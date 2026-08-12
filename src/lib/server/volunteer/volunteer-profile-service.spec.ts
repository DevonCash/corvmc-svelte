import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// What matters here is what the service decides to write, not the SQL. These
// capture the batched statements and let each test seed what the profile read
// returns. `db.batch` takes the statements as values, so the assertions run
// against the captured insert/update payloads rather than rendered queries.
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];
let insertedValues: unknown[] = [];
let updatedSets: { table: string; values: unknown }[] = [];
let updateReturns: unknown[] = [];
let batchedCount = 0;

/** Stands in for whichever table object drizzle was handed. */
function tableName(t: unknown): string {
	const sym = Object.getOwnPropertySymbols(t as object).find((s) => String(s).includes('Name'));
	return sym ? String((t as Record<symbol, unknown>)[sym]) : 'unknown';
}

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

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => chainableSelect()),
		insert: vi.fn(() => ({
			values: vi.fn((row: unknown) => {
				insertedValues.push(row);
				return { returning: vi.fn(() => Promise.resolve([row])) };
			})
		})),
		update: vi.fn((table: unknown) => ({
			set: vi.fn((values: unknown) => {
				updatedSets.push({ table: tableName(table), values });
				const chain: any = {
					where: vi.fn(() => chain),
					returning: vi.fn(() => Promise.resolve(updateReturns)),
					then: (resolve: (v: unknown[]) => void) => resolve(updateReturns)
				};
				return chain;
			})
		})),
		// Batch resolves the statements it is handed; the payloads were already
		// captured by the insert/update mocks above.
		batch: vi.fn(async (statements: unknown[]) => {
			batchedCount = statements.length;
			return [];
		})
	}
}));

vi.mock('$lib/server/authorization', () => ({ primaryRoleFor: vi.fn(() => null) }));

import {
	completeVolunteerOnboarding,
	updateVolunteerProfile,
	setAvailability,
	approveMinorVolunteer,
	requireActiveVolunteer,
	stageOf,
	VolunteerProfileBlockedError,
	VolunteerProfileExistsError,
	VolunteerProfileNotFoundError,
	VolunteerProfileValidationError,
	VolunteerAlreadyApprovedError
} from './volunteer-profile-service';
import { VOLUNTEER_AVAILABILITY_MAX, VOLUNTEER_NAME_MAX } from '$lib/config';

function profile(over: Record<string, unknown> = {}) {
	return {
		id: 'vp-1',
		userId: 'user-1',
		firstName: 'Ada',
		lastName: 'Lovelace',
		isAdult: true,
		status: 'active',
		availability: null,
		approvedByUserId: null,
		approvedAt: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		...over
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	selectResultQueue = [];
	insertedValues = [];
	updatedSets = [];
	updateReturns = [];
	batchedCount = 0;
});

describe('completeVolunteerOnboarding', () => {
	/**
	 * The load-bearing test. The whole table exists so this answer is on file
	 * before anybody claims a shift, and the mapping lives in the service rather
	 * than the remote so a hand-crafted POST cannot route around it.
	 */
	it('blocks a member who says they are under 18', async () => {
		selectResultQueue = [[]]; // no existing profile

		const row = await completeVolunteerOnboarding('user-1', {
			firstName: 'Sam',
			lastName: 'Reyes',
			isAdult: false
		});

		expect(row.status).toBe('blocked');
		expect(row.isAdult).toBe(false);
	});

	it('lets an adult straight through', async () => {
		selectResultQueue = [[]];

		const row = await completeVolunteerOnboarding('user-1', {
			firstName: 'Sam',
			lastName: 'Reyes',
			isAdult: true
		});

		expect(row.status).toBe('active');
		expect(row.isAdult).toBe(true);
	});

	/**
	 * Pronouns and phone already exist on `user` and /member/account edits them.
	 * A second copy on the profile would be stale by the next time anybody looked,
	 * so onboarding writes back — and must leave `name` alone, because that is the
	 * display name the directory, staff tables and emails all render.
	 */
	it('writes pronouns and phone back to the user row without touching the name', async () => {
		selectResultQueue = [[]];

		await completeVolunteerOnboarding('user-1', {
			firstName: 'Sam',
			lastName: 'Reyes',
			isAdult: true,
			pronouns: 'they/them',
			phone: '(541) 555-0123'
		});

		const userUpdate = updatedSets.find((u) => u.table === 'user');
		expect(userUpdate?.values).toMatchObject({ pronouns: 'they/them', phone: '(541) 555-0123' });
		expect(userUpdate?.values).not.toHaveProperty('name');
		// Profile insert + user update, in one batch — not a transaction, which D1
		// does not have and the lint rule forbids.
		expect(batchedCount).toBe(2);
	});

	it('refuses a second signup', async () => {
		selectResultQueue = [[profile()]];

		await expect(
			completeVolunteerOnboarding('user-1', { firstName: 'Sam', lastName: 'Reyes', isAdult: true })
		).rejects.toThrow(VolunteerProfileExistsError);
	});

	it('requires both names', async () => {
		selectResultQueue = [[]];
		await expect(
			completeVolunteerOnboarding('user-1', { firstName: '  ', lastName: 'Reyes', isAdult: true })
		).rejects.toThrow(VolunteerProfileValidationError);

		selectResultQueue = [[]];
		await expect(
			completeVolunteerOnboarding('user-1', { firstName: 'Sam', lastName: '', isAdult: true })
		).rejects.toThrow(VolunteerProfileValidationError);
	});

	it('caps name length', async () => {
		selectResultQueue = [[]];

		await expect(
			completeVolunteerOnboarding('user-1', {
				firstName: 'a'.repeat(VOLUNTEER_NAME_MAX + 1),
				lastName: 'Reyes',
				isAdult: true
			})
		).rejects.toThrow(VolunteerProfileValidationError);
	});
});

describe('updateVolunteerProfile', () => {
	/**
	 * The self-unblock bypass. The Profile modal reuses the same name fields, so
	 * the one thing it must not accept is another crack at the age question —
	 * otherwise a blocked minor clears themselves by reopening it.
	 */
	it('leaves isAdult and status alone for a blocked minor', async () => {
		selectResultQueue = [[profile({ isAdult: false, status: 'blocked' })]];

		const row = await updateVolunteerProfile('user-1', {
			firstName: 'Sam',
			lastName: 'Reyes'
		});

		expect(row.status).toBe('blocked');
		expect(row.isAdult).toBe(false);

		const profileUpdate = updatedSets.find((u) => u.table === 'volunteer_profile');
		// Asserted present first, so the two `not.toHaveProperty` checks below
		// cannot pass by matching nothing at all.
		expect(profileUpdate?.values).toMatchObject({ firstName: 'Sam', lastName: 'Reyes' });
		expect(profileUpdate?.values).not.toHaveProperty('isAdult');
		expect(profileUpdate?.values).not.toHaveProperty('status');
	});

	it('refuses to edit a profile that does not exist', async () => {
		selectResultQueue = [[]];

		await expect(
			updateVolunteerProfile('user-1', { firstName: 'Sam', lastName: 'Reyes' })
		).rejects.toThrow(VolunteerProfileNotFoundError);
	});
});

describe('setAvailability', () => {
	it('stores a trimmed note', async () => {
		updateReturns = [{ id: 'vp-1' }];

		await setAvailability('user-1', '  Weekday evenings  ');

		const update = updatedSets.find((u) => u.table === 'volunteer_profile');
		expect(update?.values).toMatchObject({ availability: 'Weekday evenings' });
	});

	it('stores an empty note as null rather than an empty string', async () => {
		updateReturns = [{ id: 'vp-1' }];

		await setAvailability('user-1', '   ');

		const update = updatedSets.find((u) => u.table === 'volunteer_profile');
		expect(update?.values).toMatchObject({ availability: null });
	});

	it('caps the note length', async () => {
		await expect(
			setAvailability('user-1', 'x'.repeat(VOLUNTEER_AVAILABILITY_MAX + 1))
		).rejects.toThrow(VolunteerProfileValidationError);
	});

	it('refuses when there is no profile to attach it to', async () => {
		updateReturns = [];

		await expect(setAvailability('user-1', 'Evenings')).rejects.toThrow(
			VolunteerProfileNotFoundError
		);
	});
});

describe('approveMinorVolunteer', () => {
	it('stamps the approver and opens the gate', async () => {
		updateReturns = [profile({ isAdult: false, status: 'active', approvedByUserId: 'staff-1' })];

		const row = await approveMinorVolunteer('user-1', 'staff-1');

		expect(row.status).toBe('active');
		const update = updatedSets.find((u) => u.table === 'volunteer_profile');
		expect(update?.values).toMatchObject({ status: 'active', approvedByUserId: 'staff-1' });
	});

	/**
	 * Approval moves `status` and leaves `isAdult` — staff still need to know
	 * they're working with a minor after the override, which is exactly the fact a
	 * three-state status would have erased.
	 */
	it('does not rewrite isAdult', async () => {
		updateReturns = [profile({ isAdult: false, status: 'active' })];

		await approveMinorVolunteer('user-1', 'staff-1');

		const update = updatedSets.find((u) => u.table === 'volunteer_profile');
		expect(update?.values).toMatchObject({ status: 'active' });
		expect(update?.values).not.toHaveProperty('isAdult');
	});

	it('tells a double-click apart from a missing profile', async () => {
		updateReturns = [];
		selectResultQueue = [[profile({ isAdult: false, status: 'active' })]];

		await expect(approveMinorVolunteer('user-1', 'staff-1')).rejects.toThrow(
			VolunteerAlreadyApprovedError
		);

		updateReturns = [];
		selectResultQueue = [[]];

		await expect(approveMinorVolunteer('user-1', 'staff-1')).rejects.toThrow(
			VolunteerProfileNotFoundError
		);
	});
});

describe('requireActiveVolunteer', () => {
	it('passes an active volunteer through', async () => {
		selectResultQueue = [[profile()]];
		await expect(requireActiveVolunteer('user-1')).resolves.toMatchObject({ status: 'active' });
	});

	it('refuses a blocked one', async () => {
		selectResultQueue = [[profile({ status: 'blocked' })]];
		await expect(requireActiveVolunteer('user-1')).rejects.toThrow(VolunteerProfileBlockedError);
	});

	it('refuses somebody who never onboarded', async () => {
		selectResultQueue = [[]];
		await expect(requireActiveVolunteer('user-1')).rejects.toThrow(VolunteerProfileNotFoundError);
	});
});

describe('stageOf', () => {
	it('maps a profile to the stage its route gate keys on', () => {
		expect(stageOf(null)).toBe('none');
		expect(stageOf(profile({ status: 'blocked' }) as never)).toBe('blocked');
		expect(stageOf(profile() as never)).toBe('active');
	});
});
