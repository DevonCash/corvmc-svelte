import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHasAnyRole = vi.fn();
const mockPrimaryRoleFor = vi.fn();
vi.mock('$lib/server/authorization', () => ({
	hasAnyRole: (...args: unknown[]) => mockHasAnyRole(...args),
	primaryRoleFor: (...args: unknown[]) => mockPrimaryRoleFor(...args)
}));

const mockPaginate = vi.fn();
const mockParsePagination = vi.fn();
vi.mock('$lib/server/db/paginate', () => ({
	paginate: (...args: unknown[]) => mockPaginate(...args),
	parsePagination: (...args: unknown[]) => mockParsePagination(...args)
}));

const selectResultQueue: unknown[][] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => {
					resolve(selectResultQueue.shift() ?? []);
				};
			}
			if (prop === '$dynamic') return () => proxy;
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

vi.mock('$lib/server/db/schema/reservation', () => ({
	reservation: {
		id: 'id', status: 'status', startsAt: 'starts_at', endsAt: 'ends_at',
		bookerType: 'booker_type', notes: 'notes', stripePaymentRecordId: 'stripe_payment_record_id',
		createdByUserId: 'created_by_user_id', recurringSeriesId: 'recurring_series_id'
	}
}));

vi.mock('$lib/server/db/schema/auth', () => ({
	user: { id: 'id', name: 'name', email: 'email', pronouns: 'pronouns' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(), and: vi.fn(), ne: vi.fn(), gt: vi.fn(), lt: vi.fn(),
	inArray: vi.fn(), like: vi.fn(), or: vi.fn(), desc: vi.fn(), asc: vi.fn(),
	count: vi.fn()
}));

const mockConfig = vi.fn();
vi.mock('$lib/server/site-config/site-config-service', () => ({
	config: (...args: unknown[]) => mockConfig(...args)
}));

beforeEach(() => {
	vi.clearAllMocks();
	selectResultQueue.length = 0;
	mockHasAnyRole.mockResolvedValue(true);
	mockPrimaryRoleFor.mockReturnValue('member');
	mockConfig.mockImplementation(async (key: string) => {
		if (key === 'reservation.hourlyRateCents') return 1500;
	});
	mockParsePagination.mockReturnValue({ page: 1, pageSize: 50 });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();
const later = new Date(now.getTime() + 3600000);

function makeRow(overrides?: Record<string, unknown>) {
	return {
		id: 'res-1', status: 'scheduled', startsAt: now, endsAt: later,
		bookerType: 'member', notes: '', stripePaymentRecordId: null,
		createdByUserId: 'user-1', recurringSeriesId: null,
		memberName: 'Alice', memberEmail: 'alice@test.com',
		memberPronouns: 'she/her', memberRole: 'member',
		...overrides
	};
}

function req(opts?: { user?: Record<string, unknown> | null; searchParams?: Record<string, string> }) {
	const url = new URL('http://localhost/api/staff/reservations');
	if (opts?.searchParams) {
		for (const [k, v] of Object.entries(opts.searchParams)) {
			url.searchParams.set(k, v);
		}
	}
	return {
		locals: { user: opts?.user === null ? null : (opts?.user ?? { id: 'staff-1' }) },
		url
	} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/staff/reservations', () => {
	it('returns 401 when not authenticated', async () => {
		const { GET } = await import('./+server');
		await expect(GET(req({ user: null }))).rejects.toThrow();
	});

	it('returns 403 when user lacks staff role', async () => {
		mockHasAnyRole.mockResolvedValue(false);
		const { GET } = await import('./+server');
		await expect(GET(req())).rejects.toThrow();
	});

	it('returns paginated reservations with counts', async () => {
		const rows = [makeRow()];
		mockPaginate.mockResolvedValue({
			rows,
			pagination: { page: 1, pageSize: 50, total: 1, totalPages: 1 }
		});

		// unresolved query, upcomingCount, allCount
		selectResultQueue.push([]); // unresolved
		selectResultQueue.push([{ count: 5 }]); // upcoming count
		selectResultQueue.push([{ count: 10 }]); // all count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.reservations).toHaveLength(1);
		expect(body.reservations[0].startsAt).toBe(now.toISOString());
		expect(body.counts).toEqual({ upcoming: 5, all: 10, unresolved: 0 });
		expect(body.hourlyRateCents).toBe(1500);
		expect(body.pagination).toBeDefined();
	});

	it('includes unresolved reservations', async () => {
		mockPaginate.mockResolvedValue({
			rows: [],
			pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }
		});

		const unresolvedRow = makeRow({ id: 'res-unresolved', status: 'scheduled' });
		selectResultQueue.push([unresolvedRow]); // unresolved
		selectResultQueue.push([{ count: 0 }]); // upcoming
		selectResultQueue.push([{ count: 1 }]); // all

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.unresolved).toHaveLength(1);
		expect(body.counts.unresolved).toBe(1);
	});

	it('passes tab parameter through', async () => {
		mockPaginate.mockResolvedValue({
			rows: [],
			pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }
		});
		selectResultQueue.push([]); // unresolved
		selectResultQueue.push([{ count: 0 }]); // upcoming
		selectResultQueue.push([{ count: 0 }]); // all

		const { GET } = await import('./+server');
		const response = await GET(req({ searchParams: { tab: 'all' } }));
		const body = await response.json() as any;

		expect(body.tab).toBe('all');
	});

	it('passes search and filter parameters through', async () => {
		mockPaginate.mockResolvedValue({
			rows: [],
			pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 }
		});
		selectResultQueue.push([]); // unresolved
		selectResultQueue.push([{ count: 0 }]); // upcoming
		selectResultQueue.push([{ count: 0 }]); // all

		const { GET } = await import('./+server');
		const response = await GET(req({
			searchParams: { q: 'alice', from: '2026-05-01', to: '2026-05-31' }
		}));
		const body = await response.json() as any;

		expect(body.search).toBe('alice');
		expect(body.dateFrom).toBe('2026-05-01');
		expect(body.dateTo).toBe('2026-05-31');
	});
});
