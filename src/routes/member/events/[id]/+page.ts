import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ISODateString } from '$lib/types/dates';
import type { MemberTicketsResponse } from '$lib/server/db/schema/api';

interface EventDetail {
	event: {
		id: string;
		title: string;
		description: string | null;
		startsAt: ISODateString;
		endsAt: ISODateString;
		doorsAt: ISODateString | null;
		tags: string | null;
		posterUrl: string | null;
		ticketingEnabled: boolean;
		ticketPrice: number | null;
		ticketQuantity: number | null;
	};
	remaining: number | null;
	isSustainingMember: boolean;
}

export const load: PageLoad = async ({ fetch, params }) => {
	const [eventRes, ticketsRes] = await Promise.all([
		fetch(`/api/events/${params.id}`),
		fetch('/api/me/tickets')
	]);

	if (!eventRes.ok) throw error(eventRes.status, 'Event not found');

	const eventData = (await eventRes.json()) as EventDetail;
	const ticketsData = ticketsRes.ok
		? ((await ticketsRes.json()) as MemberTicketsResponse)
		: { tickets: [] };

	const myTicket = ticketsData.tickets.find(
		(t) => t.eventId === params.id && t.status !== 'cancelled'
	);

	return { ...eventData, myTicket: myTicket ?? null };
};
