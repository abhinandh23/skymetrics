import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { getEnv } from './config/env.js';
import { health } from './controllers/health.controller.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { askRouter } from './routes/ask.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { kpiRouter } from './routes/kpi.routes.js';
import { TtlCache } from './utils/ttlCache.js';

/**
 * Build the Express app. Dependencies that talk to external services are injected
 * so tests can replace them (e.g. a fake LLM client).
 * @param {{ llm?: import('./ask/gemini.js').LlmClient | null }} [deps]
 */
export function createApp({ llm = null } = {}) {
  const env = getEnv();
  const app = express();
  const kpiCache = new TtlCache({ ttlMs: env.KPI_CACHE_TTL_SECONDS * 1000 });

  app.locals.llm = llm;
  app.locals.kpiCache = kpiCache;
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, methods: ['GET', 'POST'], maxAge: 600 }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', health);
  app.use('/api', apiLimiter());
  app.use('/api/auth', authRouter);
  app.use('/api/kpi', kpiRouter(kpiCache));
  app.use('/api/ask', askRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
