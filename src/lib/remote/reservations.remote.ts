import { z } from 'zod';
import { error, redirect } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireFeature } from '$lib/server/feature-flags';
import { db } from '$lib/server/db';
import { user, type Subscription } from '$lib/server/db/schema/authentication';
import {
	reservation,
	type Reservation,
	reservationStatuses,
	type ReservationStatus
} from '$lib/server/db/schema/reservation';
import { createReservationSchema } from '$lib/server/db/schema/reservation';
import {
	like,
	or,
	eq,
	ne,
	and,
	lt,
	gt,
	lte,
	inArray,
	notInArray,
	sql,
	isNull,
	asc,
	desc,
	count
} from 'drizzle-orm';
import { getBySlug } from '$lib/server/band/band-service';
import { formatDateInTz, buildDateInTz } from '$lib/server/reservation/timezone';
import { resolveImageUrl } from '$lib/server/storage';
import { describeFrequency, monthlyModeOf } from '$lib/server/reservation/rrule-helpers';
import { requireStaff, requireUser, isStaff, primaryRoleFor } from '$lib/server/authorization';
import { isSustainingMemberSql } from '$lib/server/finance/subscription-service';
import {
	getAvailableSlots,
	getConflictDetails,
	getValidationWarnings
} from '$lib/server/reservation/conflict-service';
import {
	staffCreate,
	create,
	createWaitlisted,
	cancel,
	confirm,
	markComplete,
	markNoShow,
	recordCashAndComplete,
	ReservationConflictError
} from '$lib/server/reservation/reservation-service';
import { mapDomainError } from '$lib/server/errors';
import { getReservationConfig } from '$lib/server/reservation/config';
import { config } from '$lib/server/site-config/site-config-service';
import type { CheckoutLineItem } from '$lib/server/finance/payment-service';
import {
	checkout,
	recordCashPayment,
	refund as refundPayment
} from '$lib/server/finance/payment-service';
import { getBalance } from '$lib/server/finance/credit-service';
import {
	commitReservationCredits,
	computeReservationCredit,
	reverseReservationCredits
} from '$lib/server/reservation/reservation-credit-service';
import { ensureStripeCustomer } from '$lib/server/finance/stripe-customer-service';
import {
	RECURRING_FREQUENCIES,
	recurringSeries,
	type RecurringFrequency
} from '$lib/server/db/schema/recurring';
import { formatSlotTime } from '$lib/utils/format';
import { buildRRule, getOccurrences } from '$lib/server/reservation/rrule-helpers';
import { create as createSeries } from '$lib/server/reservation/recurring-series-service';
import { getMembers } from '$lib/server/band/band-service';
import { requireBandMember } from '$lib/server/band/band-context';
import { paginate } from '$lib/server/db/paginate';
import { DEFAULT_TIMEZONE, SEARCH_LIMIT, LIST_LIMIT } from '$lib/config';

// ===========================================================================
// Queries
// ===========================================================================

export const getReservationPayment = query(z.string(), async (id) => {
	const currentUser = requireUser();

	const [row] = await db.select().from(reservation).where(eq(reservation.id, id)).limit(1);

	if (!row) throw error(404, 'Reservation not found');
	if (row.createdByUserId !== currentUser.id) throw error(403, 'Not your reservation');
	if (row.status !== 'scheduled') throw error(400, 'This reservation is not awaiting payment');

	const hourlyRateCents = await config<number>('reservation.hourlyRateCents');
	const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
	const durationHours = durationMs / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);
	const freeHoursBalance = await getBalance(currentUser.id, 'free_hours');

	return {
		reservation: {
			id: row.id,
			startsAt: row.startsAt,
			endsAt: row.endsAt,
			notes: row.notes
		},
		durationHours,
		totalCents,
		hourlyRateCents,
		freeHoursBalance
	};
});

/**
 * Owner-only detail view for a single reservation — backs the member detail
 * page that gets linked in communications (and surfaces the door code).
 */
export const getReservationDetail = query(z.string(), async (id) => {
	const currentUser = requireUser();

	const [row] = await db.select().from(reservation).where(eq(reservation.id, id)).limit(1);

	if (!row) throw error(404, 'Reservation not found');
	if (row.createdByUserId !== currentUser.id) throw error(403, 'Not your reservation');

	const hourlyRateCents = await config<number>('reservation.hourlyRateCents');
	const durationHours = (row.endsAt.getTime() - row.startsAt.getTime()) / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);

	return {
		reservation: row,
		durationHours,
		totalCents,
		hourlyRateCents
	};
});

export const getBandReservations = query(z.string(), async (slug) => {
	await requireFeature('bandReservations');
	requireUser();
	const band = await getBySlug(slug);
	if (!band) throw error(404, 'Band not found');

	const now = new Date();

	const upcoming = await db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			notes: reservation.notes,
			bookedByName: user.name
		})
		.from(reservation)
		.leftJoin(user, eq(user.id, reservation.createdByUserId))
		.where(
			and(
				eq(reservation.bookerType, 'band'),
				eq(reservation.bookerId, band.id),
				gt(reservation.startsAt, now),
				ne(reservation.status, 'cancelled')
			)
		)
		.orderBy(reservation.startsAt);

	const past = await db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			notes: reservation.notes,
			bookedByName: user.name
		})
		.from(reservation)
		.leftJoin(user, eq(user.id, reservation.createdByUserId))
		.where(
			and(
				eq(reservation.bookerType, 'band'),
				eq(reservation.bookerId, band.id),
				lte(reservation.startsAt, now)
			)
		)
		.orderBy(desc(reservation.startsAt))
		.limit(SEARCH_LIMIT);

	return { upcoming, past };
});

export const getStaffReservationDetail = query(z.string(), async (id) => {
	await requireStaff();

	const rows = await db
		.select({
			reservation: reservation,
			memberName: user.name,
			memberEmail: user.email,
			memberPhone: user.phone,
			memberPronouns: user.pronouns,
			memberImage: user.image
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(eq(reservation.id, id))
		.limit(1);

	if (!rows[0]) throw error(404, 'Reservation not found');

	const row = {
		...rows[0].reservation,
		memberName: rows[0].memberName,
		memberEmail: rows[0].memberEmail,
		memberPhone: rows[0].memberPhone,
		memberPronouns: rows[0].memberPronouns,
		memberImage: resolveImageUrl(rows[0].memberImage)
	};

	const tz = DEFAULT_TIMEZONE;
	const dayStr = formatDateInTz(row.startsAt, tz);
	const dayStart = buildDateInTz(dayStr, '00:00', tz);
	const dayEnd = buildDateInTz(dayStr, '23:59', tz);

	const sameDayReservations = await db
		.select({
			id: reservation.id,
			bookerType: reservation.bookerType,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			status: reservation.status
		})
		.from(reservation)
		.where(
			and(
				ne(reservation.status, 'cancelled'),
				ne(reservation.id, id),
				lt(reservation.startsAt, dayEnd),
				gt(reservation.endsAt, dayStart)
			)
		)
		.orderBy(asc(reservation.startsAt));

	const isLastOfDay =
		sameDayReservations.filter((r) => r.startsAt.getTime() > row.startsAt.getTime()).length === 0;

	const [prevRow] = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(ne(reservation.status, 'cancelled'), lt(reservation.startsAt, row.startsAt)))
		.orderBy(desc(reservation.startsAt))
		.limit(1);

	const [nextRow] = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(and(ne(reservation.status, 'cancelled'), gt(reservation.startsAt, row.startsAt)))
		.orderBy(asc(reservation.startsAt))
		.limit(1);

	const [completedCount] = await db
		.select({ count: count() })
		.from(reservation)
		.where(
			and(eq(reservation.createdByUserId, row.createdByUserId), eq(reservation.status, 'completed'))
		);

	return {
		reservation: row,
		sameDayReservations: sameDayReservations.map((r) => ({
			id: r.id,
			memberName: '',
			bookerType: r.bookerType,
			startsAt: r.startsAt,
			endsAt: r.endsAt
		})),
		isLastOfDay,
		prevId: prevRow?.id ?? null,
		nextId: nextRow?.id ?? null,
		isFirstReservation: completedCount.count === 0,
		hourlyRateCents: await config<number>('reservation.hourlyRateCents')
	};
});

/** Staff: search members by name or email for the create-reservation modal. */
export const searchMembers = query(z.string(), async (q) => {
	await requireStaff();
	if (!q || q.length < 2) return [];

	const pattern = `%${q}%`;
	const results = await db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(or(like(user.name, pattern), like(user.email, pattern)))
		.limit(SEARCH_LIMIT);

	return results;
});

/** Staff: available slots + config for a given date. */
export const getStaffSlots = query(z.string(), async (dateParam) => {
	await requireStaff();
	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getReservationConfig()
	]);

	return {
		date: date.toISOString().split('T')[0],
		slots,
		config: {
			hourlyRateCents: reservationConfig.hourlyRateCents,
			slotMinutes: reservationConfig.timeSlotMinutes,
			minDurationHours: reservationConfig.minDurationHours,
			maxDurationHours: reservationConfig.maxDurationHours
		}
	};
});

/** Member: dates with bookable availability in the next N days. */
export const getAvailableDates = query(async () => {
	const config = await getReservationConfig();
	const minSlots = config.minDurationHours * (60 / config.timeSlotMinutes);
	const days = Math.ceil(config.maxAdvanceDaysOneoff);
	const today = new Date();
	const tz = DEFAULT_TIMEZONE;
	const todayStr = today.toLocaleDateString('en-CA', { timeZone: tz });

	const results: string[] = [];
	for (let i = 0; i <= days; i++) {
		const d = new Date(todayStr + 'T00:00:00');
		d.setDate(d.getDate() + i);
		const dateStr = d.toISOString().split('T')[0];
		const slots = await getAvailableSlots(d);

		let maxRun = 0;
		let run = 0;
		for (const s of slots) {
			if (s.available) {
				run++;
				if (run > maxRun) maxRun = run;
			} else {
				run = 0;
			}
		}
		if (maxRun >= minSlots) results.push(dateStr);
	}
	return results;
});

/** Member: available slots + config + recurring frequencies for a given date. */
export const getMemberSlots = query(z.string(), async (dateParam) => {
	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getReservationConfig()
	]);

	return {
		date: date.toISOString().split('T')[0],
		slots,
		recurringFrequencies: RECURRING_FREQUENCIES,
		config: {
			hourlyRateCents: reservationConfig.hourlyRateCents,
			slotMinutes: reservationConfig.timeSlotMinutes,
			minDurationHours: reservationConfig.minDurationHours,
			maxDurationHours: reservationConfig.maxDurationHours
		}
	};
});

/** Available start times for a given date, with pricing config. */
export const getReservationStartTimes = query(z.string(), async (dateParam) => {
	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getReservationConfig()
	]);

	const minSlots = reservationConfig.minDurationHours * (60 / reservationConfig.timeSlotMinutes);

	function contiguousFrom(startIdx: number): number {
		let count = 0;
		for (let i = startIdx; i < slots.length && slots[i].available; i++) count++;
		return count;
	}

	const options = slots
		.filter((s, i) => s.available && contiguousFrom(i) >= minSlots)
		.map((s) => ({ value: s.startTime, label: formatSlotTime(s.startTime) }));

	return options;
});

/** Available end times for a given date and start time. */
export const getReservationEndTimes = query(
	z.object({ date: z.string(), startTime: z.string() }),
	async ({ date: dateParam, startTime }) => {
		const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
		const [slots, reservationConfig] = await Promise.all([
			getAvailableSlots(date),
			getReservationConfig()
		]);

		const slotMinutes = reservationConfig.timeSlotMinutes;
		const minSlots = reservationConfig.minDurationHours * (60 / slotMinutes);
		const maxSlots = reservationConfig.maxDurationHours * (60 / slotMinutes);

		const startIdx = slots.findIndex((s) => s.startTime === startTime);
		if (startIdx === -1) return [];

		let run = 0;
		for (let i = startIdx; i < slots.length && slots[i].available; i++) run++;
		const cap = Math.min(run, maxSlots);

		const options: { value: string; label: string }[] = [];
		for (let i = 0; i < cap; i++) {
			if (i + 1 >= minSlots) {
				const t = slots[startIdx + i].endTime;
				options.push({ value: t, label: formatSlotTime(t) });
			}
		}
		return options;
	}
);

/** Member: full pricing breakdown for a given date/time selection. */
export const getReservationPricing = query(
	z.object({
		date: z.string(),
		startTime: z.string(),
		endTime: z.string(),
		// When confirming an existing reservation, pricing must reflect the
		// reservation OWNER's free hours / sustaining status — not the acting user
		// (e.g. a staff member confirming on the owner's behalf). Omitted by the
		// create flow, which has no reservation yet and keys to the acting user.
		reservationId: z.string().optional()
	}),
	async ({ startTime, endTime, reservationId }) => {
		const { locals } = getRequestEvent();
		const config = await getReservationConfig();

		const [sh, sm] = startTime.split(':').map(Number);
		const [eh, em] = endTime.split(':').map(Number);
		const durationHours = (eh * 60 + em - (sh * 60 + sm)) / 60;

		const hourlyRateCents = config.hourlyRateCents;
		const totalCents = Math.round(durationHours * hourlyRateCents);

		// Resolve whose free hours apply. For an existing reservation, that's the
		// owner — staff or the owner themselves may view it.
		let targetUserId = locals.user?.id ?? null;
		if (reservationId) {
			const [res] = await db
				.select({ createdByUserId: reservation.createdByUserId })
				.from(reservation)
				.where(eq(reservation.id, reservationId))
				.limit(1);
			if (!res) throw error(404, 'Reservation not found');
			const isOwner = locals.user?.id === res.createdByUserId;
			const staff = locals.user ? await isStaff(locals.user.id) : false;
			if (!isOwner && !staff) throw error(403, 'Not authorized');
			targetUserId = res.createdByUserId;
		}

		const freeHoursBalance = targetUserId ? await getBalance(targetUserId, 'free_hours') : 0;

		let isSustainingMember = false;
		if (targetUserId) {
			const [row] = await db
				.select({ subscription: user.subscription })
				.from(user)
				.where(eq(user.id, targetUserId))
				.limit(1);
			isSustainingMember = row?.subscription != null;
		}

		// Single source of truth shared with settlement (commitReservationCredits)
		// so the member is never shown a different remainder than they're charged.
		const { creditUnits, creditDiscountCents, remainingCents } = computeReservationCredit({
			totalCents,
			durationHours,
			hourlyRateCents,
			freeHoursBalance
		});

		return {
			durationHours,
			hourlyRateCents,
			totalCents,
			freeHoursBalance,
			creditsApplicable: creditUnits,
			creditDiscountCents,
			remainingCents,
			isSustainingMember
		};
	}
);

/** Recurring: all operating-hour time slots (no per-date availability filtering). */
export const getRecurringTimeSlots = query(async () => {
	const cfg = await getReservationConfig();
	const slotMinutes = cfg.timeSlotMinutes;
	const [startH, startM] = cfg.operatingHoursStart.split(':').map(Number);
	const [endH, endM] = cfg.operatingHoursEnd.split(':').map(Number);

	const startSlots: { value: string; label: string }[] = [];
	const allSlots: string[] = [];

	for (let m = startH * 60 + startM; m < endH * 60 + endM; m += slotMinutes) {
		const hh = String(Math.floor(m / 60)).padStart(2, '0');
		const mm = String(m % 60).padStart(2, '0');
		const time = `${hh}:${mm}`;
		allSlots.push(time);
	}
	// Add the closing time as a valid end time
	allSlots.push(cfg.operatingHoursEnd);

	const minSlots = cfg.minDurationHours * (60 / slotMinutes);
	// Start times must leave room for at least minDuration
	for (let i = 0; i < allSlots.length - minSlots; i++) {
		startSlots.push({ value: allSlots[i], label: formatSlotTime(allSlots[i]) });
	}

	return {
		startSlots,
		allSlots: allSlots.map((t) => ({ value: t, label: formatSlotTime(t) })),
		config: {
			slotMinutes,
			minDurationHours: cfg.minDurationHours,
			maxDurationHours: cfg.maxDurationHours
		}
	};
});

/** Recurring: preview upcoming instances for a given schedule. */
export const previewRecurringInstances = query(
	z.object({
		date: z.string(),
		startTime: z.string(),
		frequency: z.enum(['weekly', 'biweekly', 'monthly']),
		monthlyMode: z.enum(['weekday', 'monthday']).optional()
	}),
	async ({ date, startTime, frequency, monthlyMode }) => {
		const startsAt = buildDateInTz(date, startTime, DEFAULT_TIMEZONE);
		const rruleString = buildRRule(
			startsAt,
			frequency as RecurringFrequency,
			monthlyMode ?? 'weekday'
		);
		const now = new Date();
		// Show ~60 days of preview
		const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
		const occurrences = getOccurrences(rruleString, now, windowEnd);
		return {
			dates: occurrences.slice(0, 8).map((d) => d.toISOString()),
			totalInWindow: occurrences.length
		};
	}
);

/** Band: available slots + config + recurring frequencies for a given date. */
export const getBandSlots = query(z.string(), async (dateParam) => {
	await requireFeature('bandReservations');
	await requireBandMember();

	const date = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
	const [slots, reservationConfig] = await Promise.all([
		getAvailableSlots(date),
		getReservationConfig()
	]);

	return {
		date: date.toISOString().split('T')[0],
		slots,
		recurringFrequencies: RECURRING_FREQUENCIES,
		config: {
			hourlyRateCents: reservationConfig.hourlyRateCents,
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
		const startsAt = buildDateInTz(date, startTime, DEFAULT_TIMEZONE);
		const endsAt = buildDateInTz(date, endTime, DEFAULT_TIMEZONE);

		const conflicts = await getConflictDetails(startsAt, endsAt);
		const validationWarnings = await getValidationWarnings(startsAt, endsAt);

		return { conflicts, validationWarnings };
	}
);

/** Member: subscription status — called once per page load. */
export const getMembershipStatus = query(async () => {
	const { locals } = getRequestEvent();
	if (!locals.user)
		return {
			isSustainingMember: false,
			freeHoursBalance: 0,
			creditsResetAt: null,
			hoursPerReset: 0
		};

	const [row] = await db
		.select({ subscription: user.subscription })
		.from(user)
		.where(eq(user.id, locals.user.id))
		.limit(1);

	const freeHoursBalance = await getBalance(locals.user.id, 'free_hours');
	const sub = row?.subscription as Subscription | null;

	return {
		isSustainingMember: sub != null,
		freeHoursBalance,
		creditsResetAt: sub?.creditsResetAt ?? null,
		hoursPerReset: sub?.hoursPerReset ?? 0
	};
});

/** Band: check if any active band member has a sustaining membership. */
export const getBandMembershipStatus = query(z.void(), async () => {
	await requireFeature('bandReservations');
	const { band } = await requireBandMember();
	const members = await getMembers(band.id);
	const activeUserIds = members.filter((m) => m.status === 'active').map((m) => m.userId);

	if (activeUserIds.length === 0) return { hasSustainingMember: false };

	const [sustaining] = await db
		.select({ id: user.id })
		.from(user)
		.where(and(inArray(user.id, activeUserIds), sql`subscription is not null`))
		.limit(1);

	return { hasSustainingMember: sustaining != null };
});

// ===========================================================================
// Queries — staff reservations
// ===========================================================================

const staffReservationFiltersSchema = z.object({
	tab: z.enum(['upcoming', 'all']).optional(),
	search: z.string().optional(),
	dateFrom: z.string().optional(),
	dateTo: z.string().optional(),
	statusFilter: z.array(z.string()).optional(),
	page: z.number().optional()
});

/** Staff: paginated, filtered reservation list. */
export const getStaffReservations = query(staffReservationFiltersSchema, async (filters) => {
	await requireStaff();

	const now = new Date();
	const tab = filters.tab ?? 'upcoming';
	const conditions = [];

	if (tab === 'upcoming') {
		conditions.push(gt(reservation.endsAt, now));
		conditions.push(ne(reservation.status, 'cancelled'));
	}

	if (filters.statusFilter && filters.statusFilter.length > 0) {
		const valid = filters.statusFilter.filter((s): s is ReservationStatus =>
			(reservationStatuses as readonly string[]).includes(s)
		);
		if (valid.length > 0) conditions.push(inArray(reservation.status, valid));
	}

	if (filters.dateFrom) {
		conditions.push(gt(reservation.startsAt, new Date(filters.dateFrom + 'T00:00:00')));
	}
	if (filters.dateTo) {
		conditions.push(lt(reservation.startsAt, new Date(filters.dateTo + 'T23:59:59')));
	}

	if (filters.search) {
		const pattern = `%${filters.search}%`;
		conditions.push(or(like(user.name, pattern), like(user.email, pattern)));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const dataQ = db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			bookerType: reservation.bookerType,
			notes: reservation.notes,
			stripePaymentRecordId: reservation.stripePaymentRecordId,
			paidAt: reservation.paidAt,
			cashDueCents: reservation.cashDueCents,
			creditsUsed: reservation.creditsUsed,
			createdByUserId: reservation.createdByUserId,
			recurringSeriesId: reservation.recurringSeriesId,
			memberName: user.name,
			memberEmail: user.email,
			memberPronouns: user.pronouns,
			memberRole: primaryRoleFor(user.id),
			memberSustaining: isSustainingMemberSql(user.id)
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(where)
		.orderBy(tab === 'upcoming' ? asc(reservation.startsAt) : desc(reservation.startsAt))
		.$dynamic();

	const countQ = db
		.select({ count: count() })
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(where);

	return paginate(dataQ, countQ, { page: filters.page ?? 1, pageSize: 50 });
});

/** Staff: tab badge counts for reservations. */
export const getReservationCounts = query(async () => {
	await requireStaff();
	const now = new Date();

	const [upcomingCount] = await db
		.select({ count: count() })
		.from(reservation)
		.where(and(gt(reservation.endsAt, now), ne(reservation.status, 'cancelled')));

	const [allCount] = await db.select({ count: count() }).from(reservation);

	return { upcoming: upcomingCount.count, all: allCount.count };
});

/** Staff: unresolved reservations (past end time, still scheduled). */
export const getUnresolvedReservations = query(async () => {
	await requireStaff();
	const now = new Date();

	return db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			createdByUserId: reservation.createdByUserId,
			notes: reservation.notes,
			memberName: user.name,
			memberEmail: user.email,
			memberPronouns: user.pronouns,
			memberRole: primaryRoleFor(user.id),
			cashDueCents: reservation.cashDueCents
		})
		.from(reservation)
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				lt(reservation.endsAt, now),
				or(
					// Never confirmed/paid — pending resolution.
					eq(reservation.status, 'scheduled'),
					// Confirmed with cash still owed at the door.
					and(
						eq(reservation.status, 'confirmed'),
						isNull(reservation.paidAt),
						gt(reservation.cashDueCents, 0)
					)
				)
			)
		)
		.orderBy(asc(reservation.endsAt))
		.limit(LIST_LIMIT);
});

/** Staff: current hourly rate for reservation pricing. */
export const getHourlyRate = query(async () => {
	await requireStaff();
	return config<number>('reservation.hourlyRateCents');
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

export const createReservation = form(staffCreateSchema, async (data, _issue) => {
	await requireStaff();
	const startsAt = buildDateInTz(data.date, data.startTime, DEFAULT_TIMEZONE);
	const endsAt = buildDateInTz(data.date, data.endTime, DEFAULT_TIMEZONE);

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
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional(),
	monthlyMode: z.enum(['weekday', 'monthday']).optional()
});

export const bookMemberReservation = form(memberBookingSchema, async (data, _issue) => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');

	const recurringFrequency = data.recurring || undefined;
	const isRecurring = recurringFrequency != null;

	if (isRecurring) {
		const [row] = await db
			.select({ subscription: user.subscription })
			.from(user)
			.where(eq(user.id, locals.user.id))
			.limit(1);
		if (!row?.subscription) {
			throw error(403, 'Recurring reservations require a sustaining membership');
		}
	}

	const startsAt = buildDateInTz(data.date, data.startTime, DEFAULT_TIMEZONE);
	const endsAt = buildDateInTz(data.date, data.endTime, DEFAULT_TIMEZONE);

	let res;
	let waitlisted = false;

	try {
		res = await create({
			userId: locals.user.id,
			bookerType: 'user',
			bookerId: locals.user.id,
			startsAt,
			endsAt,
			notes: data.notes
		});
	} catch (err) {
		if (isRecurring && err instanceof ReservationConflictError) {
			res = await createWaitlisted({
				userId: locals.user.id,
				bookerType: 'user',
				bookerId: locals.user.id,
				startsAt,
				endsAt,
				notes: data.notes
			});
			waitlisted = true;
		} else {
			throw err;
		}
	}

	if (isRecurring && recurringFrequency) {
		await createSeries({
			prototypeReservationId: res.id,
			frequency: recurringFrequency as RecurringFrequency,
			prototypeStartsAt: startsAt,
			monthlyMode: data.monthlyMode
		});
	}

	return { reservationId: res.id, waitlisted };
});

/**
 * Commit free-hour credits to a reservation. If credits fully cover it, settle it
 * as a credit payment (status confirmed, creditsUsed set, cashDueCents 0, paidAt
 * left null, best-effort $0 Stripe record) and return `settled: true`. Otherwise
 * return the cash remainder owed. The credit
 * commit is idempotent, so calling this from Confirm then Pay-Ahead/Cash never
 * double-deducts.
 */
async function commitCreditsAndSettleIfCovered(opts: {
	reservationId: string;
	userId: string;
	email: string;
	name: string | null;
	durationHours: number;
	totalCents: number;
	hourlyRateCents: number;
}): Promise<{ remainingCents: number; settled: boolean }> {
	const credit = await commitReservationCredits({
		userId: opts.userId,
		reservationId: opts.reservationId,
		totalCents: opts.totalCents,
		durationHours: opts.durationHours,
		hourlyRateCents: opts.hourlyRateCents
	});

	if (credit.remainingCents > 0) {
		return { remainingCents: credit.remainingCents, settled: false };
	}

	// Fully covered by free hours → settle as a credit payment. The $0 Stripe
	// record is best-effort; the committed credits are the authoritative settlement.
	let stripePaymentRecordId: string | null = null;
	try {
		const stripeCustomerId = await ensureStripeCustomer(
			opts.userId,
			opts.email,
			opts.name ?? undefined
		);
		const rec = await recordCashPayment({
			userId: opts.userId,
			stripeCustomerId,
			amountCents: 0,
			displayName: 'Credits',
			metadata: { reservation_id: opts.reservationId }
		});
		stripePaymentRecordId = rec.paymentRecordId;
	} catch (err) {
		console.error('[reservation] $0 credit settlement record failed (settling anyway):', err);
	}

	await db
		.update(reservation)
		.set({
			status: 'confirmed',
			// paidAt intentionally left null — credit-settled, not cash-paid. The
			// $0 stripePaymentRecordId is the best-effort receipt; creditsUsed is
			// what marks this as "Paid with credits" vs. a true comp.
			stripePaymentRecordId,
			cashDueCents: 0,
			creditsUsed: opts.durationHours,
			updatedAt: new Date()
		})
		.where(eq(reservation.id, opts.reservationId));

	return { remainingCents: 0, settled: true };
}

/**
 * Pay for an existing reservation: commit free hours, then either settle (fully
 * covered) or charge the cash remainder online. Credits are committed once
 * (idempotent) and not re-applied inside checkout.
 */
async function payReservationRemainder(opts: {
	row: { id: string; startsAt: Date; endsAt: Date };
	userId: string;
	email: string;
	name: string | null;
	coverFees: boolean;
	successUrl: string;
	cancelUrl: string;
}): Promise<{ paid: true } | { checkoutUrl: string }> {
	const reservationConfig = await getReservationConfig();
	const hourlyRateCents = reservationConfig.hourlyRateCents;
	const durationHours =
		(opts.row.endsAt.getTime() - opts.row.startsAt.getTime()) / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);

	const { remainingCents, settled } = await commitCreditsAndSettleIfCovered({
		reservationId: opts.row.id,
		userId: opts.userId,
		email: opts.email,
		name: opts.name,
		durationHours,
		totalCents,
		hourlyRateCents
	});
	if (settled) return { paid: true };

	const stripeCustomerId = await ensureStripeCustomer(
		opts.userId,
		opts.email,
		opts.name ?? undefined
	);
	const result = await checkout({
		stripeCustomerId,
		customerEmail: opts.email,
		userId: opts.userId,
		mode: 'payment',
		lineItems: [
			{
				price_data: {
					currency: 'usd',
					product_data: { name: 'Practice Room Rental' },
					unit_amount: remainingCents
				},
				quantity: 1
			}
		],
		// Credits already committed against this reservation — don't deduct again.
		eligibleCredits: [],
		coverFees: opts.coverFees,
		metadata: { reservation_id: opts.row.id },
		successUrl: opts.successUrl,
		cancelUrl: opts.cancelUrl
	});

	if (result.paid) {
		await db
			.update(reservation)
			.set({
				status: 'confirmed',
				stripePaymentRecordId: result.stripePaymentRecordId ?? null,
				paidAt: new Date(),
				cashDueCents: 0,
				updatedAt: new Date()
			})
			.where(eq(reservation.id, opts.row.id));
		return { paid: true };
	}

	return { checkoutUrl: result.checkoutUrl! };
}

/** Member: book a reservation and immediately initiate payment. */
const bookAndPaySchema = createReservationSchema.extend({
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional(),
	monthlyMode: z.enum(['weekday', 'monthday']).optional(),
	coverFees: z.boolean().default(false),
	skipPayment: z.enum(['', 'on']).optional()
});

export const bookAndPayReservation = form(bookAndPaySchema, async (data, _issue) => {
	const { locals, url } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');

	const recurringFrequency = data.recurring || undefined;
	const isRecurring = recurringFrequency != null;

	if (isRecurring) {
		const [row] = await db
			.select({ subscription: user.subscription })
			.from(user)
			.where(eq(user.id, locals.user.id))
			.limit(1);
		if (!row?.subscription) {
			throw error(403, 'Recurring reservations require a sustaining membership');
		}
	}

	const startsAt = buildDateInTz(data.date, data.startTime, DEFAULT_TIMEZONE);
	const endsAt = buildDateInTz(data.date, data.endTime, DEFAULT_TIMEZONE);

	let res;
	let waitlisted = false;

	try {
		res = await create({
			userId: locals.user.id,
			bookerType: 'user',
			bookerId: locals.user.id,
			startsAt,
			endsAt,
			notes: data.notes
		});
	} catch (err) {
		if (err instanceof ReservationConflictError) {
			if (isRecurring) {
				res = await createWaitlisted({
					userId: locals.user.id,
					bookerType: 'user',
					bookerId: locals.user.id,
					startsAt,
					endsAt,
					notes: data.notes
				});
				waitlisted = true;
			} else {
				// One-time slot was taken between selection and submit. create()
				// checks conflicts before inserting, so nothing was written — signal
				// the wizard to send the member back to a refreshed time picker
				// rather than surfacing a 500.
				return { conflict: true as const };
			}
		} else {
			throw err;
		}
	}

	if (isRecurring && recurringFrequency) {
		await createSeries({
			prototypeReservationId: res.id,
			frequency: recurringFrequency as RecurringFrequency,
			prototypeStartsAt: startsAt,
			monthlyMode: data.monthlyMode
		});
	}

	// Waitlisted reservations skip payment — collect when slot opens
	if (waitlisted) {
		return { reservationId: res.id, waitlisted: true as const };
	}

	const reservationConfig = await getReservationConfig();
	const hourlyRateCents = reservationConfig.hourlyRateCents;
	const durationHours = (endsAt.getTime() - startsAt.getTime()) / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);

	if (data.skipPayment === 'on') {
		// Confirm: commit free hours now. If fully covered, it's settled; otherwise
		// the cash remainder is collected at the door.
		const { settled } = await commitCreditsAndSettleIfCovered({
			reservationId: res.id,
			userId: locals.user.id,
			email: locals.user.email,
			name: locals.user.name,
			durationHours,
			totalCents,
			hourlyRateCents
		});
		if (!settled) {
			await db
				.update(reservation)
				.set({ status: 'confirmed', updatedAt: new Date() })
				.where(eq(reservation.id, res.id));
		}
		return { reservationId: res.id, confirmed: true as const };
	}

	// Pay Ahead: commit free hours, then charge any cash remainder online now.
	const { remainingCents, settled } = await commitCreditsAndSettleIfCovered({
		reservationId: res.id,
		userId: locals.user.id,
		email: locals.user.email,
		name: locals.user.name,
		durationHours,
		totalCents,
		hourlyRateCents
	});
	if (settled) {
		return { reservationId: res.id, paid: true as const };
	}

	const lineItem: CheckoutLineItem = {
		price_data: {
			currency: 'usd',
			product_data: { name: 'Practice Room Rental' },
			unit_amount: remainingCents
		},
		quantity: 1
	};

	const stripeCustomerId = await ensureStripeCustomer(
		locals.user.id,
		locals.user.email,
		locals.user.name
	);

	const result = await checkout({
		stripeCustomerId,
		customerEmail: locals.user.email,
		userId: locals.user.id,
		mode: 'payment',
		lineItems: [lineItem],
		// Credits already committed against this reservation — don't deduct again.
		eligibleCredits: [],
		coverFees: data.coverFees,
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
				paidAt: new Date(),
				cashDueCents: 0,
				updatedAt: new Date()
			})
			.where(eq(reservation.id, res.id));

		return { reservationId: res.id, paid: true as const };
	}

	return { reservationId: res.id, paid: false as const, redirectUrl: result.checkoutUrl! };
});

/** Band: book a reservation (optionally recurring). */
const bandBookingSchema = createReservationSchema.extend({
	recurring: z.enum(['', 'weekly', 'biweekly', 'monthly']).optional(),
	monthlyMode: z.enum(['weekday', 'monthday']).optional()
});

export const bookBandReservation = form(bandBookingSchema, async (data, _issue) => {
	await requireFeature('bandReservations');
	const { band } = await requireBandMember();
	const currentUser = requireUser();

	const recurringFrequency = data.recurring || undefined;
	const isRecurring = recurringFrequency != null;
	const startsAt = buildDateInTz(data.date, data.startTime, DEFAULT_TIMEZONE);
	const endsAt = buildDateInTz(data.date, data.endTime, DEFAULT_TIMEZONE);

	let res;
	let waitlisted = false;

	try {
		res = await create({
			userId: currentUser.id,
			bookerType: 'band',
			bookerId: band.id,
			startsAt,
			endsAt,
			notes: data.notes
		});
	} catch (err) {
		if (isRecurring && err instanceof ReservationConflictError) {
			res = await createWaitlisted({
				userId: currentUser.id,
				bookerType: 'band',
				bookerId: band.id,
				startsAt,
				endsAt,
				notes: data.notes
			});
			waitlisted = true;
		} else {
			throw err;
		}
	}

	if (recurringFrequency) {
		const members = await getMembers(band.id);
		const activeUserIds = members.filter((m) => m.status === 'active').map((m) => m.userId);
		const [sustaining] = await db
			.select({ id: user.id })
			.from(user)
			.where(and(inArray(user.id, activeUserIds), sql`subscription is not null`))
			.limit(1);

		if (!sustaining) {
			throw error(
				403,
				'Recurring reservations require at least one band member with a sustaining membership'
			);
		}

		await createSeries({
			prototypeReservationId: res.id,
			frequency: recurringFrequency as RecurringFrequency,
			prototypeStartsAt: startsAt,
			monthlyMode: data.monthlyMode
		});
	}

	return { reservationId: res.id, waitlisted };
});

/** Band: cancel a band reservation. */
export const cancelBandReservation = form(
	z.object({
		reservationId: z.string().min(1)
	}),
	async (data, _issue) => {
		await requireFeature('bandReservations');
		const currentUser = requireUser();
		await requireBandMember();
		try {
			await cancel(data.reservationId, currentUser.id);
		} catch (err) {
			mapDomainError(err);
		}
		return { success: true };
	}
);

/** Member: pay for an existing reservation via Stripe checkout (from action modal). */
export const payForReservation = form(
	z.object({
		id: z.string(),
		coverFees: z.boolean().default(false),
		skipPayment: z.enum(['', 'on']).optional()
	}),
	async (data, _issue) => {
		const currentUser = requireUser();
		const { url } = getRequestEvent();

		const [row] = await db.select().from(reservation).where(eq(reservation.id, data.id)).limit(1);

		if (!row) throw error(404, 'Reservation not found');
		if (row.createdByUserId !== currentUser.id) throw error(403, 'Not your reservation');
		if (row.status !== 'scheduled' && row.status !== 'confirmed')
			throw error(400, 'Not eligible for payment');

		if (data.skipPayment === 'on') {
			// Confirm: commit free hours; settle if fully covered, else cash at door.
			const reservationConfig = await getReservationConfig();
			const hourlyRateCents = reservationConfig.hourlyRateCents;
			const durationHours = (row.endsAt.getTime() - row.startsAt.getTime()) / (1000 * 60 * 60);
			const totalCents = Math.round(durationHours * hourlyRateCents);
			const { settled } = await commitCreditsAndSettleIfCovered({
				reservationId: row.id,
				userId: currentUser.id,
				email: currentUser.email,
				name: currentUser.name,
				durationHours,
				totalCents,
				hourlyRateCents
			});
			if (!settled && row.status === 'scheduled') await confirm(row.id);
			return { confirmed: true };
		}

		const result = await payReservationRemainder({
			row,
			userId: currentUser.id,
			email: currentUser.email,
			name: currentUser.name,
			coverFees: data.coverFees,
			successUrl: `${url.origin}/member/reservations`,
			cancelUrl: `${url.origin}/member/reservations`
		});

		return 'paid' in result ? { paid: true } : { redirectUrl: result.checkoutUrl };
	}
);

/** Member: pay for a reservation via Stripe checkout (from pay page). */
export const payReservation = form(
	z.object({
		coverFees: z.boolean().default(false)
	}),
	async (data, _issue) => {
		const currentUser = requireUser();
		const { params, url } = getRequestEvent();

		const [row] = await db
			.select()
			.from(reservation)
			.where(eq(reservation.id, params.id!))
			.limit(1);

		if (!row) throw error(404, 'Reservation not found');
		if (row.createdByUserId !== currentUser.id) throw error(403, 'Not your reservation');
		if (row.status !== 'scheduled' && row.status !== 'confirmed')
			throw error(400, 'Not eligible for payment');

		const result = await payReservationRemainder({
			row,
			userId: currentUser.id,
			email: currentUser.email,
			name: currentUser.name,
			coverFees: data.coverFees,
			successUrl: `${url.origin}/member/reservations`,
			cancelUrl: `${url.origin}/member/reservations/${row.id}/pay`
		});

		redirect(303, 'paid' in result ? '/member/reservations' : result.checkoutUrl);
	}
);

// ===========================================================================
// Forms — staff actions (converted from API routes)
// ===========================================================================

/** Staff/owner: confirm a reservation. */
export const confirmReservation = form(z.object({ id: z.string() }), async (data, _issue) => {
	const currentUser = requireUser();

	const [row] = await db
		.select({
			id: reservation.id,
			createdByUserId: reservation.createdByUserId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			status: reservation.status
		})
		.from(reservation)
		.where(eq(reservation.id, data.id))
		.limit(1);
	if (!row) throw error(404, 'Reservation not found');

	// Allow if staff or the owner of the reservation
	const isOwner = currentUser.id === row.createdByUserId;
	const staff = await isStaff(currentUser.id);
	if (!isOwner && !staff) throw error(403, 'Not authorized');

	// Commit the owner's free hours; settle if fully covered, else confirm with
	// the cash remainder owed at the door.
	const [owner] = await db
		.select({ email: user.email, name: user.name })
		.from(user)
		.where(eq(user.id, row.createdByUserId))
		.limit(1);
	const reservationConfig = await getReservationConfig();
	const hourlyRateCents = reservationConfig.hourlyRateCents;
	const durationHours = (row.endsAt.getTime() - row.startsAt.getTime()) / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);
	const { settled } = await commitCreditsAndSettleIfCovered({
		reservationId: row.id,
		userId: row.createdByUserId,
		email: owner?.email ?? '',
		name: owner?.name ?? null,
		durationHours,
		totalCents,
		hourlyRateCents
	});
	if (!settled && row.status === 'scheduled') await confirm(row.id);
	return { success: true };
});

/** Cancel a reservation (staff can override). */
export const cancelReservation = form(
	z.object({
		id: z.string(),
		reason: z.string().optional()
	}),
	async (data, _issue) => {
		const currentUser = requireUser();
		const staff = await isStaff(currentUser.id);
		try {
			await cancel(data.id, currentUser.id, data.reason, { staffOverride: staff });
		} catch (err) {
			mapDomainError(err);
		}
		return { success: true };
	}
);

/** Staff: mark a reservation as completed. */
export const completeReservation = form(z.object({ id: z.string() }), async (data, _issue) => {
	await requireStaff();
	await markComplete(data.id);
	return { success: true };
});

/** Staff: mark a reservation as no-show. */
export const noShowReservation = form(z.object({ id: z.string() }), async (data, _issue) => {
	await requireStaff();
	await markNoShow(data.id);
	return { success: true };
});

/** Staff: record cash payment and complete reservation. */
export const cashReceivedReservation = form(z.object({ id: z.string() }), async (data, _issue) => {
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

	const durationHours = (row.endsAt.getTime() - row.startsAt.getTime()) / (1000 * 60 * 60);
	const hourlyRateCents = await config<number>('reservation.hourlyRateCents');
	const totalCents = Math.round(durationHours * hourlyRateCents);

	// Commit the member's free hours (idempotent — already done if confirmed
	// ahead of time), then collect only the cash remainder.
	const { remainingCents } = await commitCreditsAndSettleIfCovered({
		reservationId: data.id,
		userId: row.createdByUserId,
		email: '',
		name: null,
		durationHours,
		totalCents,
		hourlyRateCents
	});

	let paymentRecordId: string;
	if (remainingCents > 0) {
		const [member] = await db
			.select({ stripeId: user.stripeId })
			.from(user)
			.where(eq(user.id, row.createdByUserId))
			.limit(1);
		if (!member?.stripeId) throw error(400, 'Member has no Stripe customer ID');

		({ paymentRecordId } = await recordCashPayment({
			userId: row.createdByUserId,
			stripeCustomerId: member.stripeId,
			amountCents: remainingCents,
			metadata: { reservation_id: data.id }
		}));
	} else {
		// Fully covered by credits — already settled by the commit (creditsUsed set).
		const [r] = await db
			.select({ rec: reservation.stripePaymentRecordId })
			.from(reservation)
			.where(eq(reservation.id, data.id))
			.limit(1);
		paymentRecordId = r?.rec ?? '';
	}

	await recordCashAndComplete(data.id, paymentRecordId);
	return { success: true };
});

/** Staff: comp a reservation (waive payment and confirm — no credits used). */
export const compReservation = form(z.object({ id: z.string() }), async (data, _issue) => {
	await requireStaff();
	await confirm(data.id);
	await db
		.update(reservation)
		.set({ cashDueCents: 0, updatedAt: new Date() })
		.where(eq(reservation.id, data.id));
	return { success: true };
});

/** Staff: refund the payment on a reservation. */
export const refundReservation = form(z.object({ id: z.string() }), async (data, _issue) => {
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
	// Reservation free-hour credits live in the ledger (not the payment record's
	// breakdown), so reverse them explicitly. Idempotent and a no-op when none.
	await reverseReservationCredits(row.createdByUserId, data.id);
	await db.update(reservation).set({ refundedAt: new Date() }).where(eq(reservation.id, data.id));
	return { success: true };
});

/** Member: confirm a waitlisted reservation when the slot opens. */
export const confirmWaitlisted = form(z.object({ id: z.string() }), async (data, _issue) => {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');

	const [row] = await db.select().from(reservation).where(eq(reservation.id, data.id)).limit(1);

	if (!row) throw error(404, 'Reservation not found');
	if (row.createdByUserId !== locals.user.id) throw error(403, 'Not your reservation');
	if (row.status !== 'waitlisted') throw error(400, 'Reservation is not waitlisted');
	if (!row.waitlistNotifiedAt) throw error(400, 'Slot has not been offered yet');
	if (row.waitlistExpiresAt && row.waitlistExpiresAt < new Date()) {
		throw error(400, 'Confirmation window has expired');
	}

	// Re-check slot is still free
	const conflicts = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				notInArray(reservation.status, ['cancelled', 'waitlisted']),
				lt(reservation.startsAt, row.endsAt),
				gt(reservation.endsAt, row.startsAt),
				ne(reservation.id, data.id)
			)
		)
		.limit(1);

	if (conflicts.length > 0) {
		throw error(409, 'Slot is no longer available');
	}

	await db
		.update(reservation)
		.set({
			status: 'scheduled',
			waitlistNotifiedAt: null,
			waitlistExpiresAt: null,
			updatedAt: new Date()
		})
		.where(eq(reservation.id, data.id));

	return { success: true };
});

type ReservationWithPrice = Reservation & { price: number; creditsAvailable: boolean };
export const getReservations = query(
	z
		.object({
			after: z.coerce.date().optional(),
			forUser: z.string().optional(),
			includeTerminal: z.boolean().optional()
		})
		.optional(),
	async ({ after, forUser, includeTerminal } = {}): Promise<ReservationWithPrice[]> => {
		const { locals } = getRequestEvent();

		if (!locals.user) throw error(401, 'Not authenticated');
		if (forUser && !locals.user.isStaff && forUser !== locals.user.id) {
			throw error(403, "Not authorized to view other users' reservations");
		}

		const filters = [
			eq(reservation.createdByUserId, forUser ?? locals.user?.id),
			after && gt(reservation.endsAt, after),
			!includeTerminal && inArray(reservation.status, ['scheduled', 'confirmed', 'waitlisted'])
		];
		const rateInCents = await config<number>('reservation.hourlyRateCents');
		const freeHoursBalance = await getBalance(forUser ?? locals.user.id, 'free_hours');

		const rows = await db
			.select()
			.from(reservation)
			.where(and(...(filters.filter(Boolean) as any[])))
			.orderBy(reservation.startsAt);

		// `price` is the full room rate. We deliberately do NOT project a credit
		// discount onto uncommitted bookings here: free hours are only applied at
		// confirm/pay time, against the live balance. Projecting a discounted
		// figure on the listing drifts from the modal (which computes credits live,
		// at the moment of the charge) and confused members with a lower number on
		// the card than at Pay Ahead. Instead, show the full price and flag that
		// credits are available so the UI can indicate they'll apply.
		// Confirmed/paid rows carry the real cash owed in cashDueCents (0 = fully
		// covered by credits).
		const hasFreeHours = freeHoursBalance > 0;
		return rows.map((value: Reservation) => {
			const durationHours = (value.endsAt.getTime() - value.startsAt.getTime()) / (1000 * 60 * 60);
			const totalCents = Math.round(durationHours * rateInCents);
			const isTerminal = ['completed', 'cancelled', 'no-show'].includes(value.status);

			// Committed rows owe their stored remainder; everything else owes full price.
			const netCents = value.cashDueCents ?? totalCents;
			// Credits can still apply only to an uncommitted, non-terminal booking.
			const creditsAvailable = hasFreeHours && value.cashDueCents == null && !isTerminal;

			return { ...value, price: netCents / 100, creditsAvailable };
		});
	}
);

export const getRecurringReservations = query(
	z
		.object({
			includeCancelled: z.boolean().optional()
		})
		.optional(),
	async (options) => {
		const includeCancelled = options?.includeCancelled ?? false;

		const filters = [
			eq(reservation.createdByUserId, getRequestEvent().locals.user?.id),
			eq(recurringSeries.prototypeType, 'reservation'),
			isNull(recurringSeries.supersededBy),
			!includeCancelled && isNull(recurringSeries.cancelledAt)
		];

		const rows = await db
			.select({
				id: recurringSeries.id,
				rrule: recurringSeries.rrule,
				createdAt: recurringSeries.createdAt,
				seriesEndsAt: recurringSeries.endsAt,
				cancelledAt: recurringSeries.cancelledAt,
				bookerType: reservation.bookerType,
				startsAt: reservation.startsAt,
				endsAt: reservation.endsAt
			})
			.from(recurringSeries)
			.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
			.where(and(...(filters.filter(Boolean) as any[])));

		return rows.map((r) => ({
			...r,
			frequencyLabel: describeFrequency(r.rrule),
			monthlyMode: monthlyModeOf(r.rrule)
		}));
	}
);
