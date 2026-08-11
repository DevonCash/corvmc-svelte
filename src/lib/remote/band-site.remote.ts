import { z } from 'zod';
import { error, invalid } from '@sveltejs/kit';
import { query, form, getRequestEvent } from '$app/server';
import { requireFeature } from '$lib/server/feature-flags';
import { verifyTurnstile } from '$lib/server/turnstile';
import { allowRateLimited } from '$lib/server/rate-limit';
import { dispatchEmailOnly } from '$lib/server/notification/dispatcher';
import type { NotificationEmailModel } from '$lib/types/notification-email';
import type { BandEpk } from '$lib/types/band-page';
import { db } from '$lib/server/db';
import { band } from '$lib/server/db/schema/band';
import { bandMember } from '$lib/server/db/schema/band';
import { bandGenre } from '$lib/server/db/schema/band';
import { bandPageConfig, bandMedia } from '$lib/server/db/schema/band-page';
import { user } from '$lib/server/db/schema/authentication';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { listBandEventsUpcoming } from '$lib/server/event/event-service';
import { resolveImageUrl } from '$lib/server/storage';
import { prepareBlocksForRender } from '$lib/server/band/band-site-blocks';
import type { Block } from '$lib/server/db/schema/band-page';

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
			avatarUrl: resolveImageUrl(bandRow.avatarKey),
			links: bandRow.links as Array<{ label: string; url: string; embed?: boolean }> | null,
			genres: genres.map((g) => g.genre),
			// Only a live custom domain counts — canonical URLs must not point at a
			// hostname that isn't serving yet.
			customDomain: bandRow.customDomainStatus === 'active' ? bandRow.customDomain : null
		},
		config: config
			? {
					theme: config.theme,
					customCss: config.customCss,
					blocks: prepareBlocksForRender(config.blocks as Block[]),
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
			posterUrl: resolveImageUrl(e.posterKey)
		})),
		media: media.map((m) => ({
			id: m.id,
			url: resolveImageUrl(m.key),
			type: m.type,
			caption: m.caption
		}))
	};
});

// ---------------------------------------------------------------------------
// Band Site Contact Form — public, delivers to the band's booking contact
// ---------------------------------------------------------------------------

const contactFormSchema = z.object({
	slug: z.string().min(1).max(200),
	name: z.string().trim().min(1).max(200),
	email: z.string().trim().email().max(254),
	message: z.string().trim().min(1).max(5000),
	turnstileToken: z.string()
});

export const submitBandContactForm = form(contactFormSchema, async (data, issue) => {
	await requireFeature('bandPremium');

	const ip = getRequestEvent().request.headers.get('CF-Connecting-IP');
	if (!(await verifyTurnstile(data.turnstileToken, ip))) {
		invalid(issue.turnstileToken('Verification failed. Please try again.'));
	}

	const [bandRow] = await db
		.select({ id: band.id, name: band.name, tier: band.tier, ownerId: band.ownerId })
		.from(band)
		.where(and(eq(band.slug, data.slug), isNull(band.deletedAt)))
		.limit(1);

	if (!bandRow || bandRow.tier !== 'premium') throw error(404, 'Band not found');

	// Soft throttle on top of Turnstile (KV is eventually consistent)
	if (!(await allowRateLimited(`band-contact:${bandRow.id}:${ip ?? 'unknown'}`, 5, 3600))) {
		throw error(429, 'Too many messages — please try again later');
	}

	// Deliver to the EPK booking contact, falling back to the band owner
	const [config] = await db
		.select({ epk: bandPageConfig.epk })
		.from(bandPageConfig)
		.where(eq(bandPageConfig.bandId, bandRow.id))
		.limit(1);
	const epk = config?.epk as BandEpk | null | undefined;

	let toEmail = epk?.bookingContact?.email;
	if (!toEmail) {
		const [owner] = await db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, bandRow.ownerId))
			.limit(1);
		toEmail = owner?.email;
	}
	if (!toEmail) throw error(500, 'This band has no contact email configured');

	const model: NotificationEmailModel = {
		subject: `New message from your band site — ${bandRow.name}`,
		heading: 'New band site message',
		preview_text: `${data.name}: ${data.message.slice(0, 100)}`,
		paragraphs: [
			{ text: `Someone sent a message through the contact form on your ${bandRow.name} site.` }
		],
		details: [
			{ label: 'From', value: data.name },
			{ label: 'Email', value: data.email }
		],
		// Raw — the dispatcher escapes it and preserves the line breaks.
		quote: data.message,
		footnote: 'Reply directly to the sender at the email address above.'
	};

	await dispatchEmailOnly({
		type: 'band_site_contact',
		toEmail,
		templateAlias: 'notification',
		model: model as unknown as Record<string, unknown>
	});

	return { success: true };
});
