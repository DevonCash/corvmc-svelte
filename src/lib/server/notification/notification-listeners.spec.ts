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

vi.mock('$lib/server/sentry', () => ({ captureException: vi.fn() }));

vi.mock('$env/dynamic/private', () => ({
	env: { PUBLIC_SITE_URL: 'https://test.corvmc.com', STAFF_CONTACT_EMAIL: 'staff@test.com' }
}));

// Capture event handlers
const handlers: Record<string, (...args: any[]) => any> = {};
vi.mock('$lib/server/events/event-bus', () => ({
	domainEvents: {
		on: (event: string, handler: (...args: any[]) => any) => {
			handlers[event] = handler;
		},
		emit: vi.fn()
	}
}));

const { registerAllNotificationListeners } = await import('./notification-listeners');

// Emittery wraps emitted payloads as `{ name, data }` before invoking
// listeners. Calling handlers directly in tests must mirror that envelope.
function emit(event: string, payload: unknown): Promise<unknown> {
	return handlers[event]({ data: payload });
}

function paragraphText(model: { paragraphs?: { text: string }[] }): string {
	return (model.paragraphs ?? []).map((p) => p.text).join('\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

// All transactional emails (except ticket-confirmation + inbox-reply) render
// through the single generic `notification` template.
const GENERIC = 'notification';

describe('registerAllNotificationListeners', () => {
	it('registers handlers for all expected events', () => {
		registerAllNotificationListeners();

		for (const event of [
			'ticket.purchased',
			'event.cancelled',
			'reservation.reminder_due',
			'reservation.confirmation_reminder_due',
			'reservation.cancelled',
			'band.invitation_sent',
			'band.invitation_accepted',
			'platform_invite.created',
			'reservation.recurring_skipped',
			'reservation.recurring_waitlisted',
			'reservation.waitlist_slot_available',
			'reservation.waitlist_expired',
			'equipment.loan_scheduled',
			'equipment.loan_requested',
			'equipment.checked_out',
			'equipment.returned',
			'contact.form_submitted'
		]) {
			expect(handlers[event], event).toBeDefined();
		}
	});
});

describe('ticket.purchased handler (dedicated template)', () => {
	beforeEach(() => registerAllNotificationListeners());

	it('sends email-only notification with the ticket-confirmation template', async () => {
		await emit('ticket.purchased', {
			attendeeName: 'Alice',
			attendeeEmail: 'alice@test.com',
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			eventTime: '8:00 PM',
			ticketCodes: ['ABC123', 'DEF456'],
			quantity: 2
		});

		expect(mockDispatchEmailOnly).toHaveBeenCalledWith(
			expect.objectContaining({
				type: 'ticket_confirmation',
				toEmail: 'alice@test.com',
				templateAlias: 'ticket-confirmation',
				model: expect.objectContaining({
					multiple: true,
					ticketCodes: [{ code: 'ABC123' }, { code: 'DEF456' }]
				})
			})
		);
	});
});

describe('collapsed listeners use the generic template', () => {
	beforeEach(() => registerAllNotificationListeners());

	it('reservation.reminder_due → notification alias with subject/heading/cta', async () => {
		await emit('reservation.reminder_due', {
			userId: 'user-1',
			userEmail: 'user@test.com',
			userName: 'Bob',
			date: 'May 21',
			startTime: '10:00 AM',
			endTime: '11:00 AM'
		});

		const params = mockDispatch.mock.calls[0][0];
		expect(params.type).toBe('reservation_reminder');
		expect(params.emailTemplate.alias).toBe(GENERIC);
		expect(params.emailTemplate.model.subject).toBe('Reservation reminder: May 21');
		expect(params.emailTemplate.model.heading).toBe('Upcoming reservation reminder');
		expect(params.emailTemplate.model.cta).toEqual({
			url: 'https://test.corvmc.com/member/reservations',
			label: 'View My Reservations'
		});
	});

	it('confirmation_reminder → notification alias', async () => {
		await emit('reservation.confirmation_reminder_due', {
			userId: 'user-1',
			userEmail: 'user@test.com',
			userName: 'Bob',
			date: 'May 22',
			startTime: '2:00 PM',
			endTime: '3:00 PM'
		});

		const params = mockDispatch.mock.calls[0][0];
		expect(params.type).toBe('confirmation_reminder');
		expect(params.emailTemplate.alias).toBe(GENERIC);
		expect(params.emailTemplate.model.subject).toBe('Please confirm your reservation: May 22');
	});

	it('band.invitation_sent → notification alias', async () => {
		await emit('band.invitation_sent', {
			invitedUserId: 'user-2',
			invitedUserEmail: 'invited@test.com',
			invitedUserName: 'Bob',
			bandName: 'The Strokes',
			invitedByName: 'Alice'
		});

		const params = mockDispatch.mock.calls[0][0];
		expect(params.type).toBe('band_invitation');
		expect(params.emailTemplate.alias).toBe(GENERIC);
		expect(params.emailTemplate.model.subject).toBe('Alice invited you to The Strokes');
	});

	it('platform_invite.created → email-only notification alias with signup link', async () => {
		await emit('platform_invite.created', {
			email: 'new@test.com',
			token: 'tok-xyz',
			bandId: 'band-1',
			bandName: 'The Strokes',
			role: 'member',
			invitedByName: 'Alice'
		});

		const params = mockDispatchEmailOnly.mock.calls[0][0];
		expect(params.type).toBe('platform_invitation');
		expect(params.templateAlias).toBe(GENERIC);
		expect(params.model.cta.url).toBe('https://test.corvmc.com/login?invite=tok-xyz');
		expect(params.model.footnote).toBe('This invitation expires in 7 days.');
	});

	it('contact.form_submitted → email-only notification alias to staff', async () => {
		await emit('contact.form_submitted', {
			name: 'Charlie',
			email: 'charlie@test.com',
			message: 'Hello, I have a question'
		});

		const params = mockDispatchEmailOnly.mock.calls[0][0];
		expect(params.type).toBe('contact_form');
		expect(params.toEmail).toBe('staff@test.com');
		expect(params.templateAlias).toBe(GENERIC);
		expect(paragraphText(params.model)).toContain('charlie@test.com');
		expect(paragraphText(params.model)).toContain('Hello, I have a question');
	});

	it('loan_requested → notification alias, omits notes line when none', async () => {
		await emit('equipment.loan_requested', {
			userName: 'Bob',
			equipmentName: 'SM58',
			memberNotes: null,
			requestedPickupDate: '2026-06-01',
			loanId: 'loan-1'
		});

		const params = mockDispatchEmailOnly.mock.calls[0][0];
		expect(params.templateAlias).toBe(GENERIC);
		expect(paragraphText(params.model)).not.toContain('Notes:');
		expect(params.model.cta.url).toBe('https://test.corvmc.com/staff/equipment/loans/loan-1');
	});
});

describe('event.cancelled handler', () => {
	beforeEach(() => registerAllNotificationListeners());

	it('uses dispatch (generic alias) for holders with a userId', async () => {
		await emit('event.cancelled', {
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			refundNote: 'Full refund within 5 days',
			ticketHolders: [{ attendeeName: 'Alice', attendeeEmail: 'alice@test.com', userId: 'user-1' }]
		});

		const params = mockDispatch.mock.calls[0][0];
		expect(params.type).toBe('event_cancellation');
		expect(params.emailTemplate.alias).toBe(GENERIC);
		expect(params.emailTemplate.model.subject).toBe('Jazz Night has been cancelled');
	});

	it('uses dispatchEmailOnly (generic alias) for holders without a userId', async () => {
		await emit('event.cancelled', {
			eventTitle: 'Jazz Night',
			eventDate: 'May 20',
			refundNote: 'Full refund within 5 days',
			ticketHolders: [{ attendeeName: 'Bob', attendeeEmail: 'bob@test.com', userId: null }]
		});

		expect(mockDispatchEmailOnly).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'event_cancellation', templateAlias: GENERIC })
		);
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

describe('band.invitation_accepted handler', () => {
	beforeEach(() => registerAllNotificationListeners());

	it('notifies each band admin via the generic alias', async () => {
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
		const first = mockDispatch.mock.calls[0][0];
		expect(first.type).toBe('band_invitation_accepted');
		expect(first.emailTemplate.alias).toBe(GENERIC);
		expect(first.emailTemplate.model.subject).toBe('Charlie joined The Strokes');
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

// ---------------------------------------------------------------------------
// Gap listeners (new)
// ---------------------------------------------------------------------------

describe('equipment.checked_out handler', () => {
	beforeEach(() => registerAllNotificationListeners());

	it('emails the member a checkout confirmation', async () => {
		await emit('equipment.checked_out', {
			loanId: 'l1',
			userId: 'user-1',
			userName: 'Bob',
			userEmail: 'user@test.com',
			equipmentName: 'SM58'
		});

		expect(mockDispatch).toHaveBeenCalledTimes(1);
		const params = mockDispatch.mock.calls[0][0];
		expect(params.type).toBe('equipment_checked_out');
		expect(params.userEmail).toBe('user@test.com');
		expect(params.emailTemplate.alias).toBe(GENERIC);
		expect(params.emailTemplate.model.subject).toBe('Equipment checked out: SM58');
	});
});

describe('equipment.returned handler', () => {
	beforeEach(() => registerAllNotificationListeners());

	it('emails a return summary with charge breakdown when charged', async () => {
		await emit('equipment.returned', {
			loanId: 'l1',
			userId: 'user-1',
			userName: 'Bob',
			userEmail: 'user@test.com',
			equipmentName: 'SM58',
			totalChargeCents: 1500,
			creditsCents: 500,
			cashCents: 1000,
			daysBorrowed: 3
		});

		const params = mockDispatch.mock.calls[0][0];
		expect(params.type).toBe('equipment_returned');
		expect(params.emailTemplate.alias).toBe(GENERIC);
		const text = paragraphText(params.emailTemplate.model);
		expect(text).toContain('3 days');
		expect(text).toContain('$15.00');
		expect(text).toContain('credits $5.00, cash $10.00');
	});

	it('omits the charge line when there is no charge', async () => {
		await emit('equipment.returned', {
			loanId: 'l1',
			userId: 'user-1',
			userName: 'Bob',
			userEmail: 'user@test.com',
			equipmentName: 'SM58',
			totalChargeCents: 0,
			creditsCents: 0,
			cashCents: 0,
			daysBorrowed: 1
		});

		const text = paragraphText(mockDispatch.mock.calls[0][0].emailTemplate.model);
		expect(text).not.toContain('Total charge');
		expect(text).toContain('1 day');
	});
});

describe('reservation.cancelled handler', () => {
	beforeEach(() => registerAllNotificationListeners());

	const base = {
		reservationId: 'r1',
		userId: 'user-1',
		userName: 'Bob',
		userEmail: 'user@test.com',
		date: 'May 21',
		startTime: '10:00 AM',
		endTime: '11:00 AM'
	};

	it('emails the member when cancelled by staff', async () => {
		await emit('reservation.cancelled', { ...base, cancelledBy: 'staff' });

		expect(mockDispatch).toHaveBeenCalledTimes(1);
		const params = mockDispatch.mock.calls[0][0];
		expect(params.type).toBe('reservation_cancelled');
		expect(params.emailTemplate.alias).toBe(GENERIC);
		expect(params.emailTemplate.model.subject).toBe('Reservation cancelled: May 21');
	});

	it('does NOT email when the member cancelled their own reservation', async () => {
		await emit('reservation.cancelled', { ...base, cancelledBy: 'member' });

		expect(mockDispatch).not.toHaveBeenCalled();
	});
});
