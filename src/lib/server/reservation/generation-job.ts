import { db } from '$lib/server/db';
import { recurringSeries } from '$lib/server/db/schema/recurring';
import { reservation } from '$lib/server/db/schema/reservation';
import { closure } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { and, eq, isNull, lt, gt, gte, lte, ne } from 'drizzle-orm';
import { getOccurrences, generationWindowEnd } from './rrule-helpers';
import { formatDateInTz, formatTimeInTz } from './timezone';
import { domainEvents } from '$lib/server/events/event-bus';

// ---------------------------------------------------------------------------
// Generation job — expand active recurring series into concrete reservations
// ---------------------------------------------------------------------------

const TZ = 'America/Los_Angeles';

export interface GenerationResult {
	seriesProcessed: number;
	instancesCreated: number;
	instancesSkipped: number;
	errors: string[];
}

/**
 * Main entry point. Processes all active series with prototype_type = 'reservation'.
 * Each series is processed independently — one failure doesn't block others.
 */
export async function generateRecurringReservations(): Promise<GenerationResult> {
	const result: GenerationResult = {
		seriesProcessed: 0,
		instancesCreated: 0,
		instancesSkipped: 0,
		errors: []
	};

	// Fetch all active reservation series
	const activeSeries = await db
		.select({
			id: recurringSeries.id,
			prototypeId: recurringSeries.prototypeId,
			rrule: recurringSeries.rrule
		})
		.from(recurringSeries)
		.where(
			and(
				eq(recurringSeries.prototypeType, 'reservation'),
				isNull(recurringSeries.cancelledAt),
				isNull(recurringSeries.supersededBy)
			)
		);

	for (const series of activeSeries) {
		try {
			const counts = await processSeries(series);
			result.instancesCreated += counts.created;
			result.instancesSkipped += counts.skipped;
			result.seriesProcessed++;
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			result.errors.push(`Series ${series.id}: ${msg}`);
		}
	}

	return result;
}

// ---------------------------------------------------------------------------
// Per-series processing
// ---------------------------------------------------------------------------

interface SeriesInfo {
	id: string;
	prototypeId: string;
	rrule: string;
}

async function processSeries(
	series: SeriesInfo
): Promise<{ created: number; skipped: number }> {
	// Load the prototype reservation
	const [prototype] = await db
		.select({
			bookerType: reservation.bookerType,
			bookerId: reservation.bookerId,
			createdByUserId: reservation.createdByUserId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			notes: reservation.notes
		})
		.from(reservation)
		.where(eq(reservation.id, series.prototypeId))
		.limit(1);

	if (!prototype) {
		throw new Error('Prototype reservation not found');
	}

	// Load user info for event emission
	const [owner] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, prototype.createdByUserId))
		.limit(1);

	// Compute prototype duration in ms
	const durationMs = prototype.endsAt.getTime() - prototype.startsAt.getTime();

	// Generate occurrences within the window
	const now = new Date();
	const windowEnd = await generationWindowEnd(now);
	const occurrences = getOccurrences(series.rrule, now, windowEnd);

	// Batch-fetch all existing instances for this series in the window
	const existingInstances = occurrences.length > 0
		? await db
				.select({ startsAt: reservation.startsAt })
				.from(reservation)
				.where(
					and(
						eq(reservation.recurringSeriesId, series.id),
						gte(reservation.startsAt, occurrences[0]),
						lte(reservation.startsAt, occurrences[occurrences.length - 1])
					)
				)
		: [];

	const existingTimes = new Set(existingInstances.map((r) => r.startsAt.getTime()));

	let created = 0;
	let skipped = 0;

	for (const occStart of occurrences) {
		const occEnd = new Date(occStart.getTime() + durationMs);

		// Already generated (or was generated and cancelled) — skip
		if (existingTimes.has(occStart.getTime())) {
			continue;
		}

		// Check for conflicts with events and closures only
		const conflict = await checkEventAndClosureConflict(occStart, occEnd);

		if (conflict) {
			skipped++;

			// Notify the member
			if (owner) {
				await domainEvents.emit('reservation.recurring_skipped', {
					seriesId: series.id,
					userId: prototype.createdByUserId,
					userName: owner.name,
					userEmail: owner.email,
					skippedDate: formatDateInTz(occStart, TZ),
					startTime: formatTimeInTz(occStart, TZ),
					endTime: formatTimeInTz(occEnd, TZ),
					reason: conflict.reason
				});
			}

			continue;
		}

		// Create the instance — clone from prototype
		await db.insert(reservation).values({
			bookerType: prototype.bookerType,
			bookerId: prototype.bookerId,
			createdByUserId: prototype.createdByUserId,
			status: 'scheduled',
			startsAt: occStart,
			endsAt: occEnd,
			notes: prototype.notes,
			recurringSeriesId: series.id
		});

		created++;
	}

	return { created, skipped };
}

// ---------------------------------------------------------------------------
// Conflict checking — events and closures only (not one-off reservations)
// ---------------------------------------------------------------------------

interface ConflictInfo {
	reason: string;
}

async function checkEventAndClosureConflict(
	startsAt: Date,
	endsAt: Date
): Promise<ConflictInfo | null> {
	// Check event-type reservations
	const eventConflicts = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				eq(reservation.bookerType, 'event'),
				ne(reservation.status, 'cancelled'),
				lt(reservation.startsAt, endsAt),
				gt(reservation.endsAt, startsAt)
			)
		)
		.limit(1);

	if (eventConflicts.length > 0) {
		return { reason: 'Scheduled event' };
	}

	// Check closures
	const closureConflicts = await db
		.select({ reason: closure.reason })
		.from(closure)
		.where(
			and(
				lt(closure.startsAt, endsAt),
				gt(closure.endsAt, startsAt)
			)
		)
		.limit(1);

	if (closureConflicts.length > 0) {
		return { reason: closureConflicts[0].reason };
	}

	return null;
}
