import Joi from 'joi';
import { ContractStatus } from '@prisma/client';

export default {
  create: Joi.object().keys({
    clientId: Joi.string().required().uuid(),
    proposalId: Joi.string().optional().uuid(),
    title: Joi.string().required().min(1).max(255),
    templateType: Joi.string()
      .required()
      .valid(
        'service_agreement',
        'nda',
        'sow',
        'freelance',
        'consulting',
        'custom',
      ),
    content: Joi.string().required().min(1),
    terms: Joi.object().optional().allow(null),
    // FIXED: Use Joi.date() which automatically converts strings to Date objects
    startDate: Joi.date().optional().allow(null),
    endDate: Joi.date().optional().allow(null),
  }),

  update: Joi.object().keys({
    title: Joi.string().optional().min(1).max(255),
    templateType: Joi.string()
      .optional()
      .valid(
        'service_agreement',
        'nda',
        'sow',
        'freelance',
        'consulting',
        'custom',
      ),
    content: Joi.string().optional().min(1),
    terms: Joi.object().optional().allow(null),
    // FIXED: Use Joi.date() which automatically converts strings to Date objects
    startDate: Joi.date().optional().allow(null),
    endDate: Joi.date().optional().allow(null),
  }),

  contractId: Joi.object().keys({
    id: Joi.string().required().uuid(),
  }),

  pagination: Joi.object().keys({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(100).optional().default(20),
    status: Joi.string()
      .valid(...Object.values(ContractStatus))
      .optional(),
    search: Joi.string().optional().allow('').max(255),
  }),

  sign: Joi.object().keys({
    signatureUrl: Joi.string().optional().uri(),
  }),
};
