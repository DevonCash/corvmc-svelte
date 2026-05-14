import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { band, bandMember } from '$lib/server/db/schema/band';
import { isNull, eq, asc, sql } from 'drizzle-orm';
import { getPublicUrl, isConfigured } from '$lib/server/storage';

export const load: PageServerLoad = async () => {
	const r2Available = isConfigured();

	const [members, bands] = await Promise.all([
		db
			.select({
				id: user.id,
				name: user.name,
				pronouns: user.pronouns,
				image: user.image
			})
			.from(user)
			.where(isNull(user.deletedAt))
			.orderBy(asc(user.name)),

		db
			.select({
				id: band.id,
				name: band.name,
				slug: band.slug,
				bio: band.bio,
				avatarKey: band.avatarKey,
				memberCount: sql<number>`count(case when ${bandMember.status} = 'active' then 1 end)::int`
			})
			.from(band)
			.leftJoin(bandMember, eq(bandMember.bandId, band.id))
			.groupBy(band.id)
			.orderBy(asc(band.name))
	]);

	return {
		members: members.map((m) => ({
			id: m.id,
			name: m.name,
			pronouns: m.pronouns,
			image: m.image
		})),
		bands: bands.map((b) => ({
			id: b.id,
			name: b.name,
			slug: b.slug,
			bio: b.bio ? (b.bio.length > 120 ? b.bio.slice(0, 120).trimEnd() + '…' : b.bio) : null,
			avatarUrl: b.avatarKey && r2Available ? getPublicUrl(b.avatarKey) : null,
			memberCount: b.memberCount
		}))
	};
};
