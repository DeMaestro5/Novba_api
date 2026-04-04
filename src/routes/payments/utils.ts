import { Payment, InvoiceStatus } from '@prisma/client';
import { PaymentWithDetails } from '../../database/repository/PaymentRepo';
import Stripe from 'stripe';

/**
 * Format payment data for response
 */
export function getPaymentData(payment: PaymentWithDetails | Payment) {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    amount: payment.amount,
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    paidAt: payment.paidAt,
    notes: payment.notes,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    createdAt: payment.createdAt,
    // Include invoice if present
    ...(('invoice' in payment) && { invoice: payment.invoice }),
  };
}

/**
 * Determine invoice status based on payments
 */
export function calculateInvoiceStatus(
  invoiceTotal: number,
  totalPaid: number,
): InvoiceStatus {
  if (totalPaid === 0) {
    return InvoiceStatus.SENT;
  } else if (totalPaid >= invoiceTotal) {
    return InvoiceStatus.PAID;
  } else {
    return InvoiceStatus.PARTIALLY_PAID;
  }
}

/**
 * Initialize Stripe (only if API key is set)
 */
export function getStripeClient(): Stripe | null {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!stripeSecretKey) {
    return null;
  }

  return new Stripe(stripeSecretKey);
}

/**
 * Create Stripe Payment Intent
 */
export async function createStripePaymentIntent(
  amount: number,
  currency: string,
  invoiceId: string,
  customerEmail?: string,
  userId?: string,
): Promise<Stripe.PaymentIntent> {
  const stripe = getStripeClient();
  
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: currency.toLowerCase(),
    metadata: {
      invoiceId,
      ...(userId && { userId }),
    },
    receipt_email: customerEmail,
  });

  return paymentIntent;
}

/**
 * Verify Stripe webhook signature
 */
export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string,
): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe) {
    throw new Error('Stripe is not configured');
  }

  if (!webhookSecret) {
    throw new Error('Stripe webhook secret is not configured');
  }

  try {
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err: any) {
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }
}

/**
 * Generate payment link for invoice
 */
export function generatePaymentLink(
  invoiceId: string,
  paymentIntentClientSecret: string,
): string {
  const baseUrl = process.env.FRONTEND_URL || 'https://app.novba.com';
  return `${baseUrl}/pay/${invoiceId}?payment_intent_client_secret=${paymentIntentClientSecret}`;
}