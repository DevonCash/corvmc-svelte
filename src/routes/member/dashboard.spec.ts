import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResults: Map<string, unknown[]> = new Map();
let selectCallIndex = 0;

function chainable() {
	const idx = selectCallIndex++;
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				// Return results in order of select() calls
				const results = [...selectResults.values()];
				return (resolve: (v: unknown[]) => void) =>
					resolve(results[idx] ?? []);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable()
	}
}));

vi.mock('$lib/server/event/event-service', () => ({
	listUpcoming: vi.fn(async () => [])
}));

vi.mock('$lib/server/storage', () => ({
	isConfigured: () => false,
	getPublicUrl: (key: string) => `https://cdn.example.com/${key}`
}));

vi.mock('$lib/server/finance/credit-service', () => ({
	getAllBalances: vi.fn(async () => ({ free_hours: 0 }))
}));

vi.mock('$lib/server/finance/subscription-service', () => ({
	getSubscription: vi.fn(async () => null)
}));

const testUser = mockUser({ id: 'user-1', name: 'Test User' });

beforeEach(() => {
	vi.clearAllMocks();
	selectCallIndex = 0;
	selectResults = new Map();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('member dashboard load', () => {
	it('returns pendingInviteCount in load result', async () => {
		// select 1: userBands (active band memberships)
		selectResults.set('userBands', []);
		// select 2: pending invite count
		selectResults.set('pendingCount', [{ count: 2 }]);
		// select 3: user reservations
		selectResults.set('userRes', []);

		const { load } = await import('./+page.server');
		const result = (await load({
			locals: { user: testUser }
		} as any)) as any;

		expect(result.pendingInviteCount).toBe(2);
	});

	it('includes bandName on band reservations', async () => {
		const bandRes = {
			id: 'res-band-1',
			bookerType: 'band',
			bookerId: 'band-1',
			status: 'scheduled',
			startsAt: new Date('2026-05-13T18:00:00Z'),
			endsAt: new Date('2026-05-13T19:00:00Z'),
			notes: null,
			createdByUserId: 'user-1'
		};

		// select 1: userBands
		selectResults.set('userBands', [
			{ bandId: 'band-1', bandName: 'The Strokes' }
		]);
		// select 2: pending invite count
		selectResults.set('pendingCount', [{ count: 0 }]);
		// select 3: user reservations
		selectResults.set('userRes', []);
		// select 4: band reservations
		selectResults.set('bandRes', [bandRes]);

		const { load } = await import('./+page.server');
		const result = (await load({
			locals: { user: testUser }
		} as any)) as any;

		const bandReservation = result.weekReservations.find(
			(r: any) => r.bookerType === 'band'
		);
		expect(bandReservation).toBeDefined();
		expect(bandReservation.bandName).toBe('The Strokes');
	});

	it('returns zero pendingInviteCount when no invitations', async () => {
		selectResults.set('userBands', []);
		selectResults.set('pendingCount', [{ count: 0 }]);
		selectResults.set('userRes', []);

		const { load } = await import('./+page.server');
		const result = (await load({
			locals: { user: testUser }
		} as any)) as any;

		expect(result.pendingInviteCount).toBe(0);
	});
});
