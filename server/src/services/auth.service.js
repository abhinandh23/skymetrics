import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getEnv } from '../config/env.js';
import { getDb } from '../db/mongo.js';
import { HttpError, unauthorized } from '../utils/httpError.js';

export const ROLES = /** @type {const} */ (['analyst', 'viewer']);
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

const users = () => getDb().collection('users');

/** @type {Promise<string> | undefined} */
let dummyHash;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('timing-equaliser', BCRYPT_ROUNDS));

/** @param {{ _id: import('mongodb').ObjectId, email: string, name: string, role: string }} user */
export function toPublicUser(user) {
  return { id: user._id.toString(), email: user.email, name: user.name, role: user.role };
}

export function signToken(user) {
  const { JWT_SECRET, JWT_EXPIRES_IN } = getEnv();
  return jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, {
    subject: user._id.toString(),
    expiresIn: JWT_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

/**
 * Create a user. Public registration always creates viewers; analysts come from the seed
 * script (or an admin process), so nobody can self-grant access to the LLM endpoint.
 * @param {{ email: string, password: string, name: string, role?: 'analyst' | 'viewer' }} input
 */
export async function createUser({ email, password, name, role = 'viewer' }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const doc = { email: email.toLowerCase(), name, role, passwordHash, createdAt: new Date() };
  try {
    const { insertedId } = await users().insertOne(doc);
    return { ...doc, _id: insertedId };
  } catch (err) {
    if (err?.code === 11000) throw new HttpError(409, 'An account with this email already exists');
    throw err;
  }
}

export async function register(input) {
  const user = await createUser({ ...input, role: 'viewer' });
  return { token: signToken(user), user: toPublicUser(user) };
}

export async function login({ email, password }) {
  const user = await users().findOne({ email: email.toLowerCase() });
  // Compare against a dummy hash when the user is missing to keep timing similar.
  const hash = user?.passwordHash ?? (await getDummyHash());
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) throw unauthorized('Invalid email or password');
  return { token: signToken(user), user: toPublicUser(user) };
}

export async function getUserById(id) {
  if (!ObjectId.isValid(id)) return null;
  const user = await users().findOne({ _id: new ObjectId(id) });
  return user ? toPublicUser(user) : null;
}
