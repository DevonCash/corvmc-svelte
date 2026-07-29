import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';
import { relations } from './schema/relations';

export type Database = ReturnType<typeof drizzle<typeof schema, typeof relations>>;

let _db: Database;

export function initDb(d1: D1Database) {
	_db = drizzle(d1, { schema, relations });
}

/**
 * Inject a database instance directly. Test-only — lets the node:sqlite test
 * harness (see `db/test-db.ts`) supply a real in-memory database, since the
 * production `initDb` path is bound to `drizzle-orm/d1`. Never called in app code.
 */
export function __setTestDb(instance: unknown) {
	_db = instance as Database;
}

export function getRowCount(result: unknown): number {
	// D1 reports affected rows under `meta.changes`; the node:sqlite test driver
	// reports them at the top level as `changes`. Accept either shape.
	const r = result as { meta?: { changes?: number }; changes?: number };
	return r?.meta?.changes ?? r?.changes ?? 0;
}

export const db = new Proxy({} as Database, {
	get(_target, prop, receiver) {
		if (!_db)
			throw new Error('Database not initialized — call initDb(d1) in hooks.server.ts first');
		return Reflect.get(_db, prop, receiver);
	}
});
