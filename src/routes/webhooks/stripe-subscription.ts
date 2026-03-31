import express from 'express';
import Stripe from 'stripe';
import SubscriptionRepo from '../../database/repository/SubscriptionRepo';
import prisma from '../../database';
import { mapStripeStatus } from '../subscription/utils';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

const router = express.Router();

/**
 * POST /api/v1/webhooks/stripe-subscription
 * Handle Stripe subscription webhook events
 */
router.post(
  '/stripe-subscription',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret =
      process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET ||
      process.env.STRIPE_WEBHOOK_SECRET;

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
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSessionCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;

        case 'customer.subscription.created':
          await handleSubscriptionCreated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(
            event.data.object as Stripe.Subscription,
          );
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.trial_will_end':
          await handleTrialWillEnd(event.data.object as Stripe.Subscription);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).send('Webhook processing failed');
    }
  },
);

/**
 * Handle checkout.session.completed
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
) {
  console.log('Processing checkout.session.completed:', session.id);

  const userId = session.metadata?.userId || session.client_reference_id;
  const tier = session.metadata?.tier as SubscriptionTier;

  if (!userId) {
    console.error('No userId found in checkout session');
    return;
  }

  if (session.customer && typeof session.customer === 'string') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        stripeCustomerId: session.customer,
      },
    });
  }

  console.log(`Checkout completed for user ${userId}, tier ${tier}`);
}

/**
 * Handle customer.subscription.created
 */
async function handleSubscriptionCreated(sub: Stripe.Subscription) {
  console.log('Processing subscription.created:', sub.id);

  const userId = sub.metadata?.userId;
  const tier = (sub.metadata?.tier as SubscriptionTier) || 'PRO';

  if (!userId) {
    console.error('No userId found in subscription metadata');
    return;
  }

  const status = mapStripeStatus(sub.status);

  // ✅ FIX: Cast to any to access Stripe properties
  const subAny = sub as any;
  const currentPeriodStart = new Date(subAny.current_period_start * 1000);
  const currentPeriodEnd = new Date(subAny.current_period_end * 1000);

  await SubscriptionRepo.create({
    userId,
    stripeSubscriptionId: sub.id,
    tier,
    status,
    currentPeriodStart,
    currentPeriodEnd,
  });

  const trialEnd = subAny.trial_end ? new Date(subAny.trial_end * 1000) : null;

  await SubscriptionRepo.updateUserSubscription(userId, tier, status, trialEnd);

  console.log(`Subscription created for user ${userId}: ${tier} - ${status}`);
}

/**
 * Handle customer.subscription.updated
 */
async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  console.log('Processing subscription.updated:', sub.id);

  const existingSubscription = await SubscriptionRepo.findByStripeId(sub.id);

  if (!existingSubscription) {
    console.error(`Subscription ${sub.id} not found in database`);
    return;
  }

  const status = mapStripeStatus(sub.status);

  // ✅ FIX: Cast to any to access Stripe properties
  const subAny = sub as any;
  const currentPeriodStart = new Date(subAny.current_period_start * 1000);
  const currentPeriodEnd = new Date(subAny.current_period_end * 1000);

  await SubscriptionRepo.updateByStripeId(sub.id, {
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subAny.cancel_at_period_end || false,
  });

  const trialEnd = subAny.trial_end ? new Date(subAny.trial_end * 1000) : null;

  await SubscriptionRepo.updateUserSubscription(
    existingSubscription.userId,
    existingSubscription.tier,
    status,
    trialEnd,
  );

  console.log(`Subscription updated: ${sub.id} - ${status}`);
}

/**
 * Handle customer.subscription.deleted
 */
async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  console.log('Processing subscription.deleted:', sub.id);

  const existingSubscription = await SubscriptionRepo.findByStripeId(sub.id);

  if (!existingSubscription) {
    console.error(`Subscription ${sub.id} not found in database`);
    return;
  }

  await SubscriptionRepo.updateByStripeId(sub.id, {
    status: 'CANCELLED' as SubscriptionStatus,
  });

  await SubscriptionRepo.updateUserSubscription(
    existingSubscription.userId,
    'FREE' as SubscriptionTier,
    'CANCELLED' as SubscriptionStatus,
    null,
  );

  console.log(`Subscription cancelled for user ${existingSubscription.userId}`);
}

/**
 * Handle invoice.paid
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log('Processing invoice.paid:', invoice.id);

  // ✅ FIX: Cast to any to access Stripe properties
  const invoiceAny = invoice as any;
  const subscriptionId =
    typeof invoiceAny.subscription === 'string'
      ? invoiceAny.subscription
      : invoiceAny.subscription?.id;

  if (!subscriptionId) {
    console.log('Invoice is not related to a subscription');
    return;
  }

  const subscription = await SubscriptionRepo.findByStripeId(subscriptionId);

  if (!subscription) {
    console.error(`Subscription ${subscriptionId} not found`);
    return;
  }

  await SubscriptionRepo.updateByStripeId(subscriptionId, {
    status: 'ACTIVE' as SubscriptionStatus,
  });

  await SubscriptionRepo.updateUserSubscription(
    subscription.userId,
    subscription.tier,
    'ACTIVE' as SubscriptionStatus,
    null,
  );

  console.log(`Payment successful for subscription ${subscriptionId}`);
}

/**
 * Handle invoice.payment_failed
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);

  // ✅ FIX: Cast to any to access Stripe properties
  const invoiceAny = invoice as any;
  const subscriptionId =
    typeof invoiceAny.subscription === 'string'
      ? invoiceAny.subscription
      : invoiceAny.subscription?.id;

  if (!subscriptionId) {
    console.log('Invoice is not related to a subscription');
    return;
  }

  const subscription = await SubscriptionRepo.findByStripeId(subscriptionId);

  if (!subscription) {
    console.error(`Subscription ${subscriptionId} not found`);
    return;
  }

  await SubscriptionRepo.updateByStripeId(subscriptionId, {
    status: 'PAST_DUE' as SubscriptionStatus,
  });

  await SubscriptionRepo.updateUserSubscription(
    subscription.userId,
    subscription.tier,
    'PAST_DUE' as SubscriptionStatus,
    null,
  );

  console.log(`Payment failed for subscription ${subscriptionId}`);
}

/**
 * Handle customer.subscription.trial_will_end
 */
async function handleTrialWillEnd(sub: Stripe.Subscription) {
  console.log('Processing trial_will_end:', sub.id);

  const existingSubscription = await SubscriptionRepo.findByStripeId(sub.id);

  if (!existingSubscription) {
    console.error(`Subscription ${sub.id} not found`);
    return;
  }

  console.log(`Trial ending soon for user ${existingSubscription.userId}`);
}

export default router;
