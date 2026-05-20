import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { EventsResponse, MemberTicketsResponse } from '$lib/server/db/schema/api';

export const load: PageLoad = async ({ fetch }) => {
	const [eventsRes, ticketsRes] = await Promise.all([
		fetch('/api/events'),
		fetch('/api/me/tickets')
	]);
	if (ticketsRes.status === 401) redirect(302, '/login');
	const events = (await eventsRes.json()) as EventsResponse;
	const tickets = (await ticketsRes.json()) as MemberTicketsResponse;
	return { events: events.events, tickets: tickets.tickets };
};
