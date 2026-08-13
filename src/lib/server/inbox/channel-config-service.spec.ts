import { describe, it, expect, vi, beforeEach } from 'vitest';

// The channel toggles are a staff setting backed by one row per channel. Two
// channels have no external system behind them — the public contact form and
// the member portal both deliver through the site itself — so there is nothing
// to authenticate and nothing to turn off. These tests pin that "always on"
// really is unconditional: a stale disabled row must not be able to break
// replies on either of them.

let rows: { channel: string; enabled: boolean; config?: unknown }[] = [];
const dbInsert = vi.fn();
const dbUpdate = vi.fn();

function chain(result: unknown) {
	const self: Record<string, unknown> = {};
	for (const m of ['from', 'where', 'limit', 'set', 'values']) {
		self[m] = () => self;
	}
	self.then = (resolve: (v: unknown) => unknown) => resolve(result);
	return self;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chain(rows),
		insert: (...args: unknown[]) => {
			dbInsert(...args);
			return chain([]);
		},
		update: (...args: unknown[]) => {
			dbUpdate(...args);
			return chain([]);
		}
	}
}));
vi.mock('$lib/server/db/schema/inbox', () => ({ inboxChannelConfig: { channel: 'channel' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

const { getAllChannelConfigs, getChannelConfig, isChannelEnabled, updateChannelConfig } =
	await import('./channel-config-service');

beforeEach(() => {
	vi.clearAllMocks();
	rows = [];
});

describe.each(['web', 'portal'] as const)('always-enabled channel: %s', (channel) => {
	it('is enabled with no config row at all', async () => {
		expect(await isChannelEnabled(channel)).toBe(true);
		expect((await getChannelConfig(channel)).enabled).toBe(true);
	});

	it('is enabled even when a row says otherwise', async () => {
		rows = [{ channel, enabled: false }];

		expect(await isChannelEnabled(channel)).toBe(true);
		const all = await getAllChannelConfigs();
		expect(all.find((c) => c.channel === channel)?.enabled).toBe(true);
	});

	it('cannot be toggled off', async () => {
		// Writing the row anyway would store a flag every read ignores, which
		// reads as a bug the next time someone debugs a channel.
		await updateChannelConfig(channel, false);

		expect(dbInsert).not.toHaveBeenCalled();
		expect(dbUpdate).not.toHaveBeenCalled();
	});
});

describe('configurable channels', () => {
	it('default to disabled when no row exists', async () => {
		expect(await isChannelEnabled('email')).toBe(false);
		expect(await isChannelEnabled('sms')).toBe(false);
	});

	it('are still writable', async () => {
		rows = [];
		await updateChannelConfig('email', true);
		expect(dbInsert).toHaveBeenCalled();
	});
});
