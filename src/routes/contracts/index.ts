import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import ContractRepo from '../../database/repository/ContractRepo';
import ClientRepo from '../../database/repository/ClientRepo';
import ProposalRepo from '../../database/repository/ProposalRepo';
import { BadRequestError, NotFoundError } from '../../core/ApiError';
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
import { ContractStatus } from '@prisma/client';

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as ContractStatus) || undefined;
    const search = (req.query.search as string) || undefined;

    const skip = (page - 1) * limit;

    const [contracts, total] = await Promise.all([
      ContractRepo.findAllByUser(req.user.id, skip, limit, status, search),
      ContractRepo.countByUser(req.user.id, status, search),
    ]);

    const totalPages = Math.ceil(total / limit);

    new SuccessResponse('Contracts fetched successfully', {
      contracts: contracts.map(getContractData),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    }).send(res);
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

    // Mark as sent
    const updatedContract = await ContractRepo.markAsSent(
      req.params.id,
      req.user.id,
    );

    // TODO: Send email to client with contract PDF
    // This would involve:
    // 1. Generate PDF from contract
    // 2. Send email with attachment
    // 3. Log email in EmailLog table

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

    // Mark as signed
    const signedContract = await ContractRepo.markAsSigned(
      req.params.id,
      req.user.id,
      req.body.signatureUrl,
    );

    // TODO: Send confirmation email
    // Update proposal status to APPROVED if linked

    new SuccessResponse('Contract signed successfully', {
      contract: getContractData(signedContract),
    }).send(res);
  }),
);

/**
 * GET /api/v1/contracts/:id/pdf
 * Generate and download contract as PDF
 */
router.get(
  '/:id/pdf',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const contract = await ContractRepo.findById(req.params.id, req.user.id);

    if (!contract) {
      throw new NotFoundError('Contract not found');
    }

    // Generate HTML content
    const htmlContent = generateContractHTML(contract, req.user);

    // TODO: Convert HTML to PDF using Puppeteer or similar
    // For now, return the HTML content
    // In production, you'd use something like:
    // const pdf = await generatePDF(htmlContent);
    // res.setHeader('Content-Type', 'application/pdf');
    // res.setHeader('Content-Disposition', `attachment; filename=contract-${contract.contractNumber}.pdf`);
    // res.send(pdf);

    // Temporary: Return HTML for testing
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  }),
);

export default router;
