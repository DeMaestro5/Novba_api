import prisma from '../index';
import { SubscriptionTier, SubscriptionStatus } from '@prisma/client';

export interface CreateSubscriptionData {
  userId: string;
  stripeSubscriptionId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface UpdateSubscriptionData {
  tier?: SubscriptionTier;
  status?: SubscriptionStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

/**
 * Get user's active subscription
 */
async function findActiveByUserId(userId: string) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: ['ACTIVE', 'TRIALING', 'PAST_DUE'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get subscription by Stripe subscription ID
 */
async function findByStripeId(stripeSubscriptionId: string) {
  return prisma.subscription.findUnique({
    where: {
      stripeSubscriptionId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Create new subscription
 */
async function create(data: CreateSubscriptionData) {
  return prisma.subscription.create({
    data,
  });
}

/**
 * Update subscription
 */
async function updateByStripeId(
  stripeSubscriptionId: string,
  data: UpdateSubscriptionData,
) {
  return prisma.subscription.update({
    where: {
      stripeSubscriptionId,
    },
    data,
  });
}

/**
 * Update user's subscription tier and status
 */
async function updateUserSubscription(
  userId: string,
  tier: SubscriptionTier,
  status: SubscriptionStatus,
  trialEndsAt?: Date | null,
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: status,
      trialEndsAt,
    },
  });
}

/**
 * Cancel subscription at period end
 */
async function cancelAtPeriodEnd(stripeSubscriptionId: string) {
  return prisma.subscription.update({
    where: {
      stripeSubscriptionId,
    },
    data: {
      cancelAtPeriodEnd: true,
    },
  });
}

/**
 * Resume cancelled subscription
 */
async function resumeSubscription(stripeSubscriptionId: string) {
  return prisma.subscription.update({
    where: {
      stripeSubscriptionId,
    },
    data: {
      cancelAtPeriodEnd: false,
    },
  });
}

/**
 * Get usage statistics for user
 */
async function getUsageStats(userId: string) {
  const [
    clientCount,
    invoiceCount,
    proposalCount,
    projectCount,
    portfolioCount,
  ] = await Promise.all([
    prisma.client.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId } }),
    prisma.proposal.count({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
    prisma.portfolio.count({ where: { userId, deletedAt: null } }),
  ]);

  // Get monthly counts
  const currentMonth = new Date();
  currentMonth.setDate(1);
  currentMonth.setHours(0, 0, 0, 0);

  const [monthlyInvoices, monthlyProposals] = await Promise.all([
    prisma.invoice.count({
      where: {
        userId,
        createdAt: {
          gte: currentMonth,
        },
      },
    }),
    prisma.proposal.count({
      where: {
        userId,
        createdAt: {
          gte: currentMonth,
        },
      },
    }),
  ]);

  return {
    clients: clientCount,
    invoices: invoiceCount,
    proposals: proposalCount,
    projects: projectCount,
    portfolioItems: portfolioCount,
    monthly: {
      invoices: monthlyInvoices,
      proposals: monthlyProposals,
    },
  };
}

export default {
  findActiveByUserId,
  findByStripeId,
  create,
  updateByStripeId,
  updateUserSubscription,
  cancelAtPeriodEnd,
  resumeSubscription,
  getUsageStats,
};