import Joi from 'joi';
import { ExpenseCategory } from '@prisma/client';

export default {
  create: Joi.object().keys({
    date: Joi.date().required(),
    vendor: Joi.string().required().min(1).max(255),
    amount: Joi.number().required().positive(),
    currency: Joi.string().length(3).uppercase().optional(),
    category: Joi.string()
      .required()
      .valid(...Object.values(ExpenseCategory)),
    description: Joi.string().optional().allow(''),
    taxDeductible: Joi.boolean().optional(),
    receiptUrl: Joi.string().optional().uri(),
  }),

  update: Joi.object().keys({
    date: Joi.date().optional(),
    vendor: Joi.string().optional().min(1).max(255),
    amount: Joi.number().optional().positive(),
    currency: Joi.string().length(3).uppercase().optional(),
    category: Joi.string()
      .optional()
      .valid(...Object.values(ExpenseCategory)),
    description: Joi.string().optional().allow(''),
    taxDeductible: Joi.boolean().optional(),
    receiptUrl: Joi.string().optional().uri(),
  }),

  expenseId: Joi.object().keys({
    id: Joi.string().required().uuid(),
  }),

  pagination: Joi.object().keys({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    category: Joi.string()
      .valid(...Object.values(ExpenseCategory))
      .optional(),
    search: Joi.string().optional().allow('').max(255),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    taxDeductible: Joi.boolean().optional(),
  }),

  receipt: Joi.object().keys({
    receiptUrl: Joi.string().required().uri(),
  }),

  taxSummary: Joi.object().keys({
    year: Joi.number().integer().min(2000).max(2100).optional(),
  }),
};