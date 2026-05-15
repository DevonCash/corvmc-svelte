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

let getBySlugResult: typeof mockBand | null = mockBand;
let getUserRoleResult: string | null = 'member';
let hasAnyRoleResult = false;

vi.mock('$lib/server/band/band-service', () => ({
	getBySlug: vi.fn(async () => getBySlugResult),
	getUserRole: vi.fn(async () => getUserRoleResult),
	listForUser: vi.fn(async () => [])
}));

vi.mock('$lib/server/authorization', () => ({
	hasAnyRole: vi.fn(async () => hasAnyRoleResult)
}));

// Mock DB for dashboard page load (reservation queries)
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

const testUser = mockUser({ id: 'user-member', name: 'Test Member' });

beforeEach(() => {
	vi.clearAllMocks();
	getBySlugResult = { ...mockBand };
	getUserRoleResult = 'member';
	hasAnyRoleResult = false;
	selectResult = [];
});

// ---------------------------------------------------------------------------
// Layout load
// ---------------------------------------------------------------------------

describe('band layout load', () => {
	it('resolves band by slug and returns band data with user role', async () => {
		const { load } = await import('./[slug]/+layout.server');
		const result = (await load({
			params: { slug: 'the-velvet-underground' },
			locals: { user: testUser }
		} as any)) as any;

		expect(result.band.id).toBe('band-1');
		expect(result.band.name).toBe('The Velvet Underground');
		expect(result.userRole).toBe('member');
		expect(result.isStaff).toBe(false);
	});

	it('throws 404 for unknown slug', async () => {
		getBySlugResult = null;

		const { load } = await import('./[slug]/+layout.server');

		await expect(
			load({
				params: { slug: 'nonexistent' },
				locals: { user: testUser }
			} as any)
		).rejects.toThrow();
	});

	it('throws 403 for non-member who is not staff', async () => {
		getUserRoleResult = null;
		hasAnyRoleResult = false;

		const { load } = await import('./[slug]/+layout.server');

		await expect(
			load({
				params: { slug: 'the-velvet-underground' },
				locals: { user: testUser }
			} as any)
		).rejects.toThrow();
	});

	it('allows staff access to any band', async () => {
		getUserRoleResult = null;
		hasAnyRoleResult = true;

		const { load } = await import('./[slug]/+layout.server');
		const result = (await load({
			params: { slug: 'the-velvet-underground' },
			locals: { user: testUser }
		} as any)) as any;

		expect(result.band.id).toBe('band-1');
		expect(result.userRole).toBe('staff');
		expect(result.isStaff).toBe(true);
	});

	it('throws 401 when not authenticated', async () => {
		const { load } = await import('./[slug]/+layout.server');

		await expect(
			load({
				params: { slug: 'the-velvet-underground' },
				locals: {}
			} as any)
		).rejects.toThrow();
	});
});

// ---------------------------------------------------------------------------
// Dashboard load
// ---------------------------------------------------------------------------

describe('band dashboard load', () => {
	it('returns upcoming reservations for the band', async () => {
		const now = new Date();
		const tomorrow = new Date(now.getTime() + 86400000);

		selectResult = [
			{
				id: 'res-1',
				status: 'confirmed',
				startsAt: tomorrow,
				endsAt: new Date(tomorrow.getTime() + 3600000),
				notes: 'Practice',
				bookedByName: 'Alice'
			}
		];

		const { load } = await import('./[slug]/+page.server');
		const result = (await load({
			parent: async () => ({
				band: { id: 'band-1', slug: 'the-velvet-underground' }
			})
		} as any)) as any;

		expect(result.upcoming).toHaveLength(1);
		expect(result.upcoming[0].status).toBe('confirmed');
		expect(result.upcoming[0].bookedByName).toBe('Alice');
	});

	it('returns empty array when no upcoming reservations', async () => {
		selectResult = [];

		const { load } = await import('./[slug]/+page.server');
		const result = (await load({
			parent: async () => ({
				band: { id: 'band-1', slug: 'the-velvet-underground' }
			})
		} as any)) as any;

		expect(result.upcoming).toHaveLength(0);
	});
});
