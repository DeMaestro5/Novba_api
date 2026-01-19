import Joi from 'joi';
import { ProposalStatus } from '@prisma/client';

export default {
  create: Joi.object().keys({
    clientId: Joi.string().required().uuid(),
    title: Joi.string().required().min(1).max(255),
    scope: Joi.string().optional().allow(''),
    deliverables: Joi.object().optional().allow(null),
    timeline: Joi.object().optional().allow(null),
    terms: Joi.string().optional().allow(''),
    currency: Joi.string().length(3).uppercase().optional(),
    validUntil: Joi.date().optional().allow(null),
    lineItems: Joi.array()
      .items(
        Joi.object({
          description: Joi.string().required().min(1),
          quantity: Joi.number().required().positive(),
          rate: Joi.number().required().min(0),
          amount: Joi.number().required().min(0),
          order: Joi.number().required().integer().min(0),
        }),
      )
      .required()
      .min(1),
  }),

  update: Joi.object().keys({
    title: Joi.string().optional().min(1).max(255),
    scope: Joi.string().optional().allow(''),
    deliverables: Joi.object().optional().allow(null),
    timeline: Joi.object().optional().allow(null),
    terms: Joi.string().optional().allow(''),
    currency: Joi.string().length(3).uppercase().optional(),
    validUntil: Joi.date().optional().allow(null),
    lineItems: Joi.array()
      .items(
        Joi.object({
          description: Joi.string().required().min(1),
          quantity: Joi.number().required().positive(),
          rate: Joi.number().required().min(0),
          amount: Joi.number().required().min(0),
          order: Joi.number().required().integer().min(0),
        }),
      )
      .optional()
      .min(1),
  }),

  proposalId: Joi.object().keys({
    id: Joi.string().required().uuid(),
  }),

  pagination: Joi.object().keys({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    status: Joi.string()
      .valid(...Object.values(ProposalStatus))
      .optional(),
    search: Joi.string().optional().allow('').max(255),
  }),
};
