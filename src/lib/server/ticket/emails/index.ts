// ---------------------------------------------------------------------------
// Ticket email stubs (DEPRECATED)
// ---------------------------------------------------------------------------
// These stubs are superseded by the notification system. Ticket emails are
// now handled by domain events (ticket.purchased, event.cancelled) routed
// through the notification dispatcher. See:
//   - src/lib/server/events/event-bus.ts (event definitions)
//   - src/lib/server/notification/notification-listeners.ts (handlers)
//   - postmark/templates/ (Postmark-hosted email templates, pushed via pnpm email:push)
//
// These stubs remain for reference only and can be deleted.
// ---------------------------------------------------------------------------

export interface TicketConfirmationParams {
	attendeeName: string;
	attendeeEmail: string;
	eventTitle: string;
	eventDate: string;
	eventTime: string;
	ticketCodes: string[];
	quantity: number;
}

/**
 * Send ticket purchase confirmation with ticket codes.
 * Triggered after successful checkout (webhook fulfillment).
 */
export async function sendTicketConfirmation(params: TicketConfirmationParams): Promise<void> {
	console.log('[email-stub] ticket-confirmation', {
		to: params.attendeeEmail,
		event: params.eventTitle,
		codes: params.ticketCodes
	});
}

export interface EventCancellationParams {
	attendeeName: string;
	attendeeEmail: string;
	eventTitle: string;
	eventDate: string;
	refundNote: string;
}

/**
 * Notify ticket holder that the event has been cancelled.
 * Triggered when staff cancels an event with sold tickets.
 */
export async function sendEventCancellation(params: EventCancellationParams): Promise<void> {
	console.log('[email-stub] event-cancellation', {
		to: params.attendeeEmail,
		event: params.eventTitle
	});
}

export interface CheckInReminderParams {
	attendeeName: string;
	attendeeEmail: string;
	eventTitle: string;
	eventDate: string;
	eventTime: string;
	ticketCode: string;
}

/**
 * Remind ticket holder about upcoming event with their ticket code.
 * Triggered by a scheduled job before the event (e.g., 24 hours prior).
 */
export async function sendCheckInReminder(params: CheckInReminderParams): Promise<void> {
	console.log('[email-stub] check-in-reminder', {
		to: params.attendeeEmail,
		event: params.eventTitle,
		code: params.ticketCode
	});
}
