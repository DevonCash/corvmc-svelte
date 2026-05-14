import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { band, bandMember } from '$lib/server/db/schema/band';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, sql } from 'drizzle-orm';
import { getPublicUrl, isConfigured } from '$lib/server/storage';

export const load: PageServerLoad = async ({ params }) => {
	const r2Available = isConfigured();

	// Load band with active member count
	const [row] = await db
		.select({
			id: band.id,
			name: band.name,
			slug: band.slug,
			bio: band.bio,
			avatarKey: band.avatarKey,
			createdAt: band.createdAt,
			memberCount: sql<number>`count(case when ${bandMember.status} = 'active' then 1 end)::int`
		})
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(eq(band.slug, params.slug))
		.groupBy(band.id);

	if (!row) throw error(404, 'Band not found');

	// Load active members with names and positions
	const members = await db
		.select({
			id: bandMember.id,
			userId: bandMember.userId,
			role: bandMember.role,
			position: bandMember.position,
			userName: user.name,
			userImage: user.image
		})
		.from(bandMember)
		.innerJoin(user, eq(user.id, bandMember.userId))
		.where(
			and(
				eq(bandMember.bandId, row.id),
				eq(bandMember.status, 'active')
			)
		)
		.orderBy(
			sql`case ${bandMember.role} when 'owner' then 0 when 'admin' then 1 else 2 end`,
			user.name
		);

	return {
		band: {
			id: row.id,
			name: row.name,
			slug: row.slug,
			bio: row.bio,
			avatarUrl: row.avatarKey && r2Available ? getPublicUrl(row.avatarKey) : null,
			memberCount: row.memberCount,
			createdAt: row.createdAt.toISOString()
		},
		members: members.map((m) => ({
			id: m.id,
			role: m.role,
			position: m.position,
			userName: m.userName,
			userImage: m.userImage
		}))
	};
};
