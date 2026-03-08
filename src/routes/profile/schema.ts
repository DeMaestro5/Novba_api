import Joi from 'joi';
// Note: JoiObjectId is now a UUID validator, but profile routes don't need userId param
// since we use req.user.id from authentication middleware
export default {
  profile: Joi.object()
    .keys({
      name: Joi.string().min(1).max(200).optional(),
      profilePicUrl: Joi.string().uri().optional(),
      portfolioSlug: Joi.string().optional().allow(''),
      portfolioTitle: Joi.string().optional().allow(''),
      portfolioBio: Joi.string().optional().allow(''),
      portfolioLocation: Joi.string().optional().allow(''),
      isAvailable: Joi.boolean().optional(),
      linkedinUrl: Joi.string().uri().optional().allow(''),
      twitterUrl: Joi.string().uri().optional().allow(''),
      githubUrl: Joi.string().uri().optional().allow(''),
      timezone: Joi.string().optional(),
      dateFormat: Joi.string().optional(),
      language: Joi.string().optional(),
    })
    .unknown(true), // allow other keys so validation doesn't reject e.g. from settings form
};
