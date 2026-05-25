import { db } from '$lib/server/db';
import { platformInvite } from '$lib/server/db/schema/platform-invite';
import { band, bandMember } from '$lib/server/db/schema/band';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, gt, desc } from 'drizzle-orm';
import { invite } from './band-service';
import { domainEvents } from '$lib/server/events/event-bus';
import { captureException } from '$lib/server/sentry';

const INVITE_EXPIRY_DAYS = 7;

function expiresAt(): Date {
	const d = new Date();
	d.setDate(d.getDate() + INVITE_EXPIRY_DAYS);
	return d;
}

export async function createInvite(
	email: string,
	bandId: string,
	role: 'admin' | 'member',
	position: string | null,
	invitedById: string
): Promise<{ type: 'platform_invite' | 'existing_user'; id: string }> {
	const normalizedEmail = email.toLowerCase().trim();

	// Check if user already exists
	const [existingUser] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, normalizedEmail))
		.limit(1);

	if (existingUser) {
		const row = await invite(bandId, existingUser.id, role, position, invitedById);
		return { type: 'existing_user', id: row.id };
	}

	// Check for existing pending invite for same email+band
	const [existing] = await db
		.select({ id: platformInvite.id })
		.from(platformInvite)
		.where(
			and(
				eq(platformInvite.email, normalizedEmail),
				eq(platformInvite.bandId, bandId),
				eq(platformInvite.status, 'pending')
			)
		)
		.limit(1);

	if (existing) {
		// Refresh expiry
		await db
			.update(platformInvite)
			.set({ expiresAt: expiresAt(), role, position })
			.where(eq(platformInvite.id, existing.id));
		return { type: 'platform_invite', id: existing.id };
	}

	// Create new platform invite
	const [row] = await db
		.insert(platformInvite)
		.values({
			email: normalizedEmail,
			bandId,
			role,
			position,
			invitedById,
			status: 'pending',
			expiresAt: expiresAt()
		})
		.returning();

	// Emit event for email notification (fire-and-forget)
	Promise.resolve().then(async () => {
		try {
			const [bandRow] = await db.select({ name: band.name }).from(band).where(eq(band.id, bandId)).limit(1);
			const [inviter] = await db.select({ name: user.name }).from(user).where(eq(user.id, invitedById)).limit(1);

			if (bandRow && inviter) {
				await domainEvents.emit('platform_invite.created', {
					email: normalizedEmail,
					token: row.token,
					bandId,
					bandName: bandRow.name,
					role,
					invitedByName: inviter.name
				});
			}
		} catch (err) {
			captureException(err, { event: 'platform_invite.created', bandId });
		}
	});

	return { type: 'platform_invite', id: row.id };
}

export async function resolvePendingInvites(userId: string, email: string): Promise<number> {
	const normalizedEmail = email.toLowerCase().trim();
	const now = new Date();

	const pending = await db
		.select({
			id: platformInvite.id,
			bandId: platformInvite.bandId,
			role: platformInvite.role,
			position: platformInvite.position,
			invitedById: platformInvite.invitedById
		})
		.from(platformInvite)
		.where(
			and(
				eq(platformInvite.email, normalizedEmail),
				eq(platformInvite.status, 'pending'),
				gt(platformInvite.expiresAt, now)
			)
		);

	if (pending.length === 0) return 0;

	let resolved = 0;
	for (const inv of pending) {
		try {
			// Create band member row (auto-accepted)
			await db
				.insert(bandMember)
				.values({
					bandId: inv.bandId,
					userId,
					role: inv.role,
					position: inv.position,
					status: 'active',
					invitedById: inv.invitedById
				});

			// Mark invite as accepted
			await db
				.update(platformInvite)
				.set({ status: 'accepted', acceptedAt: now })
				.where(eq(platformInvite.id, inv.id));

			resolved++;
		} catch (err: unknown) {
			// Unique constraint = user already in band, just mark accepted
			if (err instanceof Error && err.message.includes('UNIQUE')) {
				await db
					.update(platformInvite)
					.set({ status: 'accepted', acceptedAt: now })
					.where(eq(platformInvite.id, inv.id));
				resolved++;
			} else {
				captureException(err, { event: 'platform_invite.resolve', inviteId: inv.id });
			}
		}
	}

	return resolved;
}

export async function listForBand(bandId: string) {
	return db
		.select({
			id: platformInvite.id,
			email: platformInvite.email,
			role: platformInvite.role,
			position: platformInvite.position,
			status: platformInvite.status,
			expiresAt: platformInvite.expiresAt,
			createdAt: platformInvite.createdAt,
			invitedByName: user.name
		})
		.from(platformInvite)
		.leftJoin(user, eq(user.id, platformInvite.invitedById))
		.where(eq(platformInvite.bandId, bandId))
		.orderBy(desc(platformInvite.createdAt))
		.limit(20);
}

export async function revoke(inviteId: string): Promise<void> {
	const [row] = await db
		.select({ status: platformInvite.status })
		.from(platformInvite)
		.where(eq(platformInvite.id, inviteId))
		.limit(1);

	if (!row) throw new Error('Invite not found');
	if (row.status !== 'pending') throw new Error('Can only revoke pending invites');

	await db
		.update(platformInvite)
		.set({ status: 'revoked' })
		.where(eq(platformInvite.id, inviteId));
}

export async function getByToken(token: string): Promise<{
	bandName: string;
	inviterName: string;
	role: string;
	email: string;
} | null> {
	const now = new Date();

	const [row] = await db
		.select({
			email: platformInvite.email,
			role: platformInvite.role,
			status: platformInvite.status,
			expiresAt: platformInvite.expiresAt,
			bandName: band.name,
			inviterName: user.name
		})
		.from(platformInvite)
		.innerJoin(band, eq(band.id, platformInvite.bandId))
		.leftJoin(user, eq(user.id, platformInvite.invitedById))
		.where(eq(platformInvite.token, token))
		.limit(1);

	if (!row) return null;
	if (row.status !== 'pending') return null;
	if (row.expiresAt <= now) return null;

	return {
		bandName: row.bandName,
		inviterName: row.inviterName ?? 'Someone',
		role: row.role,
		email: row.email
	};
}
