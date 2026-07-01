import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Real error class so the remote's `instanceof ReservationConflictError` check
// matches what create() throws (both resolve to this same mocked export).
class ReservationConflictError extends Error {
	constructor() {
		super('Time slot is not available');
		this.name = 'ReservationConflictError';
	}
}

// Real error class so the remote's `instanceof ReservationValidationError` check
// matches what create() throws (both resolve to this same mocked export).
class ReservationValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ReservationValidationError';
	}
}

const reservationServiceMock = {
	staffCreate: vi.fn(),
	create: vi.fn(async () => {
		throw new ReservationConflictError();
	}),
	createWaitlisted: vi.fn(async () => ({
		id: 'res-waitlisted',
		status: 'waitlisted',
		startsAt: new Date(),
		endsAt: new Date()
	})),
	cancel: vi.fn(),
	confirm: vi.fn(),
	markComplete: vi.fn(),
	markNoShow: vi.fn(),
	recordCashAndComplete: vi.fn(),
	ReservationConflictError,
	ReservationValidationError
};

vi.mock('$lib/server/reservation/reservation-service', () => reservationServiceMock);

vi.mock('$lib/server/reservation/timezone', () => ({
	formatDateInTz: vi.fn(() => ''),
	buildDateInTz: vi.fn((date: string, time: string) => new Date(`${date}T${time}:00`))
}));

vi.mock('$lib/server/reservation/config', () => ({
	getReservationConfig: vi.fn(async () => ({ hourlyRateCents: 1500 }))
}));

const recurringSeriesServiceMock = {
	create: vi.fn(async () => ({ id: 'series-1' }))
};

vi.mock('$lib/server/reservation/recurring-series-service', () => recurringSeriesServiceMock);

vi.mock('$lib/server/feature-flags', () => ({
	requireFeature: vi.fn(async () => undefined)
}));

// Mock DB — the recurring path reads the member's subscription to gate the flow.
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
	db: { select: () => chainable() }
}));

const testUser = mockUser({ id: 'user-1', name: 'Test Member', email: 'member@example.com' });

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: testUser },
		url: new URL('http://localhost/member/reservations'),
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

const { bookAndPayReservation } = (await import('$lib/remote/reservations.remote')) as any;

beforeEach(() => {
	vi.clearAllMocks();
	selectResult = [];
	reservationServiceMock.create.mockImplementation(async () => {
		throw new ReservationConflictError();
	});
});

// ---------------------------------------------------------------------------
// Slot conflict handling
// ---------------------------------------------------------------------------

describe('bookAndPayReservation slot conflict', () => {
	it('returns a conflict signal (not a 500) when a one-time slot is taken', async () => {
		const result = await bookAndPayReservation({
			date: '2026-06-15',
			startTime: '09:00',
			endTime: '10:00',
			skipPayment: 'on'
		});

		expect(result).toEqual({ conflict: true });
		// No fallback write: create() conflicts before inserting, so nothing is created.
		expect(reservationServiceMock.createWaitlisted).not.toHaveBeenCalled();
	});

	it('surfaces a validation error (not a 500) when the slot is out of the booking window', async () => {
		reservationServiceMock.create.mockImplementation(async () => {
			throw new ReservationValidationError('Cannot book more than 14 days in advance');
		});

		const result = await bookAndPayReservation({
			date: '2026-08-01',
			startTime: '09:00',
			endTime: '10:00',
			skipPayment: 'on'
		});

		expect(result).toEqual({
			validationError: 'Cannot book more than 14 days in advance'
		});
		// Nothing was created, so no waitlist fallback either.
		expect(reservationServiceMock.createWaitlisted).not.toHaveBeenCalled();
	});

	it('waitlists a recurring booking when the first instance conflicts', async () => {
		// Non-empty subscription row => sustaining member (recurring is allowed).
		selectResult = [{ subscription: { id: 'sub-1' } }];

		const result = await bookAndPayReservation({
			date: '2026-06-15',
			startTime: '09:00',
			endTime: '10:00',
			recurring: 'weekly',
			skipPayment: 'on'
		});

		expect(reservationServiceMock.createWaitlisted).toHaveBeenCalled();
		expect(recurringSeriesServiceMock.create).toHaveBeenCalled();
		expect(result).toMatchObject({ waitlisted: true });
	});
});
