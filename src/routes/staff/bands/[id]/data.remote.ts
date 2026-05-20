import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, command, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, desc } from 'drizzle-orm';
import { requireStaff } from '$lib/server/authorization';
import {
	getByIdWithDetails,
	getMembers,
	update,
	updateMember
} from '$lib/server/band/band-service';
import { listForBand } from '$lib/server/band/platform-invite-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getBand = query(z.string(), async (id) => {
	await requireStaff();
	const band = await getByIdWithDetails(id);
	if (!band) error(404, 'Band not found');
	return band;
});

export const getBandMembers = query(z.string(), async (bandId) => {
	await requireStaff();
	return getMembers(bandId);
});

export const getBandReservations = query(z.string(), async (bandId) => {
	await requireStaff();
	return db
		.select({
			id: reservation.id,
			status: reservation.status,
			startsAt: reservation.startsAt,
			endsAt: reservation.endsAt,
			notes: reservation.notes,
			createdByUserId: reservation.createdByUserId,
			bookedByName: user.name
		})
		.from(reservation)
		.leftJoin(user, eq(user.id, reservation.createdByUserId))
		.where(
			and(
				eq(reservation.bookerType, 'band'),
				eq(reservation.bookerId, bandId)
			)
		)
		.orderBy(desc(reservation.startsAt))
		.limit(10);
});

export const getPlatformInvites = query(z.string(), async (bandId) => {
	await requireStaff();
	return listForBand(bandId);
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const updateBandSchema = z.object({
	name: z.string().trim().min(1).max(255),
	bio: z.string().trim().max(2000)
});

export const updateBand = form(updateBandSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	const id = params.id!;
	await update(id, { name: data.name, bio: data.bio || undefined });
	void getBand(id).refresh();
	return { success: true };
});

export const updateMemberRole = command(
	z.object({
		memberId: z.string().min(1),
		role: z.enum(['admin', 'member']),
		position: z.string().optional()
	}),
	async (data) => {
		await requireStaff();
		await updateMember(data.memberId, {
			role: data.role,
			position: data.position ?? undefined
		});
		const { params } = getRequestEvent();
		void getBandMembers(params.id!).refresh();
		return { success: true };
	}
);
