import { rateLimit } from 'express-rate-limit';
import { getEnv } from '../config/env.js';

const handler = (_req, res) =>
  res.status(429).json({ error: { message: 'Too many requests, please try again later.' } });

export function apiLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: getEnv().RATE_LIMIT_PER_15_MIN,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler,
  });
}

/** Stricter, per-user limit for the LLM-backed endpoint (runs after `authenticate`). */
export function askLimiter() {
  return rateLimit({
    windowMs: 60 * 1000,
    limit: getEnv().ASK_RATE_LIMIT_PER_MIN,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.user.id}`,
    handler,
  });
}
