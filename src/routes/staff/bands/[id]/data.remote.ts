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
	removeMember,
	transferOwnership,
	deactivate,
	reactivate,
	invite,
	updateMember,
	revokeInvitation,
	searchMembers
} from '$lib/server/band/band-service';

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

const memberIdSchema = z.object({ memberId: z.string().min(1) });

export const removeBandMember = command(memberIdSchema, async (data) => {
	await requireStaff();
	await removeMember(data.memberId);
	const { params } = getRequestEvent();
	void getBandMembers(params.id!).refresh();
	return { success: true };
});

const transferSchema = z.object({ newOwnerId: z.string().min(1) });

export const transferBandOwnership = command(transferSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	const id = params.id!;
	// Staff acts as current owner for the transfer
	const band = await getByIdWithDetails(id);
	if (!band) error(404, 'Band not found');
	await transferOwnership(id, data.newOwnerId, band.ownerId);
	void getBand(id).refresh();
	void getBandMembers(id).refresh();
	return { success: true };
});

export const deactivateBand = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await deactivate(params.id!);
	void getBand(params.id!).refresh();
	return { success: true };
});

export const reactivateBand = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await reactivate(params.id!);
	void getBand(params.id!).refresh();
	return { success: true };
});

// ---------------------------------------------------------------------------
// Member management
// ---------------------------------------------------------------------------

export const searchUsers = query(z.string(), async (q) => {
	await requireStaff();
	if (!q || q.length < 2) return [];
	const { params } = getRequestEvent();
	return searchMembers(q, params.id!);
});

export const inviteMember = command(
	z.object({
		userId: z.string().min(1),
		role: z.enum(['admin', 'member']),
		position: z.string().optional()
	}),
	async (data) => {
		const staff = await requireStaff();
		const { params } = getRequestEvent();
		await invite(params.id!, data.userId, data.role, data.position ?? null, staff.id);
		void getBandMembers(params.id!).refresh();
		void getBand(params.id!).refresh();
		return { success: true };
	}
);

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

export const revokeInvite = command(memberIdSchema, async (data) => {
	await requireStaff();
	await revokeInvitation(data.memberId);
	const { params } = getRequestEvent();
	void getBandMembers(params.id!).refresh();
	void getBand(params.id!).refresh();
	return { success: true };
});
