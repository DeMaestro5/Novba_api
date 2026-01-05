import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../core/ApiError';

export enum ValidationSource {
  BODY = 'body',
  HEADER = 'headers',
  QUERY = 'query',
  PARAM = 'params',
}

// UUID validator for Prisma (replaces JoiObjectId)
export const JoiUuid = () =>
  Joi.string().uuid({ version: 'uuidv4' }).messages({
    'string.guid': 'Invalid UUID format',
  });

// Keep JoiObjectId for backward compatibility, but it now validates UUIDs
// This allows gradual migration - old code using JoiObjectId will work with UUIDs
export const JoiObjectId = () =>
  Joi.string().uuid({ version: 'uuidv4' }).messages({
    'string.guid': 'Invalid ID format',
  });

export const JoiUrlEndpoint = () =>
  Joi.string().custom((value: string, helpers) => {
    if (value.includes('://')) return helpers.error('any.invalid');
    return value;
  }, 'Url Endpoint Validation');

export const JoiAuthBearer = () =>
  Joi.string().custom((value: string, helpers) => {
    if (!value.startsWith('Bearer ')) return helpers.error('any.invalid');
    if (!value.split(' ')[1]) return helpers.error('any.invalid');
    return value;
  }, 'Authorization Header Validation');

export default (
    schema: Joi.AnySchema,
    source: ValidationSource = ValidationSource.BODY,
  ) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const { error } = schema.validate(req[source]);

      if (!error) return next();

      const { details } = error;
      const message = details
        .map((i) => i.message.replace(/['"]+/g, ''))
        .join(',');

      next(new BadRequestError(message));
    } catch (error) {
      next(error);
    }
  };
