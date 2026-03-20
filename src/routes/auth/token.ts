import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import UserRepo from '../../database/repository/UserRepo';
import { AuthFailureError, TokenExpiredError } from '../../core/ApiError';
import JWT, { JwtPayload } from '../../core/JWT';
import KeystoreRepo from '../../database/repository/KeystoreRepo';
import crypto from 'crypto';
import { createTokens } from '../../auth/authUtils';
import { tokenInfo } from '../../config';
import asyncHandler from '../../helpers/asyncHandler';

const router = express.Router();

/**
 * POST /refresh
 * Accepts a refresh token in the request body.
 * Does NOT require a valid access token — that would defeat the purpose.
 * Rotates both tokens on every call (prevents replay attacks).
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AuthFailureError('Refresh token is required');
    }

    // Validate the refresh token JWT signature and expiry
    let payload: JwtPayload;
    try {
      payload = await JWT.validate(refreshToken);
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        throw new AuthFailureError('Session expired — please log in again');
      }
      throw new AuthFailureError('Invalid refresh token');
    }

    // Basic payload integrity check
    if (
      !payload.sub ||
      !payload.prm ||
      payload.iss !== tokenInfo.issuer ||
      payload.aud !== tokenInfo.audience
    ) {
      throw new AuthFailureError('Invalid refresh token payload');
    }

    // The refresh token's prm must match an active keystore entry
    const keystore = await KeystoreRepo.findForSecondaryKey(
      payload.sub,
      payload.prm,
    );
    if (!keystore) {
      throw new AuthFailureError('Session not found — please log in again');
    }

    const user = await UserRepo.findById(payload.sub);
    if (!user) throw new AuthFailureError('User not found');

    // Rotate — delete old keystore entry, create fresh one
    const newAccessTokenKey = crypto.randomBytes(64).toString('hex');
    const newRefreshTokenKey = crypto.randomBytes(64).toString('hex');

    await KeystoreRepo.remove(keystore.id);
    await KeystoreRepo.create(user.id, newAccessTokenKey, newRefreshTokenKey);

    const tokens = await createTokens(
      user,
      newAccessTokenKey,
      newRefreshTokenKey,
    );

    new SuccessResponse('Token refreshed', {
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    }).send(res);
  }),
);

export default router;
