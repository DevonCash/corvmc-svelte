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

vi.mock('$app/server', () => ({
	getRequestEvent: () => ({
		locals: mockLocals,
		request: { headers: new Headers() }
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
	}
}));

beforeEach(() => {
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Page load
// ---------------------------------------------------------------------------

describe('bands page load', () => {
	it('splits bands into pending and active', async () => {
		const { load } = await import('./+page.server');
		const result = (await load({
			locals: { user: { id: 'user-1' } }
		} as any)) as any;

		expect(result.pending).toHaveLength(1);
		expect(result.pending[0].name).toBe('Sonic Youth');
		expect(result.active).toHaveLength(1);
		expect(result.active[0].name).toBe('The Velvet Underground');
	});

	it('calls listForUser with the current user id', async () => {
		const { load } = await import('./+page.server');
		await load({ locals: { user: { id: 'user-1' } } } as any);

		expect(bandServiceMock.listForUser).toHaveBeenCalledWith('user-1');
	});

	it('redirects when not authenticated', async () => {
		const { load } = await import('./+page.server');

		// redirect throws in SvelteKit
		await expect(
			load({ locals: {} } as any)
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Create band
// ---------------------------------------------------------------------------

describe('createBand', () => {
	it('calls band-service create and returns slug', async () => {
		const { createBand } = await import('./data.remote') as any;

		const result = await createBand({ name: 'New Band', bio: 'A great band' });

		expect(bandServiceMock.create).toHaveBeenCalledWith('user-1', {
			name: 'New Band',
			bio: 'A great band'
		});
		expect(result.slug).toBe('new-band');
	});

	it('omits bio when empty string', async () => {
		const { createBand } = await import('./data.remote') as any;

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
		const { acceptInvite } = await import('./data.remote') as any;

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
		const { declineInvite } = await import('./data.remote') as any;

		const result = await declineInvite({ memberId: 'member-42' });

		expect(bandServiceMock.declineInvitation).toHaveBeenCalledWith('member-42', 'user-1');
		expect(result.success).toBe(true);
	});
});
