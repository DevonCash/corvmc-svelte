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

const { GET: layoutGET } = await import('../api/bands/[slug]/layout/+server');

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
		const response = await layoutGET({
			params: { slug: 'the-velvet-underground' },
			locals: { user: testUser },
			url: new URL('http://localhost')
		} as any);
		const result = await response.json() as any;

		expect(result.band.id).toBe('band-1');
		expect(result.band.name).toBe('The Velvet Underground');
		expect(result.userRole).toBe('member');
		expect(result.isStaff).toBe(false);
	});

	it('throws 404 for unknown slug', async () => {
		getBySlugResult = null;

		await expect(
			layoutGET({
				params: { slug: 'nonexistent' },
				locals: { user: testUser },
				url: new URL('http://localhost')
			} as any)
		).rejects.toThrow();
	});

	it('throws 403 for non-member who is not staff', async () => {
		getUserRoleResult = null;
		hasAnyRoleResult = false;

		await expect(
			layoutGET({
				params: { slug: 'the-velvet-underground' },
				locals: { user: testUser },
				url: new URL('http://localhost')
			} as any)
		).rejects.toThrow();
	});

	it('allows staff access to any band', async () => {
		getUserRoleResult = null;
		hasAnyRoleResult = true;

		const response = await layoutGET({
			params: { slug: 'the-velvet-underground' },
			locals: { user: testUser },
			url: new URL('http://localhost')
		} as any);
		const result = await response.json() as any;

		expect(result.band.id).toBe('band-1');
		expect(result.userRole).toBe('staff');
		expect(result.isStaff).toBe(true);
	});

	it('throws 401 when not authenticated', async () => {
		await expect(
			layoutGET({
				params: { slug: 'the-velvet-underground' },
				locals: {},
				url: new URL('http://localhost')
			} as any)
		).rejects.toThrow();
	});
});

