import { UserWithRoles } from '../../database/types';
import _ from 'lodash';

export enum AccessMode {
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
}

export async function getUserData(user: UserWithRoles) {
  const roles = user.roles.map((ur) => ({
    id: ur.role.id,
    code: ur.role.code,
  }));

  const data = {
    id: user.id,
    name: user.name,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    email: user.email,
    roles,
    profilePicUrl: user.profilePicUrl,
    verified: user.verified,

    // Subscription
    subscriptionTier: user.subscriptionTier,
    subscriptionStatus: user.subscriptionStatus,
    lifetimeAccess: user.lifetimeAccess ?? false,
    lifetimeAccessGrantedAt: user.lifetimeAccessGrantedAt ?? null,
    trialEndsAt: user.trialEndsAt ?? null,

    // Onboarding
    onboardingCompleted: user.onboardingCompleted,
    onboardingStep: user.onboardingStep,

    // Business profile
    businessName: user.businessName ?? null,
    businessEmail: user.businessEmail ?? null,
    businessPhone: user.businessPhone ?? null,
    businessAddress: user.businessAddress ?? null,
    businessCity: user.businessCity ?? null,
    businessState: user.businessState ?? null,
    businessZipCode: user.businessZipCode ?? null,
    businessCountry: user.businessCountry ?? null,
    businessWebsite: user.businessWebsite ?? null,
    businessLogo: user.businessLogo ?? null,

    // Freelancer profile
    industry: user.industry ?? null,
    experienceLevel: user.experienceLevel ?? null,
    averageHourlyRate: user.averageHourlyRate ?? null,

    // Portfolio
    portfolioSlug: user.portfolioSlug ?? null,
    portfolioTitle: user.portfolioTitle ?? null,
    portfolioBio: user.portfolioBio ?? null,
    portfolioAvatar: user.portfolioAvatar ?? null,
    portfolioLocation: user.portfolioLocation ?? null,
    isAvailable: user.isAvailable ?? true,
    linkedinUrl: user.linkedinUrl ?? null,
    twitterUrl: user.twitterUrl ?? null,
    githubUrl: user.githubUrl ?? null,

    // Stripe Connect
    stripeAccountStatus: user.stripeAccountStatus ?? null,
    stripeOnboardingComplete: user.stripeOnboardingComplete ?? false,
    stripeChargesEnabled: user.stripeChargesEnabled ?? false,
    stripePayoutsEnabled: user.stripePayoutsEnabled ?? false,

    // Preferences
    timezone: user.timezone ?? 'UTC',
    dateFormat: user.dateFormat ?? 'MM/DD/YYYY',
    language: user.language ?? 'en',
    defaultCurrency: user.defaultCurrency ?? 'USD',

    // Invoice defaults
    invoiceNumberPrefix: user.invoiceNumberPrefix ?? 'INV',
    defaultInvoiceNotes: user.defaultInvoiceNotes ?? null,
    defaultInvoiceTerms: user.defaultInvoiceTerms ?? null,

    // Timestamps
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt ?? null,
  };

  return data;
}
