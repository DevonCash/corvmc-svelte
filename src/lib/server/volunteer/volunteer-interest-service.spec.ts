import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// `setInterests` is a diff, so what matters is which rows it decides to write —
// not the SQL. These capture the delete/insert calls and let each test seed what
// the two reads (live roles, then current interests) return.
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];
let insertedValues: unknown[][] = [];
let deleteCalls: number = 0;

function chainableSelect() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(selectResultQueue.shift() ?? []);
			}
			return () => proxy;
		}
	});
	return proxy;
}

function chainableDelete() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') return (resolve: (v: unknown[]) => void) => resolve([]);
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => chainableSelect()),
		insert: vi.fn(() => ({
			values: vi.fn((rows: unknown[]) => {
				insertedValues.push(rows);
				return { onConflictDoNothing: vi.fn(() => Promise.resolve([])) };
			})
		})),
		delete: vi.fn(() => {
			deleteCalls++;
			return chainableDelete();
		})
	}
}));

vi.mock('$lib/server/authorization', () => ({
	primaryRoleFor: vi.fn(() => null)
}));

import { setInterests, VolunteerInterestValidationError } from './volunteer-interest-service';
import { VOLUNTEER_MAX_INTERESTS } from '$lib/config';

/**
 * Queue the reads `setInterests` makes and then run it.
 *
 * There are two, in order: the live-role check — which is `inArray(wanted)`, so
 * it only ever returns roles that were asked for — and the member's current
 * rows. The first is skipped entirely when nothing is ticked, so the queue has
 * to be built against `wanted` rather than stated flat.
 */
function run(
	wanted: string[],
	{ live, current }: { live: string[]; current: string[] }
): Promise<void> {
	// Deduped, like the service does before it queries — otherwise a submission
	// with repeats would queue more rows than the real `inArray` could return.
	const liveHits = [...new Set(wanted)].filter((id) => live.includes(id));
	selectResultQueue = [
		...(wanted.length > 0 ? [liveHits.map((id) => ({ id }))] : []),
		current.map((roleId) => ({ roleId }))
	];
	return setInterests('user-1', wanted);
}

describe('setInterests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		selectResultQueue = [];
		insertedValues = [];
		deleteCalls = 0;
	});

	it('inserts only the roles that are new', async () => {
		await run(['a', 'b'], { live: ['a', 'b', 'c'], current: ['a'] });

		expect(insertedValues.flat()).toEqual([{ userId: 'user-1', volunteerRoleId: 'b' }]);
	});

	it('deletes the roles that were unticked', async () => {
		await run(['a'], { live: ['a', 'b'], current: ['a', 'b'] });

		expect(deleteCalls).toBe(1);
		expect(insertedValues).toEqual([]);
	});

	// The whole reason the schema defaults to `[]` instead of requiring one
	// selection: "take me off the list" is a legitimate submission.
	it('clears every interest when nothing is ticked', async () => {
		await run([], { live: ['a', 'b'], current: ['a', 'b'] });

		expect(deleteCalls).toBe(1);
		expect(insertedValues).toEqual([]);
	});

	it('writes nothing when the set is unchanged', async () => {
		await run(['a', 'b'], { live: ['a', 'b'], current: ['a', 'b'] });

		expect(deleteCalls).toBe(0);
		expect(insertedValues).toEqual([]);
	});

	it('ignores duplicate ids in the submission', async () => {
		await run(['a', 'a', 'a'], { live: ['a'], current: [] });

		expect(insertedValues.flat()).toEqual([{ userId: 'user-1', volunteerRoleId: 'a' }]);
	});

	// An archived role isn't offered by the form, so seeing one means a stale page
	// or a hand-crafted post — either way it must not land in the table.
	it('rejects a role that is not live', async () => {
		await expect(run(['a', 'archived'], { live: ['a'], current: [] })).rejects.toThrow(
			VolunteerInterestValidationError
		);
		expect(insertedValues).toEqual([]);
	});

	it('rejects more roles than the cap allows', async () => {
		const tooMany = Array.from({ length: VOLUNTEER_MAX_INTERESTS + 1 }, (_, i) => `role-${i}`);

		await expect(setInterests('user-1', tooMany)).rejects.toThrow(VolunteerInterestValidationError);
		expect(insertedValues).toEqual([]);
	});

	// D1 rejects a statement with more than 100 bound parameters, so a large
	// submission has to arrive as several inserts rather than one.
	it('chunks a large insert', async () => {
		const ids = Array.from({ length: 40 }, (_, i) => `role-${i}`);
		await run(ids, { live: ids, current: [] });

		expect(insertedValues.length).toBeGreaterThan(1);
		expect(insertedValues.flat()).toHaveLength(40);
	});
});
