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
	deleteBand: vi.fn(async () => undefined)
};

vi.mock('$lib/server/band/band-service', () => bandServiceMock);

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
		const handler = typeof args[0] === 'function' ? args[0] : args[1];
		const fn = handler as Function;
		(fn as any).__ = { type: 'query' };
		return fn;
	}
}));

beforeEach(() => {
	vi.clearAllMocks();
	bandServiceMock.getUserRole.mockResolvedValue('owner');
});

// ---------------------------------------------------------------------------
// Remote handlers
// ---------------------------------------------------------------------------

describe('deleteBandForm', () => {
	it('deletes the band', async () => {
		const { deleteBandForm } = await import('./data.remote') as any;

		const result = await deleteBandForm({});

		expect(bandServiceMock.deleteBand).toHaveBeenCalledWith('band-1');
		expect(result.success).toBe(true);
	});

	it('rejects non-owner users', async () => {
		bandServiceMock.getUserRole.mockResolvedValue('admin');
		const { deleteBandForm } = await import('./data.remote') as any;

		await expect(deleteBandForm({})).rejects.toThrow();
	});

	it('rejects members', async () => {
		bandServiceMock.getUserRole.mockResolvedValue('member');
		const { deleteBandForm } = await import('./data.remote') as any;

		await expect(deleteBandForm({})).rejects.toThrow();
	});
});
