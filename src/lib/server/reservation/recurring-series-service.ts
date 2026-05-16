import { db } from '$lib/server/db';
import { recurringSeries } from '$lib/server/db/schema/recurring';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import { buildRRule, describeFrequency } from './rrule-helpers';
import type { RecurringFrequency } from './config';

// ---------------------------------------------------------------------------
// RecurringSeriesService — create, edit, cancel, and query recurring series
// ---------------------------------------------------------------------------

export class RecurringSeriesError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RecurringSeriesError';
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateSeriesParams {
	/** The prototype reservation that was just created */
	prototypeReservationId: string;
	/** Recurrence frequency */
	frequency: RecurringFrequency;
	/** The prototype's startsAt — used to derive RRULE DTSTART and BYDAY */
	prototypeStartsAt: Date;
}

export interface SeriesRow {
	id: string;
	supersededBy: string | null;
	prototypeType: string;
	prototypeId: string;
	rrule: string;
	createdAt: Date;
	cancelledAt: Date | null;
}

export interface SeriesWithPrototype extends SeriesRow {
	prototypeName: string;
	prototypeBookerType: string;
	prototypeBookerId: string;
	prototypeCreatedByUserId: string;
	prototypeStartsAt: Date;
	prototypeEndsAt: Date;
	prototypeNotes: string | null;
}

export interface SeriesListItem {
	id: string;
	rrule: string;
	frequencyLabel: string;
	createdAt: Date;
	cancelledAt: Date | null;
	userName: string;
	userPronouns: string | null;
	bookerType: string;
	bookerId: string;
	startsAt: Date;
	endsAt: Date;
}

// ---------------------------------------------------------------------------
// create() — link a new series to a prototype reservation
// ---------------------------------------------------------------------------

export async function create(params: CreateSeriesParams): Promise<SeriesRow> {
	const { prototypeReservationId, frequency, prototypeStartsAt } = params;

	const rruleString = buildRRule(prototypeStartsAt, frequency);

	return await db.transaction(async (tx) => {
		// Insert the series
		const [series] = await tx
			.insert(recurringSeries)
			.values({
				prototypeType: 'reservation',
				prototypeId: prototypeReservationId,
				rrule: rruleString
			})
			.returning();

		// Link the prototype reservation back to this series
		await tx
			.update(reservation)
			.set({ recurringSeriesId: series.id, updatedAt: new Date() })
			.where(eq(reservation.id, prototypeReservationId));

		return series;
	});
}

// ---------------------------------------------------------------------------
// edit() — supersede a series with a new one (new prototype, new schedule)
// ---------------------------------------------------------------------------

export interface EditSeriesParams {
	/** The series being replaced */
	oldSeriesId: string;
	/** The new prototype reservation */
	newPrototypeReservationId: string;
	/** New frequency */
	frequency: RecurringFrequency;
	/** New prototype's startsAt */
	prototypeStartsAt: Date;
}

export async function edit(params: EditSeriesParams): Promise<SeriesRow> {
	const { oldSeriesId, newPrototypeReservationId, frequency, prototypeStartsAt } = params;

	const rruleString = buildRRule(prototypeStartsAt, frequency);

	return await db.transaction(async (tx) => {
		// Create the replacement series
		const [newSeries] = await tx
			.insert(recurringSeries)
			.values({
				prototypeType: 'reservation',
				prototypeId: newPrototypeReservationId,
				rrule: rruleString
			})
			.returning();

		// Mark the old series as superseded
		const now = new Date();
		const supersedeResult = await tx
			.update(recurringSeries)
			.set({ supersededBy: newSeries.id, cancelledAt: now })
			.where(
				and(
					eq(recurringSeries.id, oldSeriesId),
					isNull(recurringSeries.cancelledAt),
					isNull(recurringSeries.supersededBy)
				)
			);

		const rowCount = (supersedeResult as unknown as { rowCount: number }).rowCount ?? 0;
		if (rowCount === 0) {
			throw new RecurringSeriesError('Series was already cancelled or superseded');
		}

		// Link the new prototype back to the new series
		await tx
			.update(reservation)
			.set({ recurringSeriesId: newSeries.id, updatedAt: now })
			.where(eq(reservation.id, newPrototypeReservationId));

		return newSeries;
	});
}

// ---------------------------------------------------------------------------
// cancel() — stop a series from generating new instances
// ---------------------------------------------------------------------------

export async function cancel(seriesId: string): Promise<void> {
	const result = await db
		.update(recurringSeries)
		.set({ cancelledAt: new Date() })
		.where(
			and(
				eq(recurringSeries.id, seriesId),
				isNull(recurringSeries.cancelledAt),
				isNull(recurringSeries.supersededBy)
			)
		);

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
	if (rowCount === 0) {
		throw new RecurringSeriesError('Series not found or already cancelled');
	}
}

// ---------------------------------------------------------------------------
// cancelAllForUser() — cancel all active series for a user (subscription lapse)
// ---------------------------------------------------------------------------

export async function cancelAllForUser(userId: string): Promise<number> {
	// Find active series where the prototype reservation belongs to this user
	const activeSeries = await db
		.select({ seriesId: recurringSeries.id })
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.where(
			and(
				eq(recurringSeries.prototypeType, 'reservation'),
				eq(reservation.createdByUserId, userId),
				isNull(recurringSeries.cancelledAt),
				isNull(recurringSeries.supersededBy)
			)
		);

	if (activeSeries.length === 0) return 0;

	const seriesIds = activeSeries.map((s) => s.seriesId);
	const now = new Date();

	const result = await db
		.update(recurringSeries)
		.set({ cancelledAt: now })
		.where(
			and(
				inArray(recurringSeries.id, seriesIds),
				isNull(recurringSeries.cancelledAt)
			)
		);

	return (result as unknown as { rowCount: number }).rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// get() — single series with prototype details
// ---------------------------------------------------------------------------

export async function get(seriesId: string): Promise<SeriesWithPrototype | null> {
	const rows = await db
		.select({
			id: recurringSeries.id,
			supersededBy: recurringSeries.supersededBy,
			prototypeType: recurringSeries.prototypeType,
			prototypeId: recurringSeries.prototypeId,
			rrule: recurringSeries.rrule,
			createdAt: recurringSeries.createdAt,
			cancelledAt: recurringSeries.cancelledAt,
			prototypeName: user.name,
			prototypeBookerType: reservation.bookerType,
			prototypeBookerId: reservation.bookerId,
			prototypeCreatedByUserId: reservation.createdByUserId,
			prototypeStartsAt: reservation.startsAt,
			prototypeEndsAt: reservation.endsAt,
			prototypeNotes: reservation.notes
		})
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(eq(recurringSeries.id, seriesId))
		.limit(1);

	return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// getByReservation() — find the series a reservation belongs to
// ---------------------------------------------------------------------------

export async function getByReservation(reservationId: string): Promise<SeriesRow | null> {
	const rows = await db
		.select({
			id: recurringSeries.id,
			supersededBy: recurringSeries.supersededBy,
			prototypeType: recurringSeries.prototypeType,
			prototypeId: recurringSeries.prototypeId,
			rrule: recurringSeries.rrule,
			createdAt: recurringSeries.createdAt,
			cancelledAt: recurringSeries.cancelledAt
		})
		.from(recurringSeries)
		.innerJoin(reservation, eq(reservation.recurringSeriesId, recurringSeries.id))
		.where(eq(reservation.id, reservationId))
		.limit(1);

	return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// listActive() — all active series (staff view)
// ---------------------------------------------------------------------------

export async function listActive(): Promise<SeriesListItem[]> {
	const rows = await db
		.select({
			id: recurringSeries.id,
			rrule: recurringSeries.rrule,
			createdAt: recurringSeries.createdAt,
			cancelledAt: recurringSeries.cancelledAt,
			userName: user.name,
			userPronouns: user.pronouns,
			bookerType: reservation.bookerType,
			bookerId: reservation.bookerId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt
		})
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				eq(recurringSeries.prototypeType, 'reservation'),
				isNull(recurringSeries.cancelledAt),
				isNull(recurringSeries.supersededBy)
			)
		);

	return rows.map((r) => ({
		...r,
		frequencyLabel: describeFrequency(r.rrule)
	}));
}

// ---------------------------------------------------------------------------
// listAll() — all series including cancelled (staff view with filters)
// ---------------------------------------------------------------------------

export async function listAll(): Promise<SeriesListItem[]> {
	const rows = await db
		.select({
			id: recurringSeries.id,
			rrule: recurringSeries.rrule,
			createdAt: recurringSeries.createdAt,
			cancelledAt: recurringSeries.cancelledAt,
			userName: user.name,
			userPronouns: user.pronouns,
			bookerType: reservation.bookerType,
			bookerId: reservation.bookerId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt
		})
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				eq(recurringSeries.prototypeType, 'reservation'),
				isNull(recurringSeries.supersededBy)
			)
		);

	return rows.map((r) => ({
		...r,
		frequencyLabel: describeFrequency(r.rrule)
	}));
}

// ---------------------------------------------------------------------------
// listForUser() — active series for a specific member
// ---------------------------------------------------------------------------

export async function listForUser(userId: string): Promise<SeriesListItem[]> {
	const rows = await db
		.select({
			id: recurringSeries.id,
			rrule: recurringSeries.rrule,
			createdAt: recurringSeries.createdAt,
			cancelledAt: recurringSeries.cancelledAt,
			userName: user.name,
			userPronouns: user.pronouns,
			bookerType: reservation.bookerType,
			bookerId: reservation.bookerId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt
		})
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(
			and(
				eq(recurringSeries.prototypeType, 'reservation'),
				eq(reservation.createdByUserId, userId),
				isNull(recurringSeries.cancelledAt),
				isNull(recurringSeries.supersededBy)
			)
		);

	return rows.map((r) => ({
		...r,
		frequencyLabel: describeFrequency(r.rrule)
	}));
}

// ---------------------------------------------------------------------------
// getHistory() — follow the superseded_by chain for a series
// ---------------------------------------------------------------------------

export async function getHistory(seriesId: string): Promise<SeriesRow[]> {
	// Walk backward from the given series — find predecessors that point to it
	const history: SeriesRow[] = [];

	// First, get the given series
	const [current] = await db
		.select()
		.from(recurringSeries)
		.where(eq(recurringSeries.id, seriesId))
		.limit(1);

	if (!current) return [];
	history.push(current);

	// Walk backwards: find series whose supersededBy points to entries we already have
	// This is a simple iterative approach — chains are short in practice
	let predecessorId = seriesId;
	for (let i = 0; i < 50; i++) {
		const [pred] = await db
			.select()
			.from(recurringSeries)
			.where(eq(recurringSeries.supersededBy, predecessorId))
			.limit(1);

		if (!pred) break;
		history.unshift(pred); // prepend — oldest first
		predecessorId = pred.id;
	}

	// Walk forward from the current: follow supersededBy pointers
	let nextId = current.supersededBy;
	for (let i = 0; i < 50; i++) {
		if (!nextId) break;
		const [next] = await db
			.select()
			.from(recurringSeries)
			.where(eq(recurringSeries.id, nextId))
			.limit(1);

		if (!next) break;
		history.push(next);
		nextId = next.supersededBy;
	}

	return history;
}
