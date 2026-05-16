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
	searchMembers: vi.fn(async () => [
		{ id: 'user-3', name: 'Lou Reed', email: 'lou@example.com' }
	]),
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

vi.mock('$lib/server/authorization', () => ({
	hasAnyRole: vi.fn(async () => false)
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

const testUser = mockUser({ id: 'user-owner', name: 'Test Owner' });

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: { user: testUser },
		params: { slug: 'the-velvet-underground' },
		request: { headers: new Headers() }
	}),
	form: (_schema: unknown, handler: Function) => {
		const fn = handler;
		(fn as any).__ = { type: 'form' };
		(fn as any).for = () => fn;
		return fn;
	},
	query: (...args: unknown[]) => {
		// query can be (schema, handler) or (handler)
		const handler = typeof args[0] === 'function' ? args[0] : args[1];
		const fn = handler as Function;
		(fn as any).__ = { type: 'query' };
		return fn;
	}
}));

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
		const { inviteMember } = await import('./data.remote') as any;

		const result = await inviteMember({
			userId: 'user-3',
			role: 'member',
			position: 'Guitar'
		});

		expect(bandServiceMock.invite).toHaveBeenCalledWith(
			'band-1', 'user-3', 'member', 'Guitar', 'user-owner'
		);
		expect(result.success).toBe(true);
	});

	it('sends null position when empty', async () => {
		const { inviteMember } = await import('./data.remote') as any;

		await inviteMember({ userId: 'user-3', role: 'admin', position: '' });

		expect(bandServiceMock.invite).toHaveBeenCalledWith(
			'band-1', 'user-3', 'admin', null, 'user-owner'
		);
	});
});

describe('removeMember', () => {
	it('calls removeMember with memberId', async () => {
		const { removeMember } = await import('./data.remote') as any;

		const result = await removeMember({ memberId: 'member-42' });

		expect(bandServiceMock.removeMember).toHaveBeenCalledWith('member-42');
		expect(result.success).toBe(true);
	});
});

describe('revokeInvitation', () => {
	it('calls revokeInvitation with memberId', async () => {
		const { revokeInvitation } = await import('./data.remote') as any;

		const result = await revokeInvitation({ memberId: 'member-42' });

		expect(bandServiceMock.revokeInvitation).toHaveBeenCalledWith('member-42');
		expect(result.success).toBe(true);
	});
});

describe('updateMemberRemote', () => {
	it('calls updateMember with role and position', async () => {
		const { updateMemberRemote } = await import('./data.remote') as any;

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
		const { transferOwner } = await import('./data.remote') as any;

		const result = await transferOwner({ newOwnerId: 'user-3' });

		expect(bandServiceMock.transferOwnership).toHaveBeenCalledWith(
			'band-1', 'user-3', 'user-owner'
		);
		expect(result.success).toBe(true);
	});
});

describe('leave', () => {
	it('calls leaveBand with band and user id', async () => {
		bandServiceMock.getUserRole.mockResolvedValue('member');
		const { leave } = await import('./data.remote') as any;

		const result = await leave({});

		expect(bandServiceMock.leaveBand).toHaveBeenCalledWith('band-1', 'user-owner');
		expect(result.success).toBe(true);
	});
});

describe('searchUsers', () => {
	it('returns matching users', async () => {
		const { searchUsers } = await import('./data.remote') as any;

		const results = await searchUsers('lou');

		expect(bandServiceMock.searchMembers).toHaveBeenCalledWith('lou', 'band-1');
		expect(results).toHaveLength(1);
		expect(results[0].name).toBe('Lou Reed');
	});

	it('returns empty for short queries', async () => {
		const { searchUsers } = await import('./data.remote') as any;

		const results = await searchUsers('l');

		expect(bandServiceMock.searchMembers).not.toHaveBeenCalled();
		expect(results).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Page load
// ---------------------------------------------------------------------------

describe('members page load', () => {
	it('splits members into active and pending', async () => {
		bandServiceMock.getMembers.mockResolvedValue([
			{
				id: 'm-1', userId: 'u-1', role: 'owner', position: null,
				status: 'active', invitedById: null, createdAt: new Date(),
				userName: 'Alice', userEmail: 'alice@example.com'
			},
			{
				id: 'm-2', userId: 'u-2', role: 'member', position: 'Guitar',
				status: 'pending', invitedById: 'u-1', createdAt: new Date(),
				userName: 'Bob', userEmail: 'bob@example.com'
			}
		] as any);

		const { GET } = await import('../../../../routes/api/bands/[slug]/members/+server');
		const response = await GET({
			params: { slug: 'the-velvet-underground' },
			locals: { user: testUser }
		} as any);
		const result = await response.json();

		expect(result.active).toHaveLength(1);
		expect(result.active[0].userName).toBe('Alice');
		expect(result.pending).toHaveLength(1);
		expect(result.pending[0].userName).toBe('Bob');
	});
});
