import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBand = {
	id: 'band-1',
	name: 'The Velvet Underground',
	slug: 'the-velvet-underground',
	bio: 'NYC band',
	ownerId: 'user-owner',
	avatarKey: null,
	memberCount: 3,
	createdAt: new Date(),
	updatedAt: new Date()
};

const bandServiceMock = {
	getBySlug: vi.fn(async () => mockBand),
	getUserRole: vi.fn(async () => 'member' as string | null),
	getMembers: vi.fn(async () => [
		{ userId: 'user-owner', status: 'active' },
		{ userId: 'user-2', status: 'active' }
	])
};

vi.mock('$lib/server/band/band-service', () => bandServiceMock);

const conflictServiceMock = {
	getAvailableSlots: vi.fn(async () => [
		{ startTime: '09:00', endTime: '09:30', available: true },
		{ startTime: '09:30', endTime: '10:00', available: true },
		{ startTime: '10:00', endTime: '10:30', available: false }
	])
};

vi.mock('$lib/server/reservation/conflict-service', () => conflictServiceMock);

const reservationServiceMock = {
	create: vi.fn(async () => ({
		id: 'res-new',
		bookerType: 'band',
		bookerId: 'band-1',
		status: 'scheduled',
		startsAt: new Date(),
		endsAt: new Date()
	})),
	cancel: vi.fn(async () => undefined)
};

vi.mock('$lib/server/reservation/reservation-service', () => reservationServiceMock);

vi.mock('$lib/server/reservation/timezone', () => ({
	buildDateInTz: vi.fn((date: string, time: string) => new Date(`${date}T${time}:00`))
}));

vi.mock('$lib/server/reservation/config', () => ({
	getReservationConfig: vi.fn(async () => ({
		timeSlotMinutes: 30,
		minDurationHours: 1,
		maxDurationHours: 8,
		operatingHoursStart: '09:00',
		operatingHoursEnd: '22:00',
		bufferMinutes: 0,
		maxAdvanceDaysOneoff: 14,
		maxAdvanceDaysRecurring: 17.5,
		hourlyRateCents: 1500
	}))
}));

vi.mock('$lib/server/db/schema/recurring', () => ({
	RECURRING_FREQUENCIES: ['weekly', 'biweekly', 'monthly']
}));

vi.mock('$lib/server/authorization', () => ({
	requireUser: vi.fn(() => ({ id: 'user-owner', name: 'Test Owner' })),
	hasAnyRole: vi.fn(async () => false)
}));

vi.mock('$lib/server/feature-flags', () => ({
	requireFeature: vi.fn(async () => undefined)
}));

const subscriptionServiceMock = {
	getSubscription: vi.fn(async () => null as { id: string; status: string } | null)
};

vi.mock('$lib/server/finance/subscription-service', () => subscriptionServiceMock);

const recurringSeriesServiceMock = {
	create: vi.fn(async () => ({ id: 'series-1' }))
};

vi.mock('$lib/server/reservation/recurring-series-service', () => recurringSeriesServiceMock);

// Mock DB for page load
let selectResult: unknown[] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(selectResult);
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

const testUser = mockUser({ id: 'user-owner', name: 'Test Owner' });

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: testUser },
		params: { slug: 'the-velvet-underground' },
		request: { headers: new Headers() }
	}),
	form: (_schema: unknown, handler: (...args: any[]) => any) => {
		const fn = handler;
		(fn as any).__ = { type: 'form' };
		(fn as any).for = () => fn;
		return fn;
	},
	query: (...args: unknown[]) => {
		const handler = typeof args[0] === 'function' ? args[0] : args[1];
		const fn = handler as (...args: any[]) => any;
		(fn as any).__ = { type: 'query' };
		return fn;
	}
}));

const {
	getBandSlots: getSlots,
	bookBandReservation: bookReservation,
	cancelBandReservation,
	getBandMembershipStatus
} = (await import('$lib/remote/reservations.remote')) as any;

beforeEach(() => {
	vi.clearAllMocks();
	bandServiceMock.getUserRole.mockResolvedValue('member');
	selectResult = [];
});

// ---------------------------------------------------------------------------
// Remote handlers
// ---------------------------------------------------------------------------

describe('getSlots', () => {
	it('returns available slots and config', async () => {
		const result = await getSlots('2026-06-15');

		expect(conflictServiceMock.getAvailableSlots).toHaveBeenCalled();
		expect(result.slots).toHaveLength(3);
		expect(result.config.hourlyRateCents).toBe(1500);
		expect(result.config.slotMinutes).toBe(30);
	});

	it('requires band membership', async () => {
		bandServiceMock.getUserRole.mockResolvedValue(null);

		await expect(getSlots('2026-06-15')).rejects.toThrow();
	});
});

describe('bookReservation', () => {
	it('creates reservation with band as booker', async () => {
		const result = await bookReservation({
			date: '2026-06-15',
			startTime: '09:00',
			endTime: '10:00'
		});

		expect(reservationServiceMock.create).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-owner',
				bookerType: 'band',
				bookerId: 'band-1'
			})
		);
		expect(result.reservationId).toBe('res-new');
	});

	it('passes notes through', async () => {
		await bookReservation({
			date: '2026-06-15',
			startTime: '09:00',
			endTime: '10:00',
			notes: 'Practice set list'
		});

		expect(reservationServiceMock.create).toHaveBeenCalledWith(
			expect.objectContaining({
				notes: 'Practice set list'
			})
		);
	});
});

describe('cancelBandReservation', () => {
	it('cancels the reservation', async () => {
		const result = await cancelBandReservation({ reservationId: 'res-42' });

		expect(reservationServiceMock.cancel).toHaveBeenCalledWith('res-42', 'user-owner');
		expect(result.success).toBe(true);
	});
});

describe('getBandMembershipStatus', () => {
	// Source queries the DB directly for an active member whose `subscription is not null`.
	// `selectResult` represents that query's result: a non-empty array means a sustaining
	// member was found.
	it('returns hasSustainingMember true when an active member has a subscription', async () => {
		selectResult = [{ id: 'user-owner' }];

		const result = await getBandMembershipStatus();

		expect(result.hasSustainingMember).toBe(true);
	});

	it('returns hasSustainingMember false when no active member has a subscription', async () => {
		selectResult = [];

		const result = await getBandMembershipStatus();

		expect(result.hasSustainingMember).toBe(false);
	});

	it('returns hasSustainingMember false when no active members exist', async () => {
		bandServiceMock.getMembers.mockResolvedValueOnce([{ userId: 'user-1', status: 'inactive' }]);

		const result = await getBandMembershipStatus();

		expect(result.hasSustainingMember).toBe(false);
	});
});

describe('bookReservation with recurring', () => {
	it('creates a recurring series when frequency is provided and member has sustaining subscription', async () => {
		// Non-empty result => a sustaining band member exists.
		selectResult = [{ id: 'user-owner' }];

		const result = await bookReservation({
			date: '2026-06-15',
			startTime: '09:00',
			endTime: '10:00',
			recurring: 'weekly'
		});

		expect(reservationServiceMock.create).toHaveBeenCalled();
		expect(recurringSeriesServiceMock.create).toHaveBeenCalledWith(
			expect.objectContaining({
				prototypeReservationId: 'res-new',
				frequency: 'weekly'
			})
		);
		expect(result.reservationId).toBe('res-new');
	});

	it('throws 403 when recurring is requested but no member has sustaining subscription', async () => {
		// Empty result => no sustaining band member.
		selectResult = [];

		await expect(
			bookReservation({
				date: '2026-06-15',
				startTime: '09:00',
				endTime: '10:00',
				recurring: 'monthly'
			})
		).rejects.toThrow();

		expect(recurringSeriesServiceMock.create).not.toHaveBeenCalled();
	});

	it('does not create series when recurring is empty string', async () => {
		await bookReservation({
			date: '2026-06-15',
			startTime: '09:00',
			endTime: '10:00',
			recurring: ''
		});

		expect(recurringSeriesServiceMock.create).not.toHaveBeenCalled();
	});
});
