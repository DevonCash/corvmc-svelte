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

const mockRegisterAllNotificationListeners = vi.fn();
vi.mock('$lib/server/notification/notification-listeners', () => ({
	registerAllNotificationListeners: (...args: unknown[]) =>
		mockRegisterAllNotificationListeners(...args)
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
	it('registers checkout.completed listeners for reservation and ticket fulfillment', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();

		// Allow async registration to resolve
		await vi.dynamicImportSettled();

		expect(registeredHandlers['checkout.completed']).toBeDefined();
		expect(registeredHandlers['checkout.completed'].length).toBe(2);
	});

	it('invokes handleReservationCheckout with stripe session', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();
		await vi.dynamicImportSettled();

		const mockSession = { id: 'cs_test', metadata: {} };
		const event = { stripeSession: mockSession, sessionId: 'cs_test', metadata: {} };

		await registeredHandlers['checkout.completed'][0](event);

		expect(mockHandleReservationCheckout).toHaveBeenCalledWith(mockSession);
	});

	it('invokes handleTicketCheckout with stripe session', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();
		await vi.dynamicImportSettled();

		const mockSession = { id: 'cs_test2', metadata: { type: 'ticket' } };
		const event = { stripeSession: mockSession, sessionId: 'cs_test2', metadata: {} };

		await registeredHandlers['checkout.completed'][1](event);

		expect(mockHandleTicketCheckout).toHaveBeenCalledWith(mockSession);
	});

	it('calls registerAllNotificationListeners', async () => {
		const { registerListeners } = await import('./register-listeners');
		registerListeners();
		await vi.dynamicImportSettled();

		expect(mockRegisterAllNotificationListeners).toHaveBeenCalled();
	});
});
