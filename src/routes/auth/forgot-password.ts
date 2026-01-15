import { Request, Response, NextFunction } from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import UserRepo from '../../database/repository/UserRepo';
import schema from './schema';
import validator from '../../helpers/validator';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../../services/Email.service';
import logger from '../../core/Logger';
import { forgotPasswordLimiter } from '../../helpers/rateLimiters';

export default [
  forgotPasswordLimiter,
  validator(schema.forgotPassword),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      const genericMessage =
        "If that email is registered, we've sent a password reset link. Please check your inbox.";

      // Find user by email
      const user = await UserRepo.findByEmail(email);
      if (!user) {
        logger.info('Password reset requested for non-existent email', {
          email,
        });
        return new SuccessResponse(genericMessage, {}).send(res);
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now

      // Update user with reset token
      await UserRepo.updateInfo(user.id, {
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(resetTokenExpiry),
      });

      // Send Password reset email
      const emailSent = await sendPasswordResetEmail(
        user.email,
        user.name,
        resetToken,
      );

      if (!emailSent) {
        logger.error('Failed to send password reset email', {
          userId: user.id,
          email: user.email,
        });
      }
      new SuccessResponse(genericMessage, {}).send(res);
    } catch (error) {
      next(error);
    }
  },
];
