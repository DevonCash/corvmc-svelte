import { describe, it, expect } from 'vitest';
import { creditSourceLabels, equipmentConditionBadge, equipmentConditions } from './config';
import { transactionSources } from './server/db/schema/finance';
import { titleCase } from './utils/format';

/**
 * Enum→label maps drift silently: SQLite doesn't enforce a text enum, so an
 * unlabelled source reached the staff credits page as raw snake_case
 * (`subscription_allocation`, which wasn't even a valid source — the seed
 * script wrote it and nothing rejected it). These assert each map covers its
 * enum, and only its enum.
 */
describe('creditSourceLabels', () => {
	it('labels every transaction source', () => {
		const missing = transactionSources.filter((s) => !(s in creditSourceLabels));
		expect(missing, 'add these to `creditSourceLabels` in src/lib/config.ts').toEqual([]);
	});

	it('has no labels for sources that no longer exist', () => {
		const stale = Object.keys(creditSourceLabels).filter(
			(s) => !(transactionSources as readonly string[]).includes(s)
		);
		expect(stale, 'these are not in `transactionSources`').toEqual([]);
	});

	it('never renders a raw snake_case token', () => {
		for (const source of transactionSources) {
			expect(creditSourceLabels[source]).not.toContain('_');
		}
	});
});

describe('equipmentConditionBadge', () => {
	it('colours every condition', () => {
		const missing = equipmentConditions.filter((c) => !(c in equipmentConditionBadge));
		expect(missing, 'add these to `equipmentConditionBadge`').toEqual([]);
	});

	it('gives each condition a distinct colour — it is an ordinal scale', () => {
		const colours = equipmentConditions.map((c) => equipmentConditionBadge[c]);
		expect(new Set(colours).size).toBe(equipmentConditions.length);
	});
});

describe('titleCase', () => {
	it('humanises a snake_case enum value', () => {
		expect(titleCase('admin_adjustment')).toBe('Admin adjustment');
	});

	it('capitalises a single word', () => {
		expect(titleCase('available')).toBe('Available');
	});

	it('passes an empty string through', () => {
		expect(titleCase('')).toBe('');
	});
});
