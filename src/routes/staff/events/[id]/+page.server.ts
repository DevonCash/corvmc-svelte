import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getById } from '$lib/server/event/event-service';
import { getPublicUrl, isConfigured } from '$lib/server/storage';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params }) => {
	const evt = await getById(params.id);
	if (!evt) throw error(404, 'Event not found');

	// Load creator info
	const [creator] = await db
		.select({ name: user.name, email: user.email })
		.from(user)
		.where(eq(user.id, evt.createdByUserId))
		.limit(1);

	// Load linked reservation details if present
	let linkedReservation: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
	} | null = null;

	if (evt.reservationId) {
		const [res] = await db
			.select({
				id: reservation.id,
				status: reservation.status,
				startsAt: reservation.startsAt,
				endsAt: reservation.endsAt
			})
			.from(reservation)
			.where(eq(reservation.id, evt.reservationId))
			.limit(1);

		if (res) {
			linkedReservation = {
				id: res.id,
				status: res.status,
				startsAt: res.startsAt.toISOString(),
				endsAt: res.endsAt.toISOString()
			};
		}
	}

	// Build poster URL
	let posterUrl: string | null = null;
	if (evt.posterKey && isConfigured()) {
		posterUrl = getPublicUrl(evt.posterKey);
	}

	return {
		event: {
			...evt,
			startsAt: evt.startsAt.toISOString(),
			endsAt: evt.endsAt.toISOString(),
			doorsAt: evt.doorsAt?.toISOString() ?? null,
			publishedAt: evt.publishedAt?.toISOString() ?? null,
			createdAt: evt.createdAt.toISOString(),
			updatedAt: evt.updatedAt.toISOString()
		},
		posterUrl,
		creator,
		linkedReservation
	};
};
