/**
 * Parser for the bulk backfill textarea: one past gig per line.
 *
 *   2024-03-14 | Bombs Away Cafe | w/ Paper Wolves, Sun Kissed | https://…
 *   date       | location        | title                       | ticket url
 *
 * Pure — no DB, no Svelte — so the band panel can preview a paste client-side
 * with the exact rules the server will apply.
 *
 * Two deliberate choices:
 *
 * - **No end time.** `event.endsAt` is nullable precisely so a backfill doesn't
 *   have to invent one. Start defaults to 20:00 only because `startsAt` is
 *   NOT NULL and orders the list.
 * - **Support acts stay unlinked.** A `w/` prefix becomes free-text credits.
 *   Matching them to accounts here would turn one paste into a hundred
 *   notifications, so linking stays a separate, deliberate act.
 */

export const GIG_IMPORT_MAX_LINES = 100;
export const GIG_IMPORT_MAX_LINE_LENGTH = 600;
/** Local wall-clock start assumed for an imported gig. */
export const GIG_IMPORT_DEFAULT_START = '20:00';

export interface ParsedGig {
	/** 1-based line in the pasted text, for error reporting. */
	line: number;
	date: string;
	title: string;
	location?: string;
	externalTicketUrl?: string;
	support: string[];
}

export interface GigImportError {
	line: number;
	message: string;
}

export interface GigImportResult {
	rows: ParsedGig[];
	errors: GigImportError[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Split on a pipe, or on tabs when the paste came from a spreadsheet. */
function splitFields(line: string): string[] {
	const parts = line.includes('|') ? line.split('|') : line.split('\t');
	return parts.map((p) => p.trim());
}

/** `w/ A, B` → ['A', 'B']. Anything else is a title, not a credit list. */
function extractSupport(title: string): { title: string; support: string[] } {
	const match = /^w\/\s*(.+)$/i.exec(title.trim());
	if (!match) return { title, support: [] };

	const support = match[1]
		.split(',')
		.map((n) => n.trim())
		.filter(Boolean);
	return { title: '', support };
}

/**
 * A YYYY-MM-DD that is a real calendar date. `new Date('2024-02-31')` happily
 * rolls into March, so round-trip it and compare.
 */
function parseCalendarDate(value: string): Date | null {
	if (!DATE_RE.test(value)) return null;
	const [y, m, d] = value.split('-').map(Number);
	const dt = new Date(Date.UTC(y, m - 1, d));
	if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
	return dt;
}

/**
 * @param text  the pasted block
 * @param today start-of-day used for the "must be in the past" check; injected
 *              so tests don't depend on the clock
 */
export function parseGigImport(text: string, today: Date = new Date()): GigImportResult {
	const rows: ParsedGig[] = [];
	const errors: GigImportError[] = [];

	const lines = text
		.split('\n')
		.map((l, i) => ({ raw: l.trim(), line: i + 1 }))
		.filter((l) => l.raw.length > 0);

	if (lines.length > GIG_IMPORT_MAX_LINES) {
		errors.push({
			line: GIG_IMPORT_MAX_LINES + 1,
			message: `Too many gigs — ${GIG_IMPORT_MAX_LINES} at a time, got ${lines.length}.`
		});
		return { rows, errors };
	}

	const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

	for (const { raw, line } of lines) {
		if (raw.length > GIG_IMPORT_MAX_LINE_LENGTH) {
			errors.push({ line, message: `Line is too long (max ${GIG_IMPORT_MAX_LINE_LENGTH}).` });
			continue;
		}

		const [date = '', location = '', rawTitle = '', url = ''] = splitFields(raw);

		const parsed = parseCalendarDate(date);
		if (!parsed) {
			errors.push({ line, message: `"${date}" isn't a date — use YYYY-MM-DD.` });
			continue;
		}
		if (parsed.getTime() >= todayUtc) {
			errors.push({ line, message: 'Date is in the future — import is for past gigs.' });
			continue;
		}

		const { title: strippedTitle, support } = extractSupport(rawTitle);
		const title = strippedTitle || (location ? `Live at ${location}` : 'Live show');

		rows.push({
			line,
			date,
			title,
			...(location ? { location } : {}),
			...(url ? { externalTicketUrl: url } : {}),
			support
		});
	}

	return { rows, errors };
}
