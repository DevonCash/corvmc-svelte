import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockUser } from '$lib/server/db/test-factory';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBandResult = {
	id: 'band-1',
	name: 'The Velvet Underground',
	slug: 'the-velvet-underground',
	avatarKey: null,
	role: 'owner',
	status: 'active',
	memberCount: 3
};

const mockPendingResult = {
	id: 'band-2',
	name: 'Sonic Youth',
	slug: 'sonic-youth',
	avatarKey: null,
	role: 'member',
	status: 'pending',
	memberCount: 2
};

const mockCreatedBand = {
	id: 'band-new',
	name: 'New Band',
	slug: 'new-band',
	bio: null,
	ownerId: 'user-1',
	avatarKey: null,
	createdAt: new Date(),
	updatedAt: new Date()
};

const bandServiceMock = {
	listForUser: vi.fn().mockResolvedValue([mockBandResult, mockPendingResult]),
	create: vi.fn().mockResolvedValue(mockCreatedBand),
	acceptInvitation: vi.fn().mockResolvedValue({ ...mockPendingResult, status: 'active' }),
	declineInvitation: vi.fn().mockResolvedValue({ rowCount: 1 })
};

vi.mock('$lib/server/band/band-service', () => bandServiceMock);

// Mock getRequestEvent for remote functions
const mockLocals = { user: mockUser({ id: 'user-1', name: 'Test User' }) };

vi.mock('$lib/server/authorization', () => ({
	requireUser: () => mockLocals.user,
	requireStaff: vi.fn()
}));

vi.mock('$app/server', () => {
	// Remote helpers support both single-arg (handler) and two-arg
	// (schema, handler) forms. Detect: if the first arg is a function and
	// there's no second arg, treat it as the handler.
	const wrap = (type: string) => (a: unknown, b?: unknown) => {
		const handler = (typeof a === 'function' && b === undefined ? a : b) as (...args: any[]) => any;
		(handler as any).__ = { type };
		return handler;
	};
	return {
		getRequestEvent: () => ({
			locals: mockLocals,
			request: { headers: new Headers() }
		}),
		form: wrap('form'),
		query: wrap('query'),
		command: wrap('command')
	};
});

const { createBand, acceptInvite, declineInvite } =
	(await import('$lib/remote/bands.remote')) as any;

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Create band
// ---------------------------------------------------------------------------

describe('createBand', () => {
	it('calls band-service create and returns slug', async () => {
		const result = await createBand({ name: 'New Band', bio: 'A great band' });

		expect(bandServiceMock.create).toHaveBeenCalledWith('user-1', {
			name: 'New Band',
			bio: 'A great band'
		});
		expect(result.slug).toBe('new-band');
	});

	it('omits bio when empty string', async () => {
		await createBand({ name: 'No Bio Band', bio: '' });

		expect(bandServiceMock.create).toHaveBeenCalledWith('user-1', {
			name: 'No Bio Band',
			bio: undefined
		});
	});
});

// ---------------------------------------------------------------------------
// Accept invitation
// ---------------------------------------------------------------------------

describe('acceptInvite', () => {
	it('calls acceptInvitation with memberId and userId', async () => {
		const result = await acceptInvite({ memberId: 'member-42' });

		expect(bandServiceMock.acceptInvitation).toHaveBeenCalledWith('member-42', 'user-1');
		expect(result.success).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Decline invitation
// ---------------------------------------------------------------------------

describe('declineInvite', () => {
	it('calls declineInvitation with memberId and userId', async () => {
		const result = await declineInvite({ memberId: 'member-42' });

		expect(bandServiceMock.declineInvitation).toHaveBeenCalledWith('member-42', 'user-1');
		expect(result.success).toBe(true);
	});
});
