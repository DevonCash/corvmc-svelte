import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDispatch = vi.fn().mockResolvedValue(undefined);
const mockDispatchEmailOnly = vi.fn().mockResolvedValue(undefined);

vi.mock('./dispatcher', () => ({
	dispatch: (...args: unknown[]) => mockDispatch(...args),
	dispatchEmailOnly: (...args: unknown[]) => mockDispatchEmailOnly(...args)
}));

const mockTemplates: Record<string, Mock> = {
	ticketConfirmation: vi.fn().mockReturnValue('<html>ticket</html>'),
	eventCancellation: vi.fn().mockReturnValue('<html>cancelled</html>'),
	reservationReminder: vi.fn().mockReturnValue('<html>reminder</html>'),
	confirmationReminder: vi.fn().mockReturnValue('<html>confirm</html>'),
	bandInvitation: vi.fn().mockReturnValue('<html>invite</html>'),
	bandInvitationAccepted: vi.fn().mockReturnValue('<html>accepted</html>'),
	platformInvitation: vi.fn().mockReturnValue('<html>platform</html>'),
	recurringSkipped: vi.fn().mockReturnValue('<html>skipped</html>'),
	loanScheduledConfirmation: vi.fn().mockReturnValue('<html>loan</html>'),
	loanRequestedStaffNotification: vi.fn().mockReturnValue('<html>loan-staff</html>'),
	contactFormForward: vi.fn().mockReturnValue('<html>contact</html>')
};

vi.mock('./email', () => ({ templates: mockTemplates }));

vi.mock('$env/dynamic/private', () => ({
	env: { PUBLIC_SITE_URL: 'https://test.corvmc.com', STAFF_CONTACT_EMAIL: 'staff@test.com' }
}));

// Capture event handlers
const handlers: Record<string, Function> = {};
vi.mock('$lib/server/events/event-bus', () => ({
	domainEvents: {
		on: (event: string, handler: Function) => { handlers[event] = handler; },
		emit: vi.fn()
	}
}));

const { registerAllNotificationListeners } = await import('./notification-listeners');

// Emittery wraps emitted payloads as `{ name, data }` before invoking
// listeners. Calling handlers directly in tests must mirror that envelope.
function emit(event: string, payload: unknown): Promise<unknown> {
	return handlers[event]({ data: payload });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

describe('registerAllNotificationListeners', () => {
	it('registers handlers for all expected events', () => {
		registerAllNotificationListeners();

		expect(handlers['ticket.purchased']).toBeDefined();
		expect(handlers['event.cancelled']).toBeDefined();
		expect(handlers['reservation.reminder_due']).toBeDefined();
		expect(handlers['reservation.confirmation_reminder_due']).toBeDefined();
		expect(handlers['band.invitation_sent']).toBeDefined();
		expect(handlers['band.invitation_accepted']).toBeDefined();
		expect(handlers['platform_invite.created']).toBeDefined();
		expect(handlers['reservation.recurring_skipped']).toBeDefined();
		expect(handlers['equipment.loan_scheduled']).toBeDefined();
		expect(handlers['equipment.loan_requested']).toBeDefined();
		expect(handlers['contact.form_submitted']).toBeDefined();
	});
});

describe('ticket.purchased handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('sends email-only notification to ticket buyer', async () => {
		await emit('ticket.purchased', {
			attendeeName: 'Alice',
			attendeeEmail: 'alice@test.com',
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			eventTime: '8:00 PM',
			ticketCodes: ['ABC123'],
			quantity: 1
		});

		expect(mockTemplates.ticketConfirmation).toHaveBeenCalled();
		expect(mockDispatchEmailOnly).toHaveBeenCalledWith(expect.objectContaining({
			type: 'ticket_confirmation',
			toEmail: 'alice@test.com',
			subject: 'Your tickets for Jazz Night'
		}));
	});
});

describe('reservation.reminder_due handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('dispatches in-app + email notification', async () => {
		await emit('reservation.reminder_due', {
			userId: 'user-1',
			userEmail: 'user@test.com',
			userName: 'Bob',
			date: 'May 21',
			startTime: '10:00 AM',
			endTime: '11:00 AM'
		});

		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'reservation_reminder',
			userId: 'user-1',
			userEmail: 'user@test.com',
			title: 'Upcoming reservation reminder'
		}));
	});
});

describe('platform_invite.created handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('sends email with signup URL containing invite token', async () => {
		await emit('platform_invite.created', {
			email: 'new@test.com',
			token: 'tok-xyz',
			bandId: 'band-1',
			bandName: 'The Strokes',
			role: 'member',
			invitedByName: 'Alice'
		});

		expect(mockTemplates.platformInvitation).toHaveBeenCalledWith(expect.objectContaining({
			signupUrl: 'https://test.corvmc.com/login?invite=tok-xyz',
			bandName: 'The Strokes'
		}));
		expect(mockDispatchEmailOnly).toHaveBeenCalledWith(expect.objectContaining({
			type: 'platform_invitation',
			toEmail: 'new@test.com'
		}));
	});
});

describe('band.invitation_sent handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('dispatches notification to invited user', async () => {
		await emit('band.invitation_sent', {
			invitedUserId: 'user-2',
			invitedUserEmail: 'invited@test.com',
			invitedUserName: 'Bob',
			bandName: 'The Strokes',
			invitedByName: 'Alice'
		});

		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'band_invitation',
			userId: 'user-2',
			title: "You've been invited to The Strokes"
		}));
	});
});

describe('event.cancelled handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('dispatches to ticket holders with userId via dispatch', async () => {
		await emit('event.cancelled', {
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			refundNote: 'Full refund within 5 days',
			ticketHolders: [
				{ attendeeName: 'Alice', attendeeEmail: 'alice@test.com', userId: 'user-1' }
			]
		});

		expect(mockTemplates.eventCancellation).toHaveBeenCalledWith(expect.objectContaining({
			attendeeName: 'Alice',
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			refundNote: 'Full refund within 5 days'
		}));
		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'event_cancellation',
			userId: 'user-1',
			userEmail: 'alice@test.com',
			title: 'Jazz Night has been cancelled',
			href: '/member/tickets'
		}));
	});

	it('dispatches to ticket holders without userId via dispatchEmailOnly', async () => {
		await emit('event.cancelled', {
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			refundNote: 'Full refund within 5 days',
			ticketHolders: [
				{ attendeeName: 'Bob', attendeeEmail: 'bob@test.com', userId: null }
			]
		});

		expect(mockDispatchEmailOnly).toHaveBeenCalledWith(expect.objectContaining({
			type: 'event_cancellation',
			toEmail: 'bob@test.com',
			subject: 'Jazz Night has been cancelled'
		}));
	});

	it('continues notifying remaining holders if one fails', async () => {
		mockDispatch.mockRejectedValueOnce(new Error('fail'));

		await emit('event.cancelled', {
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			refundNote: 'Refund pending',
			ticketHolders: [
				{ attendeeName: 'Alice', attendeeEmail: 'alice@test.com', userId: 'user-1' },
				{ attendeeName: 'Bob', attendeeEmail: 'bob@test.com', userId: 'user-2' }
			]
		});

		expect(mockDispatch).toHaveBeenCalledTimes(2);
	});
});

describe('reservation.confirmation_reminder_due handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('dispatches confirmation reminder notification', async () => {
		await emit('reservation.confirmation_reminder_due', {
			userId: 'user-1',
			userEmail: 'user@test.com',
			userName: 'Bob',
			date: 'May 22',
			startTime: '2:00 PM',
			endTime: '3:00 PM'
		});

		expect(mockTemplates.confirmationReminder).toHaveBeenCalledWith(expect.objectContaining({
			userName: 'Bob',
			date: 'May 22',
			startTime: '2:00 PM',
			endTime: '3:00 PM',
			siteUrl: 'https://test.corvmc.com'
		}));
		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'confirmation_reminder',
			userId: 'user-1',
			userEmail: 'user@test.com',
			title: 'Please confirm your reservation',
			href: '/member/reservations',
			emailSubject: 'Please confirm your reservation: May 22'
		}));
	});
});

describe('band.invitation_accepted handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('dispatches notification to each band admin', async () => {
		await emit('band.invitation_accepted', {
			acceptedByName: 'Charlie',
			bandName: 'The Strokes',
			bandId: 'band-1',
			bandAdmins: [
				{ userId: 'admin-1', userEmail: 'admin1@test.com', userName: 'Alice' },
				{ userId: 'admin-2', userEmail: 'admin2@test.com', userName: 'Dave' }
			]
		});

		expect(mockTemplates.bandInvitationAccepted).toHaveBeenCalledTimes(2);
		expect(mockTemplates.bandInvitationAccepted).toHaveBeenCalledWith(expect.objectContaining({
			adminName: 'Alice',
			acceptedByName: 'Charlie',
			bandName: 'The Strokes',
			bandId: 'band-1'
		}));
		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'band_invitation_accepted',
			userId: 'admin-1',
			title: 'Charlie joined The Strokes',
			href: '/member/bands/band-1'
		}));
		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'band_invitation_accepted',
			userId: 'admin-2'
		}));
	});

	it('continues notifying remaining admins if one fails', async () => {
		mockDispatch.mockRejectedValueOnce(new Error('fail'));

		await emit('band.invitation_accepted', {
			acceptedByName: 'Charlie',
			bandName: 'The Strokes',
			bandId: 'band-1',
			bandAdmins: [
				{ userId: 'admin-1', userEmail: 'admin1@test.com', userName: 'Alice' },
				{ userId: 'admin-2', userEmail: 'admin2@test.com', userName: 'Dave' }
			]
		});

		expect(mockDispatch).toHaveBeenCalledTimes(2);
	});
});

describe('reservation.recurring_skipped handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('dispatches recurring skipped notification', async () => {
		await emit('reservation.recurring_skipped', {
			userId: 'user-1',
			userEmail: 'user@test.com',
			userName: 'Bob',
			skippedDate: 'May 25',
			startTime: '10:00 AM',
			endTime: '11:00 AM',
			reason: 'Conflicting event'
		});

		expect(mockTemplates.recurringSkipped).toHaveBeenCalledWith(expect.objectContaining({
			userName: 'Bob',
			skippedDate: 'May 25',
			startTime: '10:00 AM',
			endTime: '11:00 AM',
			reason: 'Conflicting event',
			siteUrl: 'https://test.corvmc.com'
		}));
		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'recurring_skipped',
			userId: 'user-1',
			userEmail: 'user@test.com',
			title: 'Recurring reservation skipped',
			body: 'May 25 10:00 AM–11:00 AM: Conflicting event',
			href: '/member/reservations',
			emailSubject: 'Recurring reservation skipped: May 25'
		}));
	});
});

describe('equipment.loan_scheduled handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('dispatches loan scheduled notification to member', async () => {
		await emit('equipment.loan_scheduled', {
			userId: 'user-1',
			userEmail: 'user@test.com',
			userName: 'Bob',
			equipmentName: 'SM58 Microphone',
			scheduledPickupDate: '2026-06-01'
		});

		expect(mockTemplates.loanScheduledConfirmation).toHaveBeenCalledWith(expect.objectContaining({
			userName: 'Bob',
			equipmentName: 'SM58 Microphone',
			siteUrl: 'https://test.corvmc.com'
		}));
		expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({
			type: 'equipment_loan_scheduled',
			userId: 'user-1',
			userEmail: 'user@test.com',
			title: 'Equipment pickup confirmed: SM58 Microphone',
			href: '/member/equipment/loans'
		}));
	});
});

describe('equipment.loan_requested handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('sends email notification to staff', async () => {
		await emit('equipment.loan_requested', {
			userName: 'Bob',
			equipmentName: 'SM58 Microphone',
			memberNotes: 'Need for weekend gig',
			requestedPickupDate: '2026-06-01',
			loanId: 'loan-1'
		});

		expect(mockTemplates.loanRequestedStaffNotification).toHaveBeenCalledWith(expect.objectContaining({
			userName: 'Bob',
			equipmentName: 'SM58 Microphone',
			memberNotes: 'Need for weekend gig',
			loanId: 'loan-1',
			siteUrl: 'https://test.corvmc.com'
		}));
		expect(mockDispatchEmailOnly).toHaveBeenCalledWith(expect.objectContaining({
			type: 'equipment_loan_requested',
			toEmail: 'staff@test.com',
			subject: 'Equipment request from Bob'
		}));
	});
});

describe('contact.form_submitted handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('forwards to staff email', async () => {
		await emit('contact.form_submitted', {
			name: 'Charlie',
			email: 'charlie@test.com',
			message: 'Hello, I have a question'
		});

		expect(mockDispatchEmailOnly).toHaveBeenCalledWith(expect.objectContaining({
			type: 'contact_form',
			toEmail: 'staff@test.com',
			subject: 'Contact form: Charlie'
		}));
	});
});
