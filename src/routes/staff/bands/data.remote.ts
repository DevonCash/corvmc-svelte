import { z } from 'zod';
import { query, command } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { or, ilike, isNull } from 'drizzle-orm';
import { requireStaff } from '$lib/server/authorization';
import { create } from '$lib/server/band/band-service';

export const searchUsers = query(z.string(), async (q) => {
	await requireStaff();
	if (!q || q.length < 2) return [];

	const pattern = `%${q}%`;
	return db
		.select({ id: user.id, name: user.name, email: user.email })
		.from(user)
		.where(
			or(ilike(user.name, pattern), ilike(user.email, pattern))
		)
		.limit(20);
});

const createBandSchema = z.object({
	name: z.string().trim().min(1).max(255),
	bio: z.string().trim().max(2000).optional(),
	ownerId: z.string().min(1)
});

export const createBand = command(createBandSchema, async (data) => {
	await requireStaff();
	const band = await create(data.ownerId, { name: data.name, bio: data.bio });
	return { bandId: band.id };
});
