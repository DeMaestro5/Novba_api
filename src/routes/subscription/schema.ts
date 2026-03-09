import Joi from 'joi';

export default {
  checkout: Joi.object().keys({
    tier: Joi.string().required().valid('PRO', 'STUDIO'),
    interval: Joi.string().optional().valid('monthly', 'annual'),
  }),
};