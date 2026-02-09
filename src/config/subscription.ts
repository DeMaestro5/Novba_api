export const SUBSCRIPTION_TIERS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    price: 0,
    stripePriceId: null,
    features: {
      clients: 3,
      invoices: 10,
      proposals: 5,
      projects: 3,
      storage: 100, // MB
      aiInsights: false,
      portfolioItems: 3,
      customBranding: false,
      prioritySupport: false,
    },
    limits: {
      monthlyInvoices: 10,
      monthlyProposals: 5,
    },
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    price: 29, // USD per month
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    features: {
      clients: 'unlimited',
      invoices: 'unlimited',
      proposals: 'unlimited',
      projects: 'unlimited',
      storage: 10000, // 10GB
      aiInsights: true,
      portfolioItems: 'unlimited',
      customBranding: true,
      prioritySupport: true,
      stripeConnect: true,
    },
    limits: {
      monthlyInvoices: 'unlimited',
      monthlyProposals: 'unlimited',
    },
  },
  STUDIO: {
    id: 'STUDIO',
    name: 'Studio',
    price: 99, // USD per month
    stripePriceId: process.env.STRIPE_STUDIO_PRICE_ID,
    features: {
      clients: 'unlimited',
      invoices: 'unlimited',
      proposals: 'unlimited',
      projects: 'unlimited',
      storage: 50000, // 50GB
      aiInsights: true,
      portfolioItems: 'unlimited',
      customBranding: true,
      prioritySupport: true,
      stripeConnect: true,
      teamMembers: 5,
      whiteLabel: true,
      apiAccess: true,
      advancedAnalytics: true,
    },
    limits: {
      monthlyInvoices: 'unlimited',
      monthlyProposals: 'unlimited',
    },
  },
} as const;

export const TRIAL_PERIOD_DAYS = 14;

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS;

/**
 * Check if user has access to a feature
 */
export function hasFeatureAccess(
  tier: SubscriptionTier,
  feature: string,
): boolean {
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  const featureValue = tierConfig.features[feature as keyof typeof tierConfig.features];
  
  if (featureValue === 'unlimited' || featureValue === true) {
    return true;
  }
  
  return false;
}

/**
 * Check if user is within usage limits
 */
export function isWithinLimit(
  tier: SubscriptionTier,
  limitType: string,
  currentUsage: number,
): boolean {
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  const limit = tierConfig.limits[limitType as keyof typeof tierConfig.limits];
  
  if (limit === 'unlimited') {
    return true;
  }
  
  return currentUsage < (limit as number);
}

/**
 * Get readable tier name
 */
export function getTierDisplayName(tier: SubscriptionTier): string {
  return SUBSCRIPTION_TIERS[tier].name;
}

/**
 * Get tier price
 */
export function getTierPrice(tier: SubscriptionTier): number {
  return SUBSCRIPTION_TIERS[tier].price;
}