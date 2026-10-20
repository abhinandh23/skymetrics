/**
 * Create (or reset) one demo user per role.
 * Usage: npm run seed
 */
import { pathToFileURL } from 'node:url';
import { getEnv } from '../src/config/env.js';
import { close, connect, getDb } from '../src/db/mongo.js';
import { createUser } from '../src/services/auth.service.js';

export const DEMO_USERS = [
  { email: 'analyst@example.com', password: 'Analyst123!', name: 'Demo Analyst', role: 'analyst' },
  { email: 'viewer@example.com', password: 'Viewer123!', name: 'Demo Viewer', role: 'viewer' },
];

export async function seed() {
  for (const user of DEMO_USERS) {
    await getDb().collection('users').deleteOne({ email: user.email });
    await createUser(user);
    console.log(`Seeded ${user.role}: ${user.email} / ${user.password}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = getEnv();
  await connect({ uri: env.MONGODB_URI, dbName: env.MONGODB_DB });
  try {
    await seed();
  } finally {
    await close();
  }
}
