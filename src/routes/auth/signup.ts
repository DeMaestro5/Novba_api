import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { RoleRequest } from 'app-request';
import crypto from 'crypto';
import UserRepo from '../../database/repository/UserRepo';
import { BadRequestError } from '../../core/ApiError';
import { createTokens } from '../../auth/authUtils';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import bcrypt from 'bcrypt';
import logger from '../../core/Logger';
import { RoleCode } from '../../database/types';
import { getUserData } from './utils';
import KeystoreRepo from '../../database/repository/KeystoreRepo';
import {
  generateTokenExpiry,
  generateVerificationToken,
} from '../../core/token';
import { sendVerificationEmail } from '../../services/Email.service';
import { signupLimiter } from '../../helpers/rateLimiters';

const router = express.Router();

router.post(
  '/',
  signupLimiter,
  validator(schema.signup),
  asyncHandler(async (req: RoleRequest, res) => {
    const user = await UserRepo.findByEmail(req.body.email);
    if (user) throw new BadRequestError('User already registered');

    const passwordHash = await bcrypt.hash(req.body.password, 10);
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = generateTokenExpiry(24);

    const fullName: string = (req.body.name ?? '').trim();
    const spaceIndex = fullName.indexOf(' ');
    const firstName =
      spaceIndex > -1 ? fullName.slice(0, spaceIndex) : fullName;
    const lastName =
      spaceIndex > -1 ? fullName.slice(spaceIndex + 1).trim() || null : null;

    const rawName = req.body.name ?? req.body.email.split('@')[0];
    const autoSlug =
      rawName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Math.random().toString(36).slice(2, 6);

    // UserRepo.create returns UserWithRoles (includes roles)
    const createdUser = await UserRepo.create(
      {
        name: fullName,
        firstName,
        lastName: lastName ?? undefined,
        email: req.body.email,
        profilePicUrl: req.body.profilePicUrl,
        password: passwordHash,
        portfolioSlug: autoSlug,
      } as any,
      RoleCode.USER,
    );

    // Grant lifetime Pro access to first 100 founding members
    const foundingCount = await UserRepo.countFoundingMembers();
    const isFoundingMember = foundingCount < 100;

    if (isFoundingMember) {
      await UserRepo.updateInfo(createdUser.id, {
        subscriptionTier: 'PRO',
        subscriptionStatus: 'ACTIVE',
        lifetimeAccess: true,
        lifetimeAccessGrantedAt: new Date(),
      });
    }

    // Save verification token
    await UserRepo.setEmailVerificationToken(
      createdUser.email,
      verificationToken,
      verificationTokenExpiry,
    );

    //  Send verification email
    const emailSent = await sendVerificationEmail(
      createdUser.email,
      createdUser.name,
      verificationToken,
    );

    if (!emailSent) {
      logger.error('Failed to send verification email during signup', {
        userId: createdUser.id,
        email: createdUser.email,
      });
    }

    new SuccessResponse(
      'Registration successful! Please check your email to verify your account.',
      {
        email: createdUser.email,
        verified: false,
        isFoundingMember,
      },
    ).send(res);
  }),
);

router.post(
  '/admin',
  validator(schema.signup),
  asyncHandler(async (req: RoleRequest, res) => {
    const admin = await UserRepo.findByEmail(req.body.email);
    if (admin) throw new BadRequestError('Admin already registered');

    const accessTokenKey = crypto.randomBytes(64).toString('hex');
    const refreshTokenKey = crypto.randomBytes(64).toString('hex');
    const passwordHash = await bcrypt.hash(req.body.password, 10);

    const fullNameAdmin: string = (req.body.name ?? '').trim();
    const spaceIndexAdmin = fullNameAdmin.indexOf(' ');
    const firstNameAdmin =
      spaceIndexAdmin > -1
        ? fullNameAdmin.slice(0, spaceIndexAdmin)
        : fullNameAdmin;
    const lastNameAdmin =
      spaceIndexAdmin > -1
        ? fullNameAdmin.slice(spaceIndexAdmin + 1).trim() || null
        : null;

    const rawName = req.body.name ?? req.body.email.split('@')[0];
    const autoSlug =
      rawName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') +
      '-' +
      Math.random().toString(36).slice(2, 6);

    const createdAdmin = await UserRepo.create(
      {
        name: fullNameAdmin,
        firstName: firstNameAdmin,
        lastName: lastNameAdmin ?? undefined,
        email: req.body.email,
        profilePicUrl: req.body.profilePicUrl,
        password: passwordHash,
        portfolioSlug: autoSlug,
      } as any,
      RoleCode.ADMIN,
    );

    const keystore = await KeystoreRepo.create(
      createdAdmin.id,
      accessTokenKey,
      refreshTokenKey,
    );

    const tokens = await createTokens(
      createdAdmin,
      keystore.primaryKey,
      keystore.secondaryKey,
    );
    const adminData = await getUserData(createdAdmin);

    new SuccessResponse('Admin Signup Successful', {
      admin: adminData,
      tokens: tokens,
    }).send(res);
  }),
);

export default router;
