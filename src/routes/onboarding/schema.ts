import Joi from 'joi';
import { TOTAL_ONBOARDING_STEPS } from '../../config/onboarding';

export default {
  /**
   * Schema for completing a step
   * Validates that step is a valid number within range
   */
  completeStep: Joi.object().keys({
    step: Joi.number()
      .integer()
      .min(1) // Steps start at 1 (PROFILE_SETUP)
      .max(TOTAL_ONBOARDING_STEPS) // Can't complete beyond last step
      .required()
      .messages({
        'number.base': 'Step must be a number',
        'number.integer': 'Step must be an integer',
        'number.min': 'Step must be at least 1',
        'number.max': `Step must be at most ${TOTAL_ONBOARDING_STEPS}`,
        'any.required': 'Step is required',
      }),
  }),

  /**
   * Schema for skipping onboarding
   * No body required, but we validate it's empty or has optional reason
   */
  skip: Joi.object().keys({
    reason: Joi.string().max(500).optional().allow('').messages({
      'string.max': 'Reason must be less than 500 characters',
    }),
  }),

  /**
   * GET /status doesn't need body validation
   * But we define it for consistency (empty schema)
   */
  status: Joi.object().keys({}), // No body for GET requests
};
