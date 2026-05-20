import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { band, bandMember, bandGenre } from '$lib/server/db/schema/band';
import { user } from '$lib/server/db/schema/auth';
import { eq, and, sql, isNull, inArray } from 'drizzle-orm';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import type { ProfileLink, DirectoryContact } from '$lib/server/db/schema/auth';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const r2Available = isConfigured();

	const [row] = await db
		.select({
			id: band.id,
			name: band.name,
			slug: band.slug,
			bio: band.bio,
			tagline: band.tagline,
			avatarKey: band.avatarKey,
			createdAt: band.createdAt,
			lookingForMembers: band.lookingForMembers,
			directoryContact: band.directoryContact,
			links: band.links,
			memberCount: sql<number>`cast(count(case when ${bandMember.status} = 'active' then 1 end) as integer)`
		})
		.from(band)
		.leftJoin(bandMember, eq(bandMember.bandId, band.id))
		.where(and(
			eq(band.slug, params.slug),
			isNull(band.deletedAt),
			inArray(band.directoryVisibility, ['members', 'public'])
		))
		.groupBy(band.id);

	if (!row) throw error(404, 'Band not found');

	const genres = await db
		.select({ genre: bandGenre.genre })
		.from(bandGenre)
		.where(eq(bandGenre.bandId, row.id));

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

	return json({
		band: {
			id: row.id,
			name: row.name,
			slug: row.slug,
			bio: row.bio,
			tagline: row.tagline,
			avatarUrl: row.avatarKey && r2Available ? getPublicUrl(row.avatarKey) : null,
			memberCount: row.memberCount,
			createdAt: row.createdAt.toISOString(),
			genres: genres.map((r) => r.genre),
			lookingForMembers: row.lookingForMembers,
			directoryContact: row.directoryContact as DirectoryContact | null,
			links: (row.links as ProfileLink[] | null) ?? []
		},
		members: members.map((m) => ({
			id: m.id,
			role: m.role,
			position: m.position,
			userName: m.userName,
			userImage: m.userImage
		}))
	});
};
