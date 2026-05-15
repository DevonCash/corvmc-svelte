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
		const fn = handler;
		(fn as any).__ = { type: 'query' };
		return fn;
	},
	command: (_schema: unknown, handler: Function) => {
		const fn = handler;
		(fn as any).__ = { type: 'command' };
		return fn;
	}
}));

import { auth } from '$lib/server/auth';

beforeEach(() => {
	vi.clearAllMocks();
	queryResults = [];
	queryIndex = 0;
	lastUpdate = null;
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

		const { load } = await import('./+page.server');
		const result = (await load({
			locals: { user: { id: 'user-1' } }
		} as any)) as any;

		expect(result.user.name).toBe('Alice');
		expect(result.user.email).toBe('alice@example.com');
		expect(result.user.pronouns).toBe('she/her');
		expect(result.user.phone).toBe('555-0123');
	});

	it('throws 401 when not authenticated', async () => {
		const { load } = await import('./+page.server');

		await expect(
			load({ locals: {} } as any)
		).rejects.toThrow();
	});

	it('throws 404 when user not found in database', async () => {
		queryResults = [[]];

		const { load } = await import('./+page.server');

		await expect(
			load({ locals: { user: { id: 'ghost' } } } as any)
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Profile update
// ---------------------------------------------------------------------------

describe('updateProfile', () => {
	it('updates name, pronouns, and phone', async () => {
		const { updateProfile } = await import('./data.remote') as any;

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
		const { updateProfile } = await import('./data.remote') as any;

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
		const { changePassword } = await import('./data.remote') as any;

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
