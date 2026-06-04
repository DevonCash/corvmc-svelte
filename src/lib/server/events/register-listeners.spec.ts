import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const registeredHandlers: Record<string, Function[]> = {};

vi.mock('./event-bus', () => ({
	domainEvents: {
		on: (event: string, handler: Function) => {
			if (!registeredHandlers[event]) registeredHandlers[event] = [];
			registeredHandlers[event].push(handler);
		}
	}
}));

const mockHandleReservationCheckout = vi.fn();
vi.mock('$lib/server/reservation/checkout-listener', () => ({
	handleReservationCheckout: (...args: unknown[]) => mockHandleReservationCheckout(...args)
}));

const mockHandleTicketCheckout = vi.fn();
vi.mock('$lib/server/ticket/checkout-listener', () => ({
	handleTicketCheckout: (...args: unknown[]) => mockHandleTicketCheckout(...args)
}));

const mockHandleBandPremiumCheckout = vi.fn();
vi.mock('$lib/server/band/band-checkout-listener', () => ({
	handleBandPremiumCheckout: (...args: unknown[]) => mockHandleBandPremiumCheckout(...args)
}));

const mockRegisterAllNotificationListeners = vi.fn();
vi.mock('$lib/server/notification/notification-listeners', () => ({
	registerAllNotificationListeners: (...args: unknown[]) =>
		mockRegisterAllNotificationListeners(...args)
}));

// The inbox + waitlist listeners dynamically import these modules during
// registration. Mock them so registration settles without loading the real
// (heavy, db-backed) implementations, which otherwise causes
// vi.dynamicImportSettled() to time out.
vi.mock('$lib/server/notification/dispatcher', () => ({
	dispatch: vi.fn()
}));

vi.mock('$lib/server/authorization', () => ({
	listStaffUsers: vi.fn().mockResolvedValue([])
}));

vi.mock('$lib/server/reservation/waitlist-service', () => ({
	promoteNextWaitlisted: vi.fn()
}));

beforeEach(() => {
	vi.clearAllMocks();
	for (const key of Object.keys(registeredHandlers)) {
		delete registeredHandlers[key];
	}
	vi.resetModules();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerListeners', () => {
	it('registers checkout.completed listeners for reservation, ticket, and band premium fulfillment', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();

		// Allow async registration to resolve
		await vi.dynamicImportSettled();

		expect(registeredHandlers['checkout.completed']).toBeDefined();
		expect(registeredHandlers['checkout.completed'].length).toBe(3);
	});

	it('invokes handleReservationCheckout with stripe session', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();
		await vi.dynamicImportSettled();

		const mockSession = { id: 'cs_test', metadata: {} };
		const eventData = { stripeSession: mockSession, sessionId: 'cs_test', metadata: {} };

		await registeredHandlers['checkout.completed'][0]({
			name: 'checkout.completed',
			data: eventData
		});

		expect(mockHandleReservationCheckout).toHaveBeenCalledWith(mockSession);
	});

	it('invokes handleTicketCheckout with stripe session', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();
		await vi.dynamicImportSettled();

		const mockSession = { id: 'cs_test2', metadata: { type: 'ticket' } };
		const eventData = { stripeSession: mockSession, sessionId: 'cs_test2', metadata: {} };

		await registeredHandlers['checkout.completed'][1]({
			name: 'checkout.completed',
			data: eventData
		});

		expect(mockHandleTicketCheckout).toHaveBeenCalledWith(mockSession);
	});

	it('invokes handleBandPremiumCheckout with stripe session', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();
		await vi.dynamicImportSettled();

		const mockSession = { id: 'cs_test3', metadata: { subscription_type: 'band_premium' } };
		const eventData = { stripeSession: mockSession, sessionId: 'cs_test3', metadata: {} };

		await registeredHandlers['checkout.completed'][2]({
			name: 'checkout.completed',
			data: eventData
		});

		expect(mockHandleBandPremiumCheckout).toHaveBeenCalledWith(mockSession);
	});

	it('calls registerAllNotificationListeners', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();
		await vi.dynamicImportSettled();

		expect(mockRegisterAllNotificationListeners).toHaveBeenCalled();
	});
});
