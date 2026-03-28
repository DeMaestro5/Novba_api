import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { CacheService } from '../../cache/CacheService';
import { CacheKeys, TTL } from '../../cache/keys';
import ProposalRepo from '../../database/repository/ProposalRepo';
import ClientRepo from '../../database/repository/ClientRepo';
import {
  BadRequestError,
  InternalError,
  NotFoundError,
} from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  getProposalData,
  calculateTotal,
  generateProposalHTML,
} from './utils';
import ContractRepo from '../../database/repository/ContractRepo';
import { getContractData, contractTemplates } from '../contracts/utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import { EmailStatus, EmailType, ProposalStatus } from '@prisma/client';
import UserRepo from '../../database/repository/UserRepo';
import { checkUsageLimit } from '../../middleware/subscription-check';
import { generatePdf } from '../../services/pdf';
import { sendEmail } from '../../services/Email.service';
import { logEmail } from '../../services/emailLog';
import prisma from '../../database';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/proposals
 * Get all proposals for authenticated user with pagination
 */
router.get(
  '/',
  validator(schema.pagination),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as ProposalStatus) || undefined;
    const search = (req.query.search as string) || undefined;

    const cacheKey = CacheKeys.proposalList(userId, page, limit, status || '');
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Proposals fetched successfully', cached as object).send(res);
    }

    const skip = (page - 1) * limit;

    const [proposals, total] = await Promise.all([
      ProposalRepo.findAllByUser(userId, skip, limit, status, search),
      ProposalRepo.countByUser(userId, status, search),
    ]);

    const totalPages = Math.ceil(total / limit);

    const payload = {
      proposals: proposals.map(getProposalData),
      pagination: { page, limit, total, totalPages },
    };
    await CacheService.set(cacheKey, payload, TTL.LIST);

    new SuccessResponse('Proposals fetched successfully', payload).send(res);
  }),
);

/**
 * POST /api/v1/proposals
 * Create new proposal
 */
router.post(
  '/',
  checkUsageLimit('proposals'),
  validator(schema.create),
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Verify client belongs to user
    const clientExists = await ClientRepo.existsForUser(
      req.body.clientId,
      req.user.id,
    );
    if (!clientExists) {
      throw new BadRequestError('Client not found or does not belong to you');
    }

    // Calculate total from line items
    const totalAmount = calculateTotal(req.body.lineItems);

    // Generate proposal number
    const proposalNumber = await ProposalRepo.generateProposalNumber(
      req.user.id,
    );

    const proposal = await ProposalRepo.create({
      userId: req.user.id,
      clientId: req.body.clientId,
      proposalNumber,
      title: req.body.title,
      scope: req.body.scope,
      deliverables: req.body.deliverables,
      timeline: req.body.timeline,
      terms: req.body.terms,
      totalAmount,
      currency: req.body.currency || 'USD',
      validUntil: req.body.validUntil,
      lineItems: req.body.lineItems,
    });

    await CacheService.invalidatePattern(CacheKeys.userProposalsPattern(req.user.id));

    new SuccessResponse('Proposal created successfully', {
      proposal: getProposalData(proposal),
    }).send(res);
  }),
);

/**
 * GET /api/v1/proposals/stats
 * Get proposal stats for authenticated user
 */
router.get(
  '/stats',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;

    const grouped = await prisma.proposal.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const totalCount = grouped.reduce((s, g) => s + g._count.id, 0);

    const byStatus: Record<string, { count: number; value: number }> = {};
    for (const g of grouped) {
      byStatus[g.status] = {
        count: g._count.id,
        value: Number(g._sum.totalAmount ?? 0),
      };
    }

    const get = (status: string) =>
      byStatus[status] ?? { count: 0, value: 0 };

    const pipelineValue =
      get('SENT').value + get('VIEWED').value + get('APPROVED').value;

    new SuccessResponse('Proposal stats fetched successfully', {
      stats: {
        total: totalCount,
        pipelineValue,
        awaitingResponse: get('SENT').count + get('VIEWED').count,
        approved: {
          count: get('APPROVED').count,
          value: get('APPROVED').value,
        },
        byStatus: {
          DRAFT:    get('DRAFT'),
          SENT:     get('SENT'),
          VIEWED:   get('VIEWED'),
          APPROVED: get('APPROVED'),
          DECLINED: get('DECLINED'),
          EXPIRED:  get('EXPIRED'),
        },
      },
    }).send(res);
  }),
);

/**
 * GET /api/v1/proposals/:id
 * Get single proposal by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const proposal = await ProposalRepo.findById(req.params.id, req.user.id);

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    new SuccessResponse('Proposal fetched successfully', {
      proposal: getProposalData(proposal),
    }).send(res);
  }),
);

/**
 * PUT /api/v1/proposals/:id
 * Update proposal
 */
router.put(
  '/:id',
  validator(schema.update),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await ProposalRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Proposal not found');
    }

    // Recalculate total if line items provided
    const updateData = { ...req.body };
    if (req.body.lineItems) {
      updateData.totalAmount = calculateTotal(req.body.lineItems);
    }

    const proposal = await ProposalRepo.update(
      req.params.id,
      req.user.id,
      updateData,
    );

    await CacheService.invalidatePattern(CacheKeys.userProposalsPattern(req.user.id));

    new SuccessResponse('Proposal updated successfully', {
      proposal: getProposalData(proposal),
    }).send(res);
  }),
);

/**
 * DELETE /api/v1/proposals/:id
 * Delete proposal
 */
router.delete(
  '/:id',

  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await ProposalRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Proposal not found');
    }

    await ProposalRepo.remove(req.params.id, req.user.id);

    await CacheService.invalidatePattern(CacheKeys.userProposalsPattern(req.user.id));

    new SuccessResponse('Proposal deleted successfully', {}).send(res);
  }),
);

/**
 * POST /api/v1/proposals/:id/send
 * Mark proposal as sent and send to client
 */
router.post(
  '/:id/send',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const proposal = await ProposalRepo.findById(req.params.id, req.user.id);

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    if (proposal.status !== ProposalStatus.DRAFT) {
      throw new BadRequestError('Only draft proposals can be sent');
    }

    const clientEmail = proposal.client?.email;
    if (!clientEmail) {
      throw new BadRequestError('Client does not have an email address');
    }

    // Mark as sent
    const updatedProposal = await ProposalRepo.markAsSent(
      req.params.id,
      req.user.id,
    );

    // Generate PDF, send email, log (best-effort; document is already marked sent)
    let emailSent = false;
    let emailError: string | undefined;
    try {
    const fullUser = await UserRepo.findById(req.user.id);
    const htmlContent = generateProposalHTML(proposal, fullUser ?? req.user);
    const pdfBuffer = await generatePdf({
      html: htmlContent,
      filename: `proposal-${proposal.proposalNumber}.pdf`,
    });
    if (pdfBuffer) {
      const subject = `Proposal: ${proposal.title} – ${proposal.proposalNumber}`;
        const html = `<p>Please find the attached proposal.</p>`;
        emailSent = await sendEmail({
          to: clientEmail,
          subject,
          html,
          attachments: [
            {
              filename: `proposal-${proposal.proposalNumber}.pdf`,
              content: pdfBuffer,
            },
          ],
        });
        if (!emailSent) emailError = 'Email provider did not confirm send';
      } else {
        emailError = 'PDF generation failed';
      }
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'Send failed';
    }

    await logEmail({
      userId: req.user.id,
      recipient: clientEmail,
      subject: `Proposal: ${proposal.title} – ${proposal.proposalNumber}`,
      type: EmailType.PROPOSAL_SENT,
      status: emailSent ? EmailStatus.SENT : EmailStatus.FAILED,
      sentAt: emailSent ? new Date() : undefined,
      error: emailError ?? undefined,
    });

    await CacheService.invalidatePattern(CacheKeys.userProposalsPattern(req.user.id));

    new SuccessResponse('Proposal sent successfully', {
      proposal: getProposalData(updatedProposal),
    }).send(res);
  }),
);

/**
 * POST /api/v1/proposals/:id/duplicate
 * Duplicate an existing proposal
 */
router.post(
  '/:id/duplicate',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await ProposalRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Proposal not found');
    }

    // Generate new proposal number
    const newProposalNumber = await ProposalRepo.generateProposalNumber(
      req.user.id,
    );

    const duplicatedProposal = await ProposalRepo.duplicate(
      req.params.id,
      req.user.id,
      newProposalNumber,
    );

    await CacheService.invalidatePattern(CacheKeys.userProposalsPattern(req.user.id));

    new SuccessResponse('Proposal duplicated successfully', {
      proposal: getProposalData(duplicatedProposal),
    }).send(res);
  }),
);

/**
 * POST /api/v1/proposals/:id/convert-to-contract
 * Convert approved proposal to a contract (linked by proposalId)
 */
router.post(
  '/:id/convert-to-contract',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const proposal = await ProposalRepo.findById(req.params.id, req.user.id);

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestError(
        'Only approved proposals can be converted to contracts',
      );
    }

    const template = contractTemplates.service_agreement;
    const contract = await ContractRepo.createFromProposal(
      proposal.id,
      req.user.id,
      'service_agreement',
      template.content,
    );

    await CacheService.invalidatePattern(CacheKeys.userProposalsPattern(req.user.id));

    new SuccessResponse('Contract created successfully', {
      contract: getContractData(contract),
      proposalId: proposal.id,
    }).send(res);
  }),
);

/**
 * GET /proposals/:id/pdf
 * Return proposal as PDF (same template as email attachment; one canonical document).
 */
router.get(
  '/:id/pdf',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const proposal = await ProposalRepo.findById(req.params.id, req.user.id);

    if (!proposal) {
      throw new NotFoundError('Proposal not found');
    }

    const fullUser = await UserRepo.findById(req.user.id);
    const htmlContent = generateProposalHTML(proposal, fullUser ?? req.user);
    const pdfBuffer = await generatePdf({
      html: htmlContent,
      filename: `proposal-${proposal.proposalNumber}.pdf`,
    });

    if (!pdfBuffer) {
      throw new InternalError('Failed to generate PDF');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=proposal-${proposal.proposalNumber}.pdf`,
    );
    res.send(pdfBuffer);
  }),
);

export default router;
