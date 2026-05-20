import { db } from '$lib/server/db';
import { subscriber } from '$lib/server/db/schema/marketing';
import { eq, sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Subscriber service
// ---------------------------------------------------------------------------
// Subscribers are email addresses that may or may not be linked to a user
// account. The find-or-create pattern ensures we never duplicate by email.
// ---------------------------------------------------------------------------

/**
 * Find an existing subscriber by email, or create one if it doesn't exist.
 * If the subscriber exists and a name is provided, updates the name.
 */
export async function findOrCreateByEmail(
	email: string,
	name?: string
): Promise<{ id: string; email: string; name: string | null; userId: string | null }> {
	const normalized = email.toLowerCase().trim();

	const [row] = await db
		.insert(subscriber)
		.values({ email: normalized, name: name || null })
		.onConflictDoUpdate({
			target: subscriber.email,
			set: name
				? { name: sql`coalesce(${name}, ${subscriber.name})` }
				: { email: sql`${subscriber.email}` }
		})
		.returning({
			id: subscriber.id,
			email: subscriber.email,
			name: subscriber.name,
			userId: subscriber.userId
		});

	return row;
}

/**
 * Link a subscriber record to a user account.
 */
export async function linkToUser(subscriberId: string, userId: string): Promise<void> {
	await db
		.update(subscriber)
		.set({ userId })
		.where(eq(subscriber.id, subscriberId));
}

/**
 * Find a subscriber by email.
 */
export async function findByEmail(email: string) {
	const normalized = email.toLowerCase().trim();
	const [row] = await db
		.select()
		.from(subscriber)
		.where(eq(subscriber.email, normalized))
		.limit(1);
	return row ?? null;
}

/**
 * Find a subscriber by linked user account.
 */
export async function findByUserId(userId: string) {
	const [row] = await db
		.select()
		.from(subscriber)
		.where(eq(subscriber.userId, userId))
		.limit(1);
	return row ?? null;
}

/**
 * Find or create a subscriber for a user account. Uses the user's email
 * to look up / create the subscriber and links it to the userId.
 */
export async function findOrCreateForUser(
	userId: string,
	userEmail: string,
	userName?: string
): Promise<{ id: string; email: string; name: string | null; userId: string | null }> {
	const sub = await findOrCreateByEmail(userEmail, userName);
	if (!sub.userId) {
		await linkToUser(sub.id, userId);
		return { ...sub, userId };
	}
	return sub;
}
