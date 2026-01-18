import Joi from 'joi';
import { PaymentTerms } from '@prisma/client';

export default {
  create: Joi.object().keys({
    companyName: Joi.string().required().min(1).max(255),
    contactName: Joi.string().optional().allow('').max(255),
    email: Joi.string().email().optional().allow(''),
    phone: Joi.string().optional().allow('').max(50),
    billingAddress: Joi.object().optional().allow(null),
    paymentTerms: Joi.string()
      .valid(...Object.values(PaymentTerms))
      .optional(),
    currency: Joi.string().length(3).uppercase().optional(),
    notes: Joi.string().optional().allow(''),
  }),

  update: Joi.object().keys({
    companyName: Joi.string().optional().min(1).max(255),
    contactName: Joi.string().optional().allow('').max(255),
    email: Joi.string().email().optional().allow(''),
    phone: Joi.string().optional().allow('').max(50),
    billingAddress: Joi.object().optional().allow(null),
    paymentTerms: Joi.string()
      .valid(...Object.values(PaymentTerms))
      .optional(),
    currency: Joi.string().length(3).uppercase().optional(),
    notes: Joi.string().optional().allow(''),
  }),

  clientId: Joi.object().keys({
    id: Joi.string().required().uuid(),
  }),

  pagination: Joi.object().keys({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    search: Joi.string().optional().allow('').max(255),
  }),
};
