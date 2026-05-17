import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResults: unknown[][] = [];
let selectCallIndex = 0;
const insertedRows: unknown[] = [];
let updatedData: unknown[] = [];
let deleteCalled = false;

function buildChain() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				const result = selectResults[selectCallIndex] ?? [];
				selectCallIndex++;
				return (resolve: (v: unknown[]) => void) => resolve(result);
			}
			return () => proxy;
		}
	});
	return proxy;
}

const txProxy = {
	update: () => {
		const chain: any = new Proxy(() => chain, {
			get(_, prop) {
				if (prop === 'set') return (data: unknown) => { updatedData.push(data); return chain; };
				if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(undefined);
				return () => chain;
			}
		});
		return chain;
	},
	delete: () => {
		deleteCalled = true;
		return buildChain();
	},
	insert: () => ({
		values: (rows: unknown) => {
			insertedRows.push(rows);
			return Promise.resolve();
		}
	})
};

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => buildChain(),
		transaction: (fn: (tx: typeof txProxy) => Promise<unknown>) => fn(txProxy)
	}
}));

vi.mock('$lib/server/db/schema/auth', () => ({
	user: { id: 'id', bio: 'bio', tagline: 'tagline', lookingForBand: 'looking_for_band', directoryVisibility: 'directory_visibility', directoryContact: 'directory_contact', links: 'links', updatedAt: 'updated_at' },
	userInstrument: { userId: 'user_id', instrument: 'instrument' },
	userGenre: { userId: 'user_id', genre: 'genre' }
}));

vi.mock('$lib/server/db/schema/band', () => ({
	band: { id: 'id', tagline: 'tagline', lookingForMembers: 'looking_for_members', directoryVisibility: 'directory_visibility', directoryContact: 'directory_contact', links: 'links', updatedAt: 'updated_at' },
	bandMember: { bandId: 'band_id', userId: 'user_id', role: 'role', status: 'status' },
	bandGenre: { bandId: 'band_id', genre: 'genre' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn()
}));

const {
	updateMemberProfile,
	getMemberProfileForEdit,
	updateBandProfile,
	getBandProfileForEdit
} = await import('./profile-service');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	selectResults = [];
	selectCallIndex = 0;
	insertedRows.length = 0;
	updatedData = [];
	deleteCalled = false;
});

describe('updateMemberProfile', () => {
	it('updates user fields and replaces instruments/genres', async () => {
		await updateMemberProfile('user-1', {
			bio: 'Hello world',
			tagline: 'Musician',
			instruments: ['guitar', 'piano'],
			genres: ['rock', 'jazz']
		});

		expect(updatedData).toHaveLength(1);
		expect(updatedData[0]).toMatchObject({
			bio: 'Hello world',
			tagline: 'Musician',
			lookingForBand: false
		});
		// Instruments and genres inserted
		expect(insertedRows).toHaveLength(2);
	});

	it('truncates bio to 2000 chars', async () => {
		const longBio = 'x'.repeat(3000);
		await updateMemberProfile('user-1', { bio: longBio });

		expect((updatedData[0] as any).bio).toHaveLength(2000);
	});

	it('truncates tagline to 150 chars', async () => {
		const longTagline = 'x'.repeat(200);
		await updateMemberProfile('user-1', { tagline: longTagline });

		expect((updatedData[0] as any).tagline).toHaveLength(150);
	});

	it('limits instruments to 20', async () => {
		const manyInstruments = Array.from({ length: 30 }, (_, i) => `inst-${i}`);
		await updateMemberProfile('user-1', { instruments: manyInstruments });

		const inserted = insertedRows[0] as any[];
		expect(inserted).toHaveLength(20);
	});

	it('validates links structure', async () => {
		await updateMemberProfile('user-1', {
			links: [
				{ label: 'Website', url: 'https://example.com' },
				{ label: 'Twitter', url: 'https://twitter.com/test' }
			] as any
		});

		expect((updatedData[0] as any).links).toEqual([
			{ label: 'Website', url: 'https://example.com' },
			{ label: 'Twitter', url: 'https://twitter.com/test' }
		]);
	});
});

describe('getMemberProfileForEdit', () => {
	it('returns null when user not found', async () => {
		selectResults.push([]);
		const result = await getMemberProfileForEdit('nonexistent');
		expect(result).toBeNull();
	});

	it('returns profile with instruments and genres', async () => {
		selectResults.push([{ bio: 'Hi', tagline: 'Dev', lookingForBand: true, directoryVisibility: 'public', directoryContact: null, links: null }]);
		selectResults.push([{ instrument: 'guitar' }, { instrument: 'drums' }]);
		selectResults.push([{ genre: 'rock' }]);

		const result = await getMemberProfileForEdit('user-1');

		expect(result).toMatchObject({
			bio: 'Hi',
			tagline: 'Dev',
			instruments: ['guitar', 'drums'],
			genres: ['rock']
		});
	});
});

describe('updateBandProfile', () => {
	it('throws when user is not admin or owner', async () => {
		// requireBandAdmin select returns member role
		selectResults.push([{ role: 'member' }]);

		await expect(
			updateBandProfile('band-1', 'user-1', { tagline: 'Great band' })
		).rejects.toThrow('Not authorized');
	});

	it('updates band profile when user is admin', async () => {
		selectResults.push([{ role: 'admin' }]);

		await updateBandProfile('band-1', 'user-1', {
			tagline: 'Best band ever',
			genres: ['punk', 'ska'],
			lookingForMembers: true
		});

		expect(updatedData[0]).toMatchObject({
			tagline: 'Best band ever',
			lookingForMembers: true
		});
		expect(insertedRows).toHaveLength(1); // genres
	});
});

describe('getBandProfileForEdit', () => {
	it('returns null when band not found', async () => {
		selectResults.push([]);
		const result = await getBandProfileForEdit('nonexistent');
		expect(result).toBeNull();
	});

	it('returns band profile with genres', async () => {
		selectResults.push([{ tagline: 'NYC punk', lookingForMembers: true, directoryVisibility: 'public', directoryContact: null, links: null }]);
		selectResults.push([{ genre: 'punk' }, { genre: 'rock' }]);

		const result = await getBandProfileForEdit('band-1');

		expect(result).toMatchObject({
			tagline: 'NYC punk',
			genres: ['punk', 'rock']
		});
	});
});
