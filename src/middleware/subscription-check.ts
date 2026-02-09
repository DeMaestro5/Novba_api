// middleware/subscriptionCheck.ts
import { Response, NextFunction } from 'express';
import { ProtectedRequest } from '../types/app-request';
import { BadRequestError } from '../core/ApiError';
import { SUBSCRIPTION_TIERS } from '../config/subscription';
import SubscriptionRepo from '../database/repository/SubscriptionRepo';
import prisma from '../database';

/**
 * Check if user is within usage limits
 */
export function checkUsageLimit(resourceType: 'invoices' | 'proposals' | 'clients' | 'projects' | 'portfolioItems') {
  return async (req: ProtectedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { subscriptionTier: true },
      });

      if (!user) {
        throw new BadRequestError('User not found');
      }

      const tierConfig = SUBSCRIPTION_TIERS[user.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS];

      // Check if unlimited
      const limit = tierConfig.features[resourceType];
      if (limit === 'unlimited') {
        next();
        return;
      }

      // Get current usage
      const usage = await SubscriptionRepo.getUsageStats(req.user.id);

      // Determine if this is a monthly limit or total limit
      const isMonthlyLimit = resourceType === 'invoices' || resourceType === 'proposals';

      if (isMonthlyLimit) {
        // Check monthly limit
        const currentUsage = usage.monthly[resourceType];
        const monthlyLimit = tierConfig.limits[`monthly${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}` as keyof typeof tierConfig.limits];

        if (monthlyLimit !== 'unlimited' && currentUsage >= (monthlyLimit as number)) {
          throw new BadRequestError(
            `You've reached your monthly ${resourceType} limit (${monthlyLimit}). Upgrade to Pro for unlimited ${resourceType}.`,
          );
        }
      } else {
        // Check total limit
        const currentUsage = usage[resourceType];
        const totalLimit = limit as number;

        if (currentUsage >= totalLimit) {
          throw new BadRequestError(
            `You've reached your ${resourceType} limit (${totalLimit}). Upgrade to Pro for unlimited ${resourceType}.`,
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user has access to a feature
 */
/**
 * Check if user has access to a feature
 */
export function requireFeature(feature: string) {
  return async (req: ProtectedRequest, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { subscriptionTier: true },
      });

      if (!user) {
        throw new BadRequestError('User not found');
      }

      const tierConfig = SUBSCRIPTION_TIERS[user.subscriptionTier as keyof typeof SUBSCRIPTION_TIERS];
      const hasAccess = tierConfig.features[feature as keyof typeof tierConfig.features];

      // Check if feature is disabled (false) or doesn't exist (undefined/null)
      // ✅ FIXED: Proper boolean check
      if (hasAccess === false || hasAccess === undefined || hasAccess === null) {
        throw new BadRequestError(
          `This feature requires a Pro or Studio subscription. Please upgrade your plan.`,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}