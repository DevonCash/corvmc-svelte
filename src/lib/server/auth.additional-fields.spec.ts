import { describe, it, expect } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { user } from './db/schema/authentication';
import { userAdditionalFields } from './auth-fields';

// ---------------------------------------------------------------------------
// Regression: better-auth must surface `stripeId` (and the other camelCase user
// columns) on the session user.
//
// The drizzle adapter resolves each field by indexing the drizzle schema model
// with `getFieldName()` (= `additionalFields[key].fieldName || key`):
// `schemaModel[getFieldName(...)]`. drizzle's `getTableColumns(user)` is keyed by
// the camelCase *property* name (`stripeId`), and drizzle itself maps that
// property to the `stripe_id` column. So the resolved name MUST be one of those
// property keys — otherwise the adapter looks up `undefined`, never selects the
// column, and the field silently disappears from the session (the original
// "No billing account found" bug).
//
// These tests pin that invariant without needing a real DB (better-sqlite3 isn't
// built in CI). They directly encode the adapter's contract.
// ---------------------------------------------------------------------------

const columnPropertyKeys = Object.keys(getTableColumns(user));

function resolvedFieldName(def: unknown): string {
	return (def as { fieldName?: string }).fieldName ?? '';
}

describe('better-auth user additionalFields', () => {
	it('every additional field resolves to a real drizzle column property', () => {
		// With no `fieldName`, the resolved name is the key itself — which must be a
		// drizzle property so `schemaModel[key]` exists and the column is selected.
		for (const [key, def] of Object.entries(userAdditionalFields)) {
			const resolved = resolvedFieldName(def) || key;
			expect(
				columnPropertyKeys,
				`additionalFields.${key} resolves to "${resolved}", which is not a property of the drizzle user table`
			).toContain(resolved);
		}
	});

	it('stripeId is declared without a snake_case fieldName', () => {
		// The original bug: fieldName: 'stripe_id' resolves to the snake_case column
		// name, which is NOT a drizzle property key, so the field is dropped.
		expect(resolvedFieldName(userAdditionalFields.stripeId)).toBe('');
		expect(columnPropertyKeys).toContain('stripeId');
		expect(columnPropertyKeys).not.toContain('stripe_id');
	});

	it('documents the failure mode: a snake_case fieldName would not resolve', () => {
		const brokenConfig = { fieldName: 'stripe_id' };
		const resolved = resolvedFieldName(brokenConfig) || 'stripeId';
		// This is exactly what the adapter would look up under the old config — and
		// why it returned undefined.
		expect(columnPropertyKeys).not.toContain(resolved);
	});
});
