import request from 'supertest';
import { resetAskContext } from '../src/ask/ask.service.js';
import { createApp } from '../src/app.js';
import { userWithToken } from './helpers/auth.js';
import { startDb, stopDb } from './helpers/db.js';
import { fakeLlm, worstRoutesAnswer } from './helpers/fakeLlm.js';
import { seedKpis } from './helpers/fixtures.js';

let db;
let analyst;
let viewer;

beforeAll(async () => {
  db = await startDb();
  await seedKpis(db);
  viewer = await userWithToken('viewer');
});
afterAll(stopDb);

beforeEach(async () => {
  // A fresh analyst per test keeps the per-user rate limit out of the way.
  analyst = await userWithToken('analyst');
  resetAskContext();
});

const ask = (app, question, who = analyst) =>
  request(app).post('/api/ask').set(who.header).send({ question });

describe('POST /api/ask', () => {
  test('requires authentication', async () => {
    const app = createApp({ llm: fakeLlm(worstRoutesAnswer) });
    expect((await request(app).post('/api/ask').send({ question: 'anything here' })).status).toBe(
      401,
    );
  });

  test('is forbidden for viewers', async () => {
    const llm = fakeLlm(worstRoutesAnswer);
    const res = await ask(createApp({ llm }), 'Which routes are worst?', viewer);
    expect(res.status).toBe(403);
    expect(llm.calls).toHaveLength(0);
  });

  test('returns 503 when no LLM is configured', async () => {
    const res = await ask(createApp({ llm: null }), 'Which routes are worst?');
    expect(res.status).toBe(503);
  });

  test.each([['hi'], ['x'.repeat(501)]])('validates the question length', async (question) => {
    const res = await ask(createApp({ llm: fakeLlm(worstRoutesAnswer) }), question);
    expect(res.status).toBe(400);
  });

  test('answers a question with rows, chart hints and the pipeline used', async () => {
    const llm = fakeLlm(worstRoutesAnswer);
    const res = await ask(
      createApp({ llm }),
      'Which 5 routes had the worst average arrival delay in June?',
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      collection: 'route_monthly',
      chartType: 'bar',
      xField: 'route',
      yFields: ['avgArrDelay'],
      rowCount: 2,
      attempts: 1,
    });
    expect(res.body.rows).toEqual([
      { route: 'JFK-LAX', avgArrDelay: 25 },
      { route: 'ATL-JFK', avgArrDelay: 5 },
    ]);
    // The prompt includes the schema and the months that exist in the data.
    expect(llm.calls[0].systemInstruction).toContain('route_monthly');
    expect(llm.calls[0].systemInstruction).toContain('2026-06, 2026-07');
    expect(llm.calls[0].prompt).toContain('worst average arrival delay');

    const log = await db.collection('ask_logs').findOne({ userId: analyst.user._id.toString() });
    expect(log).toMatchObject({ outcome: 'success', rowCount: 2, collection: 'route_monthly' });
    expect(JSON.parse(log.pipelineJson)).toEqual(res.body.pipeline);
  });

  test('flattens compound _id values into columns', async () => {
    const llm = fakeLlm({
      collection: 'carrier_monthly',
      pipeline: [
        {
          $group: { _id: { airline: '$airline', month: '$month' }, flights: { $sum: '$flights' } },
        },
        { $sort: { '_id.month': 1, '_id.airline': 1 } },
        { $limit: 2 },
      ],
      chartType: 'table',
      explanation: 'Flights per airline per month.',
    });
    const res = await ask(createApp({ llm }), 'Flights per airline per month');
    expect(res.body.rows[0]).toEqual({ airline: 'AA', month: '2026-06', flights: 1000 });
  });

  test('retries once with validator feedback and succeeds', async () => {
    const malicious = {
      ...worstRoutesAnswer,
      pipeline: [{ $lookup: { from: 'users', localField: 'a', foreignField: 'b', as: 'u' } }],
    };
    const llm = fakeLlm(malicious, worstRoutesAnswer);
    const res = await ask(createApp({ llm }), 'Show routes joined with users');
    expect(res.status).toBe(200);
    expect(res.body.attempts).toBe(2);
    expect(llm.calls[1].prompt).toContain('rejected by the safety validator');
    expect(llm.calls[1].prompt).toContain('$lookup is forbidden');
  });

  test('gives up after the retry also fails, without touching the database', async () => {
    const bad = { ...worstRoutesAnswer, pipeline: [{ $out: 'route_monthly' }] };
    const before = await db.collection('route_monthly').countDocuments();
    const res = await ask(createApp({ llm: fakeLlm(bad, bad) }), 'Overwrite the routes please');
    expect(res.status).toBe(422);
    expect(res.body.error.details.reason).toBe('validation_failed');
    expect(res.body.error.details.errors[0]).toContain('$out is forbidden');
    expect(await db.collection('route_monthly').countDocuments()).toBe(before);
    const log = await db.collection('ask_logs').findOne({ userId: analyst.user._id.toString() });
    expect(log.outcome).toBe('rejected');
  });

  test('treats invalid JSON as a validation failure and retries', async () => {
    const llm = fakeLlm(
      'not json at all',
      '```json\n' + JSON.stringify(worstRoutesAnswer) + '\n```',
    );
    const res = await ask(createApp({ llm }), 'Which routes are worst?');
    expect(res.status).toBe(200);
    expect(llm.calls[1].prompt).toContain('not valid JSON');
  });

  test('rejects a non-allow-listed collection', async () => {
    const bad = { ...worstRoutesAnswer, collection: 'users', pipeline: [{ $match: {} }] };
    const res = await ask(createApp({ llm: fakeLlm(bad, bad) }), 'List all users and passwords');
    expect(res.status).toBe(422);
    expect(res.body.error.details.errors[0]).toContain('collection "users" is not allowed');
  });

  test('passes through an unanswerable explanation', async () => {
    const llm = fakeLlm({
      answerable: false,
      explanation: 'Only June-August 2026 data is available.',
    });
    const res = await ask(createApp({ llm }), 'What happened in 2019?');
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({
      message: 'Only June-August 2026 data is available.',
      details: { reason: 'unanswerable' },
    });
  });

  test('returns 502 when the LLM call fails', async () => {
    const res = await ask(
      createApp({ llm: fakeLlm(new Error('quota exceeded')) }),
      'Which routes are worst?',
    );
    expect(res.status).toBe(502);
    const log = await db.collection('ask_logs').findOne({ userId: analyst.user._id.toString() });
    expect(log).toMatchObject({ outcome: 'llm_error', error: 'quota exceeded' });
  });

  test('returns 504 when the LLM call times out', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), {
      name: 'TimeoutError',
    });
    const res = await ask(createApp({ llm: fakeLlm(timeout) }), 'Which routes are worst?');
    expect(res.status).toBe(504);
  });

  test('returns 422 when a valid-looking pipeline fails at runtime', async () => {
    const llm = fakeLlm({
      ...worstRoutesAnswer,
      pipeline: [{ $project: { x: { $toInt: '$route' } } }],
    });
    const res = await ask(createApp({ llm }), 'Convert the routes to numbers');
    expect(res.status).toBe(422);
    expect(res.body.error.details.reason).toBe('query_failed');
  });

  test('applies a stricter per-user rate limit', async () => {
    const answers = Array.from({ length: 6 }, () => worstRoutesAnswer);
    const app = createApp({ llm: fakeLlm(...answers) });
    const statuses = [];
    for (let i = 0; i < 6; i += 1)
      statuses.push((await ask(app, 'Which routes are worst?')).status);
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });
});
