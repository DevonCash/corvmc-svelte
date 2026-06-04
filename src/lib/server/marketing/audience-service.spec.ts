import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResults: unknown[][] = [];
let selectCallIndex = 0;
const insertedRows: unknown[] = [];
let updateData: unknown[] = [];
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

vi.mock('$lib/server/db', () => ({
	db: {
		select: () => buildChain(),
		selectDistinct: () => buildChain(),
		insert: () => ({
			values: (row: unknown) => {
				insertedRows.push(row);
				return {
					returning: () =>
						Promise.resolve([{ id: 'aud-new', ...(typeof row === 'object' ? row : {}) }])
				};
			}
		}),
		update: () => {
			const chain: any = new Proxy(() => chain, {
				get(_, prop) {
					if (prop === 'set')
						return (data: unknown) => {
							updateData.push(data);
							return chain;
						};
					if (prop === 'returning') return () => Promise.resolve([{ id: 'aud-1' }]);
					if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(undefined);
					return () => chain;
				}
			});
			return chain;
		},
		delete: () => {
			deleteCalled = true;
			return buildChain();
		}
	}
}));

vi.mock('$lib/server/db/schema/marketing', () => ({
	audience: {
		id: 'id',
		name: 'name',
		slug: 'slug',
		description: 'description',
		allowOptIn: 'allow_opt_in',
		createdAt: 'created_at'
	},
	audienceMember: {
		id: 'id',
		audienceId: 'audience_id',
		subscriberId: 'subscriber_id',
		unsubscribedAt: 'unsubscribed_at',
		createdAt: 'created_at'
	},
	subscriber: { id: 'id', email: 'email', name: 'name', userId: 'user_id' }
}));

vi.mock('$lib/server/db/schema/authentication', () => ({
	user: { id: 'id', email: 'email', name: 'name', deletedAt: 'deleted_at' }
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(),
	and: vi.fn(),
	sql: vi.fn(),
	isNull: vi.fn(),
	isNotNull: vi.fn(),
	notInArray: vi.fn()
}));

vi.mock('./subscriber-service', () => ({
	findOrCreateByEmail: vi.fn(async (email: string, name: string) => ({
		id: 'sub-1',
		email,
		name,
		userId: null
	})),
	linkToUser: vi.fn()
}));

const {
	createAudience,
	updateAudience,
	deleteAudience,
	listAudiences,
	getAudience,
	addSubscriber,
	removeSubscriber,
	unsubscribe
} = await import('./audience-service');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
	selectResults = [];
	selectCallIndex = 0;
	insertedRows.length = 0;
	updateData = [];
	deleteCalled = false;
});

describe('createAudience', () => {
	it('creates an audience with valid data', async () => {
		const result = await createAudience({ name: 'Newsletter', slug: 'newsletter' });

		expect(result.id).toBe('aud-new');
		expect(insertedRows[0]).toMatchObject({
			name: 'Newsletter',
			slug: 'newsletter',
			allowOptIn: false
		});
	});

	it('throws when name is too long', async () => {
		await expect(createAudience({ name: 'x'.repeat(256), slug: 'test' })).rejects.toThrow(
			'name too long'
		);
	});

	it('throws when slug is too long', async () => {
		await expect(createAudience({ name: 'OK', slug: 'x'.repeat(101) })).rejects.toThrow(
			'slug too long'
		);
	});

	it('throws when slug has invalid characters', async () => {
		await expect(createAudience({ name: 'OK', slug: 'Bad Slug!' })).rejects.toThrow(
			'lowercase alphanumeric'
		);
	});
});

describe('updateAudience', () => {
	it('updates audience fields', async () => {
		const result = await updateAudience('aud-1', { name: 'Updated' });

		expect(result).toBeTruthy();
		expect(updateData[0]).toMatchObject({ name: 'Updated' });
	});

	it('validates slug format on update', async () => {
		await expect(updateAudience('aud-1', { slug: 'INVALID!' })).rejects.toThrow(
			'lowercase alphanumeric'
		);
	});
});

describe('deleteAudience', () => {
	it('deletes the audience', async () => {
		await deleteAudience('aud-1');
		expect(deleteCalled).toBe(true);
	});
});

describe('addSubscriber', () => {
	it('inserts new membership when subscriber not in audience', async () => {
		// Check existing membership: not found
		selectResults.push([]);

		await addSubscriber('aud-1', 'sub-1');

		expect(insertedRows).toHaveLength(1);
		expect(insertedRows[0]).toMatchObject({
			audienceId: 'aud-1',
			subscriberId: 'sub-1'
		});
	});

	it('re-subscribes when previously unsubscribed', async () => {
		selectResults.push([{ id: 'am-1', unsubscribedAt: new Date() }]);

		await addSubscriber('aud-1', 'sub-1');

		expect(updateData[0]).toMatchObject({ unsubscribedAt: null });
	});

	it('does nothing when already active', async () => {
		selectResults.push([{ id: 'am-1', unsubscribedAt: null }]);

		await addSubscriber('aud-1', 'sub-1');

		expect(insertedRows).toHaveLength(0);
		expect(updateData).toHaveLength(0);
	});
});

describe('removeSubscriber', () => {
	it('deletes the audience member row', async () => {
		await removeSubscriber('aud-1', 'sub-1');
		expect(deleteCalled).toBe(true);
	});
});

describe('unsubscribe', () => {
	it('sets unsubscribedAt on the membership', async () => {
		await unsubscribe('sub-1', 'aud-1');
		expect(updateData[0]).toMatchObject({ unsubscribedAt: expect.any(Date) });
	});
});

describe('listAudiences', () => {
	it('returns audiences with subscriber counts', async () => {
		selectResults.push([
			{
				id: 'aud-1',
				name: 'Newsletter',
				slug: 'newsletter',
				description: null,
				allowOptIn: true,
				createdAt: new Date(),
				subscriberCount: 42
			}
		]);

		const result = await listAudiences();
		expect(result[0].subscriberCount).toBe(42);
	});
});

describe('getAudience', () => {
	it('returns null when not found', async () => {
		selectResults.push([]);
		const result = await getAudience('nonexistent');
		expect(result).toBeNull();
	});

	it('returns audience with subscriber count', async () => {
		selectResults.push([
			{
				id: 'aud-1',
				name: 'Events',
				slug: 'events',
				description: 'Event updates',
				allowOptIn: true,
				createdAt: new Date(),
				subscriberCount: 10
			}
		]);

		const result = await getAudience('aud-1');
		expect(result!.name).toBe('Events');
	});
});
