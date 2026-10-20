import { Router } from 'express';
import { ask, askSchema } from '../controllers/ask.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { askLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export function askRouter() {
  const router = Router();
  router.post(
    '/',
    authenticate,
    requireRole('analyst'),
    askLimiter(),
    validate({ body: askSchema }),
    ask,
  );
  return router;
}
