import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted() so these refs are available inside vi.mock factories
// ---------------------------------------------------------------------------

const { insertMock, getNotificationTypeMock, dbSelectResult } = vi.hoisted(() => {
	const dbSelectResult = { rows: [] as unknown[] };
	const insertMock = vi.fn();
	const getNotificationTypeMock = vi.fn();
	return { insertMock, getNotificationTypeMock, dbSelectResult };
});

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(dbSelectResult.rows);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable(),
		insert: insertMock
	}
}));

vi.mock('$lib/server/db/schema/notification', () => ({
	notificationPreference: {
		userId: 'userId',
		notificationType: 'notificationType',
		emailEnabled: 'emailEnabled',
		inAppEnabled: 'inAppEnabled',
		smsEnabled: 'smsEnabled'
	},
	getNotificationType: getNotificationTypeMock
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((col, val) => ({ col, val })),
	and: vi.fn((...args) => ({ and: args }))
}));

import { getPreference, getAllPreferences, setPreference } from './preference-service';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('preference-service', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		dbSelectResult.rows = [];

		// Default insert chain
		const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
		const values = vi.fn(() => ({ onConflictDoUpdate }));
		insertMock.mockReturnValue({ values });
	});

	// -------------------------------------------------------------------------
	// getPreference
	// -------------------------------------------------------------------------

	describe('getPreference', () => {
		it('returns mandatory type defaults regardless of DB', async () => {
			getNotificationTypeMock.mockReturnValue({
				mandatory: true,
				defaults: { email: true, inApp: false }
			});

			const result = await getPreference('user-1', 'ticket_confirmation');

			expect(result).toEqual({ email: true, inApp: false });
		});

		it('returns DB row values when row exists for non-mandatory type', async () => {
			getNotificationTypeMock.mockReturnValue({
				mandatory: false,
				defaults: { email: true, inApp: true }
			});
			dbSelectResult.rows = [{ emailEnabled: false, inAppEnabled: true }];

			const result = await getPreference('user-1', 'check_in_reminder');

			expect(result).toEqual({ email: false, inApp: true });
		});

		it('returns type defaults when no DB row exists', async () => {
			getNotificationTypeMock.mockReturnValue({
				mandatory: false,
				defaults: { email: false, inApp: true }
			});
			dbSelectResult.rows = [];

			const result = await getPreference('user-1', 'reservation_reminder');

			expect(result).toEqual({ email: false, inApp: true });
		});

		it('returns fallback { email: true, inApp: true } when type is unknown', async () => {
			getNotificationTypeMock.mockReturnValue(undefined);
			dbSelectResult.rows = [];

			const result = await getPreference('user-1', 'unknown_type');

			expect(result).toEqual({ email: true, inApp: true, sms: false });
		});
	});

	// -------------------------------------------------------------------------
	// getAllPreferences
	// -------------------------------------------------------------------------

	describe('getAllPreferences', () => {
		it('returns empty object when no rows', async () => {
			dbSelectResult.rows = [];

			const result = await getAllPreferences('user-1');

			expect(result).toEqual({});
		});

		it('returns mapped preferences from DB rows', async () => {
			dbSelectResult.rows = [
				{ notificationType: 'check_in_reminder', emailEnabled: false, inAppEnabled: true },
				{ notificationType: 'band_invitation', emailEnabled: true, inAppEnabled: false }
			];

			const result = await getAllPreferences('user-1');

			expect(result).toEqual({
				check_in_reminder: { email: false, inApp: true },
				band_invitation: { email: true, inApp: false }
			});
		});
	});

	// -------------------------------------------------------------------------
	// setPreference
	// -------------------------------------------------------------------------

	describe('setPreference', () => {
		it('calls insert with onConflictDoUpdate', async () => {
			const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
			const values = vi.fn(() => ({ onConflictDoUpdate }));
			insertMock.mockReturnValue({ values });

			await setPreference('user-1', 'band_invitation', { email: true, inApp: false, sms: false });

			expect(insertMock).toHaveBeenCalled();
			expect(values).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: 'user-1',
					notificationType: 'band_invitation',
					emailEnabled: true,
					inAppEnabled: false
				})
			);
			expect(onConflictDoUpdate).toHaveBeenCalledWith(
				expect.objectContaining({
					set: expect.objectContaining({
						emailEnabled: true,
						inAppEnabled: false
					})
				})
			);
		});
	});
});
