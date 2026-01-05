import { Request, Response, NextFunction } from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { BadRequestError } from '../../core/ApiError';
import UserRepo from '../../database/repository/UserRepo';
import schema from './schema';
import validator from '../../helpers/validator';
import bcrypt from 'bcrypt';

export default [
  validator(schema.resetPassword),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, token, password } = req.body;

      // Find user by email AND validate reset token
      const user = await UserRepo.findByEmailAndResetToken(email, token);

      if (!user) {
        throw new BadRequestError('Invalid or expired reset token');
      }

      // Check if token has expired
      if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
        throw new BadRequestError(
          'Reset token has expired. Please request a new one.',
        );
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password and clear reset token
      await UserRepo.updateInfo(user.id, {
        password: hashedPassword,
        passwordResetToken: null, // ✅ Use null, not undefined
        passwordResetExpires: null,
      });

      new SuccessResponse('Password reset successful', {}).send(res);
    } catch (error) {
      next(error);
    }
  },
];
