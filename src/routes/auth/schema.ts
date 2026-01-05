import Joi from 'joi';
import { JoiAuthBearer } from '../../helpers/validator';

export default {
  credential: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().min(6),
  }),
  refreshToken: Joi.object().keys({
    refreshToken: Joi.string().required().min(1),
  }),
  auth: Joi.object()
    .keys({
      authorization: JoiAuthBearer().required(),
    })
    .unknown(true),
  signup: Joi.object().keys({
    name: Joi.string().required().min(3),
    email: Joi.string().required().email(),
    password: Joi.string().required().min(6),
    profilePicUrl: Joi.string().optional().uri(),
  }),
  forgotPassword: Joi.object().keys({
    email: Joi.string().required().email(),
  }),
  resetPassword: Joi.object().keys({
    email: Joi.string().email().required(),
    token: Joi.string().required(),
    password: Joi.string().min(6).required(),
  }),
};
