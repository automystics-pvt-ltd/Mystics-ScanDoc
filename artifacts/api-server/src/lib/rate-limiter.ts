/**
 * IP-based rate limiter for the login endpoint using express-rate-limit.
 * Allows 5 attempts per 15-minute window per IP, then returns 429.
 * Standard rate-limit headers are set on every response.
 */
import { rateLimit } from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-8", // includes RateLimit-Policy, RateLimit headers
  legacyHeaders: false,
  message: {
    error: "Too many login attempts from this IP. Please try again in 15 minutes.",
  },
  skipSuccessfulRequests: true, // only count failed requests toward the limit
});
