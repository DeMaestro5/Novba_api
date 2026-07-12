import Joi from 'joi';

const rateBlockSchema = Joi.object({
  min: Joi.number().positive().required(),
  median: Joi.number().positive().required(),
  max: Joi.number().positive().required(),
  context: Joi.string().required(),
});

export const aiResponseSchema = Joi.object({
  message: Joi.string().required(),
  suggestedRate: Joi.number().positive().required(),
  confidence: Joi.number().min(0).max(100).required(),
  reasoning: Joi.string().required(),
  negotiationTips: Joi.array().items(Joi.string()).min(3).max(5).required(),
  localRate: rateBlockSchema.required(),
  internationalRate: rateBlockSchema.required(),
});
