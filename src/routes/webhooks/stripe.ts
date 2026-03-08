import express from 'express';
import Stripe from 'stripe';
import PaymentRepo from '../../database/repository/PaymentRepo';
import InvoiceRepo from '../../database/repository/InvoicesRepo';

const router = express.Router();

/**
 * POST /api/v1/webhooks/stripe
 * Handle Stripe payment webhook events (existing)
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('Stripe webhook secret not configured');
      return res.status(500).send('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log('Received Stripe webhook event:', event.type);

    try {
      // Handle payment-related events
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(
            event.data.object as Stripe.PaymentIntent,
          );
          break;

        default:
          console.log(`Unhandled payment event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).send('Webhook processing failed');
    }
  },
);

async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
) {
  console.log('Processing payment_intent.succeeded:', paymentIntent.id);

  const invoiceId = paymentIntent.metadata?.invoiceId;
  const userId = paymentIntent.metadata?.userId;

  if (!invoiceId || !userId) {
    console.error('Missing invoiceId or userId in payment intent metadata');
    return;
  }

  // Create payment record
  await PaymentRepo.create({
    invoiceId,
    userId,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency.toUpperCase(),
    paymentMethod: 'STRIPE',
    stripePaymentIntentId: paymentIntent.id,
    status: 'COMPLETED',
    paidAt: new Date(),
  });

  // Update invoice status
  await InvoiceRepo.updateStatusAfterPayment(invoiceId);

  console.log(`Payment recorded for invoice ${invoiceId}`);
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment_intent.payment_failed:', paymentIntent.id);

  const invoiceId = paymentIntent.metadata?.invoiceId;
  const userId = paymentIntent.metadata?.userId;

  if (!invoiceId || !userId) {
    console.error('Missing invoiceId or userId in payment intent metadata');
    return;
  }

  // Create failed payment record
  await PaymentRepo.create({
    invoiceId,
    userId,
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency.toUpperCase(),
    paymentMethod: 'STRIPE',
    stripePaymentIntentId: paymentIntent.id,
    status: 'FAILED',
    notes: paymentIntent.last_payment_error?.message,
  });

  console.log(`Payment failed for invoice ${invoiceId}`);
}

export default router;
