import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import InvoiceRepo from '../../database/repository/InvoicesRepo';
import ClientRepo from '../../database/repository/ClientRepo';
import ProjectRepo from '../../database/repository/ProjectRepo';
import {
  BadRequestError,
  NotFoundError,
} from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  getInvoiceData,
  calculateInvoiceTotals,
  generateInvoiceHTML,
  calculateDaysOverdue,
} from './utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import { InvoiceStatus } from '@prisma/client';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/invoices/overdue
 * Get overdue invoices
 * IMPORTANT: Must be before /:id route
 */
router.get(
  '/overdue',
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Update overdue statuses first
    await InvoiceRepo.updateOverdueStatus(req.user.id);

    // Get all overdue invoices
    const invoices = await InvoiceRepo.findOverdue(req.user.id);

    // Add days overdue to each invoice
    const invoicesWithDays = invoices.map((invoice) => ({
      ...getInvoiceData(invoice),
      daysOverdue: calculateDaysOverdue(invoice.dueDate),
    }));

    new SuccessResponse('Overdue invoices fetched successfully', {
      invoices: invoicesWithDays,
      total: invoices.length,
    }).send(res);
  }),
);

/**
 * GET /api/v1/invoices
 * Get all invoices for authenticated user with pagination
 */
router.get(
  '/',
  validator(schema.pagination),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as InvoiceStatus) || undefined;
    const search = (req.query.search as string) || undefined;

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      InvoiceRepo.findAllByUser(req.user.id, skip, limit, status, search),
      InvoiceRepo.countByUser(req.user.id, status, search),
    ]);

    const totalPages = Math.ceil(total / limit);

    new SuccessResponse('Invoices fetched successfully', {
      invoices: invoices.map(getInvoiceData),
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
 * POST /api/v1/invoices
 * Create new invoice
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

    // If projectId provided, verify it belongs to user
    if (req.body.projectId) {
      const projectExists = await ProjectRepo.existsForUser(
        req.body.projectId,
        req.user.id,
      );
      if (!projectExists) {
        throw new BadRequestError('Project not found');
      }
    }

    // Calculate totals
    const totals = calculateInvoiceTotals(
      req.body.lineItems,
      req.body.taxRate || 0,
    );

    // Generate invoice number
    const invoiceNumber = await InvoiceRepo.generateInvoiceNumber(req.user.id);

    // Convert dates
    const issueDate = new Date(req.body.issueDate);
    const dueDate = new Date(req.body.dueDate);

    const invoice = await InvoiceRepo.create({
      userId: req.user.id,
      clientId: req.body.clientId,
      projectId: req.body.projectId,
      invoiceNumber,
      issueDate,
      dueDate,
      subtotal: totals.subtotal,
      taxRate: req.body.taxRate || 0,
      taxAmount: totals.taxAmount,
      total: totals.total,
      currency: req.body.currency || 'USD',
      notes: req.body.notes,
      terms: req.body.terms,
      lineItems: req.body.lineItems,
    });

    new SuccessResponse('Invoice created successfully', {
      invoice: getInvoiceData(invoice),
    }).send(res);
  }),
);

/**
 * GET /api/v1/invoices/:id
 * Get single invoice by ID
 */
router.get(
  '/:id',
  validator(schema.invoiceId),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const invoice = await InvoiceRepo.findById(req.params.id, req.user.id);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    new SuccessResponse('Invoice fetched successfully', {
      invoice: getInvoiceData(invoice),
    }).send(res);
  }),
);

/**
 * PUT /api/v1/invoices/:id
 * Update invoice
 */
router.put(
  '/:id',
  validator(schema.invoiceId),
  validator(schema.update),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await InvoiceRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Invoice not found');
    }

    // Recalculate totals if line items provided
    const updateData: any = { ...req.body };
    
    if (req.body.lineItems) {
      const totals = calculateInvoiceTotals(
        req.body.lineItems,
        req.body.taxRate || 0,
      );
      updateData.subtotal = totals.subtotal;
      updateData.taxAmount = totals.taxAmount;
      updateData.total = totals.total;
    }

    // Convert dates if provided
    if (updateData.issueDate) {
      updateData.issueDate = new Date(updateData.issueDate);
    }
    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    const invoice = await InvoiceRepo.update(
      req.params.id,
      req.user.id,
      updateData,
    );

    new SuccessResponse('Invoice updated successfully', {
      invoice: getInvoiceData(invoice),
    }).send(res);
  }),
);

/**
 * DELETE /api/v1/invoices/:id
 * Delete invoice
 */
router.delete(
  '/:id',
  validator(schema.invoiceId),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await InvoiceRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Invoice not found');
    }

    await InvoiceRepo.remove(req.params.id, req.user.id);

    new SuccessResponse('Invoice deleted successfully', {}).send(res);
  }),
);

/**
 * POST /api/v1/invoices/:id/send
 * Mark invoice as sent and send to client
 */
router.post(
  '/:id/send',
  validator(schema.invoiceId),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const invoice = await InvoiceRepo.findById(req.params.id, req.user.id);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestError('Only draft invoices can be sent');
    }

    if (!invoice.client.email) {
      throw new BadRequestError('Client does not have an email address');
    }

    // Mark as sent
    const updatedInvoice = await InvoiceRepo.markAsSent(
      req.params.id,
      req.user.id,
    );

    // TODO: Send email to client with invoice PDF
    // This would involve:
    // 1. Generate PDF from invoice
    // 2. Send email with attachment
    // 3. Log email in EmailLog table

    new SuccessResponse('Invoice sent successfully', {
      invoice: getInvoiceData(updatedInvoice),
    }).send(res);
  }),
);

/**
 * POST /api/v1/invoices/:id/duplicate
 * Duplicate an existing invoice
 */
router.post(
  '/:id/duplicate',
  validator(schema.invoiceId),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const exists = await InvoiceRepo.existsForUser(req.params.id, req.user.id);
    if (!exists) {
      throw new NotFoundError('Invoice not found');
    }

    // Generate new invoice number
    const newInvoiceNumber = await InvoiceRepo.generateInvoiceNumber(
      req.user.id,
    );

    // Set new dates (issue date = today, due date = 30 days from today)
    const newIssueDate = new Date();
    const newDueDate = new Date();
    newDueDate.setDate(newDueDate.getDate() + 30);

    const duplicatedInvoice = await InvoiceRepo.duplicate(
      req.params.id,
      req.user.id,
      newInvoiceNumber,
      newIssueDate,
      newDueDate,
    );

    new SuccessResponse('Invoice duplicated successfully', {
      invoice: getInvoiceData(duplicatedInvoice),
    }).send(res);
  }),
);

/**
 * PATCH /api/v1/invoices/:id/status
 * Update invoice status
 */
router.patch(
  '/:id/status',
  validator(schema.invoiceId),
  validator(schema.updateStatus),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const invoice = await InvoiceRepo.findById(req.params.id, req.user.id);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const additionalData: any = {};

    // If marking as paid, set paidAt
    if (req.body.status === InvoiceStatus.PAID) {
      additionalData.paidAt = new Date();
    }

    const updatedInvoice = await InvoiceRepo.updateStatus(
      req.params.id,
      req.user.id,
      req.body.status,
      additionalData,
    );

    new SuccessResponse('Invoice status updated successfully', {
      invoice: getInvoiceData(updatedInvoice),
    }).send(res);
  }),
);

/**
 * GET /api/v1/invoices/:id/pdf
 * Generate and download invoice as PDF
 */
router.get(
  '/:id/pdf',
  validator(schema.invoiceId),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const invoice = await InvoiceRepo.findById(req.params.id, req.user.id);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Generate HTML content
    const htmlContent = generateInvoiceHTML(invoice, req.user);

    // TODO: Convert HTML to PDF using Puppeteer or similar
    // For now, return the HTML content
    // In production, you'd use something like:
    // const pdf = await generatePDF(htmlContent);
    // res.setHeader('Content-Type', 'application/pdf');
    // res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    // res.send(pdf);

    // Temporary: Return HTML for testing
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
  }),
);

/**
 * POST /api/v1/invoices/batch-send
 * Send multiple invoices at once
 */
router.post(
  '/batch-send',
  validator(schema.batchSend),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const invoices = await InvoiceRepo.findByIds(
      req.body.invoiceIds,
      req.user.id,
    );

    if (invoices.length === 0) {
      throw new NotFoundError('No invoices found');
    }

    // Validate all invoices can be sent
    const invalidInvoices = invoices.filter(
      (inv) => inv.status !== InvoiceStatus.DRAFT || !inv.client.email,
    );

    if (invalidInvoices.length > 0) {
      throw new BadRequestError(
        `Cannot send ${invalidInvoices.length} invoice(s). They must be in DRAFT status and have client email.`,
      );
    }

    // Mark all as sent
    const sentInvoices = [];
    for (const invoice of invoices) {
      const sent = await InvoiceRepo.markAsSent(invoice.id, req.user.id);
      sentInvoices.push(sent);
      
      // TODO: Send email for each invoice
    }

    new SuccessResponse('Invoices sent successfully', {
      count: sentInvoices.length,
      invoices: sentInvoices.map(getInvoiceData),
    }).send(res);
  }),
);

export default router;