import { domainEvents } from '$lib/server/events/event-bus';
import { dispatch, dispatchEmailOnly } from './dispatcher';
import { captureException } from '$lib/server/sentry';
import { listStaffUsers } from '$lib/server/authorization';
import { env } from '$env/dynamic/private';
import type { NotificationEmailModel } from '$lib/types/notification-email';

// ---------------------------------------------------------------------------
// Notification listeners
// ---------------------------------------------------------------------------
// Subscribes to domain events and dispatches notifications through the
// appropriate channels. Each listener maps a domain event to one or more
// notification dispatches.
//
// All transactional emails render through a single Postmark template,
// `notification` (source: postmark/templates/notification, pushed via
// `pnpm email:push`). Listeners supply the copy as a NotificationEmailModel —
// subject, heading, body paragraphs, optional details + CTA. The two
// exceptions are `ticket-confirmation` (ticket-code list) and `inbox-reply`
// (raw passthrough + threading), which keep dedicated templates.
// ---------------------------------------------------------------------------

const GENERIC_ALIAS = 'notification';

function formatPickupDate(value: string): string {
	return new Date(value).toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
}

function formatMoney(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

/** Date + time range as a single inline-HTML paragraph (matches legacy copy). */
function whenLine(date: string, startTime: string, endTime: string): { text: string } {
	return {
		text: `<strong>Date:</strong> ${date}<br /><strong>Time:</strong> ${startTime} – ${endTime}`
	};
}

export function registerAllNotificationListeners(): void {
	const siteUrl = env.PUBLIC_SITE_URL ?? 'https://corvmc.org';

	// --- Ticket purchase confirmation (dedicated template) ---
	domainEvents.on('ticket.purchased', async ({ data: event }) => {
		// Ticket buyers may not have accounts — use email-only dispatch
		await dispatchEmailOnly({
			type: 'ticket_confirmation',
			toEmail: event.attendeeEmail,
			templateAlias: 'ticket-confirmation',
			model: {
				attendeeName: event.attendeeName,
				eventTitle: event.eventTitle,
				eventDate: event.eventDate,
				eventTime: event.eventTime,
				quantity: event.quantity,
				multiple: event.quantity > 1,
				ticketCodes: event.ticketCodes.map((code) => ({ code }))
			}
		});
	});

	// --- Event cancellation to ticket holders ---
	domainEvents.on('event.cancelled', async ({ data: event }) => {
		for (const holder of event.ticketHolders) {
			try {
				const model = {
					subject: `${event.eventTitle} has been cancelled`,
					heading: 'Event cancelled',
					greeting: `Hi ${holder.attendeeName},`,
					paragraphs: [
						{
							text: `Unfortunately ${event.eventTitle} scheduled for ${event.eventDate} has been cancelled.`
						},
						...(event.refundNote ? [{ text: event.refundNote }] : []),
						{ text: 'We apologize for the inconvenience.' }
					]
				} satisfies NotificationEmailModel;

				if (holder.userId) {
					await dispatch({
						type: 'event_cancellation',
						userId: holder.userId,
						userEmail: holder.attendeeEmail,
						title: `${event.eventTitle} has been cancelled`,
						body: event.refundNote,
						href: '/member/tickets',
						emailTemplate: { alias: GENERIC_ALIAS, model }
					});
				} else {
					await dispatchEmailOnly({
						type: 'event_cancellation',
						toEmail: holder.attendeeEmail,
						templateAlias: GENERIC_ALIAS,
						model
					});
				}
			} catch (err) {
				captureException(err, {
					event: 'notification.event_cancelled',
					to: holder.attendeeEmail
				});
			}
		}
	});

	// --- Reservation reminder ---
	domainEvents.on('reservation.reminder_due', async ({ data: event }) => {
		await dispatch({
			type: 'reservation_reminder',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Upcoming reservation reminder',
			body: `${event.date} from ${event.startTime} to ${event.endTime}`,
			href: '/member/reservations',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Reservation reminder: ${event.date}`,
					heading: 'Upcoming reservation reminder',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{ text: 'You have a reservation coming up:' },
						whenLine(event.date, event.startTime, event.endTime)
					],
					cta: { url: `${siteUrl}/member/reservations`, label: 'View My Reservations' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Confirmation reminder ---
	domainEvents.on('reservation.confirmation_reminder_due', async ({ data: event }) => {
		await dispatch({
			type: 'confirmation_reminder',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Please confirm your reservation',
			body: `${event.date} from ${event.startTime} to ${event.endTime}`,
			href: '/member/reservations',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Please confirm your reservation: ${event.date}`,
					heading: 'Please confirm your reservation',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{ text: 'You have an unconfirmed reservation:' },
						whenLine(event.date, event.startTime, event.endTime),
						{
							text: 'Please confirm or cancel your reservation to free up the time slot for others.'
						}
					],
					cta: { url: `${siteUrl}/member/reservations`, label: 'Confirm now' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Band invitation sent ---
	domainEvents.on('band.invitation_sent', async ({ data: event }) => {
		await dispatch({
			type: 'band_invitation',
			userId: event.invitedUserId,
			userEmail: event.invitedUserEmail,
			title: `You've been invited to ${event.bandName}`,
			body: `${event.invitedByName} invited you to join their band`,
			href: '/member',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `${event.invitedByName} invited you to ${event.bandName}`,
					heading: "You've been invited to a band!",
					greeting: `Hi ${event.invitedUserName},`,
					paragraphs: [
						{ text: `${event.invitedByName} has invited you to join ${event.bandName}.` }
					],
					cta: { url: `${siteUrl}/member`, label: 'View invitation' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Band invitation accepted ---
	domainEvents.on('band.invitation_accepted', async ({ data: event }) => {
		for (const admin of event.bandAdmins) {
			try {
				await dispatch({
					type: 'band_invitation_accepted',
					userId: admin.userId,
					userEmail: admin.userEmail,
					title: `${event.acceptedByName} joined ${event.bandName}`,
					body: 'A new member has joined your band',
					href: `/member/bands/${event.bandId}`,
					emailTemplate: {
						alias: GENERIC_ALIAS,
						model: {
							subject: `${event.acceptedByName} joined ${event.bandName}`,
							heading: 'New band member!',
							greeting: `Hi ${admin.userName},`,
							paragraphs: [
								{
									text: `${event.acceptedByName} has accepted the invitation to join ${event.bandName}.`
								}
							],
							cta: { url: `${siteUrl}/member/bands/${event.bandId}`, label: 'View band' }
						} satisfies NotificationEmailModel
					}
				});
			} catch (err) {
				captureException(err, {
					event: 'notification.band_invitation_accepted',
					to: admin.userEmail
				});
			}
		}
	});

	// --- Platform invite (non-user) ---
	domainEvents.on('platform_invite.created', async ({ data: event }) => {
		const signupUrl = `${siteUrl}/login?invite=${event.token}`;
		await dispatchEmailOnly({
			type: 'platform_invitation',
			toEmail: event.email,
			templateAlias: GENERIC_ALIAS,
			model: {
				subject: `${event.invitedByName} invited you to join ${event.bandName} on CorvMC`,
				heading: "You've been invited to join a band!",
				paragraphs: [
					{
						text: `${event.invitedByName} has invited you to join ${event.bandName} as a ${event.role} on CorvMC.`
					},
					{
						text: 'CorvMC is a community music space where bands book rehearsals, manage equipment, and coordinate with their members.'
					}
				],
				cta: { url: signupUrl, label: 'Create your account & join' },
				footnote: 'This invitation expires in 7 days.'
			} satisfies NotificationEmailModel
		});
	});

	// --- Recurring reservation skipped ---
	domainEvents.on('reservation.recurring_skipped', async ({ data: event }) => {
		await dispatch({
			type: 'recurring_skipped',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Recurring reservation skipped',
			body: `${event.skippedDate} ${event.startTime}–${event.endTime}: ${event.reason}`,
			href: '/member/reservations',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Recurring reservation skipped: ${event.skippedDate}`,
					heading: 'Recurring reservation skipped',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: `Your recurring reservation on ${event.skippedDate} from ${event.startTime} – ${event.endTime} was skipped due to: ${event.reason}.`
						},
						{ text: 'Your series will continue generating future reservations as normal.' }
					],
					cta: { url: `${siteUrl}/member/reservations`, label: 'View my reservations' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Recurring event could not reserve space (notify staff creator) ---
	domainEvents.on('event.recurring_reservation_skipped', async ({ data: event }) => {
		await dispatch({
			type: 'event_recurring_reservation_skipped',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Recurring event could not reserve space',
			body: `${event.eventTitle} on ${event.date} ${event.startTime}–${event.endTime}: ${event.reason}`,
			href: `/staff/events/${event.eventId}`,
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Recurring event needs space: ${event.eventTitle} on ${event.date}`,
					heading: 'Recurring event could not reserve space',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: `The recurring event "${event.eventTitle}" was created as a draft for ${event.date} from ${event.startTime} – ${event.endTime}, but the practice space could not be reserved due to: ${event.reason}.`
						},
						{ text: 'Open the event to resolve the conflict or book the space manually.' }
					],
					cta: { url: `${siteUrl}/staff/events/${event.eventId}`, label: 'View the event' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Equipment loan scheduled (notify member) ---
	domainEvents.on('equipment.loan_scheduled', async ({ data: event }) => {
		await dispatch({
			type: 'equipment_loan_scheduled',
			userId: event.userId,
			userEmail: event.userEmail,
			title: `Equipment pickup confirmed: ${event.equipmentName}`,
			body: `Pickup on ${new Date(event.scheduledPickupDate).toLocaleDateString()}`,
			href: '/member/equipment/loans',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Equipment pickup confirmed: ${event.equipmentName}`,
					heading: 'Equipment pickup confirmed',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{ text: `Your equipment loan for ${event.equipmentName} has been confirmed.` },
						{
							text: `<strong>Pickup date:</strong> ${formatPickupDate(event.scheduledPickupDate)}`
						},
						{ text: 'Please visit the space during open hours on the pickup date.' }
					],
					cta: { url: `${siteUrl}/member/equipment/loans`, label: 'View my loans' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Equipment loan requested (notify staff) ---
	domainEvents.on('equipment.loan_requested', async ({ data: event }) => {
		const staffEmail = env.STAFF_CONTACT_EMAIL ?? 'staff@corvmc.org';

		await dispatchEmailOnly({
			type: 'equipment_loan_requested',
			toEmail: staffEmail,
			templateAlias: GENERIC_ALIAS,
			model: {
				subject: `Equipment request from ${event.userName}`,
				heading: 'New equipment loan request',
				paragraphs: [
					{ text: `${event.userName} has requested to borrow equipment.` },
					{
						text: event.equipmentName
							? `<strong>Item:</strong> ${event.equipmentName}`
							: 'Free-form request'
					},
					{
						text: `<strong>Requested pickup:</strong> ${formatPickupDate(event.requestedPickupDate)}`
					},
					...(event.memberNotes ? [{ text: `<strong>Notes:</strong> ${event.memberNotes}` }] : [])
				],
				cta: { url: `${siteUrl}/staff/equipment/loans/${event.loanId}`, label: 'Review request' }
			} satisfies NotificationEmailModel
		});
	});

	// --- Equipment checked out (notify member) ---
	domainEvents.on('equipment.checked_out', async ({ data: event }) => {
		await dispatch({
			type: 'equipment_checked_out',
			userId: event.userId,
			userEmail: event.userEmail,
			title: `Equipment checked out: ${event.equipmentName}`,
			body: 'Your equipment is checked out',
			href: '/member/equipment/loans',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Equipment checked out: ${event.equipmentName}`,
					heading: 'Equipment checked out',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: `You've checked out ${event.equipmentName}. Please return it on time so others can use it.`
						}
					],
					cta: { url: `${siteUrl}/member/equipment/loans`, label: 'View my loans' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Equipment returned (notify member) ---
	domainEvents.on('equipment.returned', async ({ data: event }) => {
		const paragraphs: NotificationEmailModel['paragraphs'] = [
			{ text: `Thanks for returning ${event.equipmentName}.` },
			{
				text: `<strong>Borrowed for:</strong> ${event.daysBorrowed} day${event.daysBorrowed === 1 ? '' : 's'}`
			}
		];
		if (event.totalChargeCents > 0) {
			const breakdown =
				event.creditsCents > 0
					? ` (credits ${formatMoney(event.creditsCents)}, cash ${formatMoney(event.cashCents)})`
					: '';
			paragraphs.push({
				text: `<strong>Total charge:</strong> ${formatMoney(event.totalChargeCents)}${breakdown}`
			});
		}

		await dispatch({
			type: 'equipment_returned',
			userId: event.userId,
			userEmail: event.userEmail,
			title: `Equipment returned: ${event.equipmentName}`,
			body: 'Your equipment return is recorded',
			href: '/member/equipment/loans',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Equipment returned: ${event.equipmentName}`,
					heading: 'Equipment returned',
					greeting: `Hi ${event.userName},`,
					paragraphs,
					cta: { url: `${siteUrl}/member/equipment/loans`, label: 'View my loans' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Reservation cancelled (notify member; skip self-cancels) ---
	domainEvents.on('reservation.cancelled', async ({ data: event }) => {
		// Members who cancel their own reservation don't need an email about it.
		if (event.cancelledBy === 'member') return;

		const reasonLine =
			event.cancelledBy === 'staff'
				? 'This was done by CMC staff. Reach out if you have any questions.'
				: 'This reservation was cancelled automatically.';

		await dispatch({
			type: 'reservation_cancelled',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Reservation cancelled',
			body: `${event.date} ${event.startTime}–${event.endTime}`,
			href: '/member/reservations',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Reservation cancelled: ${event.date}`,
					heading: 'Reservation cancelled',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: `Your reservation on ${event.date} from ${event.startTime} – ${event.endTime} has been cancelled.`
						},
						{ text: reasonLine }
					],
					cta: { url: `${siteUrl}/member/reservations`, label: 'View my reservations' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Recurring reservation waitlisted ---
	domainEvents.on('reservation.recurring_waitlisted', async ({ data: event }) => {
		await dispatch({
			type: 'recurring_waitlisted',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Recurring reservation waitlisted',
			body: `${event.date} ${event.startTime}–${event.endTime}: waiting for slot`,
			href: '/member/reservations',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Recurring reservation waitlisted: ${event.date}`,
					heading: 'Recurring reservation waitlisted',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: `Your recurring reservation on ${event.date} from ${event.startTime} – ${event.endTime} is on the waitlist because the time slot is currently booked.`
						},
						{ text: "You'll be notified automatically if the slot opens up." }
					],
					cta: { url: `${siteUrl}/member/reservations`, label: 'View my reservations' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Waitlist slot available ---
	domainEvents.on('reservation.waitlist_slot_available', async ({ data: event }) => {
		await dispatch({
			type: 'waitlist_slot_available',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'A slot has opened up!',
			body: `${event.date} ${event.startTime}–${event.endTime} is available — confirm within 24 hours`,
			href: `/member/reservations?confirm=${event.reservationId}`,
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Slot available: ${event.date} ${event.startTime}`,
					heading: 'A slot has opened up!',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: `The time slot on ${event.date} from ${event.startTime} – ${event.endTime} is now available.`
						},
						{ text: 'You have 24 hours to confirm your reservation before it expires.' }
					],
					cta: { url: event.confirmUrl, label: 'Confirm reservation' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Waitlist expired ---
	domainEvents.on('reservation.waitlist_expired', async ({ data: event }) => {
		await dispatch({
			type: 'waitlist_expired',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Waitlisted reservation expired',
			body: `${event.date} ${event.startTime}–${event.endTime} was not confirmed in time`,
			href: '/member/reservations',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Waitlisted reservation expired: ${event.date}`,
					heading: 'Waitlisted reservation expired',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: `Your waitlisted reservation on ${event.date} from ${event.startTime} – ${event.endTime} has expired because it was not confirmed within 24 hours.`
						}
					],
					cta: { url: `${siteUrl}/member/reservations`, label: 'View my reservations' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Contact form submission ---
	domainEvents.on('contact.form_submitted', async ({ data: event }) => {
		const staffEmail = env.STAFF_CONTACT_EMAIL ?? 'staff@corvmc.org';

		await dispatchEmailOnly({
			type: 'contact_form',
			toEmail: staffEmail,
			templateAlias: GENERIC_ALIAS,
			model: {
				subject: `Contact form: ${event.name}`,
				heading: 'New contact form submission',
				paragraphs: [
					{ text: `<strong>From:</strong> ${event.name} (${event.email})` },
					{ text: event.message },
					{ text: 'Reply directly to this email to respond to the sender.' }
				]
			} satisfies NotificationEmailModel
		});
	});

	// --- Content flagged (notify all staff, in-app) ---
	domainEvents.on('content.flagged', async ({ data: event }) => {
		const staff = await listStaffUsers();
		for (const member of staff) {
			try {
				await dispatch({
					type: 'content_flagged',
					userId: member.id,
					userEmail: member.email,
					title: 'Content flagged for review',
					body: `${event.reportedByName} reported ${event.entityLabel}: ${event.reason}`,
					href: `/staff/flags/${event.flagId}`
				});
			} catch (err) {
				captureException(err, { event: 'notification.content_flagged', to: member.email });
			}
		}
	});
}
