import { ping } from '../db/mongo.js';

export async function health(_req, res) {
  let db = 'up';
  try {
    await ping();
  } catch {
    db = 'down';
  }
  res.status(db === 'up' ? 200 : 503).json({
    status: db === 'up' ? 'ok' : 'degraded',
    db,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
