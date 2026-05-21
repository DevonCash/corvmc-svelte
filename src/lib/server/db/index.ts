import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { relations } from './schema/relations';

export type Database = ReturnType<typeof drizzle<typeof schema, typeof relations>>;

let _db: Database;

export function initDb(d1: D1Database) {
	_db = drizzle(d1, { schema, relations });
}

export function getRowCount(result: unknown): number {
	const r = result as { meta?: { changes?: number } };
	return r?.meta?.changes ?? 0;
}

export const db = new Proxy({} as Database, {
	get(_target, prop, receiver) {
		if (!_db) throw new Error('Database not initialized — call initDb(d1) in hooks.server.ts first');
		return Reflect.get(_db, prop, receiver);
	}
});
