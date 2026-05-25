import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, desc } from 'drizzle-orm';
import { requireStaff, requireUser } from '$lib/server/authorization';
import { listAll } from '$lib/server/band/band-service';
import {
	getByIdWithDetails,
	getMembers,
	update,
	updateMember,
	create,
	acceptInvitation,
	declineInvitation,
	invite,
	removeMember as removeMemberService,
	revokeInvitation as revokeInvitationService,
	transferOwnership as transferOwnershipService,
	leaveBand as leaveBandService,
	searchMembers as searchMembersService,
	deleteBand as deleteBandService,
	deactivate,
	reactivate
} from '$lib/server/band/band-service';
import {
	createInvite as createPlatformInvite,
	listForBand,
	revoke as revokePlatformInviteService
} from '$lib/server/band/platform-invite-service';
import {
	requireBandBySlug,
	requireBandAdmin,
	requireBandOwner
} from '$lib/server/band/band-context';

// ===========================================================================
// Queries — Staff (list)
// ===========================================================================

const staffBandsFilters = z.object({
	search: z.string().optional(),
	status: z.enum(['active', 'deactivated']).optional(),
	page: z.number().optional()
});

export const getStaffBands = query(staffBandsFilters, async (filters) => {
	await requireStaff();
	return listAll(
		{
			search: filters.search || undefined,
			status: filters.status || undefined
		},
		{ page: filters.page ?? 1, pageSize: 50 }
	);
});

// ===========================================================================
// Queries — Staff (detail)
// ===========================================================================

export const getStaffBand = query(z.string(), async (id) => {
	await requireStaff();
	const band = await getByIdWithDetails(id);
	if (!band) error(404, 'Band not found');
	return band;
});

export const getStaffBandMembers = query(z.string(), async (bandId) => {
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

export const getStaffPlatformInvites = query(z.string(), async (bandId) => {
	await requireStaff();
	return listForBand(bandId);
});

// ===========================================================================
// Queries — Band-context (slug-based)
// ===========================================================================

export const searchBandUsers = query(z.string(), async (q) => {
	const { band } = await requireBandAdmin();
	if (q.length < 2) return [];
	return searchMembersService(q, band.id);
});

export const getBandPlatformInvites = query(z.void(), async () => {
	const { band } = await requireBandAdmin();
	return listForBand(band.id);
});

// ===========================================================================
// Forms — Staff
// ===========================================================================

export const updateStaffBand = form(
	z.object({
		name: z.string().trim().min(1).max(255),
		bio: z.string().trim().max(2000)
	}),
	async (data) => {
		await requireStaff();
		const { params } = getRequestEvent();
		const id = params.id!;
		await update(id, { name: data.name, bio: data.bio || undefined });
		void getStaffBand(id).refresh();
		return { success: true };
	}
);

export const updateMemberRole = form(
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
		void getStaffBandMembers(params.id!).refresh();
		return { success: true };
	}
);

// ===========================================================================
// Forms — Staff (from API routes)
// ===========================================================================

export const createBandApi = form(
	z.object({
		name: z.string().min(1),
		bio: z.string().optional(),
		ownerId: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		const band = await create(data.ownerId, { name: data.name, bio: data.bio });
		return { success: true, bandId: band.id };
	}
);

export const deactivateBand = form(
	z.object({
		id: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		await deactivate(data.id);
		return { success: true };
	}
);

export const reactivateBand = form(
	z.object({
		id: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		await reactivate(data.id);
		return { success: true };
	}
);

export const addBandMember = form(
	z.object({
		bandId: z.string().min(1),
		userId: z.string().min(1),
		role: z.enum(['admin', 'member']),
		position: z.string().optional()
	}),
	async (data) => {
		const staff = await requireStaff();
		await invite(data.bandId, data.userId, data.role, data.position ?? null, staff.id);
		return { success: true };
	}
);

export const removeBandMember = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		await removeMemberService(data.memberId);
		return { success: true };
	}
);

export const revokeBandInvite = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		await revokeInvitationService(data.memberId);
		return { success: true };
	}
);

export const transferOwnership = form(
	z.object({
		bandId: z.string().min(1),
		newOwnerId: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		const band = await getByIdWithDetails(data.bandId);
		if (!band) throw error(404, 'Band not found');
		await transferOwnershipService(data.bandId, data.newOwnerId, band.ownerId);
		return { success: true };
	}
);

export const inviteByEmailApi = form(
	z.object({
		bandId: z.string().min(1),
		email: z.string().email(),
		role: z.enum(['admin', 'member']),
		position: z.string().optional()
	}),
	async (data) => {
		const staff = await requireStaff();
		const result = await createPlatformInvite(
			data.email,
			data.bandId,
			data.role,
			data.position ?? null,
			staff.id
		);
		return { success: true, ...result };
	}
);

export const revokePlatformInvite = form(
	z.object({
		inviteId: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		await revokePlatformInviteService(data.inviteId);
		return { success: true };
	}
);

// ===========================================================================
// Forms — Member (no slug context)
// ===========================================================================

export const createBand = form(
	z.object({
		name: z.string().min(1, 'Band name is required').max(255),
		bio: z.string().max(2000).optional().default('')
	}),
	async (data) => {
		const currentUser = requireUser();
		const band = await create(currentUser.id, {
			name: data.name,
			bio: data.bio || undefined
		});
		return { success: true, slug: band.slug };
	}
);

export const acceptInvite = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		const currentUser = requireUser();
		await acceptInvitation(data.memberId, currentUser.id);
		return { success: true };
	}
);

export const declineInvite = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		const currentUser = requireUser();
		await declineInvitation(data.memberId, currentUser.id);
		return { success: true };
	}
);

// ===========================================================================
// Forms — Band-context (slug-based, requires band membership)
// ===========================================================================

export const updateBand = form(
	z.object({
		name: z.string().min(1, 'Name is required').max(200),
		bio: z.string().max(2000).optional().default('')
	}),
	async (data) => {
		const { band } = await requireBandAdmin();
		const updated = await update(band.id, {
			name: data.name,
			bio: data.bio
		});
		return { success: true, slug: updated.slug };
	}
);

export const deleteBand = form(
	z.object({}),
	async () => {
		const { band } = await requireBandOwner();
		await deleteBandService(band.id);
		return { success: true };
	}
);

export const inviteMember = form(
	z.object({
		userId: z.string().min(1, 'User is required'),
		role: z.enum(['admin', 'member']),
		position: z.string().max(100).optional().default('')
	}),
	async (data) => {
		const { user, band } = await requireBandAdmin();
		const member = await invite(
			band.id,
			data.userId,
			data.role,
			data.position || null,
			user.id
		);
		return { success: true, memberId: member.id };
	}
);

export const removeMember = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		await requireBandAdmin();
		await removeMemberService(data.memberId);
		return { success: true };
	}
);

export const revokeInvitation = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		await requireBandAdmin();
		await revokeInvitationService(data.memberId);
		return { success: true };
	}
);

export const updateMemberRemote = form(
	z.object({
		memberId: z.string().min(1),
		role: z.enum(['admin', 'member']).optional(),
		position: z.string().max(100).optional()
	}),
	async (data) => {
		await requireBandAdmin();
		await updateMember(data.memberId, {
			role: data.role,
			position: data.position !== undefined ? (data.position || null) : undefined
		});
		return { success: true };
	}
);

export const transferOwner = form(
	z.object({
		newOwnerId: z.string().min(1)
	}),
	async (data) => {
		const { user, band } = await requireBandOwner();
		await transferOwnershipService(band.id, data.newOwnerId, user.id);
		return { success: true };
	}
);

export const leave = form(
	z.object({}),
	async () => {
		const user = requireUser();
		const band = await requireBandBySlug();
		await leaveBandService(band.id, user.id);
		return { success: true };
	}
);

export const inviteByEmail = form(
	z.object({
		email: z.string().email('Valid email required'),
		role: z.enum(['admin', 'member']),
		position: z.string().max(100).optional().default('')
	}),
	async (data) => {
		const { user, band } = await requireBandAdmin();
		const result = await createPlatformInvite(
			data.email,
			band.id,
			data.role,
			data.position || null,
			user.id
		);
		return { success: true, ...result };
	}
);

export const revokePlatformInviteRemote = form(
	z.object({
		inviteId: z.string().min(1)
	}),
	async (data) => {
		await requireBandAdmin();
		await revokePlatformInviteService(data.inviteId);
		return { success: true };
	}
);
