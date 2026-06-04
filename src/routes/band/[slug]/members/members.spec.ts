import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBand = {
	id: 'band-1',
	name: 'The Velvet Underground',
	slug: 'the-velvet-underground',
	bio: 'NYC band',
	ownerId: 'user-owner',
	avatarKey: null,
	memberCount: 3,
	createdAt: new Date(),
	updatedAt: new Date()
};

const bandServiceMock = {
	getBySlug: vi.fn(async () => mockBand),
	getUserRole: vi.fn(async () => 'owner' as string | null),
	searchMembers: vi.fn(async () => [{ id: 'user-3', name: 'Lou Reed', email: 'lou@example.com' }]),
	getMembers: vi.fn(async () => []),
	invite: vi.fn(async () => ({
		id: 'member-new',
		bandId: 'band-1',
		userId: 'user-3',
		role: 'member',
		status: 'pending',
		position: 'Guitar',
		invitedById: 'user-owner',
		createdAt: new Date()
	})),
	removeMember: vi.fn(async () => ({ rowCount: 1 })),
	revokeInvitation: vi.fn(async () => ({ rowCount: 1 })),
	updateMember: vi.fn(async () => undefined),
	transferOwnership: vi.fn(async () => undefined),
	leaveBand: vi.fn(async () => ({ rowCount: 1 }))
};

vi.mock('$lib/server/band/band-service', () => bandServiceMock);

const testUser = mockUser({ id: 'user-owner', name: 'Test Owner' });

vi.mock('$lib/server/authorization', () => ({
	hasAnyRole: vi.fn(async () => false),
	requireUser: () => testUser
}));

// Mock DB for page load
let selectResult: unknown[] = [];

function chainable() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) => resolve(selectResult);
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable()
	}
}));

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: testUser },
		params: { slug: 'the-velvet-underground' },
		request: { headers: new Headers() }
	}),
	form: (_schema: unknown, handler: (...args: any[]) => any) => {
		const fn = handler;
		(fn as any).__ = { type: 'form' };
		(fn as any).for = () => fn;
		return fn;
	},
	query: (...args: unknown[]) => {
		// query can be (schema, handler) or (handler)
		const handler = typeof args[0] === 'function' ? args[0] : args[1];
		const fn = handler as (...args: any[]) => any;
		(fn as any).__ = { type: 'query' };
		return fn;
	}
}));

const {
	inviteMember,
	removeMember,
	revokeInvitation,
	updateMemberRemote,
	transferOwner,
	leave,
	searchBandUsers: searchUsers
} = (await import('$lib/remote/bands.remote')) as any;

beforeEach(() => {
	vi.clearAllMocks();
	bandServiceMock.getUserRole.mockResolvedValue('owner');
	selectResult = [];
});

// ---------------------------------------------------------------------------
// Remote form handlers
// ---------------------------------------------------------------------------

describe('inviteMember', () => {
	it('calls invite with correct params', async () => {
		const result = await inviteMember({
			userId: 'user-3',
			role: 'member',
			position: 'Guitar'
		});

		expect(bandServiceMock.invite).toHaveBeenCalledWith(
			'band-1',
			'user-3',
			'member',
			'Guitar',
			'user-owner'
		);
		expect(result.success).toBe(true);
	});

	it('sends null position when empty', async () => {
		await inviteMember({ userId: 'user-3', role: 'admin', position: '' });

		expect(bandServiceMock.invite).toHaveBeenCalledWith(
			'band-1',
			'user-3',
			'admin',
			null,
			'user-owner'
		);
	});
});

describe('removeMember', () => {
	it('calls removeMember with memberId', async () => {
		const result = await removeMember({ memberId: 'member-42' });

		expect(bandServiceMock.removeMember).toHaveBeenCalledWith('member-42');
		expect(result.success).toBe(true);
	});
});

describe('revokeInvitation', () => {
	it('calls revokeInvitation with memberId', async () => {
		const result = await revokeInvitation({ memberId: 'member-42' });

		expect(bandServiceMock.revokeInvitation).toHaveBeenCalledWith('member-42');
		expect(result.success).toBe(true);
	});
});

describe('updateMemberRemote', () => {
	it('calls updateMember with role and position', async () => {
		const result = await updateMemberRemote({
			memberId: 'member-42',
			role: 'admin',
			position: 'Bass'
		});

		expect(bandServiceMock.updateMember).toHaveBeenCalledWith('member-42', {
			role: 'admin',
			position: 'Bass'
		});
		expect(result.success).toBe(true);
	});
});

describe('transferOwner', () => {
	it('calls transferOwnership with correct params', async () => {
		const result = await transferOwner({ newOwnerId: 'user-3' });

		expect(bandServiceMock.transferOwnership).toHaveBeenCalledWith(
			'band-1',
			'user-3',
			'user-owner'
		);
		expect(result.success).toBe(true);
	});
});

describe('leave', () => {
	it('calls leaveBand with band and user id', async () => {
		bandServiceMock.getUserRole.mockResolvedValue('member');

		const result = await leave({});

		expect(bandServiceMock.leaveBand).toHaveBeenCalledWith('band-1', 'user-owner');
		expect(result.success).toBe(true);
	});
});

describe('searchUsers', () => {
	it('returns matching users', async () => {
		const results = await searchUsers('lou');

		expect(bandServiceMock.searchMembers).toHaveBeenCalledWith('lou', 'band-1');
		expect(results).toHaveLength(1);
		expect(results[0].name).toBe('Lou Reed');
	});

	it('returns empty for short queries', async () => {
		const results = await searchUsers('l');

		expect(bandServiceMock.searchMembers).not.toHaveBeenCalled();
		expect(results).toHaveLength(0);
	});
});
