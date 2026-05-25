import { db, getRowCount } from '$lib/server/db';
import { recurringSeries } from '$lib/server/db/schema/recurring';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, isNull, sql, count } from 'drizzle-orm';
import { paginate, type PaginationInput } from '$lib/server/db/paginate';
import { primaryRoleFor } from '$lib/server/authorization';
import { buildRRule, describeFrequency } from './rrule-helpers';
import type { RecurringFrequency } from '$lib/server/db/schema/recurring';

// ---------------------------------------------------------------------------
// RecurringSeriesService — create, cancel, and query recurring series
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
	/** Optional scheduled end date for the series */
	endsAt?: Date;
}

export interface SeriesRow {
	id: string;
	supersededBy: string | null;
	prototypeType: string;
	prototypeId: string;
	rrule: string;
	createdAt: Date;
	endsAt: Date | null;
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
	seriesEndsAt: Date | null;
	cancelledAt: Date | null;
	userName: string;
	userPronouns: string | null;
	userRole: string | null;
	bookerType: string;
	bookerId: string;
	startsAt: Date;
	endsAt: Date;
}

// ---------------------------------------------------------------------------
// create() — link a new series to a prototype reservation
// ---------------------------------------------------------------------------

export async function create(params: CreateSeriesParams): Promise<SeriesRow> {
	const { prototypeReservationId, frequency, prototypeStartsAt, endsAt } = params;

	const [proto] = await db
		.select({ createdByUserId: reservation.createdByUserId })
		.from(reservation)
		.where(eq(reservation.id, prototypeReservationId))
		.limit(1);
	if (!proto) throw new RecurringSeriesError('Prototype reservation not found');

	const rruleString = buildRRule(prototypeStartsAt, frequency);

	const seriesId = crypto.randomUUID();

	await db.batch([
		db.insert(recurringSeries).values({
			id: seriesId,
			prototypeType: 'reservation',
			prototypeId: prototypeReservationId,
			rrule: rruleString,
			createdBy: proto.createdByUserId,
			endsAt: endsAt ?? null
		}),
		db
			.update(reservation)
			.set({ recurringSeriesId: seriesId, updatedAt: new Date() })
			.where(eq(reservation.id, prototypeReservationId))
	]);

	const [series] = await db
		.select()
		.from(recurringSeries)
		.where(eq(recurringSeries.id, seriesId));
	return series;
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

	if (getRowCount(result) === 0) {
		throw new RecurringSeriesError('Series not found or already cancelled');
	}
}

// ---------------------------------------------------------------------------
// cancelAllForUser() — cancel all active series for a user (subscription lapse)
// ---------------------------------------------------------------------------

export async function cancelAllForUser(userId: string): Promise<number> {
	const now = new Date();

	const result = await db
		.update(recurringSeries)
		.set({ cancelledAt: now })
		.where(
			and(
				eq(recurringSeries.prototypeType, 'reservation'),
				isNull(recurringSeries.cancelledAt),
				isNull(recurringSeries.supersededBy),
				sql`${recurringSeries.prototypeId} IN (
					SELECT ${reservation.id} FROM ${reservation}
					WHERE ${reservation.createdByUserId} = ${userId}
				)`
			)
		);

	return getRowCount(result);
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
			endsAt: recurringSeries.endsAt,
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
			endsAt: recurringSeries.endsAt,
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

export async function listActive(opts?: { forUser?: string }): Promise<SeriesListItem[]> {
	const conditions = [
		eq(recurringSeries.prototypeType, 'reservation'),
		isNull(recurringSeries.cancelledAt),
		isNull(recurringSeries.supersededBy)
	];

	if (opts?.forUser) {
		conditions.push(eq(recurringSeries.createdBy, opts.forUser));
	}

	const rows = await db
		.select({
			id: recurringSeries.id,
			rrule: recurringSeries.rrule,
			createdAt: recurringSeries.createdAt,
			seriesEndsAt: recurringSeries.endsAt,
			cancelledAt: recurringSeries.cancelledAt,
			userName: user.name,
			userPronouns: user.pronouns,
			userRole: primaryRoleFor(user.id),
			bookerType: reservation.bookerType,
			bookerId: reservation.bookerId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt
		})
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(and(...conditions));

	return rows.map((r) => ({
		...r,
		frequencyLabel: describeFrequency(r.rrule)
	}));
}

// ---------------------------------------------------------------------------
// listAll() — all series including cancelled (staff view with filters)
// ---------------------------------------------------------------------------

export async function listAll(
	opts?: { filter?: string },
	pagination: PaginationInput = {}
) {
	const conditions = [
		eq(recurringSeries.prototypeType, 'reservation'),
		isNull(recurringSeries.supersededBy)
	];

	if (opts?.filter === 'active') {
		conditions.push(isNull(recurringSeries.cancelledAt));
	} else if (opts?.filter === 'cancelled') {
		conditions.push(sql`${recurringSeries.cancelledAt} is not null`);
	}

	const where = and(...conditions);

	const dataQ = db
		.select({
			id: recurringSeries.id,
			rrule: recurringSeries.rrule,
			createdAt: recurringSeries.createdAt,
			seriesEndsAt: recurringSeries.endsAt,
			cancelledAt: recurringSeries.cancelledAt,
			userName: user.name,
			userPronouns: user.pronouns,
			userRole: primaryRoleFor(user.id),
			bookerType: reservation.bookerType,
			bookerId: reservation.bookerId,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt
		})
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.innerJoin(user, eq(reservation.createdByUserId, user.id))
		.where(where)
		.$dynamic();

	const countQ = db
		.select({ count: count() })
		.from(recurringSeries)
		.innerJoin(reservation, eq(recurringSeries.prototypeId, reservation.id))
		.where(where);

	const result = await paginate(dataQ, countQ, pagination);
	return {
		...result,
		rows: result.rows.map((r) => ({
			...r,
			frequencyLabel: describeFrequency(r.rrule)
		}))
	};
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
