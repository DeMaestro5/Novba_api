import { Request, Response, NextFunction } from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { BadRequestError } from '../../core/ApiError';
import UserRepo from '../../database/repository/UserRepo';
import schema from './schema';
import validator from '../../helpers/validator';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '../../services/Email.service';

export default [
  validator(schema.forgotPassword),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;

      // Find user by email
      const user = await UserRepo.findByEmail(email);
      if (!user) {
        throw new BadRequestError('User not found');
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
      await sendPasswordResetEmail(user.email, user.name, resetToken);
      new SuccessResponse('Password reset email sent', {}).send(res);
    } catch (error) {
      next(error);
    }
  },
];
