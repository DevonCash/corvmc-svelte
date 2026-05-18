import { db } from '$lib/server/db';
import { siteConfig } from '$lib/server/db/schema/site-config';
import { eq, like } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Defaults — used when no DB row exists for a key
// ---------------------------------------------------------------------------

const DEFAULTS: Record<string, string | number> = {
	'reservation.operatingHoursStart': '09:00',
	'reservation.operatingHoursEnd': '22:00',
	'reservation.minDurationHours': 1,
	'reservation.maxDurationHours': 8,
	'reservation.timeSlotMinutes': 30,
	'reservation.bufferMinutes': 0,
	'reservation.maxAdvanceDaysOneoff': 14,
	'reservation.maxAdvanceDaysRecurring': 17.5,

	'org.name': 'Corvallis Music Collective',
	'org.shortName': 'CorvMC',
	'org.contactEmail': 'staff@corvmc.com',
	'org.timezone': 'America/Los_Angeles',

	'integration.utec.clientId': '',
	'integration.utec.clientSecret': '',
	'integration.utec.deviceId': '',
	'integration.utec.refreshToken': ''
};

export type SiteConfigKey = keyof typeof DEFAULTS;

// ---------------------------------------------------------------------------
// Core access
// ---------------------------------------------------------------------------

export async function getSiteConfig<T extends string | number = string>(
	key: string
): Promise<T> {
	const [row] = await db
		.select({ value: siteConfig.value })
		.from(siteConfig)
		.where(eq(siteConfig.key, key))
		.limit(1);

	if (row) return JSON.parse(row.value) as T;

	const fallback = DEFAULTS[key];
	if (fallback !== undefined) return fallback as T;

	throw new Error(`Unknown site config key: ${key}`);
}

export async function getConfigsByPrefix(
	prefix: string
): Promise<Record<string, string | number>> {
	const rows = await db
		.select({ key: siteConfig.key, value: siteConfig.value })
		.from(siteConfig)
		.where(like(siteConfig.key, `${prefix}.%`));

	const result: Record<string, string | number> = {};

	// Start with defaults for this prefix
	for (const [key, value] of Object.entries(DEFAULTS)) {
		if (key.startsWith(`${prefix}.`)) {
			const shortKey = key.slice(prefix.length + 1);
			result[shortKey] = value;
		}
	}

	// Override with DB values
	for (const row of rows) {
		const shortKey = row.key.slice(prefix.length + 1);
		result[shortKey] = JSON.parse(row.value);
	}

	return result;
}

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

export async function updateSiteConfig(
	key: string,
	value: string | number
): Promise<void> {
	const jsonValue = JSON.stringify(value);

	await db
		.insert(siteConfig)
		.values({ key, value: jsonValue })
		.onConflictDoUpdate({
			target: siteConfig.key,
			set: { value: jsonValue, updatedAt: new Date() }
		});
}

export async function updateSiteConfigs(
	entries: Array<{ key: string; value: string | number }>
): Promise<void> {
	for (const entry of entries) {
		await updateSiteConfig(entry.key, entry.value);
	}
}
