import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { ProtectedRequest } from '../../types/app-request';
import { BadRequestError } from '../../core/ApiError';
import UserRepo from '../../database/repository/UserRepo';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import authentication from '../../auth/authentication';
import logger from '../../core/Logger';
import getStepName from '../../helpers/getStepName';
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  getNextStep,
  isOnboardingCompleted,
} from '../../config/onboarding';

const router = express.Router();

/*-------------------------------------------------------------------------*/
router.use(authentication);
/*-------------------------------------------------------------------------*/

router.get(
  '/status',
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Get current user from authentication middleware
    const user = await UserRepo.findById(req.user.id);

    if (!user) {
      logger.error('User not found in onboarding status', {
        userId: req.user.id,
      });
      throw new BadRequestError('User not found');
    }

    const currentStep = user.onboardingStep || 0;
    const completed = user.onboardingCompleted || false;
    const isCompleted = isOnboardingCompleted(currentStep, completed);

    // Calculate progress percentage
    const progressPercentage = isCompleted
      ? 100
      : Math.round((currentStep / TOTAL_ONBOARDING_STEPS) * 100);

    // Determine next step (null if completed)
    const nextStep = isCompleted ? null : getNextStep(currentStep);

    logger.info('Onboarding status retrieved', {
      userId: user.id,
      currentStep,
      completed,
      isCompleted,
    });

    return new SuccessResponse('Onboarding status retrieved', {
      currentStep,
      completed: isCompleted,
      progressPercentage,
      nextStep,
      // Optional: Include step names for frontend
      stepName: getStepName(currentStep),
    }).send(res);
  }),
);

router.put(
  '/complete-step',
  validator(schema.completeStep),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { step } = req.body;
    const user = await UserRepo.findById(req.user.id);

    if (!user) {
      throw new BadRequestError('User not found');
    }

    const currentStep = user.onboardingStep || 0;
    const alreadyCompleted = user.onboardingCompleted || false;

    // Edge Case 1: Already completed onboarding
    if (
      alreadyCompleted ||
      isOnboardingCompleted(currentStep, alreadyCompleted)
    ) {
      logger.info(
        'Attempt to complete step when onboarding already completed',
        {
          userId: user.id,
          requestedStep: step,
          currentStep,
        },
      );

      return new SuccessResponse('Onboarding already completed', {
        currentStep,
        completed: true,
        progressPercentage: 100,
        nextStep: null,
      }).send(res);
    }

    // Edge Case 2: Trying to complete a step that's too far ahead
    // User must complete steps sequentially (can't skip from step 1 to step 4)
    if (step > currentStep + 1) {
      logger.warn('Attempt to skip onboarding steps', {
        userId: user.id,
        currentStep,
        requestedStep: step,
      });

      throw new BadRequestError(
        `Cannot skip steps. Please complete step ${currentStep + 1} first.`,
      );
    }

    // Edge Case 3: Trying to complete a step that's already been completed
    // This is allowed (idempotent), but we don't regress
    if (step <= currentStep) {
      logger.info('Step already completed (idempotent operation)', {
        userId: user.id,
        currentStep,
        requestedStep: step,
      });

      // Return current status without error (idempotent)
      const isCompleted = step >= TOTAL_ONBOARDING_STEPS;
      const nextStep = isCompleted ? null : getNextStep(step);

      return new SuccessResponse('Step already completed', {
        currentStep,
        completed: isCompleted,
        progressPercentage: Math.round(
          (currentStep / TOTAL_ONBOARDING_STEPS) * 100,
        ),
        nextStep,
      }).send(res);
    }

    // Valid step completion: advance to next step
    const newStep = step;
    const isNowCompleted = newStep >= TOTAL_ONBOARDING_STEPS;

    // Update user's onboarding progress
    await UserRepo.updateOnboarding(
      user.id,
      newStep,
      isNowCompleted, // Mark as completed if reached last step
    );

    logger.info('Onboarding step completed', {
      userId: user.id,
      previousStep: currentStep,
      newStep,
      isNowCompleted,
    });

    const nextStep = isNowCompleted ? null : getNextStep(newStep);

    return new SuccessResponse('Step completed successfully', {
      currentStep: newStep,
      completed: isNowCompleted,
      progressPercentage: Math.round((newStep / TOTAL_ONBOARDING_STEPS) * 100),
      nextStep,
      stepName: getStepName(newStep),
    }).send(res);
  }),
);

router.post(
  '/skip',
  validator(schema.skip),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const { reason } = req.body;
    const user = await UserRepo.findById(req.user.id);

    if (!user) {
      throw new BadRequestError('User not found');
    }

    const currentStep = user.onboardingStep || 0;
    const alreadyCompleted = user.onboardingCompleted || false;

    // Edge Case: Already completed
    if (
      alreadyCompleted ||
      isOnboardingCompleted(currentStep, alreadyCompleted)
    ) {
      logger.info('Attempt to skip onboarding when already completed', {
        userId: user.id,
        currentStep,
      });

      return new SuccessResponse('Onboarding already completed', {
        currentStep,
        completed: true,
        progressPercentage: 100,
        nextStep: null,
      }).send(res);
    }

    // Mark onboarding as completed (skipped)
    await UserRepo.updateOnboarding(
      user.id,
      ONBOARDING_STEPS.COMPLETED, // Set to completed step number
      true, // Mark as completed
    );

    logger.info('Onboarding skipped by user', {
      userId: user.id,
      previousStep: currentStep,
      reason: reason || 'No reason provided',
    });

    return new SuccessResponse('Onboarding skipped successfully', {
      currentStep: ONBOARDING_STEPS.COMPLETED,
      completed: true,
      progressPercentage: 100,
      nextStep: null,
    }).send(res);
  }),
);

export default router;
