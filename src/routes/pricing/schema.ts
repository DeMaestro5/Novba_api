import Joi from 'joi';

export default {
  analyzeRate: Joi.object().keys({
    rate: Joi.number().required().positive(),
    category: Joi.string().required().min(1),
    subcategory: Joi.string().optional().allow(''),
    experienceLevel: Joi.string()
      .valid('BEGINNER', 'INTERMEDIATE', 'EXPERT')
      .required(),
  }),

  marketRates: Joi.object().keys({
    category: Joi.string().optional(),
    subcategory: Joi.string().optional(),
    experienceLevel: Joi.string()
      .valid('BEGINNER', 'INTERMEDIATE', 'EXPERT')
      .optional(),
  }),
};