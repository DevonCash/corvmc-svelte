import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { getAvailableSlots } from '$lib/server/reservation/conflict-service';
import { create } from '$lib/server/reservation/reservation-service';
import { createReservationSchema } from '$lib/server/reservation/types';
import {
	TIME_SLOT_MINUTES,
	MIN_DURATION_HOURS,
	MAX_DURATION_HOURS
} from '$lib/server/reservation/config';
import { getProductConfig } from '$lib/server/finance/product-config-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getSlots = query(z.string(), async (dateParam) => {
	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const slots = await getAvailableSlots(date);
	const rehearsalConfig = await getProductConfig('rehearsal');

	return {
		date: date.toISOString().split('T')[0],
		slots,
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

export const bookReservation = form(createReservationSchema, async (raw) => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');

	const data = raw as z.infer<typeof createReservationSchema>;
	const startsAt = buildDateInTz(data.date, data.startTime, 'America/Los_Angeles');
	const endsAt = buildDateInTz(data.date, data.endTime, 'America/Los_Angeles');

	const res = await create({
		userId: locals.user.id,
		bookerType: 'user',
		bookerId: locals.user.id,
		startsAt,
		endsAt,
		notes: data.notes
	});

	return { reservationId: res.id };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a date + time string into a Date in the given timezone */
function buildDateInTz(dateStr: string, timeStr: string, tz: string): Date {
	const [hours, minutes] = timeStr.split(':').map(Number);
	const utcDate = new Date(`${dateStr}T${timeStr}:00Z`);

	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: tz,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	});

	const parts = formatter.formatToParts(utcDate);
	const localHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
	const localMinute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);

	const wantedMinutes = hours * 60 + minutes;
	const gotMinutes = localHour * 60 + localMinute;
	const offsetMinutes = gotMinutes - wantedMinutes;

	return new Date(utcDate.getTime() - offsetMinutes * 60 * 1000);
}
