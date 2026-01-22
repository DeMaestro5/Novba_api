import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import PaymentRepo from '../../database/repository/PaymentRepo';
import InvoiceRepo from '../../database/repository/InvoicesRepo';
import { BadRequestError } from '../../core/ApiError';
import asyncHandler from '../../helpers/asyncHandler';
import { verifyStripeWebhook } from '../payments/utils';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { calculateInvoiceStatus } from '../payments/utils';
import { InvoiceStatus } from '@prisma/client';

const router = express.Router();

/**
 * POST /api/v1/webhooks/stripe
 * Handle Stripe webhook events
 * NOTE: This route does NOT use authentication middleware
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }), // Parse raw body for signature verification
  asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature || typeof signature !== 'string') {
      throw new BadRequestError('Missing Stripe signature');
    }

    let event;
    try {
      // Verify webhook signature
      event = verifyStripeWebhook(req.body, signature);
    } catch (err: any) {
      throw new BadRequestError(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const invoiceId = paymentIntent.metadata.invoiceId;

        if (!invoiceId) {
          console.error('Payment Intent missing invoiceId in metadata');
          break;
        }

        // Check if payment already exists
        const existingPayment = await PaymentRepo.findByStripePaymentIntent(
          paymentIntent.id,
        );

        if (existingPayment) {
          console.log(`Payment already recorded: ${paymentIntent.id}`);
          break;
        }

        // Get invoice to get userId
        const invoice = await InvoiceRepo.findByIdPublic(invoiceId); 
        
        if (!invoice) {
          console.error(`Invoice not found: ${invoiceId}`);
          break;
        }

        // Create payment record
        const payment = await PaymentRepo.create({
          invoiceId,
          userId: invoice.userId,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase(),
          paymentMethod: PaymentMethod.STRIPE,
          stripePaymentIntentId: paymentIntent.id,
          status: PaymentStatus.COMPLETED,
          paidAt: new Date(),
        });

        // Update invoice status
        const totalPaid = await PaymentRepo.getTotalPaidForInvoice(invoiceId);
        const newInvoiceStatus = calculateInvoiceStatus(
          Number(invoice.total),
          totalPaid,
        );

        await InvoiceRepo.updateStatus(invoiceId, invoice.userId, newInvoiceStatus, {
          paidAt: newInvoiceStatus === InvoiceStatus.PAID ? new Date() : undefined,
        });

        console.log(`Payment recorded successfully: ${payment.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const invoiceId = paymentIntent.metadata.invoiceId;

        if (!invoiceId) {
          console.error('Payment Intent missing invoiceId in metadata');
          break;
        }

        // Find existing payment and mark as failed
        const existingPayment = await PaymentRepo.findByStripePaymentIntent(
          paymentIntent.id,
        );

        if (existingPayment) {
          await PaymentRepo.updateStatus(
            existingPayment.id,
            PaymentStatus.FAILED,
          );
        }

        console.log(`Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return 200 to acknowledge receipt of the event
    new SuccessResponse('Webhook processed successfully', {}).send(res);
  }),
);

export default router;