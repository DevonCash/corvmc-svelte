import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { getAvailableSlots } from '$lib/server/reservation/conflict-service';
import { create } from '$lib/server/reservation/reservation-service';
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
import { getSubscription } from '$lib/server/finance/subscription-service';
import { create as createSeries } from '$lib/server/reservation/recurring-series-service';

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
		recurringFrequencies: RECURRING_FREQUENCIES,
		config: {
			hourlyRateCents: rehearsalConfig.unitAmountCents,
			slotMinutes: TIME_SLOT_MINUTES,
			minDurationHours: MIN_DURATION_HOURS,
			maxDurationHours: MAX_DURATION_HOURS
		}
	};
});

/** Subscription status — called once per page load, not per date change */
export const getMembershipStatus = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user?.stripeId) return { isSustainingMember: false };
	const sub = await getSubscription(locals.user.stripeId);
	return { isSustainingMember: sub !== null };
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

const bookingSchema = createReservationSchema.extend({
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional()
});

export const bookReservation = form(bookingSchema, async (raw) => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');

	const data = raw as z.infer<typeof bookingSchema>;
	const recurringFrequency = data.recurring || undefined;
	const isRecurring = recurringFrequency != null;

	// Verify subscription BEFORE creating reservation to avoid orphans
	if (isRecurring) {
		if (!locals.user.stripeId) {
			throw error(403, 'Recurring reservations require a sustaining membership');
		}
		const sub = await getSubscription(locals.user.stripeId);
		if (!sub) {
			throw error(403, 'Recurring reservations require a sustaining membership');
		}
	}

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

	if (isRecurring && recurringFrequency) {
		await createSeries({
			prototypeReservationId: res.id,
			frequency: recurringFrequency as RecurringFrequency,
			prototypeStartsAt: startsAt
		});
	}

	return { reservationId: res.id };
});

