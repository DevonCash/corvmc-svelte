import { stripe } from '$lib/server/stripe';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';

export async function ensureStripeCustomer(
	userId: string,
	email: string,
	name?: string
): Promise<string> {
	const [row] = await db
		.select({ stripeId: user.stripeId })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (row?.stripeId) return row.stripeId;

	const customer = await stripe.customers.create({
		email,
		name,
		metadata: { userId }
	});

	await db.update(user).set({ stripeId: customer.id }).where(eq(user.id, userId));

	return customer.id;
}
