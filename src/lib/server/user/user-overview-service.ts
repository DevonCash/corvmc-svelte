import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/authentication';
import { reservation } from '$lib/server/db/schema/reservation';
import { recurringSeries } from '$lib/server/db/schema/recurring';
import { band, bandMember } from '$lib/server/db/schema/band';
import { event, eventBand } from '$lib/server/db/schema/event';
import { eventRsvp } from '$lib/server/db/schema/event-rsvp';
import { ticket } from '$lib/server/db/schema/ticket';
import { equipmentLoan } from '$lib/server/db/schema/equipment';
import { volunteerShift, volunteerSignup, volunteerHourLog } from '$lib/server/db/schema/volunteer';
import { contentFlag } from '$lib/server/db/schema/flag';
import { paymentCache } from '$lib/server/db/schema/finance';
import { and, count, eq, gt, gte, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { getAllBalances } from '$lib/server/finance/credit-service';
import { getMemberSubscription, mapDbSubscription } from '$lib/server/finance/subscription-service';
import { getCommunityStanding } from '$lib/server/event/community-event-service';
import { getUserHourSummary } from '$lib/server/volunteer/hour-log-service';
import { listForUser as listCertificationsForUser } from '$lib/server/volunteer/member-certification-service';
import { getVolunteerProfile, stageOf } from '$lib/server/volunteer/volunteer-profile-service';
import { isProfileComplete } from '$lib/server/directory/directory-service';
import { findByUserId as findSubscriberByUserId } from '$lib/server/marketing/subscriber-service';
import { countOpenPortalThreads, countPortalUnread } from '$lib/server/inbox/portal-service';
import { getUnreadCount as getUnreadNotifications } from '$lib/server/notification/in-app-service';
import { getLastLoginAt } from './user-service';
import type { OnboardingStage } from '$lib/server/volunteer/volunteer-profile-service';

// ---------------------------------------------------------------------------
// User overview — one query behind the whole staff user record
// ---------------------------------------------------------------------------
//
// `/staff/users/[id]` is tabbed, and a tab's own queries only run once it is
// opened. That leaves one thing that cannot be lazy: the tab badges and the
// scoreboard, which have to be right on first paint or they are worse than
// absent. This is that data — every count the header, the badges and the
// Overview tab need, in a single round trip.
//
// It is deliberately all counts and single rows. Nothing here selects a list:
// the lists belong to the tabs, which fetch them when someone actually looks.
// That keeps this to ~20 narrow statements in one `Promise.all`, replacing the
// dozen client round trips an eager page would have made.
// ---------------------------------------------------------------------------

export interface UserOverviewCounts {
	upcomingReservations: number;
	pastReservations: number;
	unpaidReservations: number;
	cancelledUpcomingReservations: number;
	recurringSeries: number;
	bands: number;
	pendingBandInvites: number;
	upcomingShows: number;
	pastShows: number;
	listings: number;
	tickets: number;
	rsvps: number;
	openLoans: number;
	overdueLoans: number;
	upcomingShifts: number;
	pendingHourLogs: number;
	approvedMinutes: number;
	approvedMinutesThisYear: number;
	certsHeld: number;
	certsNeedingAttention: number;
	openThreads: number;
	unreadThreads: number;
	unreadNotifications: number;
	openFlagsAgainst: number;
	flagsFiled: number;
	payments: number;
	lifetimePaidCents: number;
}

export interface UserOverview {
	counts: UserOverviewCounts;
	credits: { free_hours: number; equipment_credits: number };
	membership: {
		sustaining: boolean;
		cancelAtPeriodEnd: boolean;
		creditsResetAt: Date | null;
		hoursPerReset: number | null;
	};
	standing: { requiresReview: boolean; reason: string | null };
	volunteer: { stage: OnboardingStage };
	marketing: { suppressed: boolean; suppressionReason: string | null };
	directory: { visibility: string; profileComplete: boolean };
	lastLoginAt: Date | null;
}

export async function getUserOverview(userId: string): Promise<UserOverview> {
	const now = new Date();

	// Band membership is resolved first: reservations, shows and invites all key
	// off it, and it is one small query rather than a subquery repeated six times.
	const [memberships, account] = await Promise.all([
		db
			.select({ bandId: bandMember.bandId, status: bandMember.status })
			.from(bandMember)
			.innerJoin(band, eq(band.id, bandMember.bandId))
			.where(and(eq(bandMember.userId, userId), isNull(band.deletedAt))),
		db
			.select({ directoryVisibility: user.directoryVisibility })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1)
	]);

	const activeBandIds = memberships.filter((m) => m.status === 'active').map((m) => m.bandId);
	const pendingBandInvites = memberships.filter((m) => m.status === 'pending').length;

	// Theirs = booked by them, or by a band they are actively in. Event bookings
	// are the venue's, not the member's, and are excluded everywhere.
	const mine = eq(reservation.createdByUserId, userId);
	const scope = and(
		activeBandIds.length > 0
			? or(
					mine,
					and(eq(reservation.bookerType, 'band'), inArray(reservation.bookerId, activeBandIds))
				)!
			: mine,
		ne(reservation.bookerType, 'event')
	)!;

	// A show is one this member played: a band they are in was confirmed on the
	// lineup. Counted through a real join rather than a raw `exists`, because an
	// array interpolated into a sql template does not bind as an IN list.
	const countShows = async (upcoming: boolean) => {
		if (activeBandIds.length === 0) return 0;
		const [row] = await db
			.select({ count: count() })
			.from(event)
			.innerJoin(
				eventBand,
				and(
					eq(eventBand.eventId, event.id),
					eq(eventBand.status, 'confirmed'),
					inArray(eventBand.bandId, activeBandIds)
				)
			)
			.where(
				and(
					eq(event.status, 'published'),
					upcoming ? gte(event.startsAt, now) : lt(event.startsAt, now)
				)
			);
		return row?.count ?? 0;
	};

	const scalar = async (q: Promise<{ count: number }[]>) => (await q)[0]?.count ?? 0;

	const [
		upcomingReservations,
		pastReservations,
		unpaidReservations,
		cancelledUpcomingReservations,
		recurring,
		upcomingShows,
		pastShows,
		listings,
		tickets,
		rsvps,
		openLoans,
		overdueLoans,
		upcomingShifts,
		pendingHourLogs,
		openFlagsAgainst,
		flagsFiled,
		unreadNotifications,
		paymentsAgg,
		credits,
		dbSubscription,
		standing,
		hourSummary,
		certifications,
		volunteerProfile,
		profileComplete,
		subscriber,
		openThreads,
		unreadThreads,
		lastLoginAt
	] = await Promise.all([
		scalar(
			db
				.select({ count: count() })
				.from(reservation)
				.where(and(scope, gte(reservation.endsAt, now)))
		),
		scalar(
			db
				.select({ count: count() })
				.from(reservation)
				.where(and(scope, lt(reservation.endsAt, now)))
		),
		scalar(
			db
				.select({ count: count() })
				.from(reservation)
				.where(
					and(
						scope,
						ne(reservation.status, 'cancelled'),
						gt(reservation.cashDueCents, 0),
						isNull(reservation.paidAt)
					)
				)
		),
		scalar(
			db
				.select({ count: count() })
				.from(reservation)
				.where(and(scope, gte(reservation.endsAt, now), eq(reservation.status, 'cancelled')))
		),
		scalar(
			db
				.select({ count: count() })
				.from(recurringSeries)
				.where(
					and(
						eq(recurringSeries.createdBy, userId),
						eq(recurringSeries.prototypeType, 'reservation'),
						isNull(recurringSeries.cancelledAt),
						isNull(recurringSeries.supersededBy)
					)
				)
		),
		countShows(true),
		countShows(false),
		scalar(
			db
				.select({ count: count() })
				.from(event)
				.where(and(eq(event.createdByUserId, userId), eq(event.source, 'community')))
		),
		scalar(db.select({ count: count() }).from(ticket).where(eq(ticket.userId, userId))),
		scalar(db.select({ count: count() }).from(eventRsvp).where(eq(eventRsvp.userId, userId))),
		scalar(
			db
				.select({ count: count() })
				.from(equipmentLoan)
				.where(
					and(
						eq(equipmentLoan.userId, userId),
						inArray(equipmentLoan.status, ['requested', 'scheduled', 'checked_out'])
					)
				)
		),
		scalar(
			db
				.select({ count: count() })
				.from(equipmentLoan)
				.where(
					and(
						eq(equipmentLoan.userId, userId),
						eq(equipmentLoan.status, 'checked_out'),
						lt(equipmentLoan.dueDate, now)
					)
				)
		),
		scalar(
			db
				.select({ count: count() })
				.from(volunteerSignup)
				.innerJoin(volunteerShift, eq(volunteerShift.id, volunteerSignup.shiftId))
				.where(
					and(
						eq(volunteerSignup.userId, userId),
						ne(volunteerSignup.status, 'cancelled'),
						isNull(volunteerShift.cancelledAt),
						gte(volunteerShift.startsAt, now)
					)
				)
		),
		scalar(
			db
				.select({ count: count() })
				.from(volunteerHourLog)
				.where(and(eq(volunteerHourLog.userId, userId), eq(volunteerHourLog.status, 'pending')))
		),
		scalar(
			db
				.select({ count: count() })
				.from(contentFlag)
				.where(
					and(
						eq(contentFlag.entityType, 'member_profile'),
						eq(contentFlag.entityId, userId),
						eq(contentFlag.status, 'pending')
					)
				)
		),
		scalar(
			db
				.select({ count: count() })
				.from(contentFlag)
				.where(eq(contentFlag.reportedByUserId, userId))
		),
		getUnreadNotifications(userId),
		db
			.select({
				count: count(),
				cents: sql<number>`coalesce(sum(case when ${paymentCache.status} = 'succeeded' then ${paymentCache.amountCents} else 0 end), 0)`
			})
			.from(paymentCache)
			.where(eq(paymentCache.userId, userId)),
		getAllBalances(userId),
		getMemberSubscription(userId),
		getCommunityStanding(userId),
		getUserHourSummary(userId),
		listCertificationsForUser(userId),
		getVolunteerProfile(userId),
		isProfileComplete(userId),
		findSubscriberByUserId(userId),
		countOpenPortalThreads(userId),
		countPortalUnread(userId),
		getLastLoginAt(userId)
	]);

	const subscription = mapDbSubscription(dbSubscription);
	const held = certifications.filter((c) => !c.revokedAt);

	return {
		counts: {
			upcomingReservations,
			pastReservations,
			unpaidReservations,
			cancelledUpcomingReservations,
			recurringSeries: recurring,
			bands: activeBandIds.length,
			pendingBandInvites,
			upcomingShows,
			pastShows,
			listings,
			tickets,
			rsvps,
			openLoans,
			overdueLoans,
			upcomingShifts,
			pendingHourLogs,
			approvedMinutes: hourSummary.approvedMinutes,
			approvedMinutesThisYear: hourSummary.approvedMinutesThisYear,
			certsHeld: held.length,
			// "Needs attention" is expiring-or-expired, not revoked: a revoked
			// clearance was an intentional act and is already resolved.
			certsNeedingAttention: held.filter((c) => c.state === 'expiring' || c.state === 'expired')
				.length,
			openThreads,
			unreadThreads,
			unreadNotifications,
			openFlagsAgainst,
			flagsFiled,
			payments: paymentsAgg[0]?.count ?? 0,
			lifetimePaidCents: Number(paymentsAgg[0]?.cents ?? 0)
		},
		credits: {
			free_hours: credits.free_hours ?? 0,
			equipment_credits: credits.equipment_credits ?? 0
		},
		membership: {
			sustaining: dbSubscription != null,
			cancelAtPeriodEnd: dbSubscription?.cancelAtPeriodEnd ?? false,
			creditsResetAt: subscription?.currentPeriodEnd ?? null,
			hoursPerReset: dbSubscription?.hoursPerReset ?? null
		},
		standing: { requiresReview: standing.requiresReview, reason: standing.reason },
		volunteer: { stage: stageOf(volunteerProfile) },
		marketing: {
			suppressed: subscriber?.suppressedAt != null,
			suppressionReason: subscriber?.suppressionReason ?? null
		},
		directory: {
			visibility: account[0]?.directoryVisibility ?? 'members',
			profileComplete
		},
		lastLoginAt
	};
}

export type { UserOverview as StaffUserOverview };
