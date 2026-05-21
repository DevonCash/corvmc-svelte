import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let queryResults: unknown[][] = [];
let queryIndex = 0;
let lastUpdate: { set: Record<string, unknown>; where: string } | null = null;

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				const results = queryResults[queryIndex] ?? [];
				queryIndex++;
				return (resolve: (v: unknown[]) => void) => resolve(results);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable(),
		update: vi.fn(() => ({
			set: vi.fn((data: Record<string, unknown>) => ({
				where: vi.fn((condition: unknown) => {
					lastUpdate = { set: data, where: String(condition) };
					return Promise.resolve({ rowCount: 1 });
				})
			}))
		}))
	}
}));

vi.mock('$lib/server/auth', () => ({
	auth: {
		api: {
			changePassword: vi.fn().mockResolvedValue({ token: null, user: {} }),
			signInEmail: vi.fn().mockResolvedValue({}),
			signOut: vi.fn().mockResolvedValue({})
		}
	}
}));

vi.mock('$lib/server/authorization', () => ({
	requireUser: vi.fn(() => ({ id: 'user-1', name: 'Test User' })),
	hasRole: vi.fn().mockResolvedValue(false),
	hasAnyRole: vi.fn().mockResolvedValue(false),
	getUserRoles: vi.fn().mockResolvedValue([])
}));

vi.mock('$lib/server/reservation/reservation-service', () => ({
	cancel: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/finance/subscription-service', () => ({
	cancel: vi.fn().mockResolvedValue(undefined)
}));

// Mock getRequestEvent for remote functions
const mockLocals = { user: mockUser({ id: 'user-1', name: 'Test User' }) };
const mockHeaders = new Headers({ cookie: 'session=abc' });

vi.mock('$lib/server/marketing/audience-service', () => ({
	getSubscriptionsForUser: vi.fn().mockResolvedValue([]),
	getOptInAudiencesForUser: vi.fn().mockResolvedValue([]),
	addSubscriber: vi.fn().mockResolvedValue(undefined),
	unsubscribe: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('$lib/server/marketing/subscriber-service', () => ({
	findOrCreateForUser: vi.fn().mockResolvedValue({ id: 'sub-1' }),
	findByUserId: vi.fn().mockResolvedValue({ id: 'sub-1' })
}));

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: mockLocals,
		request: { headers: mockHeaders }
	}),
	form: (_schema: unknown, handler: Function) => {
		const fn = handler;
		(fn as any).__ = { type: 'form' };
		return fn;
	},
	query: (_schema: unknown, handler: Function) => {
		const fn = (...args: unknown[]) => {
			const result = handler(...args);
			if (result && typeof result.then === 'function') {
				return Object.assign(result, { refresh: vi.fn() });
			}
			return Object.assign(Promise.resolve(result), { refresh: vi.fn() });
		};
		(fn as any).__ = { type: 'query' };
		(fn as any).refresh = vi.fn();
		return fn;
	},
	command: (_schema: unknown, handler: Function) => {
		const fn = handler;
		(fn as any).__ = { type: 'command' };
		return fn;
	}
}));

import { auth } from '$lib/server/auth';
import { requireUser, hasAnyRole } from '$lib/server/authorization';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { cancel as cancelSubscription } from '$lib/server/finance/subscription-service';
import {
	getSubscriptionsForUser,
	getOptInAudiencesForUser,
	addSubscriber,
	unsubscribe as unsubscribeService
} from '$lib/server/marketing/audience-service';
import { findOrCreateForUser, findByUserId } from '$lib/server/marketing/subscriber-service';

const { GET: accountGET } = await import('../../api/me/account/+server');
const { updateProfile, changePassword, getMySubscriptions, getAvailableLists, subscribe, unsubscribe: unsubscribeFromList, deleteAccount } = await import('$lib/remote/account.remote') as any;

beforeEach(() => {
	vi.clearAllMocks();
	queryResults = [];
	queryIndex = 0;
	lastUpdate = null;
	mockLocals.user = mockUser({ id: 'user-1', name: 'Test User' }) as any;
	vi.mocked(requireUser).mockReturnValue(mockLocals.user);
});

// ---------------------------------------------------------------------------
// Page load
// ---------------------------------------------------------------------------

describe('account page load', () => {
	it('returns user with profile fields', async () => {
		const user = mockUser({
			id: 'user-1',
			name: 'Alice',
			email: 'alice@example.com',
			pronouns: 'she/her',
			phone: '555-0123'
		});

		queryResults = [[user]];

		const response = await accountGET({
			locals: { user: { id: 'user-1' } },
			url: new URL('http://localhost')
		} as any);
		const result = await response.json() as any;

		expect(result.user.name).toBe('Alice');
		expect(result.user.email).toBe('alice@example.com');
		expect(result.user.pronouns).toBe('she/her');
		expect(result.user.phone).toBe('555-0123');
	});

	it('throws 401 when not authenticated', async () => {
		await expect(
			accountGET({ locals: {}, url: new URL('http://localhost') } as any)
		).rejects.toThrow();
	});

	it('throws 404 when user not found in database', async () => {
		queryResults = [[]];

		await expect(
			accountGET({ locals: { user: { id: 'ghost' } }, url: new URL('http://localhost') } as any)
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Profile update
// ---------------------------------------------------------------------------

describe('updateProfile', () => {
	it('updates name, pronouns, and phone', async () => {
		await updateProfile({
			name: 'New Name',
			pronouns: 'they/them',
			phone: '555-9999'
		});

		expect(lastUpdate).not.toBeNull();
		expect(lastUpdate!.set.name).toBe('New Name');
		expect(lastUpdate!.set.pronouns).toBe('they/them');
		expect(lastUpdate!.set.phone).toBe('555-9999');
	});

	it('clears optional fields when empty strings provided', async () => {
		await updateProfile({
			name: 'Just Name',
			pronouns: '',
			phone: ''
		});

		expect(lastUpdate!.set.pronouns).toBeNull();
		expect(lastUpdate!.set.phone).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Password change
// ---------------------------------------------------------------------------

describe('changePassword', () => {
	it('delegates to better-auth API with correct params', async () => {
		await changePassword({
			currentPassword: 'old-pass',
			newPassword: 'new-pass-123',
			confirmPassword: 'new-pass-123'
		});

		expect(auth.api.changePassword).toHaveBeenCalledWith(
			expect.objectContaining({
				body: {
					currentPassword: 'old-pass',
					newPassword: 'new-pass-123',
					revokeOtherSessions: false
				}
			})
		);
	});
});

// ---------------------------------------------------------------------------
// Email subscriptions
// ---------------------------------------------------------------------------

describe('getMySubscriptions', () => {
	it('returns subscriptions for the current user', async () => {
		const mockSubs = [{ id: 'sub-1', audienceId: 'aud-1' }];
		vi.mocked(getSubscriptionsForUser).mockResolvedValueOnce(mockSubs as any);

		const result = await getMySubscriptions();

		expect(getSubscriptionsForUser).toHaveBeenCalledWith('user-1');
		expect(result).toEqual(mockSubs);
	});
});

describe('getAvailableLists', () => {
	it('returns opt-in audiences for the current user', async () => {
		const mockAudiences = [{ id: 'aud-1', name: 'Newsletter' }];
		vi.mocked(getOptInAudiencesForUser).mockResolvedValueOnce(mockAudiences as any);

		const result = await getAvailableLists();

		expect(getOptInAudiencesForUser).toHaveBeenCalledWith('user-1');
		expect(result).toEqual(mockAudiences);
	});
});

describe('subscribe', () => {
	it('finds or creates subscriber then adds to audience', async () => {
		await subscribe({ audienceId: 'aud-99' });

		expect(findOrCreateForUser).toHaveBeenCalledWith('user-1', mockLocals.user.email, mockLocals.user.name);
		expect(addSubscriber).toHaveBeenCalledWith('aud-99', 'sub-1');
	});
});

describe('unsubscribeFromList', () => {
	it('finds subscriber and unsubscribes from audience', async () => {
		await unsubscribeFromList({ audienceId: 'aud-99' });

		expect(findByUserId).toHaveBeenCalledWith('user-1');
		expect(unsubscribeService).toHaveBeenCalledWith('sub-1', 'aud-99');
	});

	it('does nothing if subscriber not found', async () => {
		vi.mocked(findByUserId).mockResolvedValueOnce(null as any);

		await unsubscribeFromList({ audienceId: 'aud-99' });

		expect(unsubscribeService).not.toHaveBeenCalled();
	});
});

// ---------------------------------------------------------------------------
// Delete account
// ---------------------------------------------------------------------------

describe('deleteAccount', () => {
	it('cancels future reservations, cancels subscription, soft-deletes, and signs out', async () => {
		mockLocals.user = mockUser({ id: 'user-1', name: 'Test User', stripeId: 'cus_123' }) as any;
		vi.mocked(requireUser).mockReturnValue(mockLocals.user);
		queryResults = [[{ id: 'res-1' }, { id: 'res-2' }]];

		await deleteAccount({ password: 'correct-pass' });

		expect(auth.api.signInEmail).toHaveBeenCalled();
		expect(cancelReservation).toHaveBeenCalledTimes(2);
		expect(cancelSubscription).toHaveBeenCalledWith('cus_123');
		expect(lastUpdate!.set).toHaveProperty('deletedAt');
		expect(auth.api.signOut).toHaveBeenCalled();
	});

	it('rejects deletion for staff/admin accounts', async () => {
		vi.mocked(hasAnyRole).mockResolvedValueOnce(true);

		await expect(deleteAccount({ password: 'any' })).rejects.toThrow();
	});

	it('rejects incorrect password', async () => {
		vi.mocked(auth.api.signInEmail).mockRejectedValueOnce(new Error('bad creds'));

		await expect(deleteAccount({ password: 'wrong' })).rejects.toThrow();
	});

	it('skips subscription cancellation when no stripeId', async () => {
		mockLocals.user = mockUser({ id: 'user-1', name: 'Test User' }) as any;
		queryResults = [[]];

		await deleteAccount({ password: 'correct-pass' });

		expect(cancelSubscription).not.toHaveBeenCalled();
	});
});
