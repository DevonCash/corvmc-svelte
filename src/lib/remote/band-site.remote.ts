import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query } from '$app/server';
import { requireFeature } from '$lib/server/feature-flags';
import { db } from '$lib/server/db';
import { band } from '$lib/server/db/schema/band';
import { bandMember } from '$lib/server/db/schema/band';
import { bandGenre } from '$lib/server/db/schema/band';
import { bandPageConfig, bandMedia } from '$lib/server/db/schema/band-page';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { listBandEventsUpcoming } from '$lib/server/event/event-service';
import { getPublicUrl, isConfigured, resolveImageUrl } from '$lib/server/storage';

// ---------------------------------------------------------------------------
// Band Site Data — loads everything needed to render a premium band page
// ---------------------------------------------------------------------------

export const getBandSiteData = query(z.string(), async (slug) => {
	await requireFeature('bandPremium');

	const [bandRow] = await db
		.select()
		.from(band)
		.where(and(eq(band.slug, slug), isNull(band.deletedAt)))
		.limit(1);

	if (!bandRow) throw error(404, 'Band not found');
	if (bandRow.tier !== 'premium') throw error(404, 'Page not found');

	const r2Available = isConfigured();

	// Fetch page config
	const [config] = await db
		.select()
		.from(bandPageConfig)
		.where(eq(bandPageConfig.bandId, bandRow.id))
		.limit(1);

	// Fetch members
	const members = await db
		.select({
			id: bandMember.id,
			userName: user.name,
			userImage: user.image,
			position: bandMember.position,
			role: bandMember.role
		})
		.from(bandMember)
		.innerJoin(user, eq(user.id, bandMember.userId))
		.where(and(eq(bandMember.bandId, bandRow.id), eq(bandMember.status, 'active')));

	// Fetch genres
	const genres = await db
		.select({ genre: bandGenre.genre })
		.from(bandGenre)
		.where(eq(bandGenre.bandId, bandRow.id));

	// Fetch upcoming events
	const events = await listBandEventsUpcoming(bandRow.id, 10);

	// Fetch media
	const media = await db
		.select()
		.from(bandMedia)
		.where(eq(bandMedia.bandId, bandRow.id))
		.orderBy(asc(bandMedia.sortOrder));

	return {
		band: {
			id: bandRow.id,
			name: bandRow.name,
			slug: bandRow.slug,
			bio: bandRow.bio,
			tagline: bandRow.tagline,
			avatarUrl: bandRow.avatarKey && r2Available ? getPublicUrl(bandRow.avatarKey) : null,
			links: bandRow.links as Array<{ label: string; url: string; embed?: boolean }> | null,
			genres: genres.map((g) => g.genre)
		},
		config: config
			? {
					theme: config.theme,
					customCss: config.customCss,
					blocks: config.blocks,
					epk: config.epk
				}
			: null,
		members: members.map((m) => ({
			id: m.id,
			name: m.userName,
			image: resolveImageUrl(m.userImage),
			position: m.position,
			role: m.role
		})),
		events: events.map((e) => ({
			id: e.id,
			title: e.title,
			description: e.description,
			startsAt: e.startsAt,
			endsAt: e.endsAt,
			location: e.location,
			externalTicketUrl: e.externalTicketUrl,
			posterUrl: e.posterKey && r2Available ? getPublicUrl(e.posterKey) : null
		})),
		media: media.map((m) => ({
			id: m.id,
			url: r2Available ? getPublicUrl(m.key) : null,
			type: m.type,
			caption: m.caption
		}))
	};
});
