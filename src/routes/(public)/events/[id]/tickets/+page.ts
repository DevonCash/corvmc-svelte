import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ISODateString } from '$lib/server/db/schema/columns';

interface TicketPage {
	event: {
		id: string;
		title: string;
		description: string | null;
		startsAt: ISODateString;
		endsAt: ISODateString;
		doorsAt: ISODateString | null;
		ticketPrice: number;
		ticketQuantity: number | null;
	};
	remaining: number | null;
	isSustainingMember: boolean;
	posterUrl: string | null;
	isAuthenticated: boolean;
}

export const load: PageLoad = async ({ fetch, params }) => {
	const res = await fetch(`/api/events/${params.id}/tickets`);
	if (!res.ok) throw error(res.status, 'Event not found');
	return (await res.json()) as TicketPage;
};
