import { db } from '$lib/server/db';
import { event } from '$lib/server/db/schema/event';
import { user } from '$lib/server/db/schema/auth';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, gt, ne, asc, desc, inArray } from 'drizzle-orm';
import { staffCreate } from '$lib/server/reservation/reservation-service';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { hasConflict } from '$lib/server/reservation/conflict-service';
import { uploadFile, deleteObject } from '$lib/server/storage';
import { ReservationConflictError } from '$lib/server/reservation/reservation-service';

// ---------------------------------------------------------------------------
// EventService — create, update, publish, cancel events
// ---------------------------------------------------------------------------

export type EventStatus = 'draft' | 'published' | 'cancelled';

export interface EventRow {
	id: string;
	title: string;
	description: string | null;
	startsAt: Date;
	endsAt: Date;
	doorsAt: Date | null;
	status: string;
	publishedAt: Date | null;
	reservationId: string | null;
	posterKey: string | null;
	tags: string | null;
	createdByUserId: string;
	createdAt: Date;
	updatedAt: Date;
}

// ---------------------------------------------------------------------------
// create()
// ---------------------------------------------------------------------------

export interface CreateEventParams {
	title: string;
	description?: string;
	startsAt: Date;
	endsAt: Date;
	doorsAt?: Date;
	tags?: string;
	createdByUserId: string;
	reservation?: {
		startsAt: Date;
		endsAt: Date;
		overrideConflicts: boolean;
	};
	posterFile?: {
		buffer: ArrayBuffer;
		contentType: string;
	};
}

export async function create(params: CreateEventParams): Promise<EventRow> {
	const {
		title,
		description,
		startsAt,
		endsAt,
		doorsAt,
		tags,
		createdByUserId,
		reservation: reservationParams,
		posterFile
	} = params;

	// Insert event + optional reservation in a transaction
	const row = await db.transaction(async (tx) => {
		// Insert the event first to get the ID
		const [newEvent] = await tx
			.insert(event)
			.values({
				title,
				description: description ?? null,
				startsAt,
				endsAt,
				doorsAt: doorsAt ?? null,
				tags: tags ?? null,
				createdByUserId
			})
			.returning();

		// Create linked reservation if requested
		if (reservationParams) {
			if (!reservationParams.overrideConflicts) {
				const conflict = await hasConflict(reservationParams.startsAt, reservationParams.endsAt);
				if (conflict) {
					throw new ReservationConflictError();
				}
			}

			const res = await staffCreate({
				userId: createdByUserId,
				bookerType: 'event',
				bookerId: newEvent.id,
				startsAt: reservationParams.startsAt,
				endsAt: reservationParams.endsAt,
				status: 'confirmed'
			});

			await tx
				.update(event)
				.set({ reservationId: res.id, updatedAt: new Date() })
				.where(eq(event.id, newEvent.id));

			newEvent.reservationId = res.id;
		}

		return newEvent;
	});

	// Upload poster outside the transaction (non-critical, idempotent)
	if (posterFile) {
		const ext = extensionFromType(posterFile.contentType);
		const key = `events/posters/${row.id}.${ext}`;
		await uploadFile(posterFile.buffer, key, posterFile.contentType);
		await db
			.update(event)
			.set({ posterKey: key, updatedAt: new Date() })
			.where(eq(event.id, row.id));
		row.posterKey = key;
	}

	return row;
}

// ---------------------------------------------------------------------------
// update()
// ---------------------------------------------------------------------------

export interface UpdateEventParams {
	title?: string;
	description?: string | null;
	startsAt?: Date;
	endsAt?: Date;
	doorsAt?: Date | null;
	tags?: string | null;
	posterFile?: {
		buffer: ArrayBuffer;
		contentType: string;
	};
	/** When times change and a linked reservation exists, rebook it. */
	rebook?: {
		userId: string;
		reservationStartsAt: Date;
		reservationEndsAt: Date;
		overrideConflicts: boolean;
	};
}

/**
 * Check whether an event's time change would require rebooking its reservation.
 * Returns null if no rebook is needed, or an object describing the situation.
 */
export async function checkRebookNeeded(
	eventId: string,
	newStartsAt: Date,
	newEndsAt: Date
): Promise<{
	needed: boolean;
	currentReservation: { id: string; startsAt: Date; endsAt: Date } | null;
	reason: string | null;
}> {
	const evt = await getById(eventId);
	if (!evt) throw new Error('Event not found');

	if (!evt.reservationId) {
		return { needed: false, currentReservation: null, reason: null };
	}

	const [res] = await db
		.select({ id: reservation.id, startsAt: reservation.startsAt, endsAt: reservation.endsAt })
		.from(reservation)
		.where(eq(reservation.id, evt.reservationId))
		.limit(1);

	if (!res) {
		return { needed: false, currentReservation: null, reason: null };
	}

	const currentRes = { id: res.id, startsAt: res.startsAt, endsAt: res.endsAt };

	// Rebook needed if new event times extend outside the current reservation window
	const extendsEarlier = newStartsAt.getTime() < res.startsAt.getTime();
	const extendsLater = newEndsAt.getTime() > res.endsAt.getTime();

	if (!extendsEarlier && !extendsLater) {
		return { needed: false, currentReservation: currentRes, reason: null };
	}

	const reasons: string[] = [];
	if (extendsEarlier) reasons.push('starts earlier than the current reservation');
	if (extendsLater) reasons.push('ends later than the current reservation');

	return {
		needed: true,
		currentReservation: currentRes,
		reason: `New event time ${reasons.join(' and ')}`
	};
}

export async function update(eventId: string, params: UpdateEventParams): Promise<EventRow> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.status === 'cancelled') throw new Error('Cannot update a cancelled event');

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (params.title !== undefined) updates.title = params.title;
	if (params.description !== undefined) updates.description = params.description;
	if (params.startsAt !== undefined) updates.startsAt = params.startsAt;
	if (params.endsAt !== undefined) updates.endsAt = params.endsAt;
	if (params.doorsAt !== undefined) updates.doorsAt = params.doorsAt;
	if (params.tags !== undefined) updates.tags = params.tags;

	// Handle reservation rebooking if requested
	if (params.rebook && existing.reservationId) {
		const { userId, reservationStartsAt, reservationEndsAt, overrideConflicts } = params.rebook;

		// Cancel existing reservation
		try {
			await cancelReservation(existing.reservationId, userId, 'Event times changed — rebooking', {
				staffOverride: true
			});
		} catch {
			// Already cancelled — continue
		}

		// Create new reservation
		if (!overrideConflicts) {
			const conflict = await hasConflict(reservationStartsAt, reservationEndsAt, existing.reservationId);
			if (conflict) {
				throw new ReservationConflictError();
			}
		}

		const newRes = await staffCreate({
			userId,
			bookerType: 'event',
			bookerId: eventId,
			startsAt: reservationStartsAt,
			endsAt: reservationEndsAt,
			status: existing.status === 'draft' ? 'scheduled' : 'confirmed'
		});

		updates.reservationId = newRes.id;
	}

	// Handle poster replacement
	if (params.posterFile) {
		if (existing.posterKey) {
			await deleteObject(existing.posterKey);
		}
		const ext = extensionFromType(params.posterFile.contentType);
		const key = `events/posters/${eventId}.${ext}`;
		await uploadFile(params.posterFile.buffer, key, params.posterFile.contentType);
		updates.posterKey = key;
	}

	const [updated] = await db
		.update(event)
		.set(updates)
		.where(eq(event.id, eventId))
		.returning();

	return updated;
}

// ---------------------------------------------------------------------------
// publish()
// ---------------------------------------------------------------------------

export async function publish(eventId: string): Promise<void> {
	const result = await db
		.update(event)
		.set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(event.id, eventId), eq(event.status, 'draft')));

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
	if (rowCount === 0) {
		const existing = await getById(eventId);
		if (!existing) throw new Error('Event not found');
		throw new Error(`Cannot publish an event with status "${existing.status}"`);
	}
}

// ---------------------------------------------------------------------------
// cancel()
// ---------------------------------------------------------------------------

export async function cancel(eventId: string, userId: string): Promise<void> {
	const existing = await getById(eventId);
	if (!existing) throw new Error('Event not found');
	if (existing.status === 'cancelled') throw new Error('Event is already cancelled');

	const result = await db
		.update(event)
		.set({ status: 'cancelled', updatedAt: new Date() })
		.where(
			and(
				eq(event.id, eventId),
				ne(event.status, 'cancelled')
			)
		);

	const rowCount = (result as unknown as { rowCount: number }).rowCount ?? 0;
	if (rowCount === 0) throw new Error('Event status changed concurrently');

	// Cancel linked reservation if present
	if (existing.reservationId) {
		try {
			await cancelReservation(existing.reservationId, userId, 'Event cancelled', {
				staffOverride: true
			});
		} catch {
			// Reservation may already be cancelled — ignore
		}
	}

	// Delete poster from R2
	if (existing.posterKey) {
		await deleteObject(existing.posterKey);
	}
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getById(eventId: string): Promise<EventRow | null> {
	const [row] = await db
		.select()
		.from(event)
		.where(eq(event.id, eventId))
		.limit(1);

	return row ?? null;
}

/** Published events with startsAt in the future, ordered by date. */
export async function listUpcoming(): Promise<EventRow[]> {
	return db
		.select()
		.from(event)
		.where(
			and(
				eq(event.status, 'published'),
				gt(event.startsAt, new Date())
			)
		)
		.orderBy(asc(event.startsAt));
}

/** All events for staff, newest first. */
export async function listAll(): Promise<EventRow[]> {
	return db
		.select()
		.from(event)
		.orderBy(desc(event.startsAt));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extensionFromType(contentType: string): string {
	switch (contentType) {
		case 'image/jpeg':
			return 'jpg';
		case 'image/png':
			return 'png';
		case 'image/webp':
			return 'webp';
		default:
			return 'bin';
	}
}
