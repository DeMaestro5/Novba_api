import Joi from 'joi';
// Note: JoiObjectId is now a UUID validator, but profile routes don't need userId param
// since we use req.user.id from authentication middleware
export default {
  profile: Joi.object().keys({
    name: Joi.string().min(1).max(200).optional(),
    profilePicUrl: Joi.string().uri().optional(),
  }),
};
