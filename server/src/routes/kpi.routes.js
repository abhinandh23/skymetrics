import { Router } from 'express';
import * as kpi from '../controllers/kpi.controller.js';
import { authenticate } from '../middleware/auth.js';
import { cacheResponses } from '../middleware/cache.js';
import { validate } from '../middleware/validate.js';

/** @param {import('../utils/ttlCache.js').TtlCache} cache */
export function kpiRouter(cache) {
  const router = Router();
  router.use(authenticate, cacheResponses(cache));

  router.get('/overview', validate({ query: kpi.schemas.overview }), kpi.overview);
  router.get('/filters', kpi.filters);
  router.get('/carriers', validate({ query: kpi.schemas.carriers }), kpi.carriers);
  router.get('/airports', validate({ query: kpi.schemas.airports }), kpi.airports);
  router.get('/routes', validate({ query: kpi.schemas.routes }), kpi.routes);
  router.get('/delay-causes', validate({ query: kpi.schemas.delayCauses }), kpi.delayCauses);
  return router;
}
