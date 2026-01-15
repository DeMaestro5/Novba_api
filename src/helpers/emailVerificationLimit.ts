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
export default {
  verifyEmailLimiter,
  resendVerificationLimiter,
};
