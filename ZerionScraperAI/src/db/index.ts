import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from '../lib/env.js';
import * as schema from './schema.js';

export type Db = BetterSQLite3Database<typeof schema>;

export function createDb(path: string): Db {
  if (path !== ':memory:') {
    mkdirSync(dirname(resolve(path)), { recursive: true });
  }
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export function migrateDb(db: Db): void {
  migrate(db, { migrationsFolder: resolve(import.meta.dirname, '../../drizzle') });
}

let singleton: Db | undefined;

export function getDb(): Db {
  if (!singleton) {
    singleton = createDb(env.DB_PATH);
  }
  return singleton;
}

export { schema };
