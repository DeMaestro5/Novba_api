import { Tokens } from 'app-request';
import { AuthFailureError, InternalError } from '../core/ApiError';
import JWT, { JwtPayload } from '../core/JWT';
import { UserWithRoles } from '../database/types';
import { tokenInfo } from '../config';

export const getAccessToken = (authorization?: string) => {
  if (!authorization) throw new AuthFailureError('Invalid Authorization');
  if (!authorization.startsWith('Bearer '))
    throw new AuthFailureError('Invalid Authorization');
  return authorization.split(' ')[1];
};

export const validateTokenData = (payload: JwtPayload): boolean => {
  if (
    !payload ||
    !payload.iss ||
    !payload.sub ||
    !payload.aud ||
    !payload.prm ||
    payload.iss !== tokenInfo.issuer ||
    payload.aud !== tokenInfo.audience ||
    !payload.sub || // Just check it's a non-empty string (UUID format)
    typeof payload.sub !== 'string'
  )
    throw new AuthFailureError('Invalid Access Token');
  return true;
};

export const createTokens = async (
  user: UserWithRoles,
  accessTokenKey: string,
  refreshTokenKey: string,
  rememberMe: boolean = false,
): Promise<Tokens> => {
  const accessTokenValidity = parseInt(process.env.ACCESS_TOKEN_VALIDITY_SEC ?? '900');
  const refreshTokenValidity = rememberMe
    ? parseInt(process.env.REFRESH_TOKEN_REMEMBER_ME_SEC ?? '2592000')
    : parseInt(process.env.REFRESH_TOKEN_VALIDITY_SEC ?? '604800');

  const accessToken = await JWT.encode(
    new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id, // Prisma User.id is a string UUID
      accessTokenKey,
      accessTokenValidity,
    ),
  );

  if (!accessToken) throw new InternalError();

  const refreshToken = await JWT.encode(
    new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id, // Prisma User.id is a string UUID
      refreshTokenKey,
      refreshTokenValidity,
    ),
  );

  if (!refreshToken) throw new InternalError();

  return {
    accessToken: accessToken,
    refreshToken: refreshToken,
  } as Tokens;
};
