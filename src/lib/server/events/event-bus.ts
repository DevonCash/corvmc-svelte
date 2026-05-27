import Emittery from 'emittery';

// ---------------------------------------------------------------------------
// Domain event bus
// ---------------------------------------------------------------------------
// Single emittery instance shared across the application. All domain events
// are typed here — services emit events, and listeners (notifications,
// side effects) subscribe to them.
//
// Listeners are registered at startup in register-listeners.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

export interface CheckoutCompletedEvent {
	sessionId: string;
	metadata: Record<string, string>;
	/** Raw Stripe session for listeners that need it */
	stripeSession: import('stripe').default.Checkout.Session;
}

export interface ReservationConfirmedEvent {
	reservationId: string;
	userId: string;
	userName: string;
	userEmail: string;
	date: string;
	startTime: string;
	endTime: string;
	spaceName?: string;
}

export interface ReservationCancelledEvent {
	reservationId: string;
	userId: string;
	userName: string;
	userEmail: string;
	date: string;
	startTime: string;
	endTime: string;
	cancelledBy: 'member' | 'staff' | 'system';
}

export interface ReservationReminderDueEvent {
	reservationId: string;
	userId: string;
	userName: string;
	userEmail: string;
	date: string;
	startTime: string;
	endTime: string;
}

export interface ConfirmationReminderDueEvent {
	reservationId: string;
	userId: string;
	userName: string;
	userEmail: string;
	date: string;
	startTime: string;
	endTime: string;
}

export interface TicketPurchasedEvent {
	purchaseId: string;
	attendeeName: string;
	attendeeEmail: string;
	eventTitle: string;
	eventDate: string;
	eventTime: string;
	ticketCodes: string[];
	quantity: number;
}

export interface EventCancelledEvent {
	eventId: string;
	eventTitle: string;
	eventDate: string;
	/** Ticket holders to notify */
	ticketHolders: Array<{
		attendeeName: string;
		attendeeEmail: string;
		userId?: string;
	}>;
	refundNote: string;
}

export interface BandInvitationSentEvent {
	bandId: string;
	bandName: string;
	invitedUserId: string;
	invitedUserName: string;
	invitedUserEmail: string;
	invitedByName: string;
}

export interface BandInvitationAcceptedEvent {
	bandId: string;
	bandName: string;
	acceptedByUserId: string;
	acceptedByName: string;
	/** Band owner/admins to notify */
	bandAdmins: Array<{
		userId: string;
		userName: string;
		userEmail: string;
	}>;
}

export interface ContactFormSubmittedEvent {
	name: string;
	email: string;
	message: string;
}

export interface RecurringSkippedEvent {
	seriesId: string;
	userId: string;
	userName: string;
	userEmail: string;
	/** The date that was skipped (YYYY-MM-DD in America/Los_Angeles) */
	skippedDate: string;
	startTime: string;
	endTime: string;
	/** Why it was skipped */
	reason: string;
}

export interface EquipmentLoanRequestedEvent {
	loanId: string;
	userId: string;
	userName: string;
	userEmail: string;
	equipmentName: string | null;
	memberNotes: string | null;
	requestedPickupDate: string;
}

export interface EquipmentLoanScheduledEvent {
	loanId: string;
	userId: string;
	userName: string;
	userEmail: string;
	equipmentName: string;
	scheduledPickupDate: string;
}

export interface EquipmentCheckedOutEvent {
	loanId: string;
	userId: string;
	equipmentName: string;
}

export interface EquipmentReturnedEvent {
	loanId: string;
	userId: string;
	userName: string;
	equipmentName: string;
	totalChargeCents: number;
	creditsCents: number;
	cashCents: number;
	daysBorrowed: number;
}

export interface PlatformInviteCreatedEvent {
	email: string;
	token: string;
	bandId: string;
	bandName: string;
	role: string;
	invitedByName: string;
}

export interface RecurringWaitlistedEvent {
	seriesId: string;
	userId: string;
	userName: string;
	userEmail: string;
	date: string;
	startTime: string;
	endTime: string;
	reason: string;
}

export interface WaitlistSlotAvailableEvent {
	reservationId: string;
	userId: string;
	userName: string;
	userEmail: string;
	date: string;
	startTime: string;
	endTime: string;
	expiresAt: string;
	confirmUrl: string;
}

export interface WaitlistExpiredEvent {
	reservationId: string;
	userId: string;
	userName: string;
	userEmail: string;
	date: string;
	startTime: string;
	endTime: string;
}

export interface InboxMessageReceivedEvent {
	threadId: string;
	messageId: string;
	channel: string;
	contactName: string | null;
	preview: string;
}

export interface InboxMessageSentEvent {
	threadId: string;
	messageId: string;
	channel: string;
	sentByUserId: string;
}

// ---------------------------------------------------------------------------
// Event map — keys are event names, values are payload types
// ---------------------------------------------------------------------------

export type DomainEvents = {
	'checkout.completed': CheckoutCompletedEvent;
	'reservation.confirmed': ReservationConfirmedEvent;
	'reservation.cancelled': ReservationCancelledEvent;
	'reservation.reminder_due': ReservationReminderDueEvent;
	'reservation.confirmation_reminder_due': ConfirmationReminderDueEvent;
	'ticket.purchased': TicketPurchasedEvent;
	'event.cancelled': EventCancelledEvent;
	'band.invitation_sent': BandInvitationSentEvent;
	'band.invitation_accepted': BandInvitationAcceptedEvent;
	'contact.form_submitted': ContactFormSubmittedEvent;
	'reservation.recurring_skipped': RecurringSkippedEvent;
	'reservation.recurring_waitlisted': RecurringWaitlistedEvent;
	'reservation.waitlist_slot_available': WaitlistSlotAvailableEvent;
	'reservation.waitlist_expired': WaitlistExpiredEvent;
	'equipment.loan_requested': EquipmentLoanRequestedEvent;
	'equipment.loan_scheduled': EquipmentLoanScheduledEvent;
	'equipment.checked_out': EquipmentCheckedOutEvent;
	'equipment.returned': EquipmentReturnedEvent;
	'platform_invite.created': PlatformInviteCreatedEvent;
	'inbox.message_received': InboxMessageReceivedEvent;
	'inbox.message_sent': InboxMessageSentEvent;
};

// ---------------------------------------------------------------------------
// Singleton emitter
// ---------------------------------------------------------------------------

export const domainEvents = new Emittery<DomainEvents>();
