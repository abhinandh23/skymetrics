import { MongoClient } from 'mongodb';

/** @type {MongoClient | undefined} */
let client;
/** @type {MongoClient | undefined} */
let readOnlyClient;
/** @type {import('mongodb').Db | undefined} */
let db;
/** @type {import('mongodb').Db | undefined} */
let readOnlyDb;

/**
 * Connect once and reuse the pool.
 * @param {{ uri: string, dbName: string, readOnlyUri?: string }} options
 */
export async function connect({ uri, dbName, readOnlyUri }) {
  if (db) return db;
  client = new MongoClient(uri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  db = client.db(dbName);

  if (readOnlyUri) {
    readOnlyClient = new MongoClient(readOnlyUri, { maxPoolSize: 5 });
    await readOnlyClient.connect();
    readOnlyDb = readOnlyClient.db(dbName);
  }
  await ensureIndexes(db);
  return db;
}

/** @returns {import('mongodb').Db} */
export function getDb() {
  if (!db) throw new Error('Database not connected. Call connect() first.');
  return db;
}

/** Database handle for user-generated queries; falls back to the main handle. */
export function getReadOnlyDb() {
  return readOnlyDb ?? getDb();
}

export async function ping() {
  await getDb().command({ ping: 1 });
}

export async function close() {
  await Promise.all([client?.close(), readOnlyClient?.close()]);
  client = readOnlyClient = db = readOnlyDb = undefined;
}

/** Indexes for collections owned by the API (KPI collections are indexed by the pipeline). */
async function ensureIndexes(database) {
  await database.collection('users').createIndex({ email: 1 }, { unique: true });
  await database.collection('ask_logs').createIndex({ createdAt: -1 });
  await database.collection('ask_logs').createIndex({ userId: 1, createdAt: -1 });
}
