import { compileEmail } from './compile-template';
import { text, button, divider } from './html-helpers';

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------
// Each function returns compiled HTML ready to send via Postmark.
// Templates are pure functions of their data — no database access.
// Content uses html-helpers to produce the same output as MJML elements.
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
		text('Your tickets are confirmed!', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{attendeeName}}, thanks for purchasing ${vars.quantity === 1 ? 'a ticket' : `${vars.quantity} tickets`} for <strong>{{eventTitle}}</strong>.`
			) +
			text(
				`<strong>Date:</strong> {{eventDate}}<br/><strong>Time:</strong> {{eventTime}}`
			) +
			text(`Your ticket ${vars.quantity === 1 ? 'code' : 'codes'}:`, { fontWeight: '600' }) +
			text(`<ul style="list-style: none; padding: 0;">${codeList}</ul>`) +
			text(
				`Show ${vars.quantity === 1 ? 'this code' : 'these codes'} at the door for check-in. See you there!`
			),
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
		text('Event cancelled', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{attendeeName}}, unfortunately <strong>{{eventTitle}}</strong> scheduled for {{eventDate}} has been cancelled.`
			) +
			text('{{refundNote}}') +
			text('We apologize for the inconvenience.'),
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
		text('Reminder: {{eventTitle}} is tomorrow!', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{attendeeName}}, just a reminder that <strong>{{eventTitle}}</strong> is coming up.`
			) +
			text(
				`<strong>Date:</strong> {{eventDate}}<br/><strong>Time:</strong> {{eventTime}}`
			) +
			text(
				`Your ticket code: <span style="font-family: monospace; font-size: 16px; font-weight: 600;">{{ticketCode}}</span>`
			) +
			text('See you there!'),
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
		text('Upcoming reservation reminder', { fontSize: '18px', fontWeight: '600' }) +
			text('Hi {{userName}}, you have a reservation coming up:') +
			text(
				`<strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{startTime}} – {{endTime}}`
			) +
			button('View My Reservations', '{{siteUrl}}/member/reservations'),
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
		text('Please confirm your reservation', { fontSize: '18px', fontWeight: '600' }) +
			text('Hi {{userName}}, you have an unconfirmed reservation:') +
			text(
				`<strong>Date:</strong> {{date}}<br/><strong>Time:</strong> {{startTime}} – {{endTime}}`
			) +
			text('Please confirm or cancel your reservation to free up the time slot for others.') +
			button('Confirm Now', '{{siteUrl}}/member/reservations'),
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
		text("You've been invited to a band!", { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{invitedUserName}}, <strong>{{invitedByName}}</strong> has invited you to join <strong>{{bandName}}</strong>.`
			) +
			button('View Invitation', '{{siteUrl}}/member'),
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
		text('New band member!', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{adminName}}, <strong>{{acceptedByName}}</strong> has accepted the invitation to join <strong>{{bandName}}</strong>.`
			) +
			button('View Band', '{{siteUrl}}/member/bands/{{bandId}}'),
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
		text("You've been invited to join a band!", { fontSize: '18px', fontWeight: '600' }) +
			text(
				`<strong>{{invitedByName}}</strong> has invited you to join <strong>{{bandName}}</strong> as a {{role}} on CorvMC.`
			) +
			text(
				'CorvMC is a community music space where bands book rehearsals, manage equipment, and coordinate with their members.'
			) +
			button('Create Account &amp; Join', '{{signupUrl}}') +
			text('This invitation expires in 7 days.', { fontSize: '12px', color: '#888' }),
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
		text('New contact form submission', { fontSize: '18px', fontWeight: '600' }) +
			text('<strong>From:</strong> {{senderName}} ({{senderEmail}})') +
			divider() +
			text('{{message}}') +
			divider() +
			text('Reply directly to this email to respond to the sender.', {
				fontSize: '13px',
				color: '#6b7280'
			}),
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
		text('Equipment pickup confirmed', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{userName}}, your equipment loan for <strong>{{equipmentName}}</strong> has been confirmed.`
			) +
			text('<strong>Pickup date:</strong> {{scheduledPickupDate}}') +
			text('Please visit the space during open hours on the pickup date.') +
			button('View My Loans', '{{siteUrl}}/member/equipment/loans'),
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
	const notesRow = vars.memberNotes
		? text('<strong>Notes:</strong> {{memberNotes}}')
		: '';

	return compileEmail(
		text('New equipment loan request', { fontSize: '18px', fontWeight: '600' }) +
			text('<strong>{{userName}}</strong> has requested to borrow equipment.') +
			text(
				`${itemLine}<br/><strong>Requested pickup:</strong> {{requestedPickupDate}}`
			) +
			notesRow +
			button('Review Request', '{{siteUrl}}/staff/equipment/loans/{{loanId}}'),
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
		text('Recurring reservation skipped', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{userName}}, your recurring reservation on <strong>{{skippedDate}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> was skipped due to: {{reason}}.`
			) +
			text('Your series will continue generating future reservations as normal.') +
			button('View My Reservations', '{{siteUrl}}/member/reservations'),
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
		text('Recurring reservation waitlisted', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{userName}}, your recurring reservation on <strong>{{date}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> is on the waitlist because the time slot is currently booked.`
			) +
			text("You'll be notified automatically if the slot opens up.") +
			button('View My Reservations', '{{siteUrl}}/member/reservations'),
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
		text('A slot has opened up!', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{userName}}, the time slot on <strong>{{date}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> is now available.`
			) +
			text(
				'You have <strong>24 hours</strong> to confirm your reservation before it expires.'
			) +
			button('Confirm Reservation', '{{confirmUrl}}'),
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
		text('Waitlisted reservation expired', { fontSize: '18px', fontWeight: '600' }) +
			text(
				`Hi {{userName}}, your waitlisted reservation on <strong>{{date}}</strong> from <strong>{{startTime}} – {{endTime}}</strong> has expired because it was not confirmed within 24 hours.`
			) +
			button('View My Reservations', '{{siteUrl}}/member/reservations'),
		`Waitlisted reservation expired: ${vars.date}`,
		vars
	);
}

export function inboxReply(vars: {
	contactName: string;
	staffName: string;
	body: string;
	siteUrl: string;
}): string {
	return compileEmail(
		text('Hi {{contactName}},') +
			text('{{body}}') +
			divider() +
			text('{{staffName}} · Corvallis Music Collective', { cssClass: 'footer-text' }),
		vars.body.slice(0, 100),
		{
			contactName: vars.contactName,
			staffName: vars.staffName,
			body: vars.body,
			siteUrl: vars.siteUrl
		}
	);
}
