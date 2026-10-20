import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });
}

const csv = (value) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB: z.string().min(1).default('skymetrics'),
  /** Optional connection string for a read-only database user, used by "Ask your data". */
  MONGODB_READONLY_URI: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173').transform(csv),
  RATE_LIMIT_PER_15_MIN: z.coerce.number().int().positive().default(300),
  ASK_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(10),
  KPI_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(300),
  ASK_MAX_TIME_MS: z.coerce.number().int().positive().default(5000),
});

/**
 * @typedef {z.infer<typeof schema>} Env
 */

/** @returns {Env} */
export function parseEnv(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }
  return result.data;
}

/** @type {Env | undefined} */
let cached;

/** @returns {Env} */
export function getEnv() {
  cached ??= parseEnv();
  return cached;
}
