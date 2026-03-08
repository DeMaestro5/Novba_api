import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import InvoiceRepo from '../../database/repository/InvoicesRepo';
import PaymentRepo from '../../database/repository/PaymentRepo';
import { BadRequestError, NotFoundError } from '../../core/ApiError';
import asyncHandler from '../../helpers/asyncHandler';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import { InvoiceStatus } from '@prisma/client';
import {
  createStripePaymentIntent,
  generatePaymentLink,
} from '../payments/utils';

const router = express.Router();

/*---------------------------------------------------------*/
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/invoices/:id/payment-link
 * Generate Stripe payment link for invoice
 */
router.get(
  '/:id/payment-link',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const invoice = await InvoiceRepo.findById(req.params.id, req.user.id);

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    // Check if invoice is already fully paid
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError('Invoice is already fully paid');
    }

    // Check if invoice is cancelled
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestError(
        'Cannot create payment link for cancelled invoice',
      );
    }

    // Calculate remaining amount
    const totalPaid = await PaymentRepo.getTotalPaidForInvoice(invoice.id);
    const remainingAmount = Number(invoice.total) - totalPaid;

    if (remainingAmount <= 0) {
      throw new BadRequestError('Invoice has no remaining balance');
    }

    try {
      // Create Stripe Payment Intent
      const paymentIntent = await createStripePaymentIntent(
        remainingAmount,
        invoice.currency,
        invoice.id,
        invoice.client.email,
      );

      // Generate payment link
      const paymentLink = generatePaymentLink(
        invoice.id,
        paymentIntent.client_secret!,
      );

      new SuccessResponse('Payment link generated successfully', {
        paymentLink,
        paymentIntentId: paymentIntent.id,
        amount: remainingAmount,
        currency: invoice.currency,
        clientSecret: paymentIntent.client_secret,
      }).send(res);
    } catch (error: any) {
      throw new BadRequestError(
        error.message || 'Failed to create payment link',
      );
    }
  }),
);

export default router;
