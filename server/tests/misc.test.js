import { jest } from '@jest/globals';
import request from 'supertest';
import { parseLlmOutput, normaliseRow } from '../src/ask/ask.service.js';
import { createGeminiClient } from '../src/ask/gemini.js';
import { buildSystemInstruction, buildUserPrompt } from '../src/ask/prompt.js';
import { describeSchema } from '../src/ask/schema.js';
import { createApp } from '../src/app.js';
import { parseEnv } from '../src/config/env.js';
import { close } from '../src/db/mongo.js';
import { TtlCache } from '../src/utils/ttlCache.js';
import { startDb, stopDb } from './helpers/db.js';

describe('health and error handling', () => {
  let app;
  beforeAll(async () => {
    await startDb();
    app = createApp();
  });
  afterAll(stopDb);

  test('GET /api/health reports the database status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  test('sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('/api/nope');
  });

  test('malformed JSON returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Malformed JSON body');
  });

  test('oversized bodies return 413', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(20_000) });
    expect(res.status).toBe(413);
  });

  test('health reports degraded when the database is unavailable', async () => {
    await close();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.db).toBe('down');
  });

  test('unexpected errors return a generic 500', async () => {
    // The DB is closed now, so a login lookup throws inside the service.
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
  });
});

describe('parseEnv', () => {
  test('applies defaults', () => {
    const env = parseEnv({ MONGODB_URI: 'mongodb://x', JWT_SECRET: 'a'.repeat(16) });
    expect(env).toMatchObject({
      PORT: 4000,
      MONGODB_DB: 'skymetrics',
      CLIENT_ORIGIN: ['http://localhost:5173'],
    });
  });

  test('reports every problem at once', () => {
    expect(() => parseEnv({ JWT_SECRET: 'short' })).toThrow(/MONGODB_URI[\s\S]*JWT_SECRET/);
  });

  test('splits multiple client origins', () => {
    const env = parseEnv({
      MONGODB_URI: 'm',
      JWT_SECRET: 'a'.repeat(16),
      CLIENT_ORIGIN: 'http://a, http://b',
    });
    expect(env.CLIENT_ORIGIN).toEqual(['http://a', 'http://b']);
  });
});

describe('TtlCache', () => {
  test('expires entries and evicts the oldest when full', () => {
    let now = 0;
    const cache = new TtlCache({ ttlMs: 100, maxEntries: 2, now: () => now });
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe(2);
    now = 150;
    expect(cache.get('b')).toBeUndefined();
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  test('a zero TTL disables caching', () => {
    const cache = new TtlCache({ ttlMs: 0 });
    cache.set('a', 1);
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('LLM helpers', () => {
  test('parseLlmOutput accepts fenced JSON and fills defaults', () => {
    const result = parseLlmOutput(
      '```json\n{"collection":"carrier_monthly","pipeline":[],"chartType":"radar"}\n```',
    );
    expect(result.ok).toBe(true);
    expect(result.value).toMatchObject({ answerable: true, chartType: 'table', explanation: '' });
  });

  test('parseLlmOutput rejects non-objects', () => {
    expect(parseLlmOutput('[1,2]').ok).toBe(false);
    expect(parseLlmOutput('').ok).toBe(false);
  });

  test('normaliseRow keeps existing columns over _id keys', () => {
    expect(normaliseRow({ _id: { airline: 'AA', month: 'x' }, month: '2026-06' })).toEqual({
      airline: 'AA',
      month: '2026-06',
    });
    expect(normaliseRow({ _id: 'AA', n: 1 })).toEqual({ _id: 'AA', n: 1 });
  });

  test('prompt includes schema, rules and feedback', () => {
    const system = buildSystemInstruction({ months: [] });
    expect(system).toContain(describeSchema());
    expect(system).toContain('Months available: unknown');
    expect(system).toContain('Never use $lookup');
    expect(buildUserPrompt('Q?', null)).toBe('Question: Q?');
    expect(buildUserPrompt('Q?', { previous: '{}', errors: ['bad stage'] })).toContain(
      '- bad stage',
    );
  });

  test('createGeminiClient requests JSON output from the configured model', async () => {
    const generateContent = jest.fn().mockResolvedValue({ text: '{"ok":true}' });
    const llm = createGeminiClient({
      apiKey: 'k',
      model: 'test-model',
      client: { models: { generateContent } },
    });
    await expect(llm.generate({ systemInstruction: 'sys', prompt: 'p' })).resolves.toBe(
      '{"ok":true}',
    );
    expect(generateContent).toHaveBeenCalledWith({
      model: 'test-model',
      contents: 'p',
      config: { systemInstruction: 'sys', responseMimeType: 'application/json' },
    });
  });

  test('createGeminiClient returns an empty string when there is no text', async () => {
    const llm = createGeminiClient({
      apiKey: 'k',
      model: 'm',
      client: { models: { generateContent: async () => ({}) } },
    });
    await expect(llm.generate({ systemInstruction: '', prompt: '' })).resolves.toBe('');
  });
});
