import rateLimit, { type AugmentedRequest } from 'express-rate-limit';

// Tighter limit than the global limiter — login is the highest-value target
// for credential stuffing / brute force, so it gets its own, stricter budget.
// Only failed attempts count: a shared restaurant IP means every waiter's
// successful login shares one bucket, and correct-password logins must never
// lock the whole staff out.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = (req as AugmentedRequest).rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : undefined;

    res.status(429).json({
      success: false,
      error: 'Too many failed login attempts, please try again later',
      retryAfterSeconds,
    });
  },
});
