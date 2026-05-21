import { z } from 'zod';
import { error, redirect } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { reservation } from '$lib/server/db/schema/reservation';
import { createReservationSchema } from '$lib/server/db/schema/reservation';
import { like, or, eq, inArray } from 'drizzle-orm';
import { requireStaff, requireUser, isStaff } from '$lib/server/authorization';
import {
	getAvailableSlots,
	getConflictDetails,
	getValidationWarnings
} from '$lib/server/reservation/conflict-service';
import {
	staffCreate,
	create,
	cancel,
	confirm,
	markComplete,
	markNoShow,
	recordCashAndComplete
} from '$lib/server/reservation/reservation-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { getReservationConfig } from '$lib/server/reservation/config';
import { getProductConfig, buildLineItem } from '$lib/server/finance/product-config-service';
import { getSubscription } from '$lib/server/finance/subscription-service';
import {
	checkout,
	recordCashPayment,
	refund as refundPayment
} from '$lib/server/finance/payment-service';
import { getBalance } from '$lib/server/finance/credit-service';
import { RECURRING_FREQUENCIES, type RecurringFrequency } from '$lib/server/db/schema/recurring';
import { create as createSeries } from '$lib/server/reservation/recurring-series-service';
import { getMembers } from '$lib/server/band/band-service';
import { requireBandMember } from '$lib/server/band/band-context';

// ===========================================================================
// Queries
// ===========================================================================

/** Staff: search members by name or email for the create-reservation modal. */
export const searchMembers = query(z.string(), async (q) => {
	await requireStaff();
	if (!q || q.length < 2) return [];

	const pattern = `%${q}%`;
	const results = await db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(or(like(user.name, pattern), like(user.email, pattern)))
		.limit(20);

	return results;
});

/** Staff: available slots + config for a given date. */
export const getStaffSlots = query(z.string(), async (dateParam) => {
	await requireStaff();
	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, rehearsalConfig, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getProductConfig('rehearsal'),
		getReservationConfig()
	]);

	return {
		date: date.toISOString().split('T')[0],
		slots,
		config: {
			hourlyRateCents: rehearsalConfig.unitAmountCents,
			slotMinutes: reservationConfig.timeSlotMinutes,
			minDurationHours: reservationConfig.minDurationHours,
			maxDurationHours: reservationConfig.maxDurationHours
		}
	};
});

/** Member: available slots + config + recurring frequencies for a given date. */
export const getMemberSlots = query(z.string(), async (dateParam) => {
	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, rehearsalConfig, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getProductConfig('rehearsal'),
		getReservationConfig()
	]);

	return {
		date: date.toISOString().split('T')[0],
		slots,
		recurringFrequencies: RECURRING_FREQUENCIES,
		config: {
			hourlyRateCents: rehearsalConfig.unitAmountCents,
			slotMinutes: reservationConfig.timeSlotMinutes,
			minDurationHours: reservationConfig.minDurationHours,
			maxDurationHours: reservationConfig.maxDurationHours
		}
	};
});

/** Band: available slots + config + recurring frequencies for a given date. */
export const getBandSlots = query(z.string(), async (dateParam) => {
	await requireBandMember();

	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, rehearsalConfig, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getProductConfig('rehearsal'),
		getReservationConfig()
	]);

	return {
		date: date.toISOString().split('T')[0],
		slots,
		recurringFrequencies: RECURRING_FREQUENCIES,
		config: {
			hourlyRateCents: rehearsalConfig.unitAmountCents,
			slotMinutes: reservationConfig.timeSlotMinutes,
			minDurationHours: reservationConfig.minDurationHours,
			maxDurationHours: reservationConfig.maxDurationHours
		}
	};
});

/** Staff: check conflicts for a given date/time range. */
export const checkConflicts = query(
	z.object({ date: z.string(), startTime: z.string(), endTime: z.string() }),
	async ({ date, startTime, endTime }) => {
		await requireStaff();
		const startsAt = buildDateInTz(date, startTime, 'America/Los_Angeles');
		const endsAt = buildDateInTz(date, endTime, 'America/Los_Angeles');

		const conflicts = await getConflictDetails(startsAt, endsAt);
		const validationWarnings = await getValidationWarnings(startsAt, endsAt);

		return { conflicts, validationWarnings };
	}
);

/** Member: subscription status — called once per page load. */
export const getMembershipStatus = query(async () => {
	const { locals } = getRequestEvent();
	const freeHoursBalance = locals.user ? await getBalance(locals.user.id, 'free_hours') : 0;
	if (!locals.user?.stripeId) return { isSustainingMember: false, freeHoursBalance };
	const sub = await getSubscription(locals.user.stripeId);
	return { isSustainingMember: sub !== null, freeHoursBalance };
});

/** Band: check if any active band member has a sustaining membership. */
export const getBandMembershipStatus = query(z.void(), async () => {
	const { band } = await requireBandMember();
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

// ===========================================================================
// Forms — booking
// ===========================================================================

/** Staff: create a reservation on behalf of a member. */
const staffCreateSchema = z.object({
	memberId: z.string().min(1, 'Select a member'),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
	startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
	endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
	notes: z.string().optional()
});

export const createReservation = form(staffCreateSchema, async (data, issue) => {
	await requireStaff();
	const startsAt = buildDateInTz(data.date, data.startTime, 'America/Los_Angeles');
	const endsAt = buildDateInTz(data.date, data.endTime, 'America/Los_Angeles');

	const res = await staffCreate({
		userId: data.memberId,
		bookerType: 'user',
		bookerId: data.memberId,
		startsAt,
		endsAt,
		notes: data.notes,
		status: 'confirmed'
	});

	return { reservationId: res.id };
});

/** Member: book a reservation (optionally recurring). */
const memberBookingSchema = createReservationSchema.extend({
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional()
});

export const bookMemberReservation = form(memberBookingSchema, async (data, issue) => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');

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

/** Member: book a reservation and immediately initiate payment. */
const bookAndPaySchema = createReservationSchema.extend({
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional(),
	coverFees: z.enum(['', 'on']).optional()
});

export const bookAndPayReservation = form(bookAndPaySchema, async (data, issue) => {
	const { locals, url } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');

	const recurringFrequency = data.recurring || undefined;
	const isRecurring = recurringFrequency != null;

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

	const rehearsalConfig = await getProductConfig('rehearsal');
	const hourlyRateCents = rehearsalConfig.unitAmountCents;
	const durationMs = endsAt.getTime() - startsAt.getTime();
	const durationHours = durationMs / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);
	const lineItem = await buildLineItem('rehearsal', totalCents, 1);

	const result = await checkout({
		stripeCustomerId: locals.user.stripeId ?? undefined,
		customerEmail: locals.user.email,
		userId: locals.user.id,
		mode: 'payment',
		lineItems: [lineItem],
		eligibleCredits: [{ type: 'free_hours', unitValueCents: hourlyRateCents }],
		coverFees: data.coverFees === 'on',
		metadata: { reservation_id: res.id },
		successUrl: `${url.origin}/member/reservations`,
		cancelUrl: `${url.origin}/member/reservations`
	});

	if (result.paid) {
		await db
			.update(reservation)
			.set({
				status: 'confirmed',
				stripePaymentRecordId: result.stripePaymentRecordId ?? null,
				updatedAt: new Date()
			})
			.where(eq(reservation.id, res.id));

		return { reservationId: res.id, paid: true as const };
	}

	return { reservationId: res.id, paid: false as const, redirectUrl: result.checkoutUrl! };
});

/** Band: book a reservation (optionally recurring). */
const bandBookingSchema = createReservationSchema.extend({
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional()
});

export const bookBandReservation = form(bandBookingSchema, async (data, issue) => {
	const { band } = await requireBandMember();
	const currentUser = requireUser();

	const recurringFrequency = data.recurring || undefined;
	const startsAt = buildDateInTz(data.date, data.startTime, 'America/Los_Angeles');
	const endsAt = buildDateInTz(data.date, data.endTime, 'America/Los_Angeles');

	const res = await create({
		userId: currentUser.id,
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
			if (sub) {
				hasSustaining = true;
				break;
			}
		}
		if (!hasSustaining) {
			throw error(
				403,
				'Recurring reservations require at least one band member with a sustaining membership'
			);
		}

		await createSeries({
			prototypeReservationId: res.id,
			frequency: recurringFrequency as RecurringFrequency,
			prototypeStartsAt: startsAt
		});
	}

	return { reservationId: res.id };
});

/** Band: cancel a band reservation. */
export const cancelBandReservation = form(
	z.object({
		reservationId: z.string().min(1)
	}),
	async (data, issue) => {
		const currentUser = requireUser();
		await requireBandMember();
		await cancel(data.reservationId, currentUser.id);
		return { success: true };
	}
);

/** Member: pay for a reservation via Stripe checkout. */
export const payReservation = form(
	z.object({
		coverFees: z.literal('on').optional()
	}),
	async (data, issue) => {
		const currentUser = requireUser();
		const { params, url } = getRequestEvent();

		const [row] = await db
			.select()
			.from(reservation)
			.where(eq(reservation.id, params.id!))
			.limit(1);

		if (!row) throw error(404, 'Reservation not found');
		if (row.createdByUserId !== currentUser.id) throw error(403, 'Not your reservation');
		if (row.status !== 'scheduled') throw error(400, 'Not awaiting payment');

		const rehearsalConfig = await getProductConfig('rehearsal');
		const hourlyRateCents = rehearsalConfig.unitAmountCents;

		const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
		const durationHours = durationMs / (1000 * 60 * 60);
		const totalCents = Math.round(durationHours * hourlyRateCents);

		const lineItem = await buildLineItem('rehearsal', totalCents, 1);

		const result = await checkout({
			stripeCustomerId: currentUser.stripeId ?? undefined,
			customerEmail: currentUser.email,
			userId: currentUser.id,
			mode: 'payment',
			lineItems: [lineItem],
			eligibleCredits: [{ type: 'free_hours', unitValueCents: hourlyRateCents }],
			coverFees: data.coverFees === 'on',
			metadata: { reservation_id: row.id },
			successUrl: `${url.origin}/member/reservations`,
			cancelUrl: `${url.origin}/member/reservations/${row.id}/pay`
		});

		if (result.paid) {
			await db
				.update(reservation)
				.set({
					status: 'confirmed',
					stripePaymentRecordId: result.stripePaymentRecordId ?? null,
					updatedAt: new Date()
				})
				.where(eq(reservation.id, row.id));

			redirect(303, '/member/reservations');
		}

		redirect(303, result.checkoutUrl!);
	}
);

// ===========================================================================
// Forms — staff actions (converted from API routes)
// ===========================================================================

/** Staff/owner: confirm a reservation. */
export const confirmReservation = form(
	z.object({ id: z.string() }),
	async (data, issue) => {
		const currentUser = requireUser();

		const [row] = await db
			.select({ createdByUserId: reservation.createdByUserId })
			.from(reservation)
			.where(eq(reservation.id, data.id))
			.limit(1);
		if (!row) throw error(404, 'Reservation not found');

		// Allow if staff or the owner of the reservation
		const isOwner = currentUser.id === row.createdByUserId;
		const staff = await isStaff(currentUser.id);
		if (!isOwner && !staff) throw error(403, 'Not authorized');

		await confirm(data.id);
		return { success: true };
	}
);

/** Cancel a reservation (staff can override). */
export const cancelReservation = form(
	z.object({
		id: z.string(),
		reason: z.string().optional()
	}),
	async (data, issue) => {
		const currentUser = requireUser();
		const staff = await isStaff(currentUser.id);
		await cancel(data.id, currentUser.id, data.reason, { staffOverride: staff });
		return { success: true };
	}
);

/** Staff: mark a reservation as completed. */
export const completeReservation = form(
	z.object({ id: z.string() }),
	async (data, issue) => {
		await requireStaff();
		await markComplete(data.id);
		return { success: true };
	}
);

/** Staff: mark a reservation as no-show. */
export const noShowReservation = form(
	z.object({ id: z.string() }),
	async (data, issue) => {
		await requireStaff();
		await markNoShow(data.id);
		return { success: true };
	}
);

/** Staff: record cash payment and complete reservation. */
export const cashReceivedReservation = form(
	z.object({ id: z.string() }),
	async (data, issue) => {
		await requireStaff();

		const [row] = await db
			.select({
				createdByUserId: reservation.createdByUserId,
				startsAt: reservation.startsAt,
				endsAt: reservation.endsAt
			})
			.from(reservation)
			.where(eq(reservation.id, data.id))
			.limit(1);
		if (!row) throw error(404, 'Reservation not found');

		const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
		const durationHours = durationMs / (1000 * 60 * 60);
		const rehearsal = await getProductConfig('rehearsal');
		const amountCents = Math.round(durationHours * rehearsal.unitAmountCents);

		const [member] = await db
			.select({ stripeId: user.stripeId })
			.from(user)
			.where(eq(user.id, row.createdByUserId))
			.limit(1);
		if (!member?.stripeId) throw error(400, 'Member has no Stripe customer ID');

		const { paymentRecordId } = await recordCashPayment({
			userId: row.createdByUserId,
			stripeCustomerId: member.stripeId,
			amountCents,
			metadata: { reservation_id: data.id }
		});

		await recordCashAndComplete(data.id, paymentRecordId);
		return { success: true };
	}
);

/** Staff: comp a reservation (waive payment and confirm). */
export const compReservation = form(
	z.object({ id: z.string() }),
	async (data, issue) => {
		await requireStaff();
		await confirm(data.id);
		return { success: true };
	}
);

/** Staff: refund the payment on a reservation. */
export const refundReservation = form(
	z.object({ id: z.string() }),
	async (data, issue) => {
		await requireStaff();

		const [row] = await db
			.select({
				createdByUserId: reservation.createdByUserId,
				stripePaymentRecordId: reservation.stripePaymentRecordId
			})
			.from(reservation)
			.where(eq(reservation.id, data.id))
			.limit(1);
		if (!row) throw error(404, 'Reservation not found');
		if (!row.stripePaymentRecordId) throw error(400, 'No payment to refund');

		await refundPayment({
			userId: row.createdByUserId,
			stripePaymentRecordId: row.stripePaymentRecordId
		});
		return { success: true };
	}
);
