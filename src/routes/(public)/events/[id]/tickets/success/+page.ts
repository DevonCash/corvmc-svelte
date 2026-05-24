import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ISODateString } from '$lib/server/db/schema/columns';

interface TicketSuccess {
	event: {
		id: string;
		title: string;
		startsAt: ISODateString;
		endsAt: ISODateString;
		doorsAt: ISODateString | null;
	};
	tickets: Array<{
		id: string;
		code: string;
		attendeeName: string;
		attendeeEmail: string;
		status: string;
	}>;
}

export const load: PageLoad = async ({ fetch, params, url }) => {
	const res = await fetch(`/api/events/${params.id}/tickets/success` + url.search);
	if (!res.ok) throw error(res.status, 'Purchase not found');
	return (await res.json()) as TicketSuccess;
};
