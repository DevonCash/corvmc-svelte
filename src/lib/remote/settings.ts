import { z } from 'zod';
import { query, form } from '$app/server';
import {
	getAllProductConfigs,
	updateProductConfig,
	type ProductKey
} from '$lib/server/finance/product-config-service';
import {
	getConfigsByPrefix,
	updateSiteConfigs
} from '$lib/server/site-config/site-config-service';
import { testConnection } from '$lib/server/lock/ultraloc-client';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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
	key: z.enum(['contribution', 'rehearsal', 'fee_coverage']),
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
	minDurationHours: z.string().regex(/^\d+(\.\d+)?$/).transform(Number),
	maxDurationHours: z.string().regex(/^\d+$/).transform(Number),
	bufferMinutes: z.string().regex(/^\d+$/).transform(Number),
	maxAdvanceDaysOneoff: z.string().regex(/^\d+$/).transform(Number),
	maxAdvanceDaysRecurring: z.string().regex(/^\d+(\.\d+)?$/).transform(Number)
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
		{ key: 'reservation.maxAdvanceDaysOneoff', value: data.maxAdvanceDaysOneoff },
		{ key: 'reservation.maxAdvanceDaysRecurring', value: data.maxAdvanceDaysRecurring }
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
	timezone: z.string().trim().min(1, 'Timezone is required')
});

export const updateOrgSettings = form(orgSettingsSchema, async (raw) => {
	const data = raw as z.infer<typeof orgSettingsSchema>;

	await updateSiteConfigs([
		{ key: 'org.name', value: data.name },
		{ key: 'org.shortName', value: data.shortName },
		{ key: 'org.contactEmail', value: data.contactEmail },
		{ key: 'org.timezone', value: data.timezone }
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
