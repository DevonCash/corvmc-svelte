import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { form, query, getRequestEvent } from '$app/server';
import {
	getBySlug,
	getUserRole,
	searchMembers as searchMembersService,
	invite,
	removeMember as removeMemberService,
	revokeInvitation as revokeInvitationService,
	updateMember as updateMemberService,
	transferOwnership as transferOwnershipService,
	leaveBand as leaveBandService
} from '$lib/server/band/band-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

async function requireBand() {
	const { params } = getRequestEvent();
	const band = await getBySlug(params.slug!);
	if (!band) throw error(404, 'Band not found');
	return band;
}

async function requireRole(minRole: 'owner' | 'admin' | 'member') {
	const user = requireUser();
	const band = await requireBand();
	const role = await getUserRole(band.id, user.id);

	if (!role) throw error(403, 'Not a member of this band');

	const hierarchy = { owner: 0, admin: 1, member: 2 };
	if (hierarchy[role] > hierarchy[minRole]) {
		throw error(403, 'Insufficient permissions');
	}

	return { user, band, role };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const searchUsers = query(z.string(), async (q) => {
	const { band } = await requireRole('admin');
	if (q.length < 2) return [];
	return searchMembersService(q, band.id);
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const inviteMember = form(
	z.object({
		userId: z.string().min(1, 'User is required'),
		role: z.enum(['admin', 'member']),
		position: z.string().max(100).optional().default('')
	}),
	async (data) => {
		const { user, band } = await requireRole('admin');

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
		await requireRole('admin');
		await removeMemberService(data.memberId);
		return { success: true };
	}
);

export const revokeInvitation = form(
	z.object({
		memberId: z.string().min(1)
	}),
	async (data) => {
		await requireRole('admin');
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
		await requireRole('admin');
		await updateMemberService(data.memberId, {
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
		const { user, band } = await requireRole('owner');
		await transferOwnershipService(band.id, data.newOwnerId, user.id);
		return { success: true };
	}
);

export const leave = form(
	z.object({}),
	async () => {
		const user = requireUser();
		const band = await requireBand();
		await leaveBandService(band.id, user.id);
		return { success: true };
	}
);
