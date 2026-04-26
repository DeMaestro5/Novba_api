import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import asyncHandler from '../../helpers/asyncHandler';
import authentication from '../../auth/authentication';
import validator from '../../helpers/validator';
import schema from './schema';
import FeedbackRepo from '../../database/repository/FeedbackRepo';
import { ProtectedRequest } from '../../types/app-request';
import { FeedbackType } from '@prisma/client';

const router = express.Router();

router.use(authentication);

router.post(
  '/',
  validator(schema.create),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const feedback = await FeedbackRepo.create({
      userId: req.user.id,
      type: req.body.type as FeedbackType,
      rating: req.body.rating ?? undefined,
      message: req.body.message,
    });

    new SuccessResponse('Feedback submitted successfully', {
      feedback: {
        id: feedback.id,
        type: feedback.type,
        status: feedback.status,
        createdAt: feedback.createdAt,
      },
    }).send(res);
  }),
);

export default router;
