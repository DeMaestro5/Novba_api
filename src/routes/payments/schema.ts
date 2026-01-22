import Joi from 'joi';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

export default {
  create: Joi.object().keys({
    invoiceId: Joi.string().required().uuid(),
    amount: Joi.number().required().positive(),
    currency: Joi.string().length(3).uppercase().optional(),
    paymentMethod: Joi.string()
      .required()
      .valid(...Object.values(PaymentMethod)),
    paidAt: Joi.date().optional(),
    notes: Joi.string().optional().allow(''),
  }),

  paymentId: Joi.object().keys({
    id: Joi.string().required().uuid(),
  }),

  invoiceId: Joi.object().keys({
    id: Joi.string().required().uuid(),
  }),

  pagination: Joi.object().keys({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    status: Joi.string()
      .valid(...Object.values(PaymentStatus))
      .optional(),
    invoiceId: Joi.string().uuid().optional(),
  }),
};