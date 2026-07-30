import { z } from 'zod';

/** ?month= query param for the public calendar: "YYYY-MM". */
export const monthSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/** One event on the public calendar, shaped for the client. */
export interface CalendarEntry {
	id: string;
	title: string;
	startsAt: Date;
	endsAt: Date;
	source: string;
	location: string | null;
	bandName: string | null;
	bandSlug: string | null;
	posterUrl: string | null;
	ticketingEnabled: boolean;
	ticketPrice: number | null;
	externalTicketUrl: string | null;
	href: string;
}
