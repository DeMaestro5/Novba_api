import Stripe from 'stripe';
import { SUBSCRIPTION_TIERS } from '../../config/subscription';

/**
 * Get Stripe client
 */
export function getStripeClient(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    throw new Error('Stripe secret key is not configured');
  }

  return new Stripe(stripeSecretKey);
}

/**
 * Create Stripe checkout session
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  tier: 'PRO' | 'STUDIO',
  stripeCustomerId?: string,
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient();
  const tierConfig = SUBSCRIPTION_TIERS[tier];

  if (!tierConfig.stripePriceId) {
    throw new Error(`Stripe price ID not configured for ${tier} tier`);
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: tierConfig.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/subscription/cancelled`,
    client_reference_id: userId,
    metadata: {
      userId,
      tier,
    },
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        userId,
        tier,
      },
    },
  };

  // Use existing customer or create new one
  if (stripeCustomerId) {
    sessionParams.customer = stripeCustomerId;
  } else {
    sessionParams.customer_email = email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return {
    sessionId: session.id,
    url: session.url!,
  };
}

/**
 * Create customer portal session
 */
export async function createPortalSession(
  stripeCustomerId: string,
): Promise<string> {
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/subscription`,
  });

  return session.url;
}

/**
 * Cancel subscription
 */
export async function cancelStripeSubscription(
  stripeSubscriptionId: string,
  cancelAtPeriodEnd: boolean = true,
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  if (cancelAtPeriodEnd) {
    return stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } else {
    return stripe.subscriptions.cancel(stripeSubscriptionId);
  }
}

/**
 * Resume cancelled subscription
 */
export async function resumeStripeSubscription(
  stripeSubscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Get subscription from Stripe
 */
export async function getStripeSubscription(
  stripeSubscriptionId: string,
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  return stripe.subscriptions.retrieve(stripeSubscriptionId);
}

/**
 * Map Stripe status to our status enum
 */
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): 'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING' {
  const statusMap: Record<
    Stripe.Subscription.Status,
    'ACTIVE' | 'CANCELLED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING'
  > = {
    active: 'ACTIVE',
    canceled: 'CANCELLED',
    incomplete: 'UNPAID',
    incomplete_expired: 'CANCELLED',
    past_due: 'PAST_DUE',
    trialing: 'TRIALING',
    unpaid: 'UNPAID',
    paused: 'CANCELLED',
  };

  return statusMap[stripeStatus] || 'ACTIVE';
}

/**
 * Format subscription for response
 */
export function formatSubscription(subscription: any, usage?: any) {
  const tierConfig = SUBSCRIPTION_TIERS[subscription.tier as keyof typeof SUBSCRIPTION_TIERS];

  return {
    id: subscription.id,
    tier: subscription.tier,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    pricing: {
      amount: tierConfig.price,
      currency: 'USD',
      interval: 'month',
    },
    features: tierConfig.features,
    limits: tierConfig.limits,
    usage: usage || null,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
}