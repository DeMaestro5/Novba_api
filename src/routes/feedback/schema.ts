import Joi from 'joi';

export default {
  create: Joi.object().keys({
    type: Joi.string().valid('BUG', 'FEATURE', 'GENERAL').required(),
    rating: Joi.number().integer().min(1).max(5).optional().allow(null),
    message: Joi.string().min(10).max(2000).required(),
  }),
};
