import { domainEvents } from '$lib/server/events/event-bus';
import { dispatch, dispatchEmailOnly } from './dispatcher';
import { captureException } from '$lib/server/sentry';
import { listStaffUsers } from '$lib/server/authorization';
import { env } from '$env/dynamic/private';
import type {
	NotificationEmailDetail,
	NotificationEmailModel
} from '$lib/types/notification-email';

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

/** Display hours for email copy. 3 → "3 hours", 1.5 → "1.5 hours", 1 → "1 hour". */
function formatHours(hours: number): string {
	const rendered = Number.isInteger(hours) ? String(hours) : String(Number(hours.toFixed(2)));
	return `${rendered} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** Calendar date for volunteer copy — no time component to render. */
function formatWorkedOn(value: string): string {
	return new Date(value).toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
}

/** Date + time range as rows for the details card. En-dash per the brand voice. */
function whenDetails(date: string, startTime: string, endTime: string): NotificationEmailDetail[] {
	return [
		{ label: 'Date', value: date },
		{ label: 'Time', value: `${startTime} – ${endTime}` }
	];
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
				// Not a NotificationEmailModel, so the dispatcher's normalizer
				// doesn't run — the preheader has to be set here.
				preview_text: `${event.eventTitle} · ${event.eventDate} at ${event.eventTime}`,
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
					heading: 'Event Cancelled',
					greeting: `Hi ${holder.attendeeName},`,
					paragraphs: [
						{ text: `Unfortunately this event has been cancelled.` },
						...(event.refundNote ? [{ text: event.refundNote }] : []),
						{ text: 'We apologize for the inconvenience.' }
					],
					details: [
						{ label: 'Event', value: event.eventTitle },
						{ label: 'Date', value: event.eventDate }
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
					preview_text: `${event.date}, ${event.startTime} – ${event.endTime}`,
					heading: 'Upcoming Reservation',
					greeting: `Hi ${event.userName},`,
					paragraphs: [{ text: 'You have a reservation coming up at the space.' }],
					details: whenDetails(event.date, event.startTime, event.endTime),
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
					preview_text: `${event.date}, ${event.startTime} – ${event.endTime}`,
					heading: 'Please Confirm Your Reservation',
					greeting: `Hi ${event.userName},`,
					paragraphs: [{ text: 'You have an unconfirmed reservation.' }],
					details: whenDetails(event.date, event.startTime, event.endTime),
					footnote:
						'Please confirm or cancel your reservation to free up the time slot for others.',
					cta: { url: `${siteUrl}/member/reservations`, label: 'Confirm Now' }
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
				preview_text: `${event.invitedByName} wants you in ${event.bandName}. Your invite link is good for 7 days.`,
				heading: "You've Been Invited to Join a Band",
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
					heading: 'Recurring Reservation Skipped',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{ text: 'One date in your recurring reservation was skipped.' },
						{ text: 'Your series will continue generating future reservations as normal.' }
					],
					details: [
						...whenDetails(event.skippedDate, event.startTime, event.endTime),
						{ label: 'Reason', value: event.reason }
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
					heading: 'Recurring Event Could Not Reserve Space',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: 'This event was created as a draft, but the practice space could not be reserved.'
						},
						{ text: 'Open the event to resolve the conflict or book the space manually.' }
					],
					details: [
						{ label: 'Event', value: event.eventTitle },
						...whenDetails(event.date, event.startTime, event.endTime),
						{ label: 'Reason', value: event.reason }
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
					heading: 'Equipment Pickup Confirmed',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{ text: 'Your equipment loan has been confirmed.' },
						{ text: 'Please visit the space during open hours on the pickup date.' }
					],
					details: [
						{ label: 'Item', value: event.equipmentName },
						{ label: 'Pickup date', value: formatPickupDate(event.scheduledPickupDate) }
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
				heading: 'New Equipment Loan Request',
				paragraphs: [{ text: `${event.userName} has requested to borrow equipment.` }],
				details: [
					{ label: 'Item', value: event.equipmentName ?? 'Free-form request' },
					{ label: 'Requested pickup', value: formatPickupDate(event.requestedPickupDate) },
					...(event.memberNotes ? [{ label: 'Notes', value: event.memberNotes }] : [])
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
		const details: NotificationEmailDetail[] = [
			{ label: 'Item', value: event.equipmentName },
			{
				label: 'Borrowed for',
				value: `${event.daysBorrowed} day${event.daysBorrowed === 1 ? '' : 's'}`
			}
		];
		if (event.totalChargeCents > 0) {
			const breakdown =
				event.creditsCents > 0
					? ` (credits ${formatMoney(event.creditsCents)}, cash ${formatMoney(event.cashCents)})`
					: '';
			details.push({
				label: 'Total charge',
				value: `${formatMoney(event.totalChargeCents)}${breakdown}`
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
					heading: 'Equipment Returned',
					greeting: `Hi ${event.userName},`,
					paragraphs: [{ text: `Thanks for returning ${event.equipmentName}.` }],
					details,
					cta: { url: `${siteUrl}/member/equipment/loans`, label: 'View My Loans' }
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
					heading: 'Reservation Cancelled',
					greeting: `Hi ${event.userName},`,
					paragraphs: [{ text: 'Your reservation has been cancelled.' }, { text: reasonLine }],
					details: whenDetails(event.date, event.startTime, event.endTime),
					cta: { url: `${siteUrl}/member/reservations`, label: 'View My Reservations' }
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
					heading: 'Recurring Reservation Waitlisted',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: 'This date is on the waitlist because the time slot is currently booked.'
						},
						{ text: "You'll be notified automatically if the slot opens up." }
					],
					details: whenDetails(event.date, event.startTime, event.endTime),
					cta: { url: `${siteUrl}/member/reservations`, label: 'View My Reservations' }
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
					preview_text: `${event.date}, ${event.startTime} – confirm within 24 hours or it goes to the next member.`,
					heading: 'A Slot Has Opened Up',
					greeting: `Hi ${event.userName},`,
					paragraphs: [{ text: 'The time slot you were waiting on is now available.' }],
					details: whenDetails(event.date, event.startTime, event.endTime),
					footnote: 'You have 24 hours to confirm your reservation before it expires.',
					cta: { url: event.confirmUrl, label: 'Confirm Reservation' }
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
					heading: 'Waitlisted Reservation Expired',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: 'Your waitlisted reservation expired because it was not confirmed within 24 hours.'
						}
					],
					details: whenDetails(event.date, event.startTime, event.endTime),
					cta: { url: `${siteUrl}/member/reservations`, label: 'View My Reservations' }
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
				subject: `Contact form: ${event.subject}`,
				preview_text: `${event.name}: ${event.subject}`,
				heading: 'New Contact Form Message',
				details: [
					{ label: 'From', value: event.name },
					{ label: 'Email', value: event.email },
					{ label: 'Subject', value: event.subject }
				],
				// Raw — the dispatcher escapes it and preserves the line breaks.
				quote: event.message,
				footnote:
					'Reply from the staff inbox — replies sent there go to the sender and thread their response back into the same conversation.',
				cta: {
					url: `${env.PUBLIC_SITE_URL}/staff/inbox/${event.threadId}`,
					label: 'Open in Staff Inbox'
				}
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

	// --- Event unpublished by staff (notify band admins) ---
	domainEvents.on('event.unpublished_by_staff', async ({ data: event }) => {
		for (const admin of event.bandAdmins) {
			try {
				await dispatch({
					type: 'band_event_unpublished',
					userId: admin.userId,
					userEmail: admin.userEmail,
					title: `"${event.eventTitle}" was unlisted`,
					body: event.notes
						? `CMC staff removed this event from the public gig guide: ${event.notes}`
						: 'CMC staff removed this event from the public gig guide following a report.',
					href: `/member/bands/${event.bandId}`,
					emailTemplate: {
						alias: GENERIC_ALIAS,
						model: {
							subject: `Your event "${event.eventTitle}" was unlisted`,
							heading: 'Event unlisted from the gig guide',
							greeting: `Hi ${admin.userName},`,
							paragraphs: [
								{
									text: `CMC staff reviewed a report about ${event.bandName}'s event "${event.eventTitle}" and removed it from the public gig guide. It is back in draft — it has not been deleted.`
								},
								...(event.notes ? [{ text: `Staff note: ${event.notes}` }] : []),
								{
									text: 'You can edit the event and publish it again once the issue is addressed, or reply to CMC staff if you have questions.'
								}
							],
							cta: { url: `${siteUrl}/member/bands/${event.bandId}`, label: 'View your band' }
						} satisfies NotificationEmailModel
					}
				});
			} catch (err) {
				captureException(err, {
					event: 'notification.band_event_unpublished',
					to: admin.userEmail
				});
			}
		}
	});

	// --- Volunteer hours submitted (notify staff) ---
	// Fans out per-staffer rather than to a single STAFF_CONTACT_EMAIL: this is
	// queue work, so it needs an in-app badge and each staffer's own preference.
	domainEvents.on('volunteer.hours_submitted', async ({ data: event }) => {
		const staff = await listStaffUsers();
		for (const member of staff) {
			try {
				await dispatch({
					type: 'volunteer_hours_submitted',
					userId: member.id,
					userEmail: member.email,
					title: `${event.userName} logged ${formatHours(event.hours)} of volunteer time`,
					body: `${event.roleName} — ${event.description}`,
					href: '/staff/volunteer'
				});
			} catch (err) {
				captureException(err, {
					event: 'notification.volunteer_hours_submitted',
					to: member.email
				});
			}
		}
	});

	// --- Volunteer hours approved (notify member) ---
	domainEvents.on('volunteer.hours_approved', async ({ data: event }) => {
		await dispatch({
			type: 'volunteer_hours_approved',
			userId: event.userId,
			userEmail: event.userEmail,
			title: `${formatHours(event.hours)} of volunteer time approved`,
			body: `${event.roleName} on ${formatWorkedOn(event.workedOn)}`,
			href: '/member/volunteer',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Your volunteer hours were approved`,
					heading: 'Volunteer Hours Approved',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{ text: 'Thanks for helping out — your logged hours have been approved.' },
						...(event.reviewNotes ? [{ text: `Note from staff: ${event.reviewNotes}` }] : [])
					],
					details: [
						{ label: 'Date', value: formatWorkedOn(event.workedOn) },
						{ label: 'Role', value: event.roleName },
						{ label: 'Hours', value: formatHours(event.hours) }
					],
					cta: { url: `${siteUrl}/member/volunteer`, label: 'View my hours' }
				} satisfies NotificationEmailModel
			}
		});
	});

	// --- Volunteer hours rejected (notify member) ---
	// The reason is the point of this email — without it the member can't correct
	// and resubmit, which is why the service requires a non-empty note.
	domainEvents.on('volunteer.hours_rejected', async ({ data: event }) => {
		await dispatch({
			type: 'volunteer_hours_rejected',
			userId: event.userId,
			userEmail: event.userEmail,
			title: `${formatHours(event.hours)} of volunteer time needs another look`,
			body: event.reviewNotes ?? `${event.roleName} on ${formatWorkedOn(event.workedOn)}`,
			href: '/member/volunteer',
			emailTemplate: {
				alias: GENERIC_ALIAS,
				model: {
					subject: `Your volunteer hours need another look`,
					heading: 'Volunteer Hours Returned',
					greeting: `Hi ${event.userName},`,
					paragraphs: [
						{
							text: "Staff reviewed the hours you logged and couldn't approve them as written. You can log them again with the correction below."
						},
						...(event.reviewNotes ? [{ text: `Reason: ${event.reviewNotes}` }] : [])
					],
					details: [
						{ label: 'Date', value: formatWorkedOn(event.workedOn) },
						{ label: 'Role', value: event.roleName },
						{ label: 'Hours', value: formatHours(event.hours) },
						...(event.reviewNotes ? [{ label: 'Reason', value: event.reviewNotes }] : [])
					],
					cta: { url: `${siteUrl}/member/volunteer`, label: 'Log hours again' }
				} satisfies NotificationEmailModel
			}
		});
	});
}
