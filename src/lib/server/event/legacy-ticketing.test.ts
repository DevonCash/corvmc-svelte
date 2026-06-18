import { describe, it, expect } from 'vitest';
import { mapLegacyEventTicketing } from './legacy-ticketing';

describe('mapLegacyEventTicketing', () => {
	// Regression: the old migration keyed ticketing off `ticket_price` and
	// ignored `ticketing_enabled`. Real legacy events 1–4 have a display
	// `ticket_price` of $10 but `ticketing_enabled = false` — they must NOT be
	// imported as ticketed.
	it('does not enable ticketing for a non-ticketed event that has a display price', () => {
		const result = mapLegacyEventTicketing({
			ticketing_enabled: false,
			ticket_price: '10.00',
			ticket_price_override: null,
			ticket_quantity: null,
			ticket_url: null
		});
		expect(result.ticketingEnabled).toBe(false);
		expect(result.ticketPrice).toBeNull();
	});

	// Regression: real legacy events 6/8/9 have `ticketing_enabled = true` but a
	// NULL `ticket_price`; their tickets sold at $10 (ticket_orders.unit_price =
	// 1000). The old logic dropped these to non-ticketed with no price.
	it('enables ticketing at the $10 global default when no price is set', () => {
		const result = mapLegacyEventTicketing({
			ticketing_enabled: true,
			ticket_price: null,
			ticket_price_override: null,
			ticket_quantity: null,
			ticket_url: null
		});
		expect(result.ticketingEnabled).toBe(true);
		expect(result.ticketPrice).toBe(1000);
	});

	// Override is stored in dollars: legacy events 14/26 use override = 5 → $5.
	it('applies a per-event override as dollars converted to cents', () => {
		const result = mapLegacyEventTicketing({
			ticketing_enabled: true,
			ticket_price: null,
			ticket_price_override: 5,
			ticket_quantity: null,
			ticket_url: null
		});
		expect(result.ticketingEnabled).toBe(true);
		expect(result.ticketPrice).toBe(500);
	});

	it('carries ticket quantity and external ticket url', () => {
		const result = mapLegacyEventTicketing({
			ticketing_enabled: true,
			ticket_price: null,
			ticket_price_override: null,
			ticket_quantity: 50,
			ticket_url: 'https://example.com/tickets'
		});
		expect(result.ticketQuantity).toBe(50);
		expect(result.externalTicketUrl).toBe('https://example.com/tickets');
	});
});
