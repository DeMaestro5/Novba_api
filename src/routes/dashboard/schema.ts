import Joi from 'joi';

export default {
  dateRange: Joi.object().keys({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    groupBy: Joi.string().valid('day', 'week', 'month').optional().default('month'),
  }),

  clientRevenue: Joi.object().keys({
    limit: Joi.number().integer().min(1).max(50).optional().default(10),
  }),

  forecast: Joi.object().keys({
    months: Joi.number().integer().min(1).max(12).optional().default(6),
  }),
};