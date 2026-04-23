import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { CacheService } from '../../cache/CacheService';
import { CacheKeys, TTL } from '../../cache/keys';
import ContractRepo from '../../database/repository/ContractRepo';
import ClientRepo from '../../database/repository/ClientRepo';
import ProposalRepo from '../../database/repository/ProposalRepo';
import {
  BadRequestError,
  InternalError,
  NotFoundError,
} from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  getContractData,
  contractTemplates,
  generateContractHTML,
} from './utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import {
  ContractStatus,
  EmailStatus,
  EmailType,
  ProposalStatus,
} from '@prisma/client';
import { generatePdf } from '../../services/pdf';
import { sendEmail } from '../../services/Email.service';
import { logEmail } from '../../services/emailLog';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/contracts
 * Get all contracts for authenticated user with pagination
 */
router.get(
  '/',
  validator(schema.pagination),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as ContractStatus) || undefined;
    const search = (req.query.search as string) || undefined;

    const cacheKey = CacheKeys.contractList(userId, page, limit, status || '');
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Contracts fetched successfully', cached as object).send(res);
    }

    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      ContractRepo.findAllByUser(userId, skip, limit, status, search),
      ContractRepo.countByUser(userId, status, search),
    ]);

    const totalPages = Math.ceil(total / limit);

    const payload = {
      contracts: contracts.map(getContractData),
      pagination: { page, limit, total, totalPages },
    };
    await CacheService.set(cacheKey, payload, TTL.LIST);

    new SuccessResponse('Contracts fetched successfully', payload).send(res);
  }),
);

/**
 * POST /api/v1/contracts
 * Create new contract
 */
router.post(
  '/',
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

    // If proposalId provided, verify it belongs to user and client
    if (req.body.proposalId) {
      const proposal = await ProposalRepo.findById(
        req.body.proposalId,
        req.user.id,
      );
      if (!proposal) {
        throw new BadRequestError('Proposal not found');
      }
      if (proposal.clientId !== req.body.clientId) {
        throw new BadRequestError('Proposal does not belong to this client');
      }
    }

    // Generate contract number
    const contractNumber = await ContractRepo.generateContractNumber(
      req.user.id,
    );

    // FIXED: Convert date strings to Date objects
    const startDate = req.body.startDate
      ? new Date(req.body.startDate)
      : undefined;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;

    const contract = await ContractRepo.create({
      userId: req.user.id,
      clientId: req.body.clientId,
      proposalId: req.body.proposalId,
      contractNumber,
      title: req.body.title,
      templateType: req.body.templateType,
      content: req.body.content,
      terms: req.body.terms,
      startDate, // Now properly converted
      endDate, // Now properly converted
    });

    await CacheService.invalidatePattern(CacheKeys.userContractsPattern(req.user.id));

    new SuccessResponse('Contract created successfully', {
      contract: getContractData(contract),
    }).send(res);
  }),
);

/**
 * GET /api/v1/contracts/templates
 * Get available contract templates
 */
router.get(
  '/templates',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const templates = Object.entries(contractTemplates).map(
      ([key, template]) => ({
        id: key,
        name: template.name,
        description: template.description,
      }),
    );

    new SuccessResponse('Contract templates fetched successfully', {
      templates,
    }).send(res);
  }),
);

/**
 * GET /api/v1/contracts/:id
 * Get single contract by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const contract = await ContractRepo.findById(req.params.id, req.user.id);

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    new SuccessResponse('Contract fetched successfully', {
      contract: getContractData(contract),
    }).send(res);
  }),
);

/**
 * PUT /api/v1/contracts/:id
 * Update contract
 */
router.put(
  '/:id',
  validator(schema.update),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await ContractRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Contract not found');
    }

    // FIXED: Convert date strings to Date objects
    const updateData: any = { ...req.body };
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    const contract = await ContractRepo.update(
      req.params.id,
      req.user.id,
      updateData,
    );

    await CacheService.invalidatePattern(CacheKeys.userContractsPattern(req.user.id));

    new SuccessResponse('Contract updated successfully', {
      contract: getContractData(contract),
    }).send(res);
  }),
);

/**
 * DELETE /api/v1/contracts/:id
 * Delete contract
 */
router.delete(
  '/:id',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await ContractRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Contract not found');
    }

    await ContractRepo.remove(req.params.id, req.user.id);

    await CacheService.invalidatePattern(CacheKeys.userContractsPattern(req.user.id));

    new SuccessResponse('Contract deleted successfully', {}).send(res);
  }),
);

/**
 * POST /api/v1/contracts/:id/send
 * Mark contract as sent and send to client
 */
router.post(
  '/:id/send',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const contract = await ContractRepo.findById(req.params.id, req.user.id);

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestError('Only draft contracts can be sent');
    }

    const clientEmail = contract.client?.email;
    if (!clientEmail) {
      throw new BadRequestError('Client does not have an email address');
    }

    // Mark as sent
    const updatedContract = await ContractRepo.markAsSent(
      req.params.id,
      req.user.id,
    );

    let emailSent = false;
    let emailError: string | undefined;
    try {
      const htmlContent = generateContractHTML(contract, req.user);
      const pdfBuffer = await generatePdf({
        html: htmlContent,
        filename: `contract-${contract.contractNumber}.pdf`,
      });
      if (pdfBuffer) {
        const subject = `Contract: ${contract.title} – ${contract.contractNumber}`;
        const senderName = (req.user as any).businessName || req.user.name || 'Your service provider';
        const html = `
<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f9fafb;">
  <div style="background:#fff;padding:40px;border-radius:12px;border:1px solid #e5e7eb;">
    <div style="margin-bottom:28px;"><span style="font-size:22px;font-weight:900;color:#111827;">nov</span><span style="font-size:22px;font-weight:900;color:#ea580c;">ba</span></div>
    <h1 style="color:#111827;margin:0 0 8px 0;font-size:22px;">Contract: ${contract.title}</h1>
    <p style="color:#6b7280;margin:0 0 24px 0;">From ${senderName}</p>
    <p style="color:#374151;margin:0 0 16px 0;">Hi ${contract.client?.contactName || contract.client?.companyName},</p>
    <p style="color:#374151;margin:0 0 24px 0;">Please find the attached contract <strong>${contract.contractNumber}</strong> for your review and signature.</p>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0 0;border-top:1px solid #f3f4f6;padding-top:16px;">If you have any questions, reply to this email.</p>
  </div>
</body></html>`;
        emailSent = await sendEmail({
          to: clientEmail,
          subject,
          html,
          attachments: [
            {
              filename: `contract-${contract.contractNumber}.pdf`,
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
      console.error('Email send failed:', err);
      // continue — don't throw, contract status is already updated
    }

    try {
      await logEmail({
        userId: req.user.id,
        recipient: clientEmail,
        subject: `Contract: ${contract.title} – ${contract.contractNumber}`,
        type: EmailType.CONTRACT_SENT,
        status: emailSent ? EmailStatus.SENT : EmailStatus.FAILED,
        sentAt: emailSent ? new Date() : undefined,
        error: emailError ?? undefined,
      });
    } catch (logErr) {
      console.error('Email log failed:', logErr);
      // continue — logging failure must never cause a 500
    }

    await CacheService.invalidatePattern(CacheKeys.userContractsPattern(req.user.id));

    new SuccessResponse('Contract sent successfully', {
      contract: getContractData(updatedContract),
    }).send(res);
  }),
);

/**
 * POST /api/v1/contracts/:id/sign
 * Mark contract as signed (e-signature)
 */
router.post(
  '/:id/sign',
  validator(schema.sign),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const contract = await ContractRepo.findById(req.params.id, req.user.id);

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    if (contract.status === ContractStatus.SIGNED) {
      throw new BadRequestError('Contract is already signed');
    }

    if (contract.status === ContractStatus.TERMINATED) {
      throw new BadRequestError('Cannot sign a terminated contract');
    }

    const signedContract = await ContractRepo.markAsSigned(
      req.params.id,
      req.user.id,
      req.body.signatureUrl,
    );

    if (contract.proposalId) {
      await ProposalRepo.updateStatus(
        contract.proposalId,
        req.user.id,
        ProposalStatus.APPROVED,
      );
    }

    const ownerEmail = req.user.email;
    let emailSent = false;
    let emailError: string | undefined;
    if (ownerEmail) {
      try {
        const subject = `Contract signed: ${contract.title} – ${contract.contractNumber}`;
        const html = `<p>Your contract <strong>${contract.contractNumber}</strong> (${contract.title}) has been signed.</p>`;
        emailSent = await sendEmail({
          to: ownerEmail,
          subject,
          html,
        });
        if (!emailSent) emailError = 'Email provider did not confirm send';
      } catch (err) {
        emailError = err instanceof Error ? err.message : 'Send failed';
      }

      await logEmail({
        userId: req.user.id,
        recipient: ownerEmail,
        subject: `Contract signed: ${contract.title} – ${contract.contractNumber}`,
        type: EmailType.CONTRACT_SIGNED,
        status: emailSent ? EmailStatus.SENT : EmailStatus.FAILED,
        sentAt: emailSent ? new Date() : undefined,
        error: emailError ?? undefined,
      });
    }

    await CacheService.invalidatePattern(CacheKeys.userContractsPattern(req.user.id));

    new SuccessResponse('Contract signed successfully', {
      contract: getContractData(signedContract),
    }).send(res);
  }),
);

router.post(
  '/:id/duplicate',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const contract = await ContractRepo.findById(req.params.id, req.user.id);
    if (!contract) throw new NotFoundError('Contract not found');

    const newContractNumber = await ContractRepo.generateContractNumber(req.user.id);

    const duplicated = await ContractRepo.create({
      userId: req.user.id,
      clientId: contract.client.id,
      contractNumber: newContractNumber,
      title: `${contract.title} (Copy)`,
      templateType: contract.templateType,
      content: contract.content,
      terms: contract.terms ?? undefined,
      startDate: contract.startDate ?? undefined,
      endDate: contract.endDate ?? undefined,
    });

    await CacheService.invalidatePattern(
      CacheKeys.userContractsPattern(req.user.id)
    );

    new SuccessResponse('Contract duplicated successfully', {
      contract: getContractData(duplicated),
    }).send(res);
  }),
);

/**
 * GET /contracts/:id/pdf
 * Return contract as PDF (same template as email attachment; one canonical document).
 */
router.get(
  '/:id/pdf',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const contract = await ContractRepo.findById(req.params.id, req.user.id);

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    const htmlContent = generateContractHTML(contract, req.user);
    const pdfBuffer = await generatePdf({
      html: htmlContent,
      filename: `contract-${contract.contractNumber}.pdf`,
    });

    if (!pdfBuffer) {
      throw new InternalError('Failed to generate PDF');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=contract-${contract.contractNumber}.pdf`,
    );
    res.send(pdfBuffer);
  }),
);

export default router;
