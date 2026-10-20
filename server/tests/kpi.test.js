import request from 'supertest';
import { createApp } from '../src/app.js';
import { userWithToken } from './helpers/auth.js';
import { startDb, stopDb } from './helpers/db.js';
import { seedKpis } from './helpers/fixtures.js';

let app;
let header;

beforeAll(async () => {
  const db = await startDb();
  await seedKpis(db);
  app = createApp();
  ({ header } = await userWithToken('viewer'));
});
afterAll(stopDb);

const get = (url) => request(app).get(url).set(header);

describe('KPI endpoints', () => {
  test('require authentication', async () => {
    expect((await request(app).get('/api/kpi/carriers')).status).toBe(401);
  });

  test('GET /carriers filters by month and adds airline names', async () => {
    const res = await get('/api/kpi/carriers?month=2026-06');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.data.map((r) => r.airline)).toEqual(['AA', 'DL', 'UA']);
    expect(res.body.data[0]).toMatchObject({ airlineName: 'American Airlines' });
    expect(res.body.data[0]._id).toBeUndefined();
  });

  test('GET /carriers normalises airline case and sorts descending', async () => {
    const res = await get('/api/kpi/carriers?airline=dl&sort=-month');
    expect(res.body.data.map((r) => r.month)).toEqual(['2026-07', '2026-06']);
  });

  test('GET /carriers paginates', async () => {
    const res = await get('/api/kpi/carriers?limit=4&page=2&sort=airline');
    expect(res.body).toMatchObject({ page: 2, limit: 4, total: 6, totalPages: 2 });
    expect(res.body.data).toHaveLength(2);
  });

  test.each([
    ['/api/kpi/carriers?month=2026-13', 'month'],
    ['/api/kpi/carriers?month=June', 'month'],
    ['/api/kpi/carriers?airline=AAA', 'airline'],
    ['/api/kpi/carriers?limit=1000', 'limit'],
    ['/api/kpi/carriers?page=0', 'page'],
    ['/api/kpi/carriers?sort=passwordHash', 'sort'],
    ['/api/kpi/airports?airport=ATLX', 'airport'],
    ['/api/kpi/routes?origin=1', 'origin'],
  ])('rejects invalid query %s', async (url, field) => {
    const res = await get(url);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });

  test('query values cannot inject operators', async () => {
    const res = await get('/api/kpi/carriers?airline[$ne]=x');
    expect(res.status).toBe(400);
  });

  test('GET /airports sorts by flights by default and filters by minFlights', async () => {
    const res = await get('/api/kpi/airports?month=2026-06&minFlights=2000');
    expect(res.body.data.map((r) => r.airport)).toEqual(['ATL']);
  });

  test('GET /routes filters by airport on either end', async () => {
    const res = await get('/api/kpi/routes?month=2026-06&airport=jfk&sort=-avgArrDelay');
    expect(res.body.data.map((r) => r.route)).toEqual(['JFK-LAX', 'ATL-JFK']);
  });

  test('GET /routes filters by origin and dest', async () => {
    const res = await get('/api/kpi/routes?origin=JFK&dest=LAX');
    expect(res.body.total).toBe(2);
  });

  test('GET /delay-causes returns cause minutes', async () => {
    const res = await get('/api/kpi/delay-causes?month=2026-06');
    expect(res.body.data[0]).toMatchObject({
      airline: 'AA',
      totalDelayMin: 1500,
      airlineName: 'American Airlines',
    });
  });

  test('GET /overview weights on-time % by completed flights', async () => {
    const res = await get('/api/kpi/overview?month=2026-06');
    const { summary } = res.body;
    expect(summary.flights).toBe(6000);
    expect(summary.completed).toBe(5840);
    // (80*950 + 90*2990 + 70*1900) / 5840
    expect(summary.onTimePct).toBeCloseTo((80 * 950 + 90 * 2990 + 70 * 1900) / 5840, 2);
    expect(summary.cancelPct).toBeCloseTo((100 * 130) / 6000, 2);
    expect(res.body.monthly).toHaveLength(1);
    expect(res.body.daily.map((d) => d.date)).toEqual(['2026-06-01', '2026-06-02']);
    expect(res.body.lastRun).toMatchObject({ rowsRead: 12345 });
  });

  test('GET /overview with no matching data returns a null summary', async () => {
    const res = await get('/api/kpi/overview?month=2020-01');
    expect(res.body.summary).toBeNull();
    expect(res.body.monthly).toEqual([]);
  });

  test('GET /filters lists months, airlines and airports', async () => {
    const res = await get('/api/kpi/filters');
    expect(res.body.months).toEqual(['2026-06', '2026-07']);
    expect(res.body.airlines).toContainEqual({ code: 'DL', name: 'Delta Air Lines' });
    expect(res.body.airports).toEqual(['ATL', 'JFK']);
  });

  test('responses are cached', async () => {
    const first = await get('/api/kpi/carriers?month=2026-07&limit=3');
    const second = await get('/api/kpi/carriers?month=2026-07&limit=3');
    expect(first.headers['x-cache']).toBe('MISS');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);
  });

  test('error responses are not cached', async () => {
    await get('/api/kpi/carriers?month=bad');
    expect(app.locals.kpiCache.get('/api/kpi/carriers?month=bad')).toBeUndefined();
  });
});
