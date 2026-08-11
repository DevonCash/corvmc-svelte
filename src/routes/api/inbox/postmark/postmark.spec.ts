import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHandlePostmarkInbound = vi.fn(async () => ({
	thread: { id: 't1' },
	message: { id: 'm1' }
}));
vi.mock('$lib/server/inbox/inbound-handlers', () => ({
	handlePostmarkInbound: (...args: unknown[]) => mockHandlePostmarkInbound(...(args as []))
}));

const mockEnv: Record<string, string | undefined> = { POSTMARK_INBOUND_TOKEN: 'inbound-secret' };
vi.mock('$env/dynamic/private', () => ({
	get env() {
		return mockEnv;
	}
}));

beforeEach(() => {
	vi.clearAllMocks();
	mockEnv.POSTMARK_INBOUND_TOKEN = 'inbound-secret';
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BODY = {
	From: 'charlie@example.com',
	FromFull: { Email: 'charlie@example.com', Name: 'Charlie' },
	TextBody: 'hello'
};

function req(headers: Record<string, string>) {
	return {
		request: new Request('http://localhost/api/inbox/postmark', {
			method: 'POST',
			headers: { 'content-type': 'application/json', ...headers },
			body: JSON.stringify(BODY)
		})
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	} as any;
}

function basic(user: string, password: string) {
	return { authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}` };
}

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

// The import stays dynamic so it resolves after the `vi.mock` calls above, but
// it is hoisted out of the test bodies: on a cold `node_modules/.vite` cache the
// first import transforms the whole module graph, which blows the 5s per-test
// timeout if it happens inside an `it()`.
let POST: typeof import('./+server').POST;

beforeAll(async () => {
	({ POST } = await import('./+server'));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/inbox/postmark — authentication', () => {
	it('accepts HTTP Basic credentials, which is all Postmark inbound can send', async () => {
		const res = await POST(req(basic('postmark', 'inbound-secret')));

		expect(res.status).toBe(200);
		expect(mockHandlePostmarkInbound).toHaveBeenCalledTimes(1);
	});

	it('accepts the x-postmark-token header for local testing', async () => {
		const res = await POST(req({ 'x-postmark-token': 'inbound-secret' }));

		expect(res.status).toBe(200);
	});

	it('rejects a wrong Basic password', async () => {
		await expect(POST(req(basic('postmark', 'wrong')))).rejects.toMatchObject({ status: 401 });
		expect(mockHandlePostmarkInbound).not.toHaveBeenCalled();
	});

	it('rejects an unauthenticated request', async () => {
		await expect(POST(req({}))).rejects.toMatchObject({ status: 401 });
	});

	it('rejects everything when the secret is not configured', async () => {
		mockEnv.POSTMARK_INBOUND_TOKEN = undefined;

		await expect(POST(req({}))).rejects.toMatchObject({ status: 401 });
		expect(mockHandlePostmarkInbound).not.toHaveBeenCalled();
	});
});

describe('POST /api/inbox/postmark — gating', () => {
	it('no longer short-circuits on the email channel toggle', async () => {
		const res = await POST(req(basic('postmark', 'inbound-secret')));

		expect(await res.json()).toEqual({ ok: true });
	});
});
