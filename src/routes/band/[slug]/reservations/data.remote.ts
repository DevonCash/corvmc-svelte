import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, query, getRequestEvent } from '$app/server';
import { getBySlug, getUserRole } from '$lib/server/band/band-service';
import { getAvailableSlots } from '$lib/server/reservation/conflict-service';
import { create, cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { create as createSeries } from '$lib/server/reservation/recurring-series-service';
import { createReservationSchema } from '$lib/server/reservation/types';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import {
	TIME_SLOT_MINUTES,
	MIN_DURATION_HOURS,
	MAX_DURATION_HOURS,
	RECURRING_FREQUENCIES
} from '$lib/server/reservation/config';
import type { RecurringFrequency } from '$lib/server/reservation/config';
import { getProductConfig } from '$lib/server/finance/product-config-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

async function requireBand() {
	const { params } = getRequestEvent();
	const band = await getBySlug(params.slug!);
	if (!band) throw error(404, 'Band not found');
	return band;
}

async function requireMember() {
	const user = requireUser();
	const band = await requireBand();
	const role = await getUserRole(band.id, user.id);
	if (!role) throw error(403, 'Not a member of this band');
	return { user, band, role };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getSlots = query(z.string(), async (dateParam) => {
	await requireMember();

	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const slots = await getAvailableSlots(date);
	const rehearsalConfig = await getProductConfig('rehearsal');

	return {
		date: date.toISOString().split('T')[0],
		slots,
		recurringFrequencies: RECURRING_FREQUENCIES,
		config: {
			hourlyRateCents: rehearsalConfig.unitAmountCents,
			slotMinutes: TIME_SLOT_MINUTES,
			minDurationHours: MIN_DURATION_HOURS,
			maxDurationHours: MAX_DURATION_HOURS
		}
	};
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const bandBookingSchema = createReservationSchema.extend({
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional()
});

export const bookReservation = form(bandBookingSchema, async (raw) => {
	const { user, band } = await requireMember();

	const data = raw as z.infer<typeof bandBookingSchema>;
	const recurringFrequency = data.recurring || undefined;
	const startsAt = buildDateInTz(data.date, data.startTime, 'America/Los_Angeles');
	const endsAt = buildDateInTz(data.date, data.endTime, 'America/Los_Angeles');

	const res = await create({
		userId: user.id,
		bookerType: 'band',
		bookerId: band.id,
		startsAt,
		endsAt,
		notes: data.notes
	});

	if (recurringFrequency) {
		await createSeries({
			prototypeReservationId: res.id,
			frequency: recurringFrequency as RecurringFrequency,
			prototypeStartsAt: startsAt
		});
	}

	return { reservationId: res.id };
});

export const cancelBandReservation = form(
	z.object({
		reservationId: z.string().min(1)
	}),
	async (data) => {
		const { user } = await requireMember();
		await cancelReservation(data.reservationId, user.id);
		return { success: true };
	}
);
