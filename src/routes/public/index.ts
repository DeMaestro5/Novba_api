import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import UserRepo from '../../database/repository/UserRepo';
import prisma from '../../database';

const router = express.Router();

const FOUNDING_MEMBER_LIMIT = 100;

/**
 * GET /public/founding-count
 * Returns current founding member count — no auth required
 */
router.get(
  '/founding-count',
  asyncHandler(async (_req, res) => {
    const count = await UserRepo.countFoundingMembers();
    new SuccessResponse('Founding count fetched', {
      count,
      limit: FOUNDING_MEMBER_LIMIT,
      remaining: Math.max(0, FOUNDING_MEMBER_LIMIT - count),
      isOpen: count < FOUNDING_MEMBER_LIMIT,
    }).send(res);
  }),
);

/**
 * POST /public/waitlist
 * Save an email to the waitlist — no auth required
 */
router.post(
  '/waitlist',
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new SuccessResponse('Added to waitlist', {}).send(res);
    }

    try {
      await prisma.waitlistEmail.upsert({
        where: { email: email.toLowerCase().trim() },
        update: {},
        create: { email: email.toLowerCase().trim() },
      });
    } catch {
      // Silently ignore duplicates
    }

    new SuccessResponse('Added to waitlist', {}).send(res);
  }),
);

export default router;
