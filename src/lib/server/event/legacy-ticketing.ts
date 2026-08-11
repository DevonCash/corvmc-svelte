/**
 * Maps the legacy (Laravel/Postgres) event ticketing fields onto the
 * corvmc-svelte event schema. Extracted from the migration script so the
 * mapping can be unit-tested independently of a live database connection.
 *
 * Legacy pricing model (confirmed against the production pg_dump):
 *   - `ticketing_enabled` is the authoritative on/off switch for platform
 *     ticketing. `ticket_price` is a separate display/door price and is NOT a
 *     reliable signal for whether tickets were actually sold.
 *   - Ticketed events without a per-event override used a hardcoded global
 *     price of $10 (1000¢), confirmed by `ticket_orders.unit_price`.
 *   - `ticket_price` and `ticket_price_override` are both expressed in dollars.
 */

const GLOBAL_TICKET_PRICE_CENTS = 1000;

export interface LegacyEventTicketing {
	ticketing_enabled: boolean | null;
	/** numeric(8,2) — dollars */
	ticket_price: string | number | null;
	/** dollars */
	ticket_price_override: string | number | null;
	ticket_quantity: number | null;
	ticket_url: string | null;
}

export interface MappedEventTicketing {
	ticketingEnabled: boolean;
	/** cents, or null when the event was free */
	ticketPrice: number | null;
	ticketQuantity: number | null;
	externalTicketUrl: string | null;
}

const toCents = (dollars: string | number): number => Math.round(Number(dollars) * 100);

export function mapLegacyEventTicketing(e: LegacyEventTicketing): MappedEventTicketing {
	const ticketingEnabled = !!e.ticketing_enabled;

	// The target schema now models a display price independently of platform
	// ticketing, matching the legacy pricing model — so an unticketed show with a
	// door price (or a `ticket_url` and a price) keeps that price instead of
	// importing as free.
	let ticketPrice: number | null = null;
	if (e.ticket_price_override != null) {
		ticketPrice = toCents(e.ticket_price_override);
	} else if (ticketingEnabled) {
		ticketPrice = GLOBAL_TICKET_PRICE_CENTS;
	} else if (e.ticket_price != null) {
		ticketPrice = toCents(e.ticket_price);
	}

	// A legacy $0 price means free, not "a zero-dollar ticket".
	if (ticketPrice !== null && ticketPrice <= 0) ticketPrice = null;

	return {
		ticketingEnabled,
		ticketPrice,
		ticketQuantity: e.ticket_quantity ?? null,
		externalTicketUrl: e.ticket_url ?? null
	};
}
