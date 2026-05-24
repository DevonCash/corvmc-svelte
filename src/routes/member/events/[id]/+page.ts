import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ISODateString } from '$lib/types/dates';

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
	const res = await fetch(`/api/events/${params.id}`);
	if (!res.ok) throw error(res.status, 'Event not found');
	return (await res.json()) as EventDetail;
};
