import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form } from '$app/server';
import { requireUser } from '$lib/server/authorization';
import { requireBandAdmin } from '$lib/server/band/band-context';
import { getBySlug } from '$lib/server/band/band-service';
import {
	createBandEvent,
	updateBandEvent,
	cancelBandEvent,
	listBandEvents,
	listBandEventsUpcoming,
	publish,
	unpublish,
	getById
} from '$lib/server/event/event-service';
import { buildDateInTz } from '$lib/server/reservation/timezone';
import { getPublicUrl, isConfigured } from '$lib/server/storage';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** All events for a band (all statuses) — for the band panel. */
export const getBandEvents = query(z.string(), async (slug) => {
	requireUser();
	const band = await getBySlug(slug);
	if (!band) throw error(404, 'Band not found');
	const events = await listBandEvents(band.id);
	const r2Available = isConfigured();

	return events.map((e) => ({
		id: e.id,
		title: e.title,
		startsAt: e.startsAt,
		endsAt: e.endsAt,
		status: e.status,
		location: e.location,
		posterUrl: e.posterKey && r2Available ? getPublicUrl(e.posterKey) : null
	}));
});

/** Published upcoming band events — for public display. */
export const getBandEventsPublic = query(z.string(), async (bandId) => {
	const events = await listBandEventsUpcoming(bandId);
	const r2Available = isConfigured();

	return events.map((e) => ({
		id: e.id,
		title: e.title,
		description: e.description,
		startsAt: e.startsAt,
		endsAt: e.endsAt,
		doorsAt: e.doorsAt,
		location: e.location,
		externalTicketUrl: e.externalTicketUrl,
		posterUrl: e.posterKey && r2Available ? getPublicUrl(e.posterKey) : null
	}));
});

/** Single band event detail — for editing. */
export const getBandEventDetail = query(
	z.object({ slug: z.string(), eventId: z.string() }),
	async ({ slug, eventId }) => {
		requireUser();
		const band = await getBySlug(slug);
		if (!band) throw error(404, 'Band not found');
		const evt = await getById(eventId);

		if (!evt) throw error(404, 'Event not found');
		if (evt.bandId !== band.id) throw error(404, 'Event not found');

		const r2Available = isConfigured();
		return {
			id: evt.id,
			title: evt.title,
			description: evt.description,
			startsAt: evt.startsAt,
			endsAt: evt.endsAt,
			doorsAt: evt.doorsAt,
			status: evt.status,
			location: evt.location,
			tags: evt.tags,
			externalTicketUrl: evt.externalTicketUrl,
			posterUrl: evt.posterKey && r2Available ? getPublicUrl(evt.posterKey) : null
		};
	}
);

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const createBandEventForm = form(
	z.object({
		slug: z.string().min(1),
		title: z.string().min(1, 'Title is required').max(200),
		description: z.string().max(5000).optional(),
		eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
		eventStartTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
		eventEndTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
		doorsTime: z.string().optional(),
		location: z.string().max(500).optional(),
		tags: z.string().max(500).optional(),
		externalTicketUrl: z.string().url().optional().or(z.literal(''))
	}),
	async (data, issue) => {
		const { user, band } = await requireBandAdmin();

		if (!data.title) {
			issue.title('Title is required');
		}

		const tz = 'America/Los_Angeles';
		const startsAt = buildDateInTz(data.eventDate, data.eventStartTime, tz);
		const endsAt = buildDateInTz(data.eventDate, data.eventEndTime, tz);
		const doorsAt = data.doorsTime ? buildDateInTz(data.eventDate, data.doorsTime, tz) : undefined;

		const evt = await createBandEvent({
			bandId: band.id,
			createdByUserId: user.id,
			title: data.title,
			description: data.description || undefined,
			startsAt,
			endsAt,
			doorsAt,
			location: data.location || undefined,
			tags: data.tags || undefined,
			externalTicketUrl: data.externalTicketUrl || undefined
		});

		return { eventId: evt.id };
	}
);

export const updateBandEventForm = form(
	z.object({
		slug: z.string().min(1),
		eventId: z.string().min(1),
		title: z.string().min(1).max(200).optional(),
		description: z.string().max(5000).optional(),
		eventDate: z.string().optional(),
		eventStartTime: z.string().optional(),
		eventEndTime: z.string().optional(),
		doorsTime: z.string().optional(),
		location: z.string().max(500).optional(),
		tags: z.string().max(500).optional(),
		externalTicketUrl: z.string().optional()
	}),
	async (data) => {
		const { band } = await requireBandAdmin();

		const tz = 'America/Los_Angeles';
		const params: Parameters<typeof updateBandEvent>[2] = {};

		if (data.title !== undefined) params.title = data.title;
		if (data.description !== undefined) params.description = data.description || null;
		if (data.location !== undefined) params.location = data.location || null;
		if (data.tags !== undefined) params.tags = data.tags || null;
		if (data.externalTicketUrl !== undefined) {
			params.externalTicketUrl = data.externalTicketUrl || null;
		}

		if (data.eventDate && data.eventStartTime && data.eventEndTime) {
			params.startsAt = buildDateInTz(data.eventDate, data.eventStartTime, tz);
			params.endsAt = buildDateInTz(data.eventDate, data.eventEndTime, tz);
		}

		if (data.doorsTime !== undefined && data.eventDate) {
			params.doorsAt = data.doorsTime
				? buildDateInTz(data.eventDate, data.doorsTime, tz)
				: null;
		}

		await updateBandEvent(data.eventId, band.id, params);
		return { success: true };
	}
);

export const publishBandEvent = form(
	z.object({ slug: z.string().min(1), eventId: z.string().min(1) }),
	async (data) => {
		const { band } = await requireBandAdmin();

		const evt = await getById(data.eventId);
		if (!evt || evt.bandId !== band.id) throw error(404, 'Event not found');

		await publish(data.eventId);
		return { success: true };
	}
);

export const unpublishBandEvent = form(
	z.object({ slug: z.string().min(1), eventId: z.string().min(1) }),
	async (data) => {
		const { band } = await requireBandAdmin();

		const evt = await getById(data.eventId);
		if (!evt || evt.bandId !== band.id) throw error(404, 'Event not found');

		await unpublish(data.eventId);
		return { success: true };
	}
);

export const cancelBandEventForm = form(
	z.object({ slug: z.string().min(1), eventId: z.string().min(1) }),
	async (data) => {
		const { band } = await requireBandAdmin();

		await cancelBandEvent(data.eventId, band.id);
		return { success: true };
	}
);
