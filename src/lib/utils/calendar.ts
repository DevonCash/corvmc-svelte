// Add-to-calendar helpers — dependency-free. Build a Google Calendar "template" link and
// an inline .ics data URL from an event. Both emit UTC timestamps (YYYYMMDDTHHMMSSZ), the
// format Google and the iCalendar spec expect.

export interface CalendarEvent {
	title: string;
	description?: string | null;
	location?: string | null;
	startsAt: Date;
	endsAt: Date;
}

/** Format a Date as a UTC iCalendar timestamp, e.g. 20260620T200000Z. */
function toICSDate(d: Date): string {
	return d
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
}

/** Escape a value for inclusion in an ICS text field (RFC 5545). */
function escapeICS(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n');
}

/** Google Calendar "add event" URL with the event prefilled. */
export function googleCalendarUrl(evt: CalendarEvent): string {
	const params = new URLSearchParams({
		action: 'TEMPLATE',
		text: evt.title,
		dates: `${toICSDate(evt.startsAt)}/${toICSDate(evt.endsAt)}`
	});
	if (evt.description) params.set('details', evt.description);
	if (evt.location) params.set('location', evt.location);
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** A `data:text/calendar` URL holding a single-event .ics file, for download. */
export function icsDataUrl(evt: CalendarEvent): string {
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Corvallis Music Collective//Events//EN',
		'BEGIN:VEVENT',
		`DTSTART:${toICSDate(evt.startsAt)}`,
		`DTEND:${toICSDate(evt.endsAt)}`,
		`SUMMARY:${escapeICS(evt.title)}`
	];
	if (evt.description) lines.push(`DESCRIPTION:${escapeICS(evt.description)}`);
	if (evt.location) lines.push(`LOCATION:${escapeICS(evt.location)}`);
	lines.push('END:VEVENT', 'END:VCALENDAR');

	return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}
