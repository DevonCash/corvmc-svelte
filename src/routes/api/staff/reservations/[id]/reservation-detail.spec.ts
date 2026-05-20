import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHasAnyRole = vi.fn();
vi.mock('$lib/server/authorization', () => ({
	hasAnyRole: (...args: unknown[]) => mockHasAnyRole(...args)
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
		bookerType: 'booker_type', bookerId: 'booker_id', notes: 'notes',
		cancellationReason: 'cancellation_reason',
		stripePaymentRecordId: 'stripe_payment_record_id',
		createdByUserId: 'created_by_user_id', createdAt: 'created_at'
	}
}));

vi.mock('$lib/server/db/schema/auth', () => ({
	user: { id: 'id', name: 'name', email: 'email', phone: 'phone', pronouns: 'pronouns', image: 'image' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(), and: vi.fn(), ne: vi.fn(), gt: vi.fn(), lt: vi.fn(),
	asc: vi.fn(), desc: vi.fn(), count: vi.fn()
}));

const mockGetProductConfig = vi.fn();
vi.mock('$lib/server/finance/product-config-service', () => ({
	getProductConfig: (...args: unknown[]) => mockGetProductConfig(...args)
}));

vi.mock('$lib/server/reservation/timezone', () => ({
	formatDateInTz: () => '2026-05-20',
	buildDateInTz: (_date: string, time: string) =>
		time === '00:00' ? new Date('2026-05-20T00:00:00') : new Date('2026-05-20T23:59:00')
}));

beforeEach(() => {
	vi.clearAllMocks();
	selectResultQueue.length = 0;
	mockHasAnyRole.mockResolvedValue(true);
	mockGetProductConfig.mockResolvedValue({ unitAmountCents: 1500 });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date('2026-05-20T10:00:00Z');
const later = new Date('2026-05-20T12:00:00Z');

function makeRow(overrides?: Record<string, unknown>) {
	return {
		id: 'res-1', status: 'confirmed', startsAt: now, endsAt: later,
		bookerType: 'member', bookerId: null, notes: 'Practice',
		cancellationReason: null, stripePaymentRecordId: null,
		createdByUserId: 'user-1', createdAt: now,
		memberName: 'Alice', memberEmail: 'alice@test.com',
		memberPhone: '555-1234', memberPronouns: 'she/her', memberImage: null,
		...overrides
	};
}

function req(opts?: { user?: Record<string, unknown> | null; params?: Record<string, string> }) {
	return {
		locals: { user: opts?.user === null ? null : (opts?.user ?? { id: 'staff-1' }) },
		params: opts?.params ?? { id: 'res-1' }
	} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/staff/reservations/[id]', () => {
	it('returns 401 when not authenticated', async () => {
		const { GET } = await import('./+server');
		await expect(GET(req({ user: null }))).rejects.toThrow();
	});

	it('returns 403 when user lacks staff role', async () => {
		mockHasAnyRole.mockResolvedValue(false);
		const { GET } = await import('./+server');
		await expect(GET(req())).rejects.toThrow();
	});

	it('returns 404 when reservation not found', async () => {
		selectResultQueue.push([]); // reservation lookup
		const { GET } = await import('./+server');
		await expect(GET(req())).rejects.toThrow();
	});

	it('returns full reservation detail with serialized dates', async () => {
		selectResultQueue.push([makeRow()]); // reservation
		selectResultQueue.push([]); // same-day
		selectResultQueue.push([]); // prev
		selectResultQueue.push([]); // next
		selectResultQueue.push([{ count: 0 }]); // completed count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.reservation.id).toBe('res-1');
		expect(body.reservation.startsAt).toBe(now.toISOString());
		expect(body.reservation.memberName).toBe('Alice');
		expect(body.hourlyRateCents).toBe(1500);
	});

	it('includes same-day reservations', async () => {
		const otherRes = {
			id: 'res-2', bookerType: 'member', startsAt: later, endsAt: new Date(later.getTime() + 3600000), status: 'confirmed'
		};
		selectResultQueue.push([makeRow()]); // reservation
		selectResultQueue.push([otherRes]); // same-day
		selectResultQueue.push([]); // prev
		selectResultQueue.push([]); // next
		selectResultQueue.push([{ count: 0 }]); // completed count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.sameDayReservations).toHaveLength(1);
	});

	it('returns prev/next IDs for navigation', async () => {
		selectResultQueue.push([makeRow()]); // reservation
		selectResultQueue.push([]); // same-day
		selectResultQueue.push([{ id: 'res-prev' }]); // prev
		selectResultQueue.push([{ id: 'res-next', startsAt: later }]); // next
		selectResultQueue.push([{ count: 0 }]); // completed count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.prevId).toBe('res-prev');
		expect(body.nextId).toBe('res-next');
	});

	it('returns null for prev/next when none exist', async () => {
		selectResultQueue.push([makeRow()]); // reservation
		selectResultQueue.push([]); // same-day
		selectResultQueue.push([]); // prev
		selectResultQueue.push([]); // next
		selectResultQueue.push([{ count: 0 }]); // completed count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.prevId).toBeNull();
		expect(body.nextId).toBeNull();
	});

	it('returns isFirstReservation=true when no completed reservations', async () => {
		selectResultQueue.push([makeRow()]); // reservation
		selectResultQueue.push([]); // same-day
		selectResultQueue.push([]); // prev
		selectResultQueue.push([]); // next
		selectResultQueue.push([{ count: 0 }]); // completed count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.isFirstReservation).toBe(true);
	});

	it('returns isFirstReservation=false when completed reservations exist', async () => {
		selectResultQueue.push([makeRow()]); // reservation
		selectResultQueue.push([]); // same-day
		selectResultQueue.push([]); // prev
		selectResultQueue.push([]); // next
		selectResultQueue.push([{ count: 3 }]); // completed count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.isFirstReservation).toBe(false);
	});

	it('computes isLastOfDay correctly', async () => {
		selectResultQueue.push([makeRow()]); // reservation
		selectResultQueue.push([]); // no same-day after this one
		selectResultQueue.push([]); // prev
		selectResultQueue.push([]); // next
		selectResultQueue.push([{ count: 0 }]); // completed count

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.isLastOfDay).toBe(true);
	});
});
