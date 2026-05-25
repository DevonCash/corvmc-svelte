import { db } from '$lib/server/db';
import { band, bandMember } from '$lib/server/db/schema/band';
import { user } from '$lib/server/db/schema/authentication';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq, and, ne, gt, sql, or, like, inArray, isNull, isNotNull, count } from 'drizzle-orm';
import { paginate, type PaginationInput } from '$lib/server/db/paginate';
import { primaryRoleFor } from '$lib/server/authorization';
import { generateSlug, ensureUniqueSlug } from '$lib/server/utils/slug';
import { cancel as cancelReservation } from '$lib/server/reservation/reservation-service';
import { deleteObject } from '$lib/server/storage';
import { captureException } from '$lib/server/sentry';
import { domainEvents } from '$lib/server/events/event-bus';
import type { BandRole } from '$lib/server/db/schema/band';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateBandData {
	name: string;
	bio?: string;
}

export interface UpdateBandData {
	name?: string;
	bio?: string;
}

export interface UpdateMemberData {
	role?: 'admin' | 'member';
	position?: string | null;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class BandNotFoundError extends Error {
	constructor() {
		super('Band not found');
		this.name = 'BandNotFoundError';
	}
}

export class BandMemberExistsError extends Error {
	constructor() {
		super('User is already a member or has a pending invitation');
		this.name = 'BandMemberExistsError';
	}
}

export class CannotRemoveOwnerError extends Error {
	constructor() {
		super('Cannot remove or demote the band owner');
		this.name = 'CannotRemoveOwnerError';
	}
}

export class OwnerCannotLeaveError extends Error {
	constructor() {
		super('Owner must transfer ownership before leaving');
		this.name = 'OwnerCannotLeaveError';
	}
}

// ---------------------------------------------------------------------------
// Create / Update / Delete
// ---------------------------------------------------------------------------

export async function create(ownerId: string, data: CreateBandData) {
	const baseSlug = generateSlug(data.name);
	const slug = await ensureUniqueSlug(baseSlug, band, band.slug);

	const bandId = crypto.randomUUID();

	await db.batch([
		db.insert(band).values({
			id: bandId,
			name: data.name,
			slug,
			bio: data.bio ?? null,
			ownerId
		}),
		db.insert(bandMember).values({
			bandId,
			userId: ownerId,
			role: 'owner',
			status: 'active'
		})
	]);

	const [newBand] = await db.select().from(band).where(eq(band.id, bandId));
	return newBand;
}

export async function update(bandId: string, data: UpdateBandData) {
	const updates: Record<string, unknown> = { updatedAt: new Date() };

	if (data.name !== undefined) {
		updates.name = data.name;
		const baseSlug = generateSlug(data.name);
		updates.slug = await ensureUniqueSlug(baseSlug, band, band.slug);
	}

	if (data.bio !== undefined) {
		updates.bio = data.bio?.slice(0, 2000) || null;
	}

	const [updated] = await db.update(band).set(updates).where(eq(band.id, bandId)).returning();

	if (!updated) throw new BandNotFoundError();
	return updated;
}

export async function deleteBand(bandId: string) {
	const [row] = await db.select().from(band).where(eq(band.id, bandId)).limit(1);
	if (!row) throw new BandNotFoundError();

	// Cancel all future band reservations
	const futureReservations = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				eq(reservation.bookerType, 'band'),
				eq(reservation.bookerId, bandId),
				gt(reservation.startsAt, new Date()),
				ne(reservation.status, 'cancelled')
			)
		);

	for (const r of futureReservations) {
		await cancelReservation(r.id, row.ownerId, 'Band deleted', { staffOverride: true });
	}

	// Delete avatar from R2
	if (row.avatarKey) {
		try {
			await deleteObject(row.avatarKey);
		} catch {
			// Avatar may not exist — that's fine
		}
	}

	// Delete band (band_member rows cascade)
	await db.delete(band).where(eq(band.id, bandId));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getBySlug(slug: string) {
	const [row] = await db
		.select({
			id: band.id,
			name: band.name,
			slug: band.slug,
			bio: band.bio,
			ownerId: band.ownerId,
			avatarKey: band.avatarKey,
			createdAt: band.createdAt,
			updatedAt: band.updatedAt,
			memberCount: sql<number>`count(case when ${bandMember.status} = 'active' then 1 end)`
		})
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(eq(band.slug, slug), isNull(band.deletedAt)))
		.groupBy(band.id);

	return row ?? null;
}

export async function getById(bandId: string) {
	const [row] = await db.select().from(band).where(eq(band.id, bandId)).limit(1);
	return row ?? null;
}

export async function listForUser(
	userId: string,
	props = {
		id: band.id,
		name: band.name,
		slug: band.slug,
		avatarKey: band.avatarKey,
		role: bandMember.role,
		status: bandMember.status,
		memberCount: sql<number>`(
		select count(*) from band_member bm
		where bm.band_id = ${band.id} and bm.status = 'active'
	)`
	}
) {
	return db
		.select(props)
		.from(bandMember)
		.innerJoin(band, eq(band.id, bandMember.bandId))
		.where(and(eq(bandMember.userId, userId), isNull(band.deletedAt)))
		.orderBy(band.name);
}

export async function getMembers(bandId: string) {
	return db
		.select({
			id: bandMember.id,
			userId: bandMember.userId,
			role: bandMember.role,
			position: bandMember.position,
			status: bandMember.status,
			invitedById: bandMember.invitedById,
			createdAt: bandMember.createdAt,
			userName: user.name,
			userEmail: user.email,
			userPronouns: user.pronouns,
			userRole: primaryRoleFor(user.id)
		})
		.from(bandMember)
		.innerJoin(user, eq(user.id, bandMember.userId))
		.where(eq(bandMember.bandId, bandId))
		.orderBy(
			sql`case ${bandMember.role} when 'owner' then 0 when 'admin' then 1 else 2 end`,
			user.name
		);
}

export async function searchMembers(query: string, bandId: string) {
	const pattern = `%${query}%`;
	return db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(
			and(
				or(like(user.name, pattern), like(user.email, pattern)),
				isNull(user.deletedAt),
				sql`NOT EXISTS (
					SELECT 1 FROM ${bandMember}
					WHERE ${bandMember.bandId} = ${bandId}
					AND ${bandMember.userId} = ${user.id}
				)`
			)
		)
		.limit(10);
}

// ---------------------------------------------------------------------------
// Membership management
// ---------------------------------------------------------------------------

export async function invite(
	bandId: string,
	userId: string,
	role: 'admin' | 'member',
	position: string | null,
	invitedById: string
) {
	try {
		const [row] = await db
			.insert(bandMember)
			.values({
				bandId,
				userId,
				role,
				position,
				status: 'pending',
				invitedById
			})
			.returning();

		// Emit domain event (fire-and-forget)
		Promise.resolve().then(async () => {
			try {
				const [bandRow] = await db.select({ name: band.name }).from(band).where(eq(band.id, bandId)).limit(1);
				const [invitedUser] = await db.select({ name: user.name, email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
				const [inviter] = await db.select({ name: user.name }).from(user).where(eq(user.id, invitedById)).limit(1);

				if (bandRow && invitedUser && inviter) {
					await domainEvents.emit('band.invitation_sent', {
						bandId,
						bandName: bandRow.name,
						invitedUserId: userId,
						invitedUserName: invitedUser.name,
						invitedUserEmail: invitedUser.email,
						invitedByName: inviter.name
					});
				}
			} catch (err) {
				captureException(err, { event: 'band.invitation_sent', bandId });
			}
		});

		return row;
	} catch (err: unknown) {
		// Unique constraint violation = user already in band
		if (err instanceof Error && err.message.includes('unique')) {
			throw new BandMemberExistsError();
		}
		throw err;
	}
}

export async function acceptInvitation(memberId: string, userId: string) {
	const [row] = await db
		.update(bandMember)
		.set({ status: 'active' })
		.where(
			and(
				eq(bandMember.id, memberId),
				eq(bandMember.userId, userId),
				eq(bandMember.status, 'pending')
			)
		)
		.returning();

	if (!row) throw new Error('Invitation not found or already accepted');

	// Emit domain event (fire-and-forget)
	Promise.resolve().then(async () => {
		try {
			const [bandRow] = await db.select({ name: band.name }).from(band).where(eq(band.id, row.bandId)).limit(1);
			const [acceptedUser] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);

			// Get band admins/owners to notify (single join query)
			const adminUsers = await db
				.select({ id: user.id, name: user.name, email: user.email })
				.from(bandMember)
				.innerJoin(user, eq(user.id, bandMember.userId))
				.where(
					and(
						eq(bandMember.bandId, row.bandId),
						inArray(bandMember.role, ['owner', 'admin']),
						eq(bandMember.status, 'active'),
						ne(bandMember.userId, userId)
					)
				);

			if (bandRow && acceptedUser) {
				await domainEvents.emit('band.invitation_accepted', {
					bandId: row.bandId,
					bandName: bandRow.name,
					acceptedByUserId: userId,
					acceptedByName: acceptedUser.name,
					bandAdmins: adminUsers.map((u) => ({
						userId: u.id,
						userName: u.name,
						userEmail: u.email
					}))
				});
			}
		} catch (err) {
			captureException(err, { event: 'band.invitation_accepted' });
		}
	});

	return row;
}

export async function declineInvitation(memberId: string, userId: string) {
	const result = await db
		.delete(bandMember)
		.where(
			and(
				eq(bandMember.id, memberId),
				eq(bandMember.userId, userId),
				eq(bandMember.status, 'pending')
			)
		);

	return result;
}

export async function revokeInvitation(memberId: string) {
	return db
		.delete(bandMember)
		.where(and(eq(bandMember.id, memberId), eq(bandMember.status, 'pending')));
}

export async function removeMember(memberId: string) {
	const [row] = await db
		.select({ role: bandMember.role })
		.from(bandMember)
		.where(eq(bandMember.id, memberId))
		.limit(1);

	if (!row) throw new Error('Member not found');
	if (row.role === 'owner') throw new CannotRemoveOwnerError();

	return db.delete(bandMember).where(eq(bandMember.id, memberId));
}

export async function updateMember(memberId: string, data: UpdateMemberData) {
	const [row] = await db
		.select({ role: bandMember.role })
		.from(bandMember)
		.where(eq(bandMember.id, memberId))
		.limit(1);

	if (!row) throw new Error('Member not found');
	if (row.role === 'owner') throw new CannotRemoveOwnerError();

	const updates: Record<string, unknown> = {};
	if (data.role !== undefined) updates.role = data.role;
	if (data.position !== undefined) updates.position = data.position;

	return db.update(bandMember).set(updates).where(eq(bandMember.id, memberId));
}

export async function transferOwnership(bandId: string, newOwnerId: string, actorId: string) {
	const [target] = await db
		.select({ status: bandMember.status })
		.from(bandMember)
		.where(and(eq(bandMember.bandId, bandId), eq(bandMember.userId, newOwnerId)))
		.limit(1);

	if (!target || target.status !== 'active') {
		throw new Error('New owner must be an active band member');
	}

	await db.batch([
		db
			.update(bandMember)
			.set({ role: 'admin' })
			.where(
				and(
					eq(bandMember.bandId, bandId),
					eq(bandMember.userId, actorId),
					eq(bandMember.role, 'owner')
				)
			),
		db
			.update(bandMember)
			.set({ role: 'owner' })
			.where(
				and(
					eq(bandMember.bandId, bandId),
					eq(bandMember.userId, newOwnerId),
					eq(bandMember.status, 'active')
				)
			),
		db
			.update(band)
			.set({ ownerId: newOwnerId, updatedAt: new Date() })
			.where(eq(band.id, bandId))
	]);
}

export async function leaveBand(bandId: string, userId: string) {
	const [row] = await db
		.select({ role: bandMember.role })
		.from(bandMember)
		.where(and(eq(bandMember.bandId, bandId), eq(bandMember.userId, userId)))
		.limit(1);

	if (!row) throw new Error('Not a member of this band');
	if (row.role === 'owner') throw new OwnerCannotLeaveError();

	return db
		.delete(bandMember)
		.where(and(eq(bandMember.bandId, bandId), eq(bandMember.userId, userId)));
}

// ---------------------------------------------------------------------------
// Staff queries
// ---------------------------------------------------------------------------

export async function listAll(
	opts?: { search?: string; status?: 'active' | 'deactivated' },
	pagination: PaginationInput = {}
) {
	const conditions = [];

	if (opts?.search) {
		conditions.push(like(band.name, `%${opts.search}%`));
	}
	if (opts?.status === 'active') {
		conditions.push(isNull(band.deletedAt));
	} else if (opts?.status === 'deactivated') {
		conditions.push(isNotNull(band.deletedAt));
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const dataQ = db
		.select({
			id: band.id,
			name: band.name,
			slug: band.slug,
			ownerId: band.ownerId,
			ownerName: user.name,
			memberCount: sql<number>`(
				select count(*) from band_member bm
				where bm.band_id = ${band.id} and bm.status = 'active'
			)`,
			createdAt: band.createdAt,
			deletedAt: band.deletedAt
		})
		.from(band)
		.innerJoin(user, eq(user.id, band.ownerId))
		.where(where)
		.orderBy(band.name)
		.$dynamic();

	const countQ = db
		.select({ count: count() })
		.from(band)
		.innerJoin(user, eq(user.id, band.ownerId))
		.where(where);

	return paginate(dataQ, countQ, pagination);
}

export async function getByIdWithDetails(bandId: string) {
	const [row] = await db
		.select({
			id: band.id,
			name: band.name,
			slug: band.slug,
			bio: band.bio,
			ownerId: band.ownerId,
			ownerName: user.name,
			ownerEmail: user.email,
			ownerPronouns: user.pronouns,
			ownerRole: primaryRoleFor(user.id),
			avatarKey: band.avatarKey,
			createdAt: band.createdAt,
			updatedAt: band.updatedAt,
			deletedAt: band.deletedAt,
			memberCount: sql<number>`(
				select count(*) from band_member bm
				where bm.band_id = ${band.id} and bm.status = 'active'
			)`
		})
		.from(band)
		.innerJoin(user, eq(user.id, band.ownerId))
		.where(eq(band.id, bandId));

	return row ?? null;
}

export async function deactivate(bandId: string) {
	const [row] = await db
		.update(band)
		.set({ deletedAt: new Date(), updatedAt: new Date() })
		.where(and(eq(band.id, bandId), isNull(band.deletedAt)))
		.returning();

	if (!row) throw new BandNotFoundError();

	// Cancel all future band reservations
	const futureReservations = await db
		.select({ id: reservation.id })
		.from(reservation)
		.where(
			and(
				eq(reservation.bookerType, 'band'),
				eq(reservation.bookerId, bandId),
				gt(reservation.startsAt, new Date()),
				ne(reservation.status, 'cancelled')
			)
		);

	for (const r of futureReservations) {
		await cancelReservation(r.id, row.ownerId, 'Band deactivated', { staffOverride: true });
	}

	return row;
}

export async function reactivate(bandId: string) {
	const [row] = await db
		.update(band)
		.set({ deletedAt: null, updatedAt: new Date() })
		.where(and(eq(band.id, bandId), isNotNull(band.deletedAt)))
		.returning();

	if (!row) throw new BandNotFoundError();
	return row;
}

// ---------------------------------------------------------------------------
// Role check
// ---------------------------------------------------------------------------

export async function getUserRole(bandId: string, userId: string): Promise<BandRole | null> {
	const [row] = await db
		.select({ role: bandMember.role, status: bandMember.status })
		.from(bandMember)
		.where(
			and(
				eq(bandMember.bandId, bandId),
				eq(bandMember.userId, userId),
				eq(bandMember.status, 'active')
			)
		)
		.limit(1);

	return (row?.role as BandRole) ?? null;
}
