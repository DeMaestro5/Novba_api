import rateLimit from 'express-rate-limit';
import { TooManyRequestsError } from '../core/ApiError';

export const verifyEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: 'Too many verification attempts. Please try again later.',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers

  // Skip rate limiting for successful requests (optional)
  skipSuccessfulRequests: false,

  // Custom handler for rate limit exceeded
  handler: () => {
    throw new TooManyRequestsError(
      'Too many verification attempts. Please try again in 15 minutes.',
    );
  },
});

export const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Only 3 resend attempts per 15 min
  message: 'Too many resend requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,

  handler: () => {
    throw new TooManyRequestsError(
      'Too many resend requests. Please check your spam folder or try again in 15 minutes.',
    );
  },
});

// Rate limiter for login attempts (prevent brute force)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 login attempts per 15 min
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: () => {
    throw new TooManyRequestsError(
      'Too many login attempts. Please try again in 15 minutes.',
    );
  },
});

// Rate limiter for password reset requests
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 password reset requests per hour
  message: 'Too many password reset requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: () => {
    throw new TooManyRequestsError(
      'Too many password reset requests. Please try again in an hour.',
    );
  },
});

// Rate limiter for signup (prevent spam accounts)
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: 'Too many signup attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: () => {
    throw new TooManyRequestsError(
      'Too many signup attempts. Please try again in an hour.',
    );
  },
});

// Rate limiter for OAuth initiation (prevent abuse)
export const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 OAuth initiations per window
  message: 'Too many OAuth attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  handler: () => {
    throw new TooManyRequestsError(
      'Too many OAuth attempts, please try again later',
    );
  },
});

export default {
  verifyEmailLimiter,
  resendVerificationLimiter,
  signupLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  oauthLimiter,
};
