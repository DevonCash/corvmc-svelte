import { compileEmail } from './compile-template';

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------
// Each function returns compiled HTML ready to send via Postmark.
// Templates are pure functions of their data — no database access.
// ---------------------------------------------------------------------------

export function ticketConfirmation(vars: {
	attendeeName: string;
	eventTitle: string;
	eventDate: string;
	eventTime: string;
	ticketCodes: string[];
	quantity: number;
}): string {
	const codeList = vars.ticketCodes
		.map((code) => `<li style="font-family: monospace; font-size: 16px; margin: 4px 0;">${code}</li>`)
		.join('');

	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Your tickets are confirmed!</mj-text>
		<mj-text>Hi {{attendeeName}}, thanks for purchasing ${vars.quantity === 1 ? 'a ticket' : `${vars.quantity} tickets`} for <strong>{{eventTitle}}</strong>.</mj-text>
		<mj-text><strong>Date:</strong> {{eventDate}}<br/><strong>Time:</strong> {{eventTime}}</mj-text>
		<mj-text font-weight="600">Your ticket ${vars.quantity === 1 ? 'code' : 'codes'}:</mj-text>
		<mj-text><ul style="list-style: none; padding: 0;">${codeList}</ul></mj-text>
		<mj-text>Show ${vars.quantity === 1 ? 'this code' : 'these codes'} at the door for check-in. See you there!</mj-text>
		`,
		`Your tickets for ${vars.eventTitle}`,
		{
			attendeeName: vars.attendeeName,
			eventTitle: vars.eventTitle,
			eventDate: vars.eventDate,
			eventTime: vars.eventTime
		}
	);
}

export function eventCancellation(vars: {
	attendeeName: string;
	eventTitle: string;
	eventDate: string;
	refundNote: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Event cancelled</mj-text>
		<mj-text>Hi {{attendeeName}}, unfortunately <strong>{{eventTitle}}</strong> scheduled for {{eventDate}} has been cancelled.</mj-text>
		<mj-text>{{refundNote}}</mj-text>
		<mj-text>We apologize for the inconvenience.</mj-text>
		`,
		`${vars.eventTitle} has been cancelled`,
		vars
	);
}

export function checkInReminder(vars: {
	attendeeName: string;
	eventTitle: string;
	eventDate: string;
	eventTime: string;
	ticketCode: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Reminder: {{eventTitle}} is tomorrow!</mj-text>
		<mj-text>Hi {{attendeeName}}, just a reminder that <strong>{{eventTitle}}</strong> is coming up.</mj-text>
		<mj-text><strong>Date:</strong> {{eventDate}}<br/><strong>Time:</strong> {{eventTime}}</mj-text>
		<mj-text>Your ticket code: <span style="font-family: monospace; font-size: 16px; font-weight: 600;">{{ticketCode}}</span></mj-text>
		<mj-text>See you there!</mj-text>
		`,
		`Reminder: ${vars.eventTitle} tomorrow`,
		vars
	);
}

export function reservationReminder(vars: {
	userName: string;
	date: string;
	startTime: string;
	endTime: string;
	siteUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Upcoming reservation reminder</mj-text>
		<mj-text>Hi {{userName}}, you have a reservation coming up:</mj-text>
		<mj-text><strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{startTime}} – {{endTime}}</mj-text>
		<mj-button href="{{siteUrl}}/member/reservations">View My Reservations</mj-button>
		`,
		`Reservation reminder: ${vars.date}`,
		vars
	);
}

export function confirmationReminder(vars: {
	userName: string;
	date: string;
	startTime: string;
	endTime: string;
	siteUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Please confirm your reservation</mj-text>
		<mj-text>Hi {{userName}}, you have an unconfirmed reservation:</mj-text>
		<mj-text><strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{startTime}} – {{endTime}}</mj-text>
		<mj-text>Please confirm or cancel your reservation to free up the time slot for others.</mj-text>
		<mj-button href="{{siteUrl}}/member/reservations">Confirm Now</mj-button>
		`,
		`Confirm your reservation: ${vars.date}`,
		vars
	);
}

export function bandInvitation(vars: {
	invitedUserName: string;
	bandName: string;
	invitedByName: string;
	siteUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">You've been invited to a band!</mj-text>
		<mj-text>Hi {{invitedUserName}}, <strong>{{invitedByName}}</strong> has invited you to join <strong>{{bandName}}</strong>.</mj-text>
		<mj-button href="{{siteUrl}}/member">View Invitation</mj-button>
		`,
		`${vars.invitedByName} invited you to ${vars.bandName}`,
		vars
	);
}

export function bandInvitationAccepted(vars: {
	adminName: string;
	acceptedByName: string;
	bandName: string;
	siteUrl: string;
	bandId: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">New band member!</mj-text>
		<mj-text>Hi {{adminName}}, <strong>{{acceptedByName}}</strong> has accepted the invitation to join <strong>{{bandName}}</strong>.</mj-text>
		<mj-button href="{{siteUrl}}/member/bands/{{bandId}}">View Band</mj-button>
		`,
		`${vars.acceptedByName} joined ${vars.bandName}`,
		vars
	);
}

export function platformInvitation(vars: {
	email: string;
	bandName: string;
	invitedByName: string;
	role: string;
	signupUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">You've been invited to join a band!</mj-text>
		<mj-text><strong>{{invitedByName}}</strong> has invited you to join <strong>{{bandName}}</strong> as a {{role}} on CorvMC.</mj-text>
		<mj-text>CorvMC is a community music space where bands book rehearsals, manage equipment, and coordinate with their members.</mj-text>
		<mj-button href="{{signupUrl}}">Create Account &amp; Join</mj-button>
		<mj-text font-size="12px" color="#888">This invitation expires in 7 days.</mj-text>
		`,
		`${vars.invitedByName} invited you to join ${vars.bandName} on CorvMC`,
		vars
	);
}

export function contactFormForward(vars: {
	senderName: string;
	senderEmail: string;
	message: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">New contact form submission</mj-text>
		<mj-text><strong>From:</strong> {{senderName}} ({{senderEmail}})</mj-text>
		<mj-divider border-color="#e5e7eb" border-width="1px" />
		<mj-text>{{message}}</mj-text>
		<mj-divider border-color="#e5e7eb" border-width="1px" />
		<mj-text font-size="13px" color="#6b7280">Reply directly to this email to respond to the sender.</mj-text>
		`,
		`Contact form: ${vars.senderName}`,
		vars
	);
}

export function loanScheduledConfirmation(vars: {
	userName: string;
	equipmentName: string;
	scheduledPickupDate: string;
	siteUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Equipment pickup confirmed</mj-text>
		<mj-text>Hi {{userName}}, your equipment loan for <strong>{{equipmentName}}</strong> has been confirmed.</mj-text>
		<mj-text><strong>Pickup date:</strong> {{scheduledPickupDate}}</mj-text>
		<mj-text>Please visit the space during open hours on the pickup date.</mj-text>
		<mj-button href="{{siteUrl}}/member/equipment/loans">View My Loans</mj-button>
		`,
		`Equipment pickup confirmed: ${vars.equipmentName}`,
		vars
	);
}

export function loanRequestedStaffNotification(vars: {
	userName: string;
	equipmentName: string | null;
	memberNotes: string | null;
	requestedPickupDate: string;
	siteUrl: string;
	loanId: string;
}): string {
	const itemLine = vars.equipmentName
		? `<strong>Item:</strong> {{equipmentName}}`
		: `<strong>Free-form request</strong>`;
	const notesLine = vars.memberNotes
		? `<mj-text><strong>Notes:</strong> {{memberNotes}}</mj-text>`
		: '';

	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">New equipment loan request</mj-text>
		<mj-text><strong>{{userName}}</strong> has requested to borrow equipment.</mj-text>
		<mj-text>${itemLine}<br/><strong>Requested pickup:</strong> {{requestedPickupDate}}</mj-text>
		${notesLine}
		<mj-button href="{{siteUrl}}/staff/equipment/loans/{{loanId}}">Review Request</mj-button>
		`,
		`Equipment request from ${vars.userName}`,
		vars as Record<string, string>
	);
}

export function recurringSkipped(vars: {
	userName: string;
	skippedDate: string;
	startTime: string;
	endTime: string;
	reason: string;
	siteUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Recurring reservation skipped</mj-text>
		<mj-text>Hi {{userName}}, your recurring reservation on <strong>{{skippedDate}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> was skipped due to: {{reason}}.</mj-text>
		<mj-text>Your series will continue generating future reservations as normal.</mj-text>
		<mj-button href="{{siteUrl}}/member/reservations">View My Reservations</mj-button>
		`,
		`Recurring reservation skipped: ${vars.skippedDate}`,
		vars
	);
}

export function recurringWaitlisted(vars: {
	userName: string;
	date: string;
	startTime: string;
	endTime: string;
	reason: string;
	siteUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Recurring reservation waitlisted</mj-text>
		<mj-text>Hi {{userName}}, your recurring reservation on <strong>{{date}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> is on the waitlist because the time slot is currently booked.</mj-text>
		<mj-text>You'll be notified automatically if the slot opens up.</mj-text>
		<mj-button href="{{siteUrl}}/member/reservations">View My Reservations</mj-button>
		`,
		`Recurring reservation waitlisted: ${vars.date}`,
		vars
	);
}

export function waitlistSlotAvailable(vars: {
	userName: string;
	date: string;
	startTime: string;
	endTime: string;
	expiresAt: string;
	confirmUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">A slot has opened up!</mj-text>
		<mj-text>Hi {{userName}}, the time slot on <strong>{{date}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> is now available.</mj-text>
		<mj-text>You have <strong>24 hours</strong> to confirm your reservation before it expires.</mj-text>
		<mj-button href="{{confirmUrl}}">Confirm Reservation</mj-button>
		`,
		`Slot available: ${vars.date} ${vars.startTime}`,
		vars
	);
}

export function waitlistExpired(vars: {
	userName: string;
	date: string;
	startTime: string;
	endTime: string;
	siteUrl: string;
}): string {
	return compileEmail(
		`
		<mj-text font-size="18px" font-weight="600">Waitlisted reservation expired</mj-text>
		<mj-text>Hi {{userName}}, your waitlisted reservation on <strong>{{date}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> has expired because it was not confirmed within 24 hours.</mj-text>
		<mj-button href="{{siteUrl}}/member/reservations">View My Reservations</mj-button>
		`,
		`Waitlisted reservation expired: ${vars.date}`,
		vars
	);
}
