import Joi from 'joi';

export default {
  profile: Joi.object().keys({
    name: Joi.string().optional().min(2).max(100),
    email: Joi.string().email().optional(),
    profilePicUrl: Joi.string().uri().optional().allow(''),
    timezone: Joi.string().optional(),
    dateFormat: Joi.string().optional().valid('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'),
    language: Joi.string().optional().valid('en', 'es', 'fr', 'de'),

    // Portfolio profile fields
    portfolioSlug: Joi.string()
      .optional()
      .allow('')
      .min(3)
      .max(50)
      .lowercase()
      .pattern(/^[a-z0-9-]+$/)
      .message('Portfolio URL can only contain lowercase letters, numbers, and hyphens'),
    portfolioTitle: Joi.string().optional().allow('').max(100),
    portfolioBio: Joi.string().optional().allow('').max(500),
    portfolioLocation: Joi.string().optional().allow('').max(100),
    isAvailable: Joi.boolean().optional(),
    linkedinUrl: Joi.string().uri().optional().allow(''),
    twitterUrl: Joi.string().uri().optional().allow(''),
    githubUrl: Joi.string().uri().optional().allow(''),
  }),

  business: Joi.object().keys({
    businessName: Joi.string().optional().allow('').max(200),
    businessAddress: Joi.string().optional().allow('').max(500),
    businessCity: Joi.string().optional().allow('').max(100),
    businessState: Joi.string().optional().allow('').max(100),
    businessZipCode: Joi.string().optional().allow('').max(20),
    businessCountry: Joi.string().optional().allow('').max(100),
    businessPhone: Joi.string().optional().allow('').max(50),
    businessEmail: Joi.string().email().optional().allow(''),
    businessWebsite: Joi.string().uri().optional().allow(''),
    taxId: Joi.string().optional().allow('').max(50),
  }),

  invoiceDefaults: Joi.object().keys({
    defaultCurrency: Joi.string().optional().length(3).uppercase(),
     // Accept EITHER enum OR custom string
     defaultPaymentTerms: Joi.string()
     .optional()
     .valid('NET_15', 'NET_30', 'NET_60', 'DUE_ON_RECEIPT', 'CUSTOM'),
   
   // Custom text when CUSTOM is selected
   defaultPaymentTermsCustom: Joi.string()
     .optional()
     .allow('')
     .max(200)
     .when('defaultPaymentTerms', {
       is: 'CUSTOM',
       then: Joi.required(),
       otherwise: Joi.optional(),
     }),
    defaultInvoiceNotes: Joi.string().optional().allow('').max(1000),
    defaultInvoiceTerms: Joi.string().optional().allow('').max(2000),
    defaultTaxRate: Joi.number().optional().min(0).max(100),
    invoiceNumberPrefix: Joi.string().optional().max(10),
    nextInvoiceNumber: Joi.number().integer().optional().min(1),
  }),

  logo: Joi.object().keys({
    logoUrl: Joi.string().uri().required(),
  }),
};