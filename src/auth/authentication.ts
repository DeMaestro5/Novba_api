import express from 'express';
import { ProtectedRequest } from 'app-request';
import UserRepo from '../database/repository/UserRepo';
import {
  AuthFailureError,
  AccessTokenError,
  TokenExpiredError,
} from '../core/ApiError';
import JWT, { JwtPayload } from '../core/JWT';
import KeystoreRepo from '../database/repository/KeystoreRepo';
import { getAccessToken, validateTokenData } from './authUtils';
import validator, { ValidationSource } from '../helpers/validator';
import schema from './schema';
import asyncHandler from '../helpers/asyncHandler';

const router = express.Router();

export default router.use(
  validator(schema.auth, ValidationSource.HEADER),
  asyncHandler(async (req: ProtectedRequest, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[auth] missing/bad auth header:', req.originalUrl);
    }
    req.accessToken = getAccessToken(authHeader); // Express headers are auto converted to lowercase

    try {
      let payload: JwtPayload;
      try {
        payload = await JWT.validate(req.accessToken);
      } catch (e) {
        console.warn('[auth] token validation failed:', {
          url: req.originalUrl,
          error: (e as Error).constructor.name,
        });
        throw e;
      }
      validateTokenData(payload);

      // payload.sub is now a UUID string (Prisma User.id), not ObjectId
      const user = await UserRepo.findById(payload.sub);
      if (!user) {
        console.warn('[auth] user not found for token sub:', payload.sub);
        throw new AuthFailureError('User not registered');
      }
      req.user = user;

      // KeystoreRepo.findForKey expects userId (string) and key (string)
      const keystore = await KeystoreRepo.findForKey(req.user.id, payload.prm);
      if (!keystore) {
        console.warn('[auth] keystore not found:', {
          userId: payload.sub,
          prm: payload.prm,
        });
        throw new AuthFailureError('Invalid access token');
      }
      req.keystore = keystore;

      return next();
    } catch (e) {
      if (e instanceof TokenExpiredError) throw new AccessTokenError(e.message);
      throw e;
    }
  }),
);
