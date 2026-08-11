import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResultQueue: unknown[][] = [];
let insertedValues: unknown[] = [];

function chainable() {
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
		select: vi.fn(() => chainable()),
		insert: vi.fn(() => ({
			values: vi.fn((v: unknown) => {
				insertedValues.push(v);
				return { returning: vi.fn(() => Promise.resolve([v])) };
			})
		})),
		update: vi.fn(() => chainable()),
		delete: vi.fn(() => chainable())
	}
}));

import {
	wasHeldOn,
	certificationState,
	grantCertification,
	missingRequirements
} from './member-certification-service';
import { CERT_EXPIRY_WARNING_DAYS, DEFAULT_TIMEZONE } from '$lib/config';
import { buildDateInTz } from '$lib/server/reservation/timezone';

const noon = (d: string) => buildDateInTz(d, '12:00', DEFAULT_TIMEZONE);

beforeEach(() => {
	vi.clearAllMocks();
	selectResultQueue = [];
	insertedValues = [];
});

describe('wasHeldOn', () => {
	const worked = noon('2026-06-15');

	it('is false before the grant date', () => {
		expect(
			wasHeldOn({ grantedAt: noon('2026-06-16'), expiresAt: null, revokedAt: null }, worked)
		).toBe(false);
	});

	it('is true on the grant date itself', () => {
		expect(
			wasHeldOn({ grantedAt: noon('2026-06-15'), expiresAt: null, revokedAt: null }, worked)
		).toBe(true);
	});

	// The two rules below are asymmetric on purpose and easy to get backwards.

	it('a card is valid THROUGH its expiry date', () => {
		expect(
			wasHeldOn(
				{ grantedAt: noon('2026-01-01'), expiresAt: noon('2026-06-15'), revokedAt: null },
				worked
			)
		).toBe(true);
	});

	it('a card is not valid the day after it expires', () => {
		expect(
			wasHeldOn(
				{ grantedAt: noon('2026-01-01'), expiresAt: noon('2026-06-14'), revokedAt: null },
				worked
			)
		).toBe(false);
	});

	it('a clearance pulled ON the day was NOT in force that day', () => {
		expect(
			wasHeldOn(
				{ grantedAt: noon('2026-01-01'), expiresAt: null, revokedAt: noon('2026-06-15') },
				worked
			)
		).toBe(false);
	});

	it('a clearance pulled the day after was in force', () => {
		expect(
			wasHeldOn(
				{ grantedAt: noon('2026-01-01'), expiresAt: null, revokedAt: noon('2026-06-16') },
				worked
			)
		).toBe(true);
	});

	it('never expires when expiresAt is null', () => {
		expect(
			wasHeldOn({ grantedAt: noon('2020-01-01'), expiresAt: null, revokedAt: null }, worked)
		).toBe(true);
	});
});

describe('certificationState', () => {
	const today = noon('2026-06-15');

	it('reads revoked before anything else', () => {
		expect(
			certificationState(
				{ grantedAt: noon('2026-01-01'), expiresAt: noon('2020-01-01'), revokedAt: today },
				today
			)
		).toBe('revoked');
	});

	it('reads expired when past expiry', () => {
		expect(
			certificationState(
				{ grantedAt: noon('2026-01-01'), expiresAt: noon('2026-06-14'), revokedAt: null },
				today
			)
		).toBe('expired');
	});

	it('reads expiring inside the warning window', () => {
		const soon = new Date(today.getTime() + (CERT_EXPIRY_WARNING_DAYS - 1) * 86_400_000);
		expect(
			certificationState({ grantedAt: noon('2026-01-01'), expiresAt: soon, revokedAt: null }, today)
		).toBe('expiring');
	});

	it('reads current outside the warning window', () => {
		const later = new Date(today.getTime() + (CERT_EXPIRY_WARNING_DAYS + 1) * 86_400_000);
		expect(
			certificationState(
				{ grantedAt: noon('2026-01-01'), expiresAt: later, revokedAt: null },
				today
			)
		).toBe('current');
	});

	it('reads current when it never expires', () => {
		expect(
			certificationState({ grantedAt: noon('2020-01-01'), expiresAt: null, revokedAt: null }, today)
		).toBe('current');
	});
});

describe('grantCertification', () => {
	it('stamps expiresAt from the catalog rather than leaving it to be computed later', async () => {
		selectResultQueue = [[{ validityMonths: 36 }]];

		await grantCertification({
			userId: 'u1',
			certificationId: 'c1',
			grantedOn: '2026-06-15',
			grantedByUserId: 'staff'
		});

		const row = insertedValues[0] as { expiresAt: Date | null };
		expect(row.expiresAt).toEqual(noon('2029-06-15'));
	});

	it('leaves expiresAt null for a certification that never lapses', async () => {
		selectResultQueue = [[{ validityMonths: null }]];

		await grantCertification({
			userId: 'u1',
			certificationId: 'c1',
			grantedOn: '2026-06-15',
			grantedByUserId: 'staff'
		});

		expect((insertedValues[0] as { expiresAt: Date | null }).expiresAt).toBeNull();
	});

	// A renewal is a second grant, not an edit — the old row keeps its dates so
	// "were they cleared last March" still has an answer.
	it('inserts rather than updating, so renewals append', async () => {
		selectResultQueue = [[{ validityMonths: 12 }]];

		await grantCertification({
			userId: 'u1',
			certificationId: 'c1',
			grantedOn: '2026-06-15',
			grantedByUserId: 'staff'
		});

		const { db } = await import('$lib/server/db');
		expect(vi.mocked(db.insert)).toHaveBeenCalled();
		expect(vi.mocked(db.update)).not.toHaveBeenCalled();
	});
});

describe('missingRequirements', () => {
	it('is empty when the role requires nothing', async () => {
		selectResultQueue = [[]];
		expect(await missingRequirements('u1', 'role-1')).toEqual([]);
	});

	it('lists only the requirements the member does not currently hold', async () => {
		selectResultQueue = [
			[
				{ id: 'cert-a', name: 'Sound Desk Cleared' },
				{ id: 'cert-b', name: 'First Aid' }
			],
			[{ id: 'cert-a' }]
		];

		expect(await missingRequirements('u1', 'role-1')).toEqual([
			{ id: 'cert-b', name: 'First Aid' }
		]);
	});
});
