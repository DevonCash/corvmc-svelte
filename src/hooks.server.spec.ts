import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// `handle` is `sequence(Sentry.sentryHandle(), handleBetterAuth)`. Both the real
// `sentryHandle()` and SvelteKit's real `sequence()` reach for the request
// async-context store, which isn't set up when calling `handle` directly in a
// unit test. Mock Sentry to no-ops, and mock `sequence` to delegate to the final
// (business-logic) handler so these tests exercise handleBetterAuth as before.
vi.mock('@sentry/sveltekit', () => ({
	initCloudflareSentryHandle:
		() =>
		({ event, resolve }: { event: unknown; resolve: (event: unknown) => unknown }) =>
			resolve(event),
	sentryHandle:
		() =>
		({ event, resolve }: { event: unknown; resolve: (event: unknown) => unknown }) =>
			resolve(event),
	handleErrorWithSentry: <T>(handler: T) => handler
}));

vi.mock('@sveltejs/kit/hooks', () => ({
	sequence: (...handlers: unknown[]) => handlers[handlers.length - 1]
}));

const mockRegisterListeners = vi.fn();
vi.mock('$lib/server/events/register-listeners', () => ({
	registerListeners: (...args: unknown[]) => mockRegisterListeners(...args)
}));

vi.mock('$app/environment', () => ({
	building: false
}));

const mockGetSession = vi.fn();
vi.mock('$lib/server/auth', () => ({
	auth: {
		api: {
			getSession: (...args: unknown[]) => mockGetSession(...args)
		}
	}
}));

const mockSvelteKitHandler = vi.fn();
vi.mock('better-auth/svelte-kit', () => ({
	svelteKitHandler: (...args: unknown[]) => mockSvelteKitHandler(...args)
}));

vi.mock('$lib/server/db', () => ({
	initDb: vi.fn()
}));

vi.mock('$lib/server/storage', () => ({
	initStorage: vi.fn()
}));

vi.mock('$lib/server/kv', () => ({
	initKv: vi.fn()
}));

const mockResolvePendingInvites = vi.fn();
vi.mock('$lib/server/band/platform-invite-service', () => ({
	resolvePendingInvites: (...args: unknown[]) => mockResolvePendingInvites(...args)
}));

beforeEach(() => {
	vi.clearAllMocks();
	mockSvelteKitHandler.mockResolvedValue(new Response('ok'));
	mockResolvePendingInvites.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides?: Record<string, unknown>) {
	return {
		request: new Request('http://localhost/', { method: 'GET' }),
		locals: {} as Record<string, unknown>,
		platform: {},
		...overrides
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hooks.server handle', () => {
	it('calls registerListeners when handling a request', async () => {
		mockGetSession.mockResolvedValue(null);

		const { handle } = await import('./hooks.server');
		await handle({ event: makeEvent() as any, resolve: vi.fn() });

		expect(mockRegisterListeners).toHaveBeenCalled();
	}, 30_000);

	it('populates locals.user and locals.session when session exists', async () => {
		const mockSession = {
			session: { id: 'sess-1', userId: 'user-1' },
			user: { id: 'user-1', name: 'Alice', email: 'alice@test.com' }
		};
		mockGetSession.mockResolvedValue(mockSession);

		const { handle } = await import('./hooks.server');
		const event = makeEvent();
		const resolve = vi.fn();

		await handle({ event: event as any, resolve });

		expect(event.locals.user).toEqual(mockSession.user);
		expect(event.locals.session).toEqual(mockSession.session);
	});

	it('does not populate locals when session is null', async () => {
		mockGetSession.mockResolvedValue(null);

		const { handle } = await import('./hooks.server');
		const event = makeEvent();
		const resolve = vi.fn();

		await handle({ event: event as any, resolve });

		expect(event.locals.user).toBeUndefined();
		expect(event.locals.session).toBeUndefined();
	});

	it('resolves pending invites on first session encounter', async () => {
		const mockSession = {
			session: { id: 'sess-new', userId: 'user-2' },
			user: { id: 'user-2', name: 'Bob', email: 'bob@test.com' }
		};
		mockGetSession.mockResolvedValue(mockSession);

		const { handle } = await import('./hooks.server');
		const event = makeEvent();
		const resolve = vi.fn();

		await handle({ event: event as any, resolve });

		expect(mockResolvePendingInvites).toHaveBeenCalledWith('user-2', 'bob@test.com');
	});

	it('delegates to svelteKitHandler', async () => {
		mockGetSession.mockResolvedValue(null);

		const { handle } = await import('./hooks.server');
		const event = makeEvent();
		const resolve = vi.fn();

		await handle({ event: event as any, resolve });

		expect(mockSvelteKitHandler).toHaveBeenCalledWith(expect.objectContaining({ event, resolve }));
	});
});
