import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, command } from '$app/server';
import {
	getAllProductConfigs,
	updateProductConfig,
	type ProductKey
} from '$lib/server/finance/product-config-service';
import {
	config as getConfig,
	getConfigsByPrefix,
	updateSiteConfigs,
	updateSiteConfig
} from '$lib/server/site-config/site-config-service';
import { testConnection } from '$lib/server/lock/ultraloc-client';
import { requireStaff } from '$lib/server/authorization';
import { getAllFeatureFlags, type FeatureFlag } from '$lib/server/feature-flags';
import { syncAllSubscriptions } from '$lib/server/finance/subscription-sync-service';

// ---------------------------------------------------------------------------
// Public queries (no auth)
// ---------------------------------------------------------------------------

export const getSocialLinks = query(async () => {
	const settings = await getConfigsByPrefix('org');
	return {
		facebook: String(settings.socialFacebook ?? ''),
		instagram: String(settings.socialInstagram ?? '')
	};
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const config = query(z.string(), async (key) => {
	return getConfig(key);
});

export const getProducts = query(async () => {
	return getAllProductConfigs();
});

export const getReservationSettings = query(async () => {
	return getConfigsByPrefix('reservation');
});

export const getOrgSettings = query(async () => {
	return getConfigsByPrefix('org');
});

export const getIntegrationSettings = query(async () => {
	const raw = await getConfigsByPrefix('integration.utec');
	return {
		clientId: raw.clientId ? String(raw.clientId) : '',
		clientSecret: raw.clientSecret ? String(raw.clientSecret) : '',
		deviceId: raw.deviceId ? String(raw.deviceId) : '',
		refreshToken: raw.refreshToken ? String(raw.refreshToken) : ''
	};
});

export const testUtecConnection = query(async () => {
	return testConnection();
});

// ---------------------------------------------------------------------------
// Forms — Product pricing
// ---------------------------------------------------------------------------

const updateProductSchema = z.object({
	key: z.enum(['contribution', 'fee_coverage']),
	name: z.string().trim().min(1, 'Name is required'),
	description: z.string().trim(),
	unitAmountCents: z.string().regex(/^\d+$/, 'Amount must be a whole number of cents')
});

export const updateProduct = form(updateProductSchema, async (raw) => {
	const data = raw as z.infer<typeof updateProductSchema>;

	await updateProductConfig(data.key as ProductKey, {
		name: data.name,
		description: data.description || null,
		unitAmountCents: parseInt(data.unitAmountCents, 10)
	});

	void getProducts().refresh();

	return { success: true };
});

// ---------------------------------------------------------------------------
// Forms — Reservation settings
// ---------------------------------------------------------------------------

const reservationSettingsSchema = z.object({
	operatingHoursStart: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
	operatingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
	timeSlotMinutes: z.string().regex(/^\d+$/).transform(Number),
	minDurationHours: z
		.string()
		.regex(/^\d+(\.\d+)?$/)
		.transform(Number),
	maxDurationHours: z.string().regex(/^\d+$/).transform(Number),
	bufferMinutes: z.string().regex(/^\d+$/).transform(Number),
	minAdvanceMinutes: z.string().regex(/^\d+$/).transform(Number),
	maxAdvanceDaysOneoff: z.string().regex(/^\d+$/).transform(Number),
	maxAdvanceDaysRecurring: z
		.string()
		.regex(/^\d+(\.\d+)?$/)
		.transform(Number),
	hourlyRateCents: z.string().regex(/^\d+$/).transform(Number)
});

export const updateReservationSettings = form(reservationSettingsSchema, async (raw) => {
	const data = raw as z.infer<typeof reservationSettingsSchema>;

	await updateSiteConfigs([
		{ key: 'reservation.operatingHoursStart', value: data.operatingHoursStart },
		{ key: 'reservation.operatingHoursEnd', value: data.operatingHoursEnd },
		{ key: 'reservation.timeSlotMinutes', value: data.timeSlotMinutes },
		{ key: 'reservation.minDurationHours', value: data.minDurationHours },
		{ key: 'reservation.maxDurationHours', value: data.maxDurationHours },
		{ key: 'reservation.bufferMinutes', value: data.bufferMinutes },
		{ key: 'reservation.minAdvanceMinutes', value: data.minAdvanceMinutes },
		{ key: 'reservation.maxAdvanceDaysOneoff', value: data.maxAdvanceDaysOneoff },
		{ key: 'reservation.maxAdvanceDaysRecurring', value: data.maxAdvanceDaysRecurring },
		{ key: 'reservation.hourlyRateCents', value: data.hourlyRateCents }
	]);

	void getReservationSettings().refresh();

	return { success: true };
});

// ---------------------------------------------------------------------------
// Forms — Organization settings
// ---------------------------------------------------------------------------

const orgSettingsSchema = z.object({
	name: z.string().trim().min(1, 'Organization name is required'),
	shortName: z.string().trim().min(1, 'Short name is required'),
	contactEmail: z.string().trim().email('Invalid email address'),
	timezone: z.string().trim().min(1, 'Timezone is required'),
	socialFacebook: z.string().trim().max(500).optional().default(''),
	socialInstagram: z.string().trim().max(500).optional().default('')
});

export const updateOrgSettings = form(orgSettingsSchema, async (raw) => {
	const data = raw as z.infer<typeof orgSettingsSchema>;

	await updateSiteConfigs([
		{ key: 'org.name', value: data.name },
		{ key: 'org.shortName', value: data.shortName },
		{ key: 'org.contactEmail', value: data.contactEmail },
		{ key: 'org.timezone', value: data.timezone },
		{ key: 'org.socialFacebook', value: data.socialFacebook ?? '' },
		{ key: 'org.socialInstagram', value: data.socialInstagram ?? '' }
	]);

	void getOrgSettings().refresh();

	return { success: true };
});

// ---------------------------------------------------------------------------
// Forms — Integration settings
// ---------------------------------------------------------------------------

const integrationSettingsSchema = z.object({
	clientId: z.string().trim(),
	clientSecret: z.string().trim(),
	deviceId: z.string().trim(),
	refreshToken: z.string().trim()
});

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export const getFeatureFlags = query(async () => {
	await requireStaff();
	return getAllFeatureFlags();
});

const VALID_FLAGS: FeatureFlag[] = [
	'staffInbox',
	'bandPremium',
	'emailMarketing',
	'equipment',
	'helpArticles'
];

export const updateFeatureFlag = form(
	z.object({
		flag: z.string(),
		enabled: z.enum(['true', 'false']).transform((v) => v === 'true')
	}),
	async (data) => {
		await requireStaff();
		if (!VALID_FLAGS.includes(data.flag as FeatureFlag)) {
			throw error(400, 'Invalid feature flag');
		}
		await updateSiteConfig(`feature.${data.flag}`, data.enabled);
		void getFeatureFlags().refresh();
		return { success: true };
	}
);

// ---------------------------------------------------------------------------
// Subscription status sync
// ---------------------------------------------------------------------------

export const syncSubscriptions = command(async () => {
	await requireStaff();
	return syncAllSubscriptions();
});

export const updateIntegrationSettings = form(integrationSettingsSchema, async (raw) => {
	const data = raw as z.infer<typeof integrationSettingsSchema>;

	await updateSiteConfigs([
		{ key: 'integration.utec.clientId', value: data.clientId },
		{ key: 'integration.utec.clientSecret', value: data.clientSecret },
		{ key: 'integration.utec.deviceId', value: data.deviceId },
		{ key: 'integration.utec.refreshToken', value: data.refreshToken }
	]);

	void getIntegrationSettings().refresh();

	return { success: true };
});
