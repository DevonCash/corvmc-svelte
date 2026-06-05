import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { getTableColumns } from 'drizzle-orm';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { user } from './db/schema/authentication';
import { userAdditionalFields } from './auth-fields';

// ---------------------------------------------------------------------------
// Regression: better-auth must surface `stripeId` (and other camelCase user
// columns) on the session user.
//
// The drizzle adapter resolves a field by indexing the drizzle schema model
// with `getFieldName()` (= additionalFields.fieldName || key). Our `user` table
// is keyed by the camelCase property `stripeId` (drizzle maps it to the
// `stripe_id` column internally). Declaring `fieldName: 'stripe_id'` made the
// adapter look up `schemaModel['stripe_id']` → undefined → the field was
// silently dropped from the session, producing the "No billing account found"
// bug. These tests pin the fix (no `fieldName`) and document the failure mode.
// ---------------------------------------------------------------------------

function makeDb() {
	const sqlite = new Database(':memory:');
	// Build a CREATE TABLE matching every column of the real drizzle `user` table
	// (the adapter selects the whole row), derived from the schema so it can't drift.
	const colNames = Object.values(getTableColumns(user)).map((c) => c.name as string);
	const colDefs = colNames.map((n) => (n === 'id' ? `"id" TEXT PRIMARY KEY` : `"${n}"`));
	sqlite.exec(`CREATE TABLE user (${colDefs.join(', ')});`);

	sqlite.prepare(`INSERT INTO user (id, name, email, stripe_id) VALUES (?, ?, ?, ?)`).run(
		'u1',
		'Devon',
		'devon@corvmc.org',
		'cus_test'
	);
	return drizzle({ client: sqlite, schema: { user } });
}

function buildAdapter(db: ReturnType<typeof makeDb>, additionalFields: unknown) {
	// drizzleAdapter(db, cfg) returns a factory that better-auth calls with the
	// resolved options; we invoke it directly with a minimal options object.
	return drizzleAdapter(db, { provider: 'sqlite', schema: { user } })({
		user: { additionalFields }
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any);
}

describe('better-auth user additionalFields', () => {
	it('surfaces stripeId on the user (current config, no fieldName)', async () => {
		const db = makeDb();
		const adapter = buildAdapter(db, userAdditionalFields);

		const row = await adapter.findOne<{ id: string; stripeId?: string }>({
			model: 'user',
			where: [{ field: 'id', value: 'u1' }]
		});

		expect(row?.id).toBe('u1');
		expect(row?.stripeId).toBe('cus_test');
	});

	it('drops stripeId when fieldName is set (the original bug)', async () => {
		const db = makeDb();
		const adapter = buildAdapter(db, {
			stripeId: { type: 'string', required: false, fieldName: 'stripe_id' }
		});

		// With the snake_case fieldName, the adapter looks up the wrong schema key,
		// so stripeId never makes it onto the returned user — by throwing or by
		// returning undefined. Either way it must NOT round-trip the value.
		const result = await adapter
			.findOne<{ stripeId?: string }>({
				model: 'user',
				where: [{ field: 'id', value: 'u1' }]
			})
			.catch(() => ({ stripeId: undefined }));

		expect(result?.stripeId).not.toBe('cus_test');
	});
});
