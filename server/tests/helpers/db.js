import { MongoMemoryServer } from 'mongodb-memory-server';
import { close, connect, getDb } from '../../src/db/mongo.js';

let mongod;

export async function startDb() {
  mongod = await MongoMemoryServer.create();
  await connect({ uri: mongod.getUri(), dbName: 'skymetrics_test' });
  return getDb();
}

export async function stopDb() {
  await close();
  await mongod?.stop();
}
