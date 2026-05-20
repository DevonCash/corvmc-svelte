import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResult: unknown[] = [];
const mockUpdate = vi.fn();

function chainable(result?: unknown[]) {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(result ?? selectResult);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable(),
		update: (...args: unknown[]) => mockUpdate(...args)
	}
}));

vi.mock('$lib/server/db/schema/reservation', () => ({
	reservation: {
		id: 'id', status: 'status', startsAt: 'starts_at', endsAt: 'ends_at',
		createdByUserId: 'created_by_user_id', stripePaymentRecordId: 'stripe_payment_record_id',
		updatedAt: 'updated_at'
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn()
}));

const mockGetBalance = vi.fn();
vi.mock('$lib/server/finance/credit-service', () => ({
	getBalance: (...args: unknown[]) => mockGetBalance(...args)
}));

const mockCheckout = vi.fn();
vi.mock('$lib/server/finance/payment-service', () => ({
	checkout: (...args: unknown[]) => mockCheckout(...args)
}));

const mockGetProductConfig = vi.fn();
const mockBuildLineItem = vi.fn();
vi.mock('$lib/server/finance/product-config-service', () => ({
	getProductConfig: (...args: unknown[]) => mockGetProductConfig(...args),
	buildLineItem: (...args: unknown[]) => mockBuildLineItem(...args)
}));

beforeEach(() => {
	vi.clearAllMocks();
	selectResult = [];
	mockGetProductConfig.mockResolvedValue({ unitAmountCents: 1500 });
	mockBuildLineItem.mockResolvedValue({ name: 'Rehearsal', amount: 3000, quantity: 1 });
	mockUpdate.mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue({ rowCount: 1 })
		})
	});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const now = new Date();
const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

function makeReservation(overrides?: Record<string, unknown>) {
	return {
		id: 'res-1',
		status: 'scheduled',
		startsAt: now,
		endsAt: twoHoursLater,
		createdByUserId: 'user-1',
		notes: 'Test',
		stripePaymentRecordId: null,
		...overrides
	};
}

function getReq(opts?: { user?: Record<string, unknown> | null; params?: Record<string, string> }) {
	return {
		locals: { user: opts?.user === null ? null : (opts?.user ?? { id: 'user-1', stripeId: 'cus_1' }) },
		params: opts?.params ?? { id: 'res-1' }
	} as any;
}

function postReq(opts?: {
	user?: Record<string, unknown> | null;
	params?: Record<string, string>;
	fields?: Record<string, string>;
}) {
	const fd = new FormData();
	if (opts?.fields) {
		for (const [k, v] of Object.entries(opts.fields)) fd.append(k, v);
	}
	return {
		locals: { user: opts?.user === null ? null : (opts?.user ?? { id: 'user-1', stripeId: 'cus_1' }) },
		params: opts?.params ?? { id: 'res-1' },
		request: new Request('http://localhost/api/me/reservations/res-1/pay', {
			method: 'POST',
			body: fd
		})
	} as any;
}

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe('GET /api/me/reservations/[id]/pay', () => {
	it('returns 401 when not authenticated', async () => {
		const { GET } = await import('./+server');
		await expect(GET(getReq({ user: null }))).rejects.toThrow();
	});

	it('returns 404 when reservation not found', async () => {
		selectResult = [];
		const { GET } = await import('./+server');
		await expect(GET(getReq())).rejects.toThrow();
	});

	it('returns 403 when reservation belongs to another user', async () => {
		selectResult = [makeReservation({ createdByUserId: 'other-user' })];
		const { GET } = await import('./+server');
		await expect(GET(getReq())).rejects.toThrow();
	});

	it('returns 400 when reservation status is not scheduled', async () => {
		selectResult = [makeReservation({ status: 'confirmed' })];
		const { GET } = await import('./+server');
		await expect(GET(getReq())).rejects.toThrow();
	});

	it('returns pricing breakdown', async () => {
		selectResult = [makeReservation()];
		mockGetBalance.mockResolvedValue(5);

		const { GET } = await import('./+server');
		const response = await GET(getReq());
		const body = await response.json() as any;

		expect(body.durationHours).toBe(2);
		expect(body.hourlyRateCents).toBe(1500);
		expect(body.totalCents).toBe(3000);
		expect(body.freeHoursBalance).toBe(5);
		expect(body.reservation.id).toBe('res-1');
	});
});

// ---------------------------------------------------------------------------
// POST tests
// ---------------------------------------------------------------------------

describe('POST /api/me/reservations/[id]/pay', () => {
	it('returns 401 when not authenticated', async () => {
		const { POST } = await import('./+server');
		const response = await POST(postReq({ user: null }));
		expect(response.status).toBe(401);
	});

	it('returns 404 when reservation not found', async () => {
		selectResult = [];
		const { POST } = await import('./+server');
		const response = await POST(postReq());
		expect(response.status).toBe(404);
	});

	it('returns 403 when not owner', async () => {
		selectResult = [makeReservation({ createdByUserId: 'other-user' })];
		const { POST } = await import('./+server');
		const response = await POST(postReq());
		expect(response.status).toBe(403);
	});

	it('returns 400 when not scheduled', async () => {
		selectResult = [makeReservation({ status: 'cancelled' })];
		const { POST } = await import('./+server');
		const response = await POST(postReq());
		expect(response.status).toBe(400);
	});

	it('calls checkout with correct line item and eligible credits', async () => {
		selectResult = [makeReservation()];
		mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

		const { POST } = await import('./+server');
		await POST(postReq());

		expect(mockCheckout).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				mode: 'payment',
				eligibleCredits: [{ type: 'free_hours', unitValueCents: 1500 }],
				metadata: { reservation_id: 'res-1' }
			})
		);
	});

	it('when credits cover cost — updates reservation to confirmed', async () => {
		selectResult = [makeReservation()];
		mockCheckout.mockResolvedValue({ paid: true, stripePaymentRecordId: 'pr_1' });

		const { POST } = await import('./+server');
		const response = await POST(postReq());
		const body = await response.json() as any;

		expect(body.success).toBe(true);
		expect(mockUpdate).toHaveBeenCalled();
	});

	it('when credits do not cover — returns Stripe checkout URL', async () => {
		selectResult = [makeReservation()];
		mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/pay' });

		const { POST } = await import('./+server');
		const response = await POST(postReq());
		const body = await response.json() as any;

		expect(body.redirectUrl).toBe('https://checkout.stripe.com/pay');
	});

	it('passes coverFees from form data', async () => {
		selectResult = [makeReservation()];
		mockCheckout.mockResolvedValue({ paid: false, checkoutUrl: 'https://checkout.stripe.com/s' });

		const { POST } = await import('./+server');
		await POST(postReq({ fields: { coverFees: 'on' } }));

		expect(mockCheckout).toHaveBeenCalledWith(
			expect.objectContaining({ coverFees: true })
		);
	});
});
