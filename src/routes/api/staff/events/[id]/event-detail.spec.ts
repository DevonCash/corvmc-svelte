import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHasAnyRole = vi.fn();
vi.mock('$lib/server/authorization', () => ({
	hasAnyRole: (...args: unknown[]) => mockHasAnyRole(...args)
}));

const mockGetById = vi.fn();
vi.mock('$lib/server/event/event-service', () => ({
	getById: (...args: unknown[]) => mockGetById(...args)
}));

const mockGetPublicUrl = vi.fn();
const mockIsConfigured = vi.fn();
vi.mock('$lib/server/storage', () => ({
	getPublicUrl: (...args: unknown[]) => mockGetPublicUrl(...args),
	isConfigured: (...args: unknown[]) => mockIsConfigured(...args)
}));

const mockGetEventTickets = vi.fn();
const mockGetTicketsSold = vi.fn();
const mockGetTicketsRemaining = vi.fn();
vi.mock('$lib/server/ticket/ticket-service', () => ({
	getEventTickets: (...args: unknown[]) => mockGetEventTickets(...args),
	getTicketsSold: (...args: unknown[]) => mockGetTicketsSold(...args),
	getTicketsRemaining: (...args: unknown[]) => mockGetTicketsRemaining(...args)
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
	reservation: { id: 'id', status: 'status', startsAt: 'starts_at', endsAt: 'ends_at' }
}));

vi.mock('$lib/server/db/schema/authentication', () => ({
	user: { id: 'id', name: 'name', email: 'email' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn()
}));

beforeEach(() => {
	vi.clearAllMocks();
	selectResultQueue.length = 0;
	mockHasAnyRole.mockResolvedValue(true);
	mockIsConfigured.mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date('2026-05-20T19:00:00Z');
const later = new Date('2026-05-20T22:00:00Z');

function makeEvent(overrides?: Record<string, unknown>) {
	return {
		id: 'event-1',
		title: 'Test Show',
		status: 'published',
		startsAt: now,
		endsAt: later,
		doorsAt: null,
		publishedAt: now,
		createdAt: now,
		updatedAt: now,
		createdByUserId: 'user-1',
		reservationId: null,
		posterKey: null,
		ticketingEnabled: false,
		ticketPrice: null,
		ticketCapacity: null,
		...overrides
	};
}

function req(opts?: { user?: Record<string, unknown> | null; params?: Record<string, string> }) {
	return {
		locals: { user: opts?.user === null ? null : (opts?.user ?? { id: 'staff-1' }) },
		params: opts?.params ?? { id: 'event-1' }
	} as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/staff/events/[id]', () => {
	it('returns 401 when not authenticated', async () => {
		const { GET } = await import('./+server');
		await expect(GET(req({ user: null }))).rejects.toThrow();
	});

	it('returns 403 when user lacks staff role', async () => {
		mockHasAnyRole.mockResolvedValue(false);
		const { GET } = await import('./+server');
		await expect(GET(req())).rejects.toThrow();
	});

	it('returns 404 when event not found', async () => {
		mockGetById.mockResolvedValue(null);
		const { GET } = await import('./+server');
		await expect(GET(req())).rejects.toThrow();
	});

	it('returns event with serialized dates', async () => {
		mockGetById.mockResolvedValue(makeEvent());
		selectResultQueue.push([{ name: 'Alice', email: 'alice@test.com' }]); // creator

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.event.id).toBe('event-1');
		expect(body.event.startsAt).toBe(now.toISOString());
		expect(body.event.endsAt).toBe(later.toISOString());
		expect(body.creator).toEqual({ name: 'Alice', email: 'alice@test.com' });
	});

	it('includes posterUrl when poster key exists and storage is configured', async () => {
		mockGetById.mockResolvedValue(makeEvent({ posterKey: 'posters/event-1.jpg' }));
		mockIsConfigured.mockReturnValue(true);
		mockGetPublicUrl.mockReturnValue('https://cdn.example.com/posters/event-1.jpg');
		selectResultQueue.push([{ name: 'Alice', email: 'alice@test.com' }]); // creator

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.posterUrl).toBe('https://cdn.example.com/posters/event-1.jpg');
	});

	it('returns null posterUrl when no poster key', async () => {
		mockGetById.mockResolvedValue(makeEvent());
		selectResultQueue.push([{ name: 'Alice', email: 'alice@test.com' }]); // creator

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.posterUrl).toBeNull();
	});

	it('includes linked reservation when reservationId is set', async () => {
		const resStart = new Date('2026-05-20T18:00:00Z');
		const resEnd = new Date('2026-05-20T22:00:00Z');

		mockGetById.mockResolvedValue(makeEvent({ reservationId: 'res-linked' }));
		selectResultQueue.push([{ name: 'Alice', email: 'alice@test.com' }]); // creator
		selectResultQueue.push([{ id: 'res-linked', status: 'confirmed', startsAt: resStart, endsAt: resEnd }]); // reservation

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.linkedReservation).toEqual({
			id: 'res-linked',
			status: 'confirmed',
			startsAt: resStart.toISOString(),
			endsAt: resEnd.toISOString()
		});
	});

	it('returns null linkedReservation when no reservationId', async () => {
		mockGetById.mockResolvedValue(makeEvent());
		selectResultQueue.push([{ name: 'Alice', email: 'alice@test.com' }]); // creator

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.linkedReservation).toBeNull();
	});

	it('includes ticket stats when ticketing is enabled', async () => {
		mockGetById.mockResolvedValue(makeEvent({ ticketingEnabled: true, ticketPrice: 1000 }));
		selectResultQueue.push([{ name: 'Alice', email: 'alice@test.com' }]); // creator

		mockGetTicketsSold.mockResolvedValue(15);
		mockGetTicketsRemaining.mockResolvedValue(85);
		mockGetEventTickets.mockResolvedValue([
			{
				id: 't-1', purchaseId: 'p-1', attendeeName: 'Bob', attendeeEmail: 'bob@test.com',
				code: 'ABC123', status: 'confirmed', checkedInAt: null, createdAt: now
			}
		]);

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.ticketStats).toEqual({ sold: 15, remaining: 85 });
		expect(body.tickets).toHaveLength(1);
		expect(body.tickets[0].code).toBe('ABC123');
	});

	it('omits ticket data when ticketing is not enabled', async () => {
		mockGetById.mockResolvedValue(makeEvent({ ticketingEnabled: false }));
		selectResultQueue.push([{ name: 'Alice', email: 'alice@test.com' }]); // creator

		const { GET } = await import('./+server');
		const response = await GET(req());
		const body = await response.json() as any;

		expect(body.ticketStats).toBeNull();
		expect(body.tickets).toEqual([]);
		expect(mockGetTicketsSold).not.toHaveBeenCalled();
	});
});
