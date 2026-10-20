import { createGeminiClient } from './ask/gemini.js';
import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { close, connect } from './db/mongo.js';

const env = getEnv();

await connect({
  uri: env.MONGODB_URI,
  dbName: env.MONGODB_DB,
  readOnlyUri: env.MONGODB_READONLY_URI,
});

const llm = env.GEMINI_API_KEY
  ? createGeminiClient({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
      timeoutMs: env.GEMINI_TIMEOUT_MS,
    })
  : null;
if (!llm) console.warn('GEMINI_API_KEY is not set: POST /api/ask will return 503.');

const server = createApp({ llm }).listen(env.PORT, () => {
  console.log(`SkyMetrics API listening on http://localhost:${env.PORT}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
