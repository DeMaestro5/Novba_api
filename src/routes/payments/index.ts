import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { CacheService } from '../../cache/CacheService';
import { CacheKeys, TTL } from '../../cache/keys';
import PaymentRepo from '../../database/repository/PaymentRepo';
import InvoiceRepo from '../../database/repository/InvoicesRepo';
import {
  BadRequestError,
  NotFoundError,
} from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  getPaymentData,
  calculateInvoiceStatus,
  
} from './utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import { PaymentStatus, InvoiceStatus } from '@prisma/client';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/payments
 * Get all payments for authenticated user with pagination
 */
router.get(
  '/',
  validator(schema.pagination),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as PaymentStatus) || undefined;
    const invoiceId = (req.query.invoiceId as string) || undefined;

    const cacheKey = CacheKeys.paymentList(userId, page, limit);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Payments fetched successfully', cached as object).send(res);
    }

    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      PaymentRepo.findAllByUser(userId, skip, limit, status, invoiceId),
      PaymentRepo.countByUser(userId, status, invoiceId),
    ]);

    const totalPages = Math.ceil(total / limit);

    const payload = {
      payments: payments.map(getPaymentData),
      pagination: { page, limit, total, totalPages },
    };
    await CacheService.set(cacheKey, payload, TTL.LIST);

    new SuccessResponse('Payments fetched successfully', payload).send(res);
  }),
);

/**
 * POST /api/v1/payments
 * Record a manual payment (cash, bank transfer, etc.)
 */
router.post(
  '/',
  validator(schema.create),
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Verify invoice belongs to user
    const invoice = await InvoiceRepo.findById(req.body.invoiceId, req.user.id);
    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Check if invoice is already fully paid
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError('Invoice is already fully paid');
    }

    // Check if invoice is cancelled
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestError('Cannot add payment to cancelled invoice');
    }

    // Validate payment amount doesn't exceed invoice total
    const totalPaid = await PaymentRepo.getTotalPaidForInvoice(req.body.invoiceId);
    const remainingAmount = Number(invoice.total) - totalPaid;

    if (req.body.amount > remainingAmount) {
      throw new BadRequestError(
        `Payment amount ($${req.body.amount}) exceeds remaining balance ($${remainingAmount})`,
      );
    }

    // Convert date if provided
    const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();

    // Create payment
    const payment = await PaymentRepo.create({
      invoiceId: req.body.invoiceId,
      userId: req.user.id,
      amount: req.body.amount,
      currency: req.body.currency || invoice.currency,
      paymentMethod: req.body.paymentMethod,
      status: PaymentStatus.COMPLETED,
      paidAt,
      notes: req.body.notes,
    });

    // Update invoice status
    const newTotalPaid = totalPaid + req.body.amount;
    const newInvoiceStatus = calculateInvoiceStatus(
      Number(invoice.total),
      newTotalPaid,
    );

    await InvoiceRepo.updateStatus(
      req.body.invoiceId,
      req.user.id,
      newInvoiceStatus,
      {
        paidAt: newInvoiceStatus === InvoiceStatus.PAID ? new Date() : undefined,
      },
    );

    await CacheService.invalidatePattern(CacheKeys.userPaymentsPattern(req.user.id));
    await CacheService.invalidatePattern(CacheKeys.userInvoicesPattern(req.user.id));
    await CacheService.invalidateUserDashboard(req.user.id);

    new SuccessResponse('Payment recorded successfully', {
      payment: getPaymentData(payment),
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: newInvoiceStatus,
        total: invoice.total,
        totalPaid: newTotalPaid,
        remainingBalance: Number(invoice.total) - newTotalPaid,
      },
    }).send(res);
  }),
);

/**
 * GET /api/v1/payments/:id
 * Get single payment by ID
 */
router.get(
  '/:id',
  validator(schema.paymentId),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const payment = await PaymentRepo.findById(req.params.id, req.user.id);

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    new SuccessResponse('Payment fetched successfully', {
      payment: getPaymentData(payment),
    }).send(res);
  }),
);

export default router;