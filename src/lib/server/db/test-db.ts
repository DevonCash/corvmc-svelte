/**
 * Real in-memory database harness for server tests.
 *
 * Uses Node's built-in `node:sqlite` (no native build — works in CI on Node 22)
 * with drizzle's first-party `drizzle-orm/node-sqlite` adapter, and applies the
 * real committed migrations so specs exercise the actual SQL (overlap predicates,
 * compare-and-swap guards, joins) instead of stubbed Drizzle operators.
 *
 * Usage:
 *   import { createTestDb, insertUser, insertReservation } from '$lib/server/db/test-db';
 *   let ctx: TestDb;
 *   beforeEach(() => { ctx = createTestDb(); });
 *   afterEach(() => ctx.close());
 *
 * `createTestDb()` also injects the instance into the shared `db` proxy via
 * `__setTestDb`, so services importing `{ db }` from `$lib/server/db` hit it.
 */
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-sqlite';
import * as schema from './schema';
import { relations } from './schema/relations';
import { __setTestDb } from './index';
import { user } from './schema/authentication';
import { reservation, closure } from './schema/reservation';
import type { reservationStatuses, bookerTypes } from './schema/reservation';

export type TestDb = {
	sqlite: DatabaseSync;
	db: ReturnType<typeof drizzle>;
	close: () => void;
};

// Parse every migration's statements once and reuse across specs. Each migration
// file separates statements with drizzle's `--> statement-breakpoint` marker.
let cachedStatements: string[] | null = null;

function loadMigrationStatements(): string[] {
	if (cachedStatements) return cachedStatements;
	const migrationsDir = join(process.cwd(), 'migrations');
	const dirs = readdirSync(migrationsDir)
		.filter((d) => /^\d/.test(d))
		.sort();
	const statements: string[] = [];
	for (const dir of dirs) {
		let sql: string;
		try {
			sql = readFileSync(join(migrationsDir, dir, 'migration.sql'), 'utf8');
		} catch {
			continue;
		}
		for (const part of sql.split('--> statement-breakpoint')) {
			const stmt = part.trim();
			if (stmt) statements.push(stmt);
		}
	}
	cachedStatements = statements;
	return statements;
}

/**
 * Build a fresh in-memory database with the full schema applied, and wire it
 * into the shared `db` proxy. Returns the drizzle instance plus a `close()`.
 */
export function createTestDb(): TestDb {
	const sqlite = new DatabaseSync(':memory:');
	sqlite.exec('PRAGMA foreign_keys = ON;');
	for (const stmt of loadMigrationStatements()) {
		sqlite.exec(stmt);
	}
	const db = drizzle({ client: sqlite, schema, relations });
	__setTestDb(db);
	return {
		sqlite,
		db,
		close: () => sqlite.close()
	};
}

// ---------------------------------------------------------------------------
// Row factories — minimal, satisfy NOT NULL columns, return the inserted row.
// ---------------------------------------------------------------------------

let seq = 0;
function nextId(prefix: string): string {
	seq += 1;
	return `${prefix}-${seq}`;
}

export async function insertUser(
	db: TestDb['db'],
	overrides: Partial<typeof user.$inferInsert> = {}
): Promise<typeof user.$inferSelect> {
	const id = overrides.id ?? nextId('user');
	const [row] = await db
		.insert(user)
		.values({
			id,
			name: overrides.name ?? `User ${id}`,
			email: overrides.email ?? `${id}@example.com`,
			...overrides
		})
		.returning();
	return row;
}

export async function insertReservation(
	db: TestDb['db'],
	overrides: Partial<typeof reservation.$inferInsert> & {
		startsAt: Date;
		endsAt: Date;
		createdByUserId: string;
	}
): Promise<typeof reservation.$inferSelect> {
	const [row] = await db
		.insert(reservation)
		.values({
			bookerType: (overrides.bookerType ?? 'user') as (typeof bookerTypes)[number],
			bookerId: overrides.bookerId ?? overrides.createdByUserId,
			status: (overrides.status ?? 'confirmed') as (typeof reservationStatuses)[number],
			...overrides
		})
		.returning();
	return row;
}

export async function insertClosure(
	db: TestDb['db'],
	overrides: Partial<typeof closure.$inferInsert> & { startsAt: Date; endsAt: Date }
): Promise<typeof closure.$inferSelect> {
	const [row] = await db
		.insert(closure)
		.values({
			reason: overrides.reason ?? 'Maintenance',
			...overrides
		})
		.returning();
	return row;
}
