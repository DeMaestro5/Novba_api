import express from 'express';
import crypto from 'crypto';
import asyncHandler from '../../helpers/asyncHandler';
import UserRepo from '../../database/repository/UserRepo';
import KeystoreRepo from '../../database/repository/KeystoreRepo';
import { createTokens } from '../../auth/authUtils';
import { RoleCode } from '../../database/types';
import Logger from '../../core/Logger';
import {
  exchangeGoogleCode,
  exchangeGitHubCode,
  OAuthProfile,
} from '../../services/OAuth.service';
import { oauthLimiter } from '../../helpers/rateLimiters';

const router = express.Router();

// ── SHARED OAUTH HANDLER ──────────────────────────────────────────────────────

/**
 * Core logic shared by both Google and GitHub callbacks.
 * Find-or-create user, issue JWT tokens, redirect to frontend.
 */
async function handleOAuthCallback(
  res: express.Response,
  profile: OAuthProfile,
) {
  const FRONTEND_REDIRECT =
    process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000';

  try {
    // 1. Check if user already exists by email
    let user = await UserRepo.findByEmail(profile.email);

    if (user) {
      // Existing user — update profile pic if they don't have one
      if (!user.profilePicUrl && profile.profilePicUrl) {
        await UserRepo.updateInfo(user.id, {
          profilePicUrl: profile.profilePicUrl,
        });
      }

      // If existing user has unverified email, auto-verify them
      if (!user.verified) {
        await UserRepo.verifyEmail(user.id);
        user = (await UserRepo.findByEmail(profile.email)) ?? user;
      }
    } else {
      // New user — create account (auto-verified, no password)
      user = await UserRepo.create(
        {
          name: profile.name,
          email: profile.email,
          profilePicUrl: profile.profilePicUrl,
          password: undefined,
          firstName: profile.firstName,
          lastName: profile.lastName,
          verified: true,
        },
        RoleCode.USER,
      );

      Logger.info(
        `New OAuth user created: ${profile.email} via ${profile.provider}`,
      );
    }

    // 2. Issue JWT tokens — same as email/password login
    const accessTokenKey = crypto.randomBytes(64).toString('hex');
    const refreshTokenKey = crypto.randomBytes(64).toString('hex');

    await KeystoreRepo.create(user.id, accessTokenKey, refreshTokenKey);
    const tokens = await createTokens(user, accessTokenKey, refreshTokenKey);

    // 3. Determine redirect destination (strict === true so false/null/undefined → /onboarding)
    const destination = user.onboardingCompleted === true ? '/dashboard' : '/onboarding';
    Logger.info(`OAuth destination for ${profile.email}: ${destination} (onboardingCompleted=${user.onboardingCompleted})`);

    // 4. Redirect to frontend with tokens in query params
    const redirectUrl = `${process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000'}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&destination=${encodeURIComponent(destination)}`;

    return res.redirect(redirectUrl);
  } catch (err) {
    Logger.error('OAuth handleOAuthCallback error', err);
    const errorUrl = new URL(`${FRONTEND_REDIRECT}/login`);
    errorUrl.searchParams.set('error', 'oauth_failed');
    return res.redirect(errorUrl.toString());
  }
}

// ── GOOGLE ROUTES ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/oauth/google
 * Frontend redirects user here to initiate Google OAuth.
 */
router.get('/google', oauthLimiter, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.SERVER_URL}/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

/**
 * GET /api/v1/auth/oauth/google/callback
 * Google redirects here with ?code= after user consents.
 */
router.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error || !code) {
      const FRONTEND_REDIRECT =
        process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${FRONTEND_REDIRECT}/login?error=oauth_cancelled`);
    }

    const profile = await exchangeGoogleCode(code);
    return handleOAuthCallback(res, profile);
  }),
);

// ── GITHUB ROUTES ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/oauth/github
 * Frontend redirects user here to initiate GitHub OAuth.
 */
router.get('/github', oauthLimiter, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.SERVER_URL}/auth/oauth/github/callback`,
    scope: 'read:user user:email',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

/**
 * GET /api/v1/auth/oauth/github/callback
 * GitHub redirects here with ?code= after user authorizes.
 */
router.get(
  '/github/callback',
  asyncHandler(async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;

    if (error || !code) {
      const FRONTEND_REDIRECT =
        process.env.OAUTH_REDIRECT_BASE_URL || 'http://localhost:3000';
      return res.redirect(`${FRONTEND_REDIRECT}/login?error=oauth_cancelled`);
    }

    const profile = await exchangeGitHubCode(code);
    return handleOAuthCallback(res, profile);
  }),
);

export default router;
