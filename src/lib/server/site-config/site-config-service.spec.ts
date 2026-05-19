import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let selectResults: unknown[][] = [];
let insertedValues: unknown[] = [];

function buildChain() {
	const proxy: any = new Proxy(() => proxy, {
		get(_, prop) {
			if (prop === 'then') {
				const result = selectResults.shift() ?? [];
				return (resolve: (v: unknown[]) => void) => resolve(result);
			}
			if (prop === 'onConflictDoUpdate') {
				return () => Promise.resolve();
			}
			return () => proxy;
		}
	});
	return proxy;
}

vi.mock('$lib/server/db', () => ({
	db: {
		select: vi.fn(() => buildChain()),
		insert: vi.fn(() => ({
			values: (row: unknown) => {
				insertedValues.push(row);
				return {
					onConflictDoUpdate: () => Promise.resolve()
				};
			}
		}))
	}
}));

vi.mock('drizzle-orm', async (importOriginal) => {
	const actual = await importOriginal<typeof import('drizzle-orm')>();
	return {
		...actual,
		eq: vi.fn(),
		like: vi.fn()
	};
});

import {
	getSiteConfig,
	getConfigsByPrefix,
	updateSiteConfig,
	updateSiteConfigs
} from './site-config-service';

beforeEach(() => {
	selectResults = [];
	insertedValues = [];
});

// ---------------------------------------------------------------------------
// getSiteConfig
// ---------------------------------------------------------------------------

describe('getSiteConfig', () => {
	it('returns the DB value when a row exists', async () => {
		selectResults = [[{ value: JSON.stringify('10:00') }]];
		const result = await getSiteConfig('reservation.operatingHoursStart');
		expect(result).toBe('10:00');
	});

	it('returns the default value when no DB row exists', async () => {
		selectResults = [[]];
		const result = await getSiteConfig('reservation.operatingHoursStart');
		expect(result).toBe('09:00');
	});

	it('returns numeric defaults correctly', async () => {
		selectResults = [[]];
		const result = await getSiteConfig<number>('reservation.timeSlotMinutes');
		expect(result).toBe(30);
	});

	it('throws for unknown keys', async () => {
		selectResults = [[]];
		await expect(getSiteConfig('unknown.key')).rejects.toThrow('Unknown site config key');
	});
});

// ---------------------------------------------------------------------------
// getConfigsByPrefix
// ---------------------------------------------------------------------------

describe('getConfigsByPrefix', () => {
	it('returns defaults when no DB rows exist', async () => {
		selectResults = [[]];
		const result = await getConfigsByPrefix('reservation');
		expect(result.operatingHoursStart).toBe('09:00');
		expect(result.operatingHoursEnd).toBe('22:00');
		expect(result.timeSlotMinutes).toBe(30);
		expect(result.minDurationHours).toBe(1);
		expect(result.maxDurationHours).toBe(8);
		expect(result.bufferMinutes).toBe(0);
		expect(result.maxAdvanceDaysOneoff).toBe(14);
		expect(result.maxAdvanceDaysRecurring).toBe(17.5);
	});

	it('overrides defaults with DB values', async () => {
		selectResults = [[
			{ key: 'reservation.operatingHoursStart', value: JSON.stringify('08:00') },
			{ key: 'reservation.maxDurationHours', value: JSON.stringify(10) }
		]];
		const result = await getConfigsByPrefix('reservation');
		expect(result.operatingHoursStart).toBe('08:00');
		expect(result.maxDurationHours).toBe(10);
		// Unmodified defaults still present
		expect(result.operatingHoursEnd).toBe('22:00');
	});

	it('returns org defaults', async () => {
		selectResults = [[]];
		const result = await getConfigsByPrefix('org');
		expect(result.name).toBe('Corvallis Music Collective');
		expect(result.shortName).toBe('CorvMC');
		expect(result.contactEmail).toBe('staff@corvmc.com');
		expect(result.timezone).toBe('America/Los_Angeles');
	});

	it('returns integration defaults as empty strings', async () => {
		selectResults = [[]];
		const result = await getConfigsByPrefix('integration.utec');
		expect(result.clientId).toBe('');
		expect(result.clientSecret).toBe('');
		expect(result.deviceId).toBe('');
		expect(result.refreshToken).toBe('');
	});
});

// ---------------------------------------------------------------------------
// updateSiteConfig
// ---------------------------------------------------------------------------

describe('updateSiteConfig', () => {
	it('inserts with JSON-encoded value', async () => {
		await updateSiteConfig('reservation.operatingHoursStart', '08:00');
		expect(insertedValues).toHaveLength(1);
		expect(insertedValues[0]).toMatchObject({
			key: 'reservation.operatingHoursStart',
			value: JSON.stringify('08:00')
		});
	});

	it('handles numeric values', async () => {
		await updateSiteConfig('reservation.timeSlotMinutes', 15);
		expect(insertedValues[0]).toMatchObject({
			key: 'reservation.timeSlotMinutes',
			value: JSON.stringify(15)
		});
	});
});

// ---------------------------------------------------------------------------
// updateSiteConfigs (batch)
// ---------------------------------------------------------------------------

describe('updateSiteConfigs', () => {
	it('updates multiple keys', async () => {
		await updateSiteConfigs([
			{ key: 'reservation.operatingHoursStart', value: '08:00' },
			{ key: 'reservation.operatingHoursEnd', value: '23:00' }
		]);
		expect(insertedValues).toHaveLength(2);
	});
});
