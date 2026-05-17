import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, query, getRequestEvent } from '$app/server';
import { getBySlug, getUserRole, getMembers } from '$lib/server/band/band-service';
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
import { getSubscription } from '$lib/server/finance/subscription-service';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { inArray } from 'drizzle-orm';

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

/** Check if any active band member has a sustaining membership. */
export const getBandMembershipStatus = query(z.void(), async () => {
	const { band } = await requireMember();
	const members = await getMembers(band.id);
	const activeUserIds = members
		.filter((m) => m.status === 'active')
		.map((m) => m.userId);

	if (activeUserIds.length === 0) return { hasSustainingMember: false };

	const users = await db
		.select({ stripeId: user.stripeId })
		.from(user)
		.where(inArray(user.id, activeUserIds));

	for (const u of users) {
		if (!u.stripeId) continue;
		const sub = await getSubscription(u.stripeId);
		if (sub) return { hasSustainingMember: true };
	}

	return { hasSustainingMember: false };
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
		// Verify at least one band member has a sustaining membership
		const members = await getMembers(band.id);
		const activeUserIds = members
			.filter((m) => m.status === 'active')
			.map((m) => m.userId);
		const users = await db
			.select({ stripeId: user.stripeId })
			.from(user)
			.where(inArray(user.id, activeUserIds));

		let hasSustaining = false;
		for (const u of users) {
			if (!u.stripeId) continue;
			const sub = await getSubscription(u.stripeId);
			if (sub) { hasSustaining = true; break; }
		}
		if (!hasSustaining) {
			throw error(403, 'Recurring reservations require at least one band member with a sustaining membership');
		}

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
