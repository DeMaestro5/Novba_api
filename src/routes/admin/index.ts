import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { NotFoundError } from '../../core/ApiError';
import { CacheService } from '../../cache/CacheService';
import { TTL } from '../../cache/keys';
import asyncHandler from '../../helpers/asyncHandler';
import authentication from '../../auth/authentication';
import authorization from '../../auth/authorization';
import role from '../../helpers/role';
import { RoleCode } from '../../database/types';
import AdminRepo from '../../database/repository/AdminRepo';
import FeedbackRepo from '../../database/repository/FeedbackRepo';
import { FeedbackType, FeedbackStatus } from '@prisma/client';
import { ProtectedRequest } from '../../types/app-request';

const router = express.Router();

/*---------------------------------------------------------*/
router.use(authentication, role(RoleCode.ADMIN), authorization);
/*---------------------------------------------------------*/

const ADMIN_OVERVIEW_KEY = 'admin:overview';

router.get(
  '/overview',
  asyncHandler(async (_req: ProtectedRequest, res) => {
    const cached = await CacheService.get(ADMIN_OVERVIEW_KEY);
    if (cached) {
      return new SuccessResponse('Overview fetched successfully', cached as object).send(res);
    }

    const overview = await AdminRepo.getOverview();
    await CacheService.set(ADMIN_OVERVIEW_KEY, overview, TTL.DASHBOARD);

    new SuccessResponse('Overview fetched successfully', overview).send(res);
  }),
);

router.get(
  '/growth',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const days = parseInt(req.query.days as string) || 30;
    const growth = await AdminRepo.getUserGrowth(days);

    new SuccessResponse('User growth fetched successfully', { growth }).send(res);
  }),
);

router.get(
  '/users',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || undefined;

    const result = await AdminRepo.getUsers(page, limit, search);

    new SuccessResponse('Users fetched successfully', result).send(res);
  }),
);

router.get(
  '/users/:id',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const detail = await AdminRepo.getUserDetail(req.params.id);
    if (!detail) throw new NotFoundError('User not found');

    new SuccessResponse('User fetched successfully', detail).send(res);
  }),
);

router.get(
  '/waitlist',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await AdminRepo.getWaitlist(page, limit);

    new SuccessResponse('Waitlist fetched successfully', result).send(res);
  }),
);

router.get(
  '/feedback/stats',
  asyncHandler(async (_req: ProtectedRequest, res) => {
    const stats = await FeedbackRepo.getStats();
    new SuccessResponse('Feedback stats fetched successfully', { stats }).send(res);
  }),
);

router.get(
  '/feedback',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as FeedbackType | undefined;
    const status = req.query.status as FeedbackStatus | undefined;

    const result = await FeedbackRepo.findAll(page, limit, type, status);
    const stats = await FeedbackRepo.getStats();

    new SuccessResponse('Feedback fetched successfully', {
      feedback: result.feedback,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
      stats,
    }).send(res);
  }),
);

router.patch(
  '/feedback/:id',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { status } = req.body;

    if (!['NEW', 'READ', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const updated = await FeedbackRepo.updateStatus(req.params.id, status as FeedbackStatus);

    new SuccessResponse('Feedback updated successfully', { feedback: updated }).send(res);
  }),
);

export default router;
