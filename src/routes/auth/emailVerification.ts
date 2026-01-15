import express from 'express';
import asyncHandler from '../../helpers/asyncHandler';
import UserRepo from '../../database/repository/UserRepo';
import logger from '../../core/Logger';
import { BadRequestError } from '../../core/ApiError';
import { SuccessResponse } from '../../core/ApiResponse';
import validator from '../../helpers/validator';
import schema from './schema';
import { ProtectedRequest } from '../../types/app-request';
import {
  generateTokenExpiry,
  generateVerificationToken,
} from '../../core/token';
import {
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../../services/Email.service';
import {
  resendVerificationLimiter,
  verifyEmailLimiter,
} from '../../helpers/rateLimiters';

const router = express.Router();

router.post(
  '/verify-email',
  verifyEmailLimiter,
  validator(schema.emailVerification),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { token } = req.body;

    logger.info('Email verification attempt', {
      token: token.substring(0, 10) + '...',
    });

    // 2. Find user by verification token
    const user = await UserRepo.findByEmailVerificationToken(token);

    if (!user) {
      logger.warn('Invalid or expired verification token', {
        token: token.substring(0, 10) + '...',
      });
      throw new BadRequestError(
        'Invalid or expired verification link. Please request a new one.',
      );
    }

    // 3. Check if already verified
    if (user.verified) {
      logger.info('User already verified', {
        userId: user.id,
        email: user.email,
      });

      // Not an error - just inform user
      return new SuccessResponse(
        'Email already verified. You can log in now.',
        {
          verified: true,
          email: user.email,
        },
      ).send(res);
    }

    // 4. Mark email as verified (also clears the token)
    await UserRepo.verifyEmail(user.id);

    logger.info('Email verified successfully', {
      userId: user.id,
      email: user.email,
    });

    // 5. Send welcome email (fire and forget - don't block response)
    sendWelcomeEmail(user.email, user.name || user.firstName).catch((error) => {
      // Log but don't fail the verification if welcome email fails
      logger.error('Failed to send welcome email', {
        userId: user.id,
        email: user.email,
        error,
      });
    });

    // 6. Send success response
    return new SuccessResponse(
      'Email verified successfully! You can now log in.',
      {
        verified: true,
        email: user.email,
      },
    ).send(res);
  }),
);

router.post(
  '/resend-verification',
  resendVerificationLimiter,
  validator(schema.resendVerification),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { email } = req.body;

    logger.info('Verification resend requested', { email });

    // 2. Find user by email
    const user = await UserRepo.findByEmail(email);

    // SECURITY: Always send same response, even if email doesn't exist
    // This prevents email enumeration attacks
    const successMessage =
      "If that email is registered, we've sent a verification link. Please check your inbox.";

    // If user doesn't exist, still return success (security)
    if (!user) {
      logger.info('Verification resend for non-existent email', { email });

      // Return success to prevent email enumeration
      return new SuccessResponse(successMessage, {
        email,
      }).send(res);
    }

    // If user is already verified, still return success but don't send email
    if (user.verified) {
      logger.info('Verification resend for already verified user', {
        userId: user.id,
        email,
      });

      // Return success (don't reveal user is already verified)
      return new SuccessResponse(successMessage, {
        email,
      }).send(res);
    }

    // 3. Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = generateTokenExpiry(24);

    // 4. Save token to database
    await UserRepo.setEmailVerificationToken(
      email,
      verificationToken,
      verificationTokenExpiry,
    );

    logger.info('New verification token generated', {
      userId: user.id,
      email,
    });

    // 5. Send verification email
    const emailSent = await sendVerificationEmail(
      email,
      user.name || user.firstName,
      verificationToken,
    );

    if (!emailSent) {
      // Email failed to send, but we don't tell the user
      // Instead, we log it for internal monitoring
      logger.error('Failed to send verification email', {
        userId: user.id,
        email,
      });

      // Still return success (don't leak email sending failures)
      // In production, alert ops team about email failures
    }

    // 6. Always return success response (security)
    return new SuccessResponse(successMessage, {
      email,
    }).send(res);
  }),
);

export default router;
