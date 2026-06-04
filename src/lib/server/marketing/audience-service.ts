import { db } from '$lib/server/db';
import { audience, audienceMember, subscriber } from '$lib/server/db/schema/marketing';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, sql, isNull, isNotNull } from 'drizzle-orm';
import { findOrCreateByEmail } from './subscriber-service';

// ---------------------------------------------------------------------------
// Audience service
// ---------------------------------------------------------------------------
// CRUD for audiences and subscriber management within audiences.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Audience CRUD
// ---------------------------------------------------------------------------

export async function createAudience(data: {
	name: string;
	slug: string;
	description?: string;
	allowOptIn?: boolean;
}) {
	if (data.name.length > 255) throw new Error('Audience name too long (max 255)');
	if (data.slug.length > 100) throw new Error('Audience slug too long (max 100)');
	if (!/^[a-z0-9-]+$/.test(data.slug))
		throw new Error('Slug must be lowercase alphanumeric with hyphens');

	const [created] = await db
		.insert(audience)
		.values({
			name: data.name,
			slug: data.slug,
			description: data.description || null,
			allowOptIn: data.allowOptIn ?? false
		})
		.returning();

	return created;
}

export async function updateAudience(
	id: string,
	data: { name?: string; slug?: string; description?: string; allowOptIn?: boolean }
) {
	if (data.name !== undefined && data.name.length > 255)
		throw new Error('Audience name too long (max 255)');
	if (data.slug !== undefined && data.slug.length > 100)
		throw new Error('Audience slug too long (max 100)');
	if (data.slug !== undefined && !/^[a-z0-9-]+$/.test(data.slug))
		throw new Error('Slug must be lowercase alphanumeric with hyphens');

	const [updated] = await db.update(audience).set(data).where(eq(audience.id, id)).returning();

	return updated ?? null;
}

export async function deleteAudience(id: string) {
	await db.delete(audience).where(eq(audience.id, id));
}

export async function listAudiences() {
	return db
		.select({
			id: audience.id,
			name: audience.name,
			slug: audience.slug,
			description: audience.description,
			allowOptIn: audience.allowOptIn,
			createdAt: audience.createdAt,
			subscriberCount: sql<number>`cast(count(case when ${audienceMember.unsubscribedAt} is null then 1 end) as integer)`
		})
		.from(audience)
		.leftJoin(audienceMember, eq(audienceMember.audienceId, audience.id))
		.groupBy(audience.id)
		.orderBy(audience.name);
}

export async function getAudience(id: string) {
	const [row] = await db
		.select({
			id: audience.id,
			name: audience.name,
			slug: audience.slug,
			description: audience.description,
			allowOptIn: audience.allowOptIn,
			createdAt: audience.createdAt,
			subscriberCount: sql<number>`cast(count(case when ${audienceMember.unsubscribedAt} is null then 1 end) as integer)`
		})
		.from(audience)
		.leftJoin(audienceMember, eq(audienceMember.audienceId, audience.id))
		.where(eq(audience.id, id))
		.groupBy(audience.id);

	return row ?? null;
}

export async function getAudienceBySlug(slug: string) {
	const [row] = await db
		.select({
			id: audience.id,
			name: audience.name,
			slug: audience.slug,
			description: audience.description,
			allowOptIn: audience.allowOptIn,
			createdAt: audience.createdAt
		})
		.from(audience)
		.where(eq(audience.slug, slug))
		.limit(1);

	return row ?? null;
}

// ---------------------------------------------------------------------------
// Subscriber management within an audience
// ---------------------------------------------------------------------------

/**
 * Add a subscriber to an audience. If already a member but unsubscribed,
 * clears the unsubscribedAt (re-subscribe). If already active, no-op.
 */
export async function addSubscriber(audienceId: string, subscriberId: string) {
	const [existing] = await db
		.select({ id: audienceMember.id, unsubscribedAt: audienceMember.unsubscribedAt })
		.from(audienceMember)
		.where(
			and(eq(audienceMember.audienceId, audienceId), eq(audienceMember.subscriberId, subscriberId))
		)
		.limit(1);

	if (existing) {
		if (existing.unsubscribedAt) {
			// Re-subscribe
			await db
				.update(audienceMember)
				.set({ unsubscribedAt: null })
				.where(eq(audienceMember.id, existing.id));
		}
		// Already active — no-op
		return;
	}

	await db.insert(audienceMember).values({ audienceId, subscriberId });
}

/**
 * Hard-remove a subscriber from an audience (staff action, not unsubscribe).
 */
export async function removeSubscriber(audienceId: string, subscriberId: string) {
	await db
		.delete(audienceMember)
		.where(
			and(eq(audienceMember.audienceId, audienceId), eq(audienceMember.subscriberId, subscriberId))
		);
}

/**
 * Unsubscribe: set unsubscribedAt on the audience_member row.
 */
export async function unsubscribe(subscriberId: string, audienceId: string) {
	await db
		.update(audienceMember)
		.set({ unsubscribedAt: new Date() })
		.where(
			and(
				eq(audienceMember.subscriberId, subscriberId),
				eq(audienceMember.audienceId, audienceId),
				isNull(audienceMember.unsubscribedAt)
			)
		);
}

/**
 * Bulk-add all active user accounts as subscribers to an audience.
 * Creates subscriber records as needed. Returns count of new additions.
 */
export async function bulkAddMembers(audienceId: string): Promise<number> {
	const users = await db
		.select({ id: user.id, email: user.email, name: user.name })
		.from(user)
		.where(isNull(user.deletedAt));

	let added = 0;
	for (const u of users) {
		const sub = await findOrCreateByEmail(u.email, u.name);
		// Link to user if not already linked
		if (!sub.userId) {
			const { linkToUser } = await import('./subscriber-service');
			await linkToUser(sub.id, u.id);
		}

		// Check if already a member
		const [existing] = await db
			.select({ id: audienceMember.id, unsubscribedAt: audienceMember.unsubscribedAt })
			.from(audienceMember)
			.where(
				and(eq(audienceMember.audienceId, audienceId), eq(audienceMember.subscriberId, sub.id))
			)
			.limit(1);

		if (!existing) {
			await db.insert(audienceMember).values({ audienceId, subscriberId: sub.id });
			added++;
		} else if (existing.unsubscribedAt) {
			await db
				.update(audienceMember)
				.set({ unsubscribedAt: null })
				.where(eq(audienceMember.id, existing.id));
			added++;
		}
	}

	return added;
}

/**
 * List all subscribers in an audience (including unsubscribed, for staff view).
 */
export async function listSubscribers(audienceId: string) {
	return db
		.select({
			id: audienceMember.id,
			subscriberId: subscriber.id,
			email: subscriber.email,
			name: subscriber.name,
			userId: subscriber.userId,
			unsubscribedAt: audienceMember.unsubscribedAt,
			createdAt: audienceMember.createdAt
		})
		.from(audienceMember)
		.innerJoin(subscriber, eq(subscriber.id, audienceMember.subscriberId))
		.where(eq(audienceMember.audienceId, audienceId))
		.orderBy(audienceMember.createdAt);
}

// ---------------------------------------------------------------------------
// Member-facing queries
// ---------------------------------------------------------------------------

/**
 * Get all audiences a user is actively subscribed to (for member account page).
 */
export async function getSubscriptionsForUser(userId: string) {
	return db
		.select({
			audienceId: audience.id,
			audienceName: audience.name,
			audienceDescription: audience.description,
			subscribedAt: audienceMember.createdAt
		})
		.from(audienceMember)
		.innerJoin(subscriber, eq(subscriber.id, audienceMember.subscriberId))
		.innerJoin(audience, eq(audience.id, audienceMember.audienceId))
		.where(and(eq(subscriber.userId, userId), isNull(audienceMember.unsubscribedAt)))
		.orderBy(audience.name);
}

/**
 * Get opt-in audiences the user is NOT currently subscribed to.
 */
export async function getOptInAudiencesForUser(userId: string) {
	return db
		.select({
			id: audience.id,
			name: audience.name,
			slug: audience.slug,
			description: audience.description
		})
		.from(audience)
		.where(
			and(
				eq(audience.allowOptIn, true),
				sql`NOT EXISTS (
					SELECT 1 FROM ${audienceMember}
					INNER JOIN ${subscriber} ON ${subscriber.id} = ${audienceMember.subscriberId}
					WHERE ${audienceMember.audienceId} = ${audience.id}
					AND ${subscriber.userId} = ${userId}
					AND ${audienceMember.unsubscribedAt} IS NULL
				)`
			)
		)
		.orderBy(audience.name);
}

/**
 * Get all audiences with allowOptIn = true (for public subscribe page).
 */
export async function getOptInAudiences() {
	return db
		.select({
			id: audience.id,
			name: audience.name,
			slug: audience.slug,
			description: audience.description
		})
		.from(audience)
		.where(eq(audience.allowOptIn, true))
		.orderBy(audience.name);
}
