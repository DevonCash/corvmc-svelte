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
	error: (status: number, message: string) => {
		const err = new Error(message);
		(err as any).status = status;
		throw err;
	}
}));

beforeEach(() => {
	vi.clearAllMocks();
	selectCallIndex = 0;
	selectResults.length = 0;
});

// ---------------------------------------------------------------------------
// Directory page load
// ---------------------------------------------------------------------------

describe('directory page load', () => {
	it('returns members and bands', async () => {
		// select 1: members
		selectResults.push([
			{ id: 'u-1', name: 'Alice', pronouns: 'she/her', image: null },
			{ id: 'u-2', name: 'Bob', pronouns: null, image: null }
		]);
		// select 2: bands
		selectResults.push([
			{
				id: 'b-1',
				name: 'The Strokes',
				slug: 'the-strokes',
				bio: 'NYC band',
				avatarKey: null,
				memberCount: 3
			}
		]);

		const { load } = await import('./+page.server');
		const result = (await load({} as any)) as any;

		expect(result.members).toHaveLength(2);
		expect(result.members[0].name).toBe('Alice');
		expect(result.bands).toHaveLength(1);
		expect(result.bands[0].name).toBe('The Strokes');
		expect(result.bands[0].memberCount).toBe(3);
	});

	it('truncates long bios', async () => {
		selectResults.push([]); // members
		selectResults.push([
			{
				id: 'b-1',
				name: 'Wordy Band',
				slug: 'wordy-band',
				bio: 'A'.repeat(200),
				avatarKey: null,
				memberCount: 1
			}
		]);

		const { load } = await import('./+page.server');
		const result = (await load({} as any)) as any;

		expect(result.bands[0].bio!.length).toBeLessThanOrEqual(124); // 120 + "…"
	});
});

// ---------------------------------------------------------------------------
// Public band profile load
// ---------------------------------------------------------------------------

describe('public band profile load', () => {
	it('returns band with active members', async () => {
		// select 1: band
		selectResults.push([
			{
				id: 'b-1',
				name: 'The Strokes',
				slug: 'the-strokes',
				bio: 'NYC band',
				avatarKey: null,
				createdAt: new Date(),
				memberCount: 2
			}
		]);
		// select 2: members
		selectResults.push([
			{ id: 'm-1', userId: 'u-1', role: 'owner', position: 'Guitar', userName: 'Alice', userImage: null },
			{ id: 'm-2', userId: 'u-2', role: 'member', position: 'Drums', userName: 'Bob', userImage: null }
		]);

		const { load } = await import('./bands/[slug]/+page.server');
		const result = (await load({
			params: { slug: 'the-strokes' }
		} as any)) as any;

		expect(result.band.name).toBe('The Strokes');
		expect(result.members).toHaveLength(2);
		expect(result.members[0].userName).toBe('Alice');
		expect(result.members[0].position).toBe('Guitar');
	});

	it('throws 404 for unknown slug', async () => {
		selectResults.push([]); // no band found

		const { load } = await import('./bands/[slug]/+page.server');

		await expect(
			load({ params: { slug: 'nonexistent' } } as any)
		).rejects.toThrow('Band not found');
	});
});
