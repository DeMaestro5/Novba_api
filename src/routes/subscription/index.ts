import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { CacheService } from '../../cache/CacheService';
import { CacheKeys, TTL } from '../../cache/keys';
import SubscriptionRepo from '../../database/repository/SubscriptionRepo';
import { BadRequestError, NotFoundError } from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  createCheckoutSession,
  createPortalSession,
  cancelStripeSubscription,
  resumeStripeSubscription,
  formatSubscription,
} from './utils';
import { SUBSCRIPTION_TIERS } from '../../config/subscription';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import prisma from '../../database';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/subscription
 * Get current user's subscription details
 */
router.get(
  '/',
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Get user's subscription
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id);

    // Get user's tier from User model (for free tier users)
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        stripeCustomerId: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Get usage statistics
    const usage = await SubscriptionRepo.getUsageStats(req.user.id);

    // If no active subscription, return FREE tier info
    if (!subscription) {
      const tierConfig = SUBSCRIPTION_TIERS.FREE;

      new SuccessResponse('Subscription fetched successfully', {
        subscription: {
          tier: 'FREE',
          status: user.subscriptionStatus,
          pricing: {
            amount: 0,
            currency: 'USD',
            interval: 'month',
          },
          features: tierConfig.features,
          limits: tierConfig.limits,
          usage,
          isFree: true,
          hasStripeCustomer: !!user.stripeCustomerId,
        },
        availableTiers: Object.keys(SUBSCRIPTION_TIERS).map((key) => {
          const tier = SUBSCRIPTION_TIERS[key as keyof typeof SUBSCRIPTION_TIERS];
          return {
            id: key,
            name: tier.name,
            price: tier.price,
            features: tier.features,
          };
        }),
      }).send(res);
      return;
    }

    new SuccessResponse('Subscription fetched successfully', {
      subscription: formatSubscription(subscription, usage),
      availableTiers: Object.keys(SUBSCRIPTION_TIERS).map((key) => {
        const tier = SUBSCRIPTION_TIERS[key as keyof typeof SUBSCRIPTION_TIERS];
        return {
          id: key,
          name: tier.name,
          price: tier.price,
          features: tier.features,
        };
      }),
    }).send(res);
  }),
);

/**
 * POST /api/v1/subscription/checkout
 * Create Stripe checkout session for subscription upgrade
 */
router.post(
  '/checkout',
  validator(schema.checkout),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { tier } = req.body;

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        email: true,
        stripeCustomerId: true,
        subscriptionTier: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Check if user already has this tier or higher
    if (user.subscriptionTier === tier) {
      throw new BadRequestError('You already have this subscription tier');
    }

    // Create checkout session
    const session = await createCheckoutSession(
      req.user.id,
      user.email,
      tier,
      user.stripeCustomerId || undefined,
    );

    new SuccessResponse('Checkout session created successfully', {
      sessionId: session.sessionId,
      checkoutUrl: session.url,
    }).send(res);
  }),
);

/**
 * POST /api/v1/subscription/portal
 * Create Stripe customer portal session
 */
router.post(
  '/portal',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        stripeCustomerId: true,
      },
    });

    if (!user?.stripeCustomerId) {
      throw new BadRequestError(
        'No Stripe customer found. Please subscribe to a plan first.',
      );
    }

    const portalUrl = await createPortalSession(user.stripeCustomerId);

    new SuccessResponse('Customer portal session created successfully', {
      portalUrl,
    }).send(res);
  }),
);

/**
 * POST /api/v1/subscription/cancel
 * Cancel current subscription (at period end)
 */
router.post(
  '/cancel',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id);

    if (!subscription) {
      throw new NotFoundError('No active subscription found');
    }

    if (subscription.cancelAtPeriodEnd) {
      throw new BadRequestError('Subscription is already scheduled for cancellation');
    }

    // Cancel in Stripe
    await cancelStripeSubscription(subscription.stripeSubscriptionId, true);

    // Update in database
    await SubscriptionRepo.cancelAtPeriodEnd(subscription.stripeSubscriptionId);

    await CacheService.invalidatePattern(CacheKeys.userSubscriptionPattern(req.user.id));

    new SuccessResponse('Subscription cancelled successfully', {
      message: `Your subscription will remain active until ${subscription.currentPeriodEnd}`,
      cancelAt: subscription.currentPeriodEnd,
    }).send(res);
  }),
);

/**
 * POST /api/v1/subscription/resume
 * Resume a cancelled subscription
 */
router.post(
  '/resume',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const subscription = await SubscriptionRepo.findActiveByUserId(req.user.id);

    if (!subscription) {
      throw new NotFoundError('No active subscription found');
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new BadRequestError('Subscription is not scheduled for cancellation');
    }

    // Resume in Stripe
    await resumeStripeSubscription(subscription.stripeSubscriptionId);

    // Update in database
    await SubscriptionRepo.resumeSubscription(subscription.stripeSubscriptionId);

    await CacheService.invalidatePattern(CacheKeys.userSubscriptionPattern(req.user.id));

    new SuccessResponse('Subscription resumed successfully', {
      message: 'Your subscription will continue beyond the current period',
      subscription: formatSubscription(subscription),
    }).send(res);
  }),
);

/**
 * GET /api/v1/subscription/usage
 * Get current usage statistics
 */
router.get(
  '/usage',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;

    const cacheKey = CacheKeys.subscriptionUsage(userId);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse('Usage statistics fetched successfully', cached as object).send(res);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionTier: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const usage = await SubscriptionRepo.getUsageStats(userId);
    const tierConfig = SUBSCRIPTION_TIERS[user.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS];

    // Calculate usage percentages
    const usageWithLimits = {
      clients: {
        used: usage.clients,
        limit: tierConfig.features.clients,
        percentage:
          tierConfig.features.clients === 'unlimited'
            ? 0
            : Math.round((usage.clients / (tierConfig.features.clients as number)) * 100),
      },
      invoices: {
        used: usage.invoices,
        limit: tierConfig.features.invoices,
      },
      proposals: {
        used: usage.proposals,
        limit: tierConfig.features.proposals,
      },
      projects: {
        used: usage.projects,
        limit: tierConfig.features.projects,
      },
      portfolioItems: {
        used: usage.portfolioItems,
        limit: tierConfig.features.portfolioItems,
      },
      monthly: {
        invoices: {
          used: usage.monthly.invoices,
          limit: tierConfig.limits.monthlyInvoices,
          percentage:
            tierConfig.limits.monthlyInvoices === 'unlimited'
              ? 0
              : Math.round(
                  (usage.monthly.invoices / (tierConfig.limits.monthlyInvoices as number)) * 100,
                ),
        },
        proposals: {
          used: usage.monthly.proposals,
          limit: tierConfig.limits.monthlyProposals,
          percentage:
            tierConfig.limits.monthlyProposals === 'unlimited'
              ? 0
              : Math.round(
                  (usage.monthly.proposals / (tierConfig.limits.monthlyProposals as number)) * 100,
                ),
        },
      },
    };

    const payload = {
      tier: user.subscriptionTier,
      usage: usageWithLimits,
      tierLimits: tierConfig.limits,
    };
    await CacheService.set(cacheKey, payload, TTL.SUBSCRIPTION);

    new SuccessResponse('Usage statistics fetched successfully', payload).send(res);
  }),
);

export default router;