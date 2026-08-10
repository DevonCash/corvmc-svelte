// ---------------------------------------------------------------------------
// Sample models for rendering the Postmark templates locally
// ---------------------------------------------------------------------------
// One fixture per template *shape*, not per notification type — the 18 types
// that render through `notification` only differ in copy, so covering the
// combinations of optional blocks is what actually exercises the markup.
//
// Used by scripts/email-preview.ts, scripts/email-validate.ts and render.spec.ts.
// ---------------------------------------------------------------------------

export interface Fixture {
	/** Filename-safe id, also the preview page's label */
	name: string;
	/** Postmark template alias */
	alias: string;
	model: Record<string, unknown>;
}

export const FIXTURES: Fixture[] = [
	{
		name: 'notification-minimal',
		alias: 'notification',
		// Heading only — proves every other block is genuinely optional and
		// leaves no empty card, button or callout behind.
		model: {
			subject: 'Your reservation was cancelled',
			preview_text: 'Thursday, December 5 · 7:00 – 9:00 PM',
			heading: 'Reservation Cancelled'
		}
	},
	{
		name: 'notification-full',
		alias: 'notification',
		model: {
			subject: 'Practice space reminder',
			preview_text: 'Thursday, December 5, 7:00 – 9:00 PM',
			heading: "You're Booked Thursday",
			greeting: 'Hi Maya,',
			paragraphs: [
				{ text: 'You have a reservation coming up at the Collective.' },
				{ text: 'The drum kit is set up — bring cymbals and sticks.' }
			],
			has_details: true,
			details: [
				{ label: 'Room', value: 'Main Practice' },
				{ label: 'Date', value: 'Thursday, December 5' },
				{ label: 'Time', value: '7:00 PM – 9:00 PM' },
				{ label: 'Band', value: 'Indigo Kiss' },
				{ label: 'Cost', value: 'Free · 2 of 10 free hours used this month' }
			],
			cta: { url: 'https://corvmc.org/member/reservations', label: 'Manage Reservation' },
			footnote: 'Need to cancel? Do it at least 24 hours ahead so someone else can use the room.'
		}
	},
	{
		name: 'notification-with-quote',
		alias: 'notification',
		// The staff-facing contact-form forward: user-generated text in a quote block.
		model: {
			subject: 'New contact form message',
			preview_text: 'Charlie Rivera: Booking question',
			heading: 'New Contact Form Message',
			paragraphs: [{ text: 'Someone sent a message through the contact form.' }],
			has_details: true,
			details: [
				{ label: 'From', value: 'Charlie Rivera' },
				{ label: 'Email', value: 'charlie@example.com' },
				{ label: 'Subject', value: 'Booking question' }
			],
			// Post-normalization shape: `quote` is escaped HTML, `quote_text` is the raw source.
			quote:
				'Hi there,<br /><br />I run a small folk trio &amp; we&#39;re hoping to book the space for a Saturday in March.<br /><br />Thanks!',
			quote_text:
				"Hi there,\n\nI run a small folk trio & we're hoping to book the space for a Saturday in March.\n\nThanks!",
			footnote: 'Reply directly to the sender at the email address above.'
		}
	},
	{
		name: 'notification-escaping',
		alias: 'notification',
		// Hostile input in every escaped field. Nothing here may render as markup.
		model: {
			subject: 'Escaping check',
			preview_text: '<script>alert(1)</script>',
			heading: '<script>alert("heading")</script>',
			greeting: 'Hi <b>bold</b>,',
			paragraphs: [{ text: '<script>alert(1)</script>' }, { text: 'Ampersand & "quotes"' }],
			has_details: true,
			details: [{ label: '<b>label</b>', value: '<img src=x onerror=alert(1)>' }],
			cta: { url: 'https://corvmc.org/member', label: '<b>Go</b>' },
			footnote: '<i>footnote</i>'
		}
	},
	{
		name: 'ticket-single',
		alias: 'ticket-confirmation',
		model: {
			attendeeName: 'Maya',
			eventTitle: 'Real Book Club',
			eventDate: 'Thursday, December 5',
			eventTime: '7:00 PM',
			quantity: 1,
			multiple: false,
			preview_text: 'Real Book Club · Thursday, December 5 at 7:00 PM',
			ticketCodes: [{ code: 'CMC-4K2P-9XQ1' }],
			// Buyer declined fee coverage — the fees row should be absent.
			orderId: '7F3A9C21',
			unitPrice: '$15.00',
			subtotal: '$15.00',
			feesCovered: false,
			fees: '$0.00',
			total: '$15.00',
			ticketsUrl: 'https://corvmc.org/events/evt-1/tickets/success?purchase_id=7f3a9c21'
		}
	},
	{
		name: 'ticket-multiple',
		alias: 'ticket-confirmation',
		model: {
			attendeeName: 'Maya',
			eventTitle: 'Winter Showcase',
			eventDate: 'Saturday, December 14',
			eventTime: '8:00 PM',
			quantity: 3,
			multiple: true,
			preview_text: 'Winter Showcase · Saturday, December 14 at 8:00 PM',
			ticketCodes: [
				{ code: 'CMC-4K2P-9XQ1' },
				{ code: 'CMC-7B3M-2LZ8' },
				{ code: 'CMC-1N9V-6RT4' }
			],
			// Buyer covered fees — exercises the {{#feesCovered}} row.
			orderId: 'B82D5E60',
			unitPrice: '$20.00',
			subtotal: '$60.00',
			feesCovered: true,
			fees: '$2.04',
			total: '$62.04',
			ticketsUrl: 'https://corvmc.org/events/evt-2/tickets/success?purchase_id=b82d5e60'
		}
	},
	{
		name: 'inbox-reply',
		alias: 'inbox-reply',
		model: {
			contactName: 'Charlie',
			subject: 'Re: Booking question',
			preview_text: 'Thanks for reaching out — March Saturdays are wide open right now.',
			// Staff-authored rich text, intentionally rendered raw.
			body: '<p>Thanks for reaching out — March Saturdays are wide open right now.</p><p>Give me two or three dates that work and I will hold one for you.</p>',
			staffName: 'Devon'
		}
	}
];
