import { describe, it, expect, vi, beforeEach } from 'vitest';

// Two rules carry most of the weight in this file, and both are the kind that
// look redundant to someone tidying up later:
//
//   1. Blocks are directional rows read in both directions. Unblocking removes
//      only your own row — if the other person blocked you too, theirs stands.
//   2. A member may switch their own messaging off and back on, but may never
//      write over a restriction staff or a report put there. Without that,
//      "turn my messages back on" also clears a suspension.

const TABLES = {
	userBlock: {
		__table: 'user_block',
		id: 'block.id',
		blockerUserId: 'block.blockerUserId',
		blockedUserId: 'block.blockedUserId',
		source: 'block.source',
		createdAt: 'block.createdAt'
	},
	messagingStanding: {
		__table: 'messaging_standing',
		userId: 'standing.userId',
		status: 'standing.status',
		source: 'standing.source',
		reason: 'standing.reason',
		triggeringFlagId: 'standing.triggeringFlagId',
		updatedByUserId: 'standing.updatedByUserId',
		updatedAt: 'standing.updatedAt'
	}
};

let results: unknown[] = [];
let inserted: { table: string; values: unknown; conflict: unknown }[] = [];
let deleted: { table: string; where: unknown }[] = [];
/** Every `where` a select built, in order. */
let selectWheres: unknown[] = [];

function chain(record?: (key: string, value: unknown) => void) {
	const self: Record<string, unknown> = {};
	for (const m of ['from', 'innerJoin', 'leftJoin', 'orderBy', 'limit', 'groupBy']) {
		self[m] = () => self;
	}
	self.where = (w: unknown) => {
		record?.('where', w);
		return self;
	};
	self.values = (v: unknown) => {
		record?.('values', v);
		return self;
	};
	self.set = (v: unknown) => {
		record?.('set', v);
		return self;
	};
	self.onConflictDoNothing = () => {
		record?.('conflict', 'nothing');
		return self;
	};
	self.onConflictDoUpdate = (c: unknown) => {
		record?.('conflict', c);
		return self;
	};
	self.then = (resolve: (v: unknown) => unknown) => resolve(results.shift() ?? []);
	return self;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () =>
			chain((k, v) => {
				if (k === 'where') selectWheres.push(v);
			}),
		insert: (table: { __table: string }) => {
			const entry = {
				table: table.__table,
				values: undefined as unknown,
				conflict: undefined as unknown
			};
			inserted.push(entry);
			return chain((k, v) => {
				if (k === 'values') entry.values = v;
				if (k === 'conflict') entry.conflict = v;
			});
		},
		update: () => chain(),
		delete: (table: { __table: string }) => {
			const entry = { table: table.__table, where: undefined as unknown };
			deleted.push(entry);
			return chain((k, v) => {
				if (k === 'where') entry.where = v;
			});
		}
	}
}));
vi.mock('$lib/server/db/schema/moderation', () => TABLES);
vi.mock('$lib/server/db/schema/authentication', () => ({
	user: { __table: 'user', id: 'user.id', name: 'user.name' }
}));

vi.mock('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
	and: (...a: unknown[]) => ({ op: 'and', a }),
	or: (...a: unknown[]) => ({ op: 'or', a }),
	desc: vi.fn(),
	sql: (strings: TemplateStringsArray, ...v: unknown[]) => ({
		op: 'sql',
		text: strings.join('?'),
		v
	})
}));

const {
	blockUser,
	unblockUser,
	isBlockedEitherWay,
	blockExistsBetween,
	getMessagingStanding,
	setMessagingStanding,
	restrictMessaging,
	canInitiateMessages,
	messagingIsDisabled,
	MessagingStandingNotYoursError
} = await import('./moderation-service');

beforeEach(() => {
	results = [];
	inserted = [];
	deleted = [];
	selectWheres = [];
});

describe('blockUser', () => {
	it('is idempotent — blocking twice writes one row', async () => {
		await blockUser({ blockerUserId: 'alice', blockedUserId: 'bob' });
		expect(inserted[0].table).toBe('user_block');
		expect(inserted[0].conflict).toBe('nothing');
	});

	it('records why, so staff have context without asking', async () => {
		await blockUser({ blockerUserId: 'alice', blockedUserId: 'bob', source: 'declined_request' });
		expect(inserted[0].values).toMatchObject({ source: 'declined_request' });
	});

	it('defaults to a manual block', async () => {
		await blockUser({ blockerUserId: 'alice', blockedUserId: 'bob' });
		expect(inserted[0].values).toMatchObject({ source: 'manual' });
	});

	it('refuses to let someone block themselves', async () => {
		await blockUser({ blockerUserId: 'alice', blockedUserId: 'alice' });
		expect(inserted).toHaveLength(0);
	});
});

describe('unblockUser', () => {
	it('removes only the caller’s own row', async () => {
		// If both people blocked each other, lifting one must leave the other
		// standing. Deleting "the pair" would let either party unilaterally
		// reopen a channel the other closed.
		await unblockUser('alice', 'bob');
		expect(deleted).toHaveLength(1);
		const where = deleted[0].where as Record<string, unknown>;
		expect(where.op).toBe('and');
		const parts = where.a as Record<string, unknown>[];
		expect(parts).toEqual([
			{ op: 'eq', a: TABLES.userBlock.blockerUserId, b: 'alice' },
			{ op: 'eq', a: TABLES.userBlock.blockedUserId, b: 'bob' }
		]);
	});
});

describe('block checks read both directions', () => {
	it('isBlockedEitherWay ORs the two orderings', async () => {
		// A check that only asks "did the sender block the recipient" lets a
		// blocked person keep writing to the person who blocked them. Both
		// orderings have to be in the query.
		results = [[]];
		await isBlockedEitherWay('alice', 'bob');

		expect(selectWheres).toHaveLength(1);
		const where = selectWheres[0] as Record<string, unknown>;
		expect(where.op).toBe('or');

		const [first, second] = where.a as Record<string, unknown>[];
		expect(first.a).toEqual([
			{ op: 'eq', a: TABLES.userBlock.blockerUserId, b: 'alice' },
			{ op: 'eq', a: TABLES.userBlock.blockedUserId, b: 'bob' }
		]);
		expect(second.a).toEqual([
			{ op: 'eq', a: TABLES.userBlock.blockerUserId, b: 'bob' },
			{ op: 'eq', a: TABLES.userBlock.blockedUserId, b: 'alice' }
		]);
	});

	it('reports a block found in either direction', async () => {
		results = [[{ id: 'block-1' }]];
		expect(await isBlockedEitherWay('alice', 'bob')).toBe(true);
		results = [[]];
		expect(await isBlockedEitherWay('alice', 'bob')).toBe(false);
	});

	it('blockExistsBetween names both people on both sides', () => {
		const fragment = blockExistsBetween('alice', 'bob') as unknown as Record<string, unknown>;
		expect(fragment.op).toBe('sql');
		expect(fragment.text).toContain('user_block');
		// alice and bob each appear twice: once as blocker, once as blocked.
		const values = fragment.v as string[];
		expect(values.filter((v) => v === 'alice')).toHaveLength(2);
		expect(values.filter((v) => v === 'bob')).toHaveLength(2);
	});
});

describe('getMessagingStanding', () => {
	it('treats a missing row as no restriction', async () => {
		// Absence means unrestricted — the common case, and the default the whole
		// feature is built around.
		results = [[]];
		expect(await getMessagingStanding('alice')).toEqual({
			status: 'none',
			source: null,
			reason: null,
			updatedAt: null
		});
	});

	it('returns the stored standing when there is one', async () => {
		const row = {
			status: 'restricted',
			source: 'report',
			reason: 'told someone to get lost',
			updatedAt: new Date(0)
		};
		results = [[row]];
		expect(await getMessagingStanding('alice')).toEqual(row);
	});
});

describe('canInitiateMessages / messagingIsDisabled', () => {
	it('a restricted member may not start conversations but is not disabled', async () => {
		results = [[{ status: 'restricted', source: 'report', reason: null, updatedAt: null }]];
		expect(await canInitiateMessages('alice')).toBe(false);
		results = [[{ status: 'restricted', source: 'report', reason: null, updatedAt: null }]];
		expect(await messagingIsDisabled('alice')).toBe(false);
	});

	it('a disabled member can neither start nor be reached', async () => {
		results = [[{ status: 'disabled', source: 'staff', reason: null, updatedAt: null }]];
		expect(await canInitiateMessages('alice')).toBe(false);
		results = [[{ status: 'disabled', source: 'staff', reason: null, updatedAt: null }]];
		expect(await messagingIsDisabled('alice')).toBe(true);
	});

	it('an unrestricted member may do both', async () => {
		results = [[]];
		expect(await canInitiateMessages('alice')).toBe(true);
		results = [[]];
		expect(await messagingIsDisabled('alice')).toBe(false);
	});
});

describe('setMessagingStanding — who may change what', () => {
	it('lets a member switch their own messaging off', async () => {
		results = [[]]; // no existing row
		await setMessagingStanding({ userId: 'alice', status: 'disabled', source: 'member' });
		expect(inserted[0].values).toMatchObject({ status: 'disabled', source: 'member' });
	});

	it('lets a member switch their own back on', async () => {
		results = [[{ status: 'disabled', source: 'member', reason: null, updatedAt: null }]];
		await setMessagingStanding({ userId: 'alice', status: 'none', source: 'member' });
		expect(inserted[0].values).toMatchObject({ status: 'none' });
	});

	it('refuses to let a member lift a staff-applied restriction', async () => {
		results = [[{ status: 'disabled', source: 'staff', reason: 'under 18', updatedAt: null }]];
		await expect(
			setMessagingStanding({ userId: 'alice', status: 'none', source: 'member' })
		).rejects.toBeInstanceOf(MessagingStandingNotYoursError);
		expect(inserted).toHaveLength(0);
	});

	it('refuses to let a member lift a restriction from an upheld report', async () => {
		results = [[{ status: 'restricted', source: 'report', reason: null, updatedAt: null }]];
		await expect(
			setMessagingStanding({ userId: 'alice', status: 'none', source: 'member' })
		).rejects.toBeInstanceOf(MessagingStandingNotYoursError);
		expect(inserted).toHaveLength(0);
	});

	it('lets staff write over anything, including a member’s own switch', async () => {
		results = [[{ status: 'disabled', source: 'member', reason: null, updatedAt: null }]];
		await setMessagingStanding({
			userId: 'alice',
			status: 'none',
			source: 'staff',
			actorUserId: 'staff-1'
		});
		expect(inserted[0].values).toMatchObject({ status: 'none', source: 'staff' });
	});

	it('does not even read the existing row for a staff write', async () => {
		// The ownership check is member-only. A staff path that consulted it would
		// be one refactor away from inheriting the member restriction.
		await setMessagingStanding({ userId: 'alice', status: 'disabled', source: 'staff' });
		expect(inserted).toHaveLength(1);
	});

	it('upserts rather than failing on a second write', async () => {
		results = [[]];
		await setMessagingStanding({ userId: 'alice', status: 'disabled', source: 'staff' });
		expect(inserted[0].conflict).toMatchObject({ target: TABLES.messagingStanding.userId });
	});
});

describe('restrictMessaging', () => {
	it('records the report that caused it, so the member can be told why', async () => {
		await restrictMessaging({
			userId: 'bob',
			flagId: 'flag-1',
			staffId: 'staff-1',
			reason: 'harassment'
		});
		expect(inserted[0].values).toMatchObject({
			userId: 'bob',
			status: 'restricted',
			source: 'report',
			reason: 'harassment',
			triggeringFlagId: 'flag-1',
			updatedByUserId: 'staff-1'
		});
	});

	it('restricts rather than disables — they can still answer existing threads', async () => {
		// The distinction is the whole point: someone who was rude in one
		// conversation should not be cut out of a different one mid-negotiation.
		await restrictMessaging({ userId: 'bob', flagId: 'flag-1', staffId: 'staff-1' });
		expect((inserted[0].values as Record<string, unknown>).status).toBe('restricted');
		expect((inserted[0].values as Record<string, unknown>).status).not.toBe('disabled');
	});
});
