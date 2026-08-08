import Joi from 'joi';

const rateBlockSchema = Joi.object({
  min: Joi.number().positive().required(),
  median: Joi.number().positive().required(),
  max: Joi.number().positive().required(),
  context: Joi.string().required(),
});

const pushBack = Joi.object({
  objection: Joi.string().required(),
  response: Joi.string().required(),
});

const negotiationBrief = Joi.object({
  pushBack: Joi.array().items(pushBack).min(2).max(5).required(),
  holdFirmWhen: Joi.array().items(Joi.string()).min(2).max(4).required(),
  acceptLowerWhen: Joi.array().items(Joi.string()).min(2).max(4).required(),
  redFlags: Joi.array().items(Joi.string()).min(2).max(5),
  positioning: Joi.string().required(),
  howToPresent: Joi.string().required(),
});

export const aiResponseSchema = Joi.object({
  message: Joi.string().required(),
  suggestedRate: Joi.number().positive().required(),
  confidence: Joi.number().min(0).max(100).required(),
  reasoning: Joi.string().required(),
  negotiationTips: Joi.array().items(Joi.string()).min(3).max(5).required(),
  localRate: rateBlockSchema.required(),
  internationalRate: rateBlockSchema.required(),
  negotiationBrief: negotiationBrief.required(),
});

const estimateBlockSchema = Joi.object({
  low: Joi.number().positive().required(),
  recommended: Joi.number().positive().required(),
  high: Joi.number().positive().required(),
  context: Joi.string().required(),
});

export const projectEstimateAiSchema = Joi.object({
  localEstimate: estimateBlockSchema.required(),
  internationalEstimate: estimateBlockSchema.required(),
  confidence: Joi.number().min(0).max(100).required(),
  projectType: Joi.string().required(),
  reasoning: Joi.array().items(Joi.string()).min(2).max(4).required(),
  breakdown: Joi.array()
    .items(
      Joi.object({
        label: Joi.string().required(),
        percentOfTotal: Joi.number().positive().max(100).required(),
      }),
    )
    .length(4)
    .required(),
  analyzedKeywords: Joi.array().items(Joi.string()).max(5).required(),
});
