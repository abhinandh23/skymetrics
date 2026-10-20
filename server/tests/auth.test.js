import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { userWithToken } from './helpers/auth.js';
import { startDb, stopDb } from './helpers/db.js';

let app;
let db;

beforeAll(async () => {
  db = await startDb();
  app = createApp();
});
afterAll(stopDb);

describe('POST /api/auth/register', () => {
  test('creates a viewer and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'New.User@Example.com', password: 'longpassword', name: 'New User' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new.user@example.com', role: 'viewer' });
    expect(res.body.token).toEqual(expect.any(String));
    const stored = await db.collection('users').findOne({ email: 'new.user@example.com' });
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain('longpassword');
  });

  test('ignores a requested role (no self-promotion to analyst)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sneaky@example.com', password: 'longpassword', name: 'S', role: 'analyst' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('viewer');
  });

  test('rejects duplicate emails', async () => {
    const body = { email: 'dup@example.com', password: 'longpassword', name: 'D' };
    await request(app).post('/api/auth/register').send(body).expect(201);
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(409);
  });

  test.each([
    [{ email: 'not-an-email', password: 'longpassword', name: 'X' }, 'email'],
    [{ email: 'a@b.co', password: 'short', name: 'X' }, 'password'],
    [{ email: 'a@b.co', password: 'longpassword' }, 'name'],
  ])('validates input %#', async (body, field) => {
    const res = await request(app).post('/api/auth/register').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'login@example.com', password: 'correct-horse', name: 'L' });
  });

  test('returns a token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'LOGIN@example.com', password: 'correct-horse' });
    expect(res.status).toBe(200);
    const payload = jwt.decode(res.body.token);
    expect(payload).toMatchObject({ email: 'login@example.com', role: 'viewer' });
  });

  test('rejects a wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  test('rejects an unknown user with the same message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });
});

describe('GET /api/auth/me', () => {
  test('returns the current user', async () => {
    const { header, user } = await userWithToken('analyst');
    const res = await request(app).get('/api/auth/me').set(header);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: user.email, role: 'analyst' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  test('requires a token', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
  });

  test.each([
    ['garbage token', 'Bearer not.a.jwt'],
    ['wrong scheme', 'Basic abc'],
    [
      'wrong secret',
      `Bearer ${jwt.sign({ role: 'analyst' }, 'another-secret-value', { subject: 'x' })}`,
    ],
    [
      'alg none',
      `Bearer ${jwt.sign({ role: 'analyst' }, null, { algorithm: 'none', subject: 'x' })}`,
    ],
    [
      'expired',
      `Bearer ${jwt.sign({ role: 'analyst' }, process.env.JWT_SECRET, { subject: 'x', expiresIn: -10 })}`,
    ],
  ])('rejects %s', async (_name, authorization) => {
    const res = await request(app).get('/api/auth/me').set('Authorization', authorization);
    expect(res.status).toBe(401);
  });

  test('returns 404 when the user no longer exists', async () => {
    const { header, user } = await userWithToken('viewer');
    await db.collection('users').deleteOne({ _id: user._id });
    expect((await request(app).get('/api/auth/me').set(header)).status).toBe(404);
  });
});
