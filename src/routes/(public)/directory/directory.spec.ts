import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectCallIndex = 0;
const selectResults: unknown[][] = [];

function chainable() {
	const idx = selectCallIndex++;
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				return (resolve: (v: unknown[]) => void) =>
					resolve(selectResults[idx] ?? []);
			}
			return () => proxy;
		}
	});
	return proxy;
}

let mockMembers: unknown[] = [];
let mockBands: unknown[] = [];

vi.mock('$lib/server/directory/directory-service', () => ({
	listPublicMembers: vi.fn(async () => mockMembers),
	listPublicBands: vi.fn(async () => mockBands)
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => chainable()
	}
}));

vi.mock('$lib/server/storage', () => ({
	isConfigured: () => false,
	getPublicUrl: (key: string) => `https://cdn.example.com/${key}`
}));

vi.mock('@sveltejs/kit', () => ({
	json: (data: unknown, opts?: { status?: number }) => new Response(JSON.stringify(data), {
		status: opts?.status ?? 200,
		headers: { 'Content-Type': 'application/json' }
	}),
	error: (status: number, message: string) => {
		const err = new Error(message);
		(err as any).status = status;
		throw err;
	}
}));

const directoryMod = await import('../../api/directory/+server');
const bandProfileMod = await import('../../api/directory/bands/[slug]/+server');

beforeEach(() => {
	vi.clearAllMocks();
	selectCallIndex = 0;
	selectResults.length = 0;
	mockMembers = [];
	mockBands = [];
});

// ---------------------------------------------------------------------------
// Directory page load
// ---------------------------------------------------------------------------

describe('directory page load', () => {
	it('returns members and bands', async () => {
		mockMembers = [
			{ id: 'u-1', name: 'Alice', pronouns: 'she/her', image: null },
			{ id: 'u-2', name: 'Bob', pronouns: null, image: null }
		];
		mockBands = [
			{
				id: 'b-1',
				name: 'The Strokes',
				slug: 'the-strokes',
				bio: 'NYC band',
				avatarKey: null,
				memberCount: 3
			}
		];

		const response = await (directoryMod.GET as Function)({
			url: new URL('http://localhost/directory')
		});
		const result = await response.json();

		expect(result.members).toHaveLength(2);
		expect(result.members[0].name).toBe('Alice');
		expect(result.bands).toHaveLength(1);
		expect(result.bands[0].name).toBe('The Strokes');
		expect(result.bands[0].memberCount).toBe(3);
	});

	it('truncates long bios', async () => {
		mockMembers = [];
		mockBands = [
			{
				id: 'b-1',
				name: 'Wordy Band',
				slug: 'wordy-band',
				bio: 'A'.repeat(200),
				avatarKey: null,
				memberCount: 1
			}
		];

		const response = await (directoryMod.GET as Function)({
			url: new URL('http://localhost/directory')
		});
		const result = await response.json();

		expect(result.bands[0].bio!.length).toBeLessThanOrEqual(124); // 120 + "…"
	});
});

// ---------------------------------------------------------------------------
// Public band profile load
// ---------------------------------------------------------------------------

describe('public band profile load', () => {
	it('returns band with active members', async () => {
		selectResults.push([
			{
				id: 'b-1',
				name: 'The Strokes',
				slug: 'the-strokes',
				bio: 'NYC band',
				tagline: null,
				avatarKey: null,
				createdAt: new Date(),
				lookingForMembers: false,
				directoryContact: null,
				links: null,
				memberCount: 2
			}
		]);
		selectResults.push([{ genre: 'Rock' }]);
		selectResults.push([
			{ id: 'm-1', userId: 'u-1', role: 'owner', position: 'Guitar', userName: 'Alice', userImage: null },
			{ id: 'm-2', userId: 'u-2', role: 'member', position: 'Drums', userName: 'Bob', userImage: null }
		]);

		const response = await (bandProfileMod.GET as Function)({
			params: { slug: 'the-strokes' }
		});
		const result = await response.json();

		expect(result.band.name).toBe('The Strokes');
		expect(result.members).toHaveLength(2);
		expect(result.members[0].userName).toBe('Alice');
		expect(result.members[0].position).toBe('Guitar');
	});

	it('throws 404 for unknown slug', async () => {
		selectResults.push([]);

		await expect(
			(bandProfileMod.GET as Function)({ params: { slug: 'nonexistent' } })
		).rejects.toThrow('Band not found');
	});
});
