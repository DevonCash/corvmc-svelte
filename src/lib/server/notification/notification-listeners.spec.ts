import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDispatch = vi.fn().mockResolvedValue(undefined);
const mockDispatchEmailOnly = vi.fn().mockResolvedValue(undefined);

vi.mock('./dispatcher', () => ({
	dispatch: (...args: unknown[]) => mockDispatch(...args),
	dispatchEmailOnly: (...args: unknown[]) => mockDispatchEmailOnly(...args)
}));

const mockTemplates: Record<string, vi.Mock> = {
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
		await handlers['ticket.purchased']({
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
		await handlers['reservation.reminder_due']({
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
		await handlers['platform_invite.created']({
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
		await handlers['band.invitation_sent']({
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

describe('contact.form_submitted handler', () => {
	beforeEach(() => { registerAllNotificationListeners(); });

	it('forwards to staff email', async () => {
		await handlers['contact.form_submitted']({
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
