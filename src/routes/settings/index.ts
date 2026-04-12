import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { CacheService } from '../../cache/CacheService';
import { CacheKeys, TTL } from '../../cache/keys';
import SettingsRepo from '../../database/repository/SettingsRepo';
import ReminderRepo from '../../database/repository/ReminderRepo';
import { BadRequestError, NotFoundError } from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import {
  formatSettings,
  createStripeConnectAccount,
  createStripeConnectLink,
  getStripeAccountStatus,
  disconnectStripeAccount,
} from './utils';
import { ProtectedRequest } from '../../types/app-request';
import authentication from '../../auth/authentication';
import prisma from '../../database';

const router = express.Router();

/*---------------------------------------------------------*/
// All routes require authentication
router.use(authentication);
/*---------------------------------------------------------*/

/**
 * GET /api/v1/settings/profile
 * Get all user settings
 */
router.get(
  '/profile',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const userId = req.user.id;

    const cacheKey = CacheKeys.settingsProfile(userId);
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return new SuccessResponse(
        'Settings fetched successfully',
        cached as object,
      ).send(res);
    }

    const settings = await SettingsRepo.getAllSettings(userId);

    if (!settings) {
      throw new NotFoundError('Settings not found');
    }

    const payload = { settings: formatSettings(settings) };
    await CacheService.set(cacheKey, payload, TTL.SETTINGS);

    new SuccessResponse('Settings fetched successfully', payload).send(res);
  }),
);

/**
 * PUT /api/v1/settings/profile
 * Update profile settings
 */
router.put(
  '/profile',
  validator(schema.profile),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const updatedSettings = await SettingsRepo.updateProfileSettings(
      req.user.id,
      req.body,
    );

    // Sync portfolio fields back to User table so public portfolio
    // lookup at GET /p/:slug works correctly
    const userSyncData: Record<string, unknown> = {};

    if (req.body.portfolioSlug !== undefined) {
      userSyncData.portfolioSlug = req.body.portfolioSlug
        ? req.body.portfolioSlug.toLowerCase().trim()
        : null;
    }
    if (req.body.portfolioTitle !== undefined) {
      userSyncData.portfolioTitle = req.body.portfolioTitle ?? null;
    }
    if (req.body.portfolioBio !== undefined) {
      userSyncData.portfolioBio = req.body.portfolioBio ?? null;
    }
    if (req.body.portfolioLocation !== undefined) {
      userSyncData.portfolioLocation = req.body.portfolioLocation ?? null;
    }
    if (req.body.isAvailable !== undefined) {
      userSyncData.isAvailable = req.body.isAvailable;
    }
    if (req.body.linkedinUrl !== undefined) {
      userSyncData.linkedinUrl = req.body.linkedinUrl ?? null;
    }
    if (req.body.twitterUrl !== undefined) {
      userSyncData.twitterUrl = req.body.twitterUrl ?? null;
    }
    if (req.body.githubUrl !== undefined) {
      userSyncData.githubUrl = req.body.githubUrl ?? null;
    }

    if (Object.keys(userSyncData).length > 0) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: userSyncData,
      });
    }

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Profile settings updated successfully', {
      settings: updatedSettings,
    }).send(res);
  }),
);

/**
 * PUT /api/v1/settings/business
 * Update business settings
 */
router.put(
  '/business',
  validator(schema.business),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const updatedSettings = await SettingsRepo.updateBusinessSettings(
      req.user.id,
      req.body,
    );

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Business settings updated successfully', {
      settings: updatedSettings,
    }).send(res);
  }),
);

/**
 * PUT /api/v1/settings/invoice-defaults
 * Update invoice default settings
 */
router.put(
  '/invoice-defaults',
  validator(schema.invoiceDefaults),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const updatedSettings = await SettingsRepo.updateInvoiceDefaults(
      req.user.id,
      req.body,
    );

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Invoice defaults updated successfully', {
      settings: updatedSettings,
    }).send(res);
  }),
);

/**
 * POST /api/v1/settings/logo
 * Upload/Update business logo
 */
router.post(
  '/logo',
  validator(schema.logo),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const updatedSettings = await SettingsRepo.updateLogo(
      req.user.id,
      req.body.logoUrl,
    );

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Logo updated successfully', {
      businessLogo: updatedSettings.businessLogo,
    }).send(res);
  }),
);

/**
 * DELETE /api/v1/settings/logo
 * Delete business logo
 */
router.delete(
  '/logo',
  asyncHandler(async (req: ProtectedRequest, res) => {
    await SettingsRepo.deleteLogo(req.user.id);

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Logo deleted successfully', {
      businessLogo: null,
    }).send(res);
  }),
);

/**
 * GET /api/v1/settings/stripe/connect-url
 * Get Stripe Connect onboarding URL
 */
router.get(
  '/stripe/connect-url',
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Get user's current Stripe settings
    const stripeSettings = await SettingsRepo.getStripeSettings(req.user.id);

    console.log(stripeSettings);

    let accountId = stripeSettings?.stripeAccountId;

    // If no Stripe account exists, create one
    if (!accountId) {
      const profileSettings = await SettingsRepo.getProfileSettings(
        req.user.id,
      );
      const businessSettings = await SettingsRepo.getBusinessSettings(
        req.user.id,
      );

      accountId = await createStripeConnectAccount(
        profileSettings?.email || '',
        businessSettings?.businessName || undefined,
      );

      // Save the account ID
      await SettingsRepo.updateStripeSettings(req.user.id, {
        stripeAccountId: accountId,
        stripeAccountStatus: 'pending',
      });
    }

    // Create account link for onboarding
    const connectUrl = await createStripeConnectLink(accountId);
    console.log('ConnectUrl', connectUrl);

    new SuccessResponse('Stripe Connect URL generated successfully', {
      url: connectUrl,
      accountId,
    }).send(res);
  }),
);

/**
 * POST /api/v1/settings/stripe/complete
 * Complete Stripe Connect setup (called after user returns from Stripe)
 */
router.post(
  '/stripe/complete',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const stripeSettings = await SettingsRepo.getStripeSettings(req.user.id);

    if (!stripeSettings?.stripeAccountId) {
      throw new BadRequestError('No Stripe account found');
    }

    // Get account status from Stripe
    const accountStatus = await getStripeAccountStatus(
      stripeSettings.stripeAccountId,
    );

    // Update settings with account status
    await SettingsRepo.updateStripeSettings(req.user.id, {
      stripeOnboardingComplete: accountStatus.detailsSubmitted,
      stripeChargesEnabled: accountStatus.chargesEnabled,
      stripePayoutsEnabled: accountStatus.payoutsEnabled,
      stripeAccountStatus: accountStatus.chargesEnabled ? 'active' : 'pending',
      stripeConnectedAt: accountStatus.detailsSubmitted
        ? new Date()
        : undefined,
    });

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Stripe Connect setup completed', {
      onboardingComplete: accountStatus.detailsSubmitted,
      chargesEnabled: accountStatus.chargesEnabled,
      payoutsEnabled: accountStatus.payoutsEnabled,
    }).send(res);
  }),
);

/**
 * POST /api/v1/settings/stripe/disconnect
 * Disconnect Stripe account
 */
router.post(
  '/stripe/disconnect',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const stripeSettings = await SettingsRepo.getStripeSettings(req.user.id);

    if (!stripeSettings?.stripeAccountId) {
      throw new BadRequestError('No Stripe account connected');
    }

    // Disconnect from Stripe
    try {
      await disconnectStripeAccount(stripeSettings.stripeAccountId);
    } catch (error) {
      // Continue even if Stripe API fails (account might already be deleted)
      console.error('Error disconnecting Stripe account:', error);
    }

    // Remove Stripe settings from database
    await SettingsRepo.disconnectStripe(req.user.id);

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Stripe account disconnected successfully', {
      disconnected: true,
    }).send(res);
  }),
);

/**
 * GET /settings/reminders
 * Get user reminder settings
 */
router.get(
  '/reminders',
  asyncHandler(async (req: ProtectedRequest, res) => {
    let settings = await ReminderRepo.findByUserId(req.user.id);

    // Return defaults if not configured yet
    if (!settings) {
      settings = await ReminderRepo.upsert(req.user.id, {});
    }

    new SuccessResponse('Reminder settings fetched', {
      reminders: {
        enabled: settings.enabled,
        beforeDueDays: settings.beforeDueDays,
        afterDueDays: settings.afterDueDays,
        userConfigured: settings.userConfigured,
      },
    }).send(res);
  }),
);

/**
 * PUT /settings/reminders
 * Update reminder settings
 */
router.put(
  '/reminders',
  validator(schema.reminders),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const settings = await ReminderRepo.upsert(req.user.id, {
      enabled: req.body.enabled,
      beforeDueDays: req.body.beforeDueDays,
      afterDueDays: req.body.afterDueDays,
      userConfigured: true,
    });

    await CacheService.invalidatePattern(
      CacheKeys.userSettingsPattern(req.user.id),
    );

    new SuccessResponse('Reminder settings updated', {
      reminders: {
        enabled: settings.enabled,
        beforeDueDays: settings.beforeDueDays,
        afterDueDays: settings.afterDueDays,
        userConfigured: settings.userConfigured,
      },
    }).send(res);
  }),
);

export default router;
