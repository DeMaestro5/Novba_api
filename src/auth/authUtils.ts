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
  // Defaults: 1hr access, 30-day refresh, 90-day remember-me
  const accessTokenValidity = parseInt(
    process.env.ACCESS_TOKEN_VALIDITY_SEC ?? '3600',
  );
  const refreshTokenValidity = rememberMe
    ? parseInt(process.env.REFRESH_TOKEN_REMEMBER_ME_SEC ?? '7776000')
    : parseInt(process.env.REFRESH_TOKEN_VALIDITY_SEC ?? '2592000');

  const accessToken = await JWT.encode(
    new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id,
      accessTokenKey,
      accessTokenValidity,
    ),
  );

  if (!accessToken) throw new InternalError();

  const refreshToken = await JWT.encode(
    new JwtPayload(
      tokenInfo.issuer,
      tokenInfo.audience,
      user.id,
      refreshTokenKey,
      refreshTokenValidity,
    ),
  );

  if (!refreshToken) throw new InternalError();

  return {
    accessToken,
    refreshToken,
  } as Tokens;
};
