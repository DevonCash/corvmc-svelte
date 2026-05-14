import { domainEvents } from '$lib/server/events/event-bus';
import { dispatch, dispatchEmailOnly } from './dispatcher';
import { templates } from './email';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// Notification listeners
// ---------------------------------------------------------------------------
// Subscribes to domain events and dispatches notifications through the
// appropriate channels. Each listener maps a domain event to one or more
// notification dispatches.
// ---------------------------------------------------------------------------

export function registerAllNotificationListeners(): void {
	const siteUrl = env.PUBLIC_SITE_URL ?? 'https://corvmc.com';

	// --- Ticket purchase confirmation ---
	domainEvents.on('ticket.purchased', async (event) => {
		const html = templates.ticketConfirmation({
			attendeeName: event.attendeeName,
			eventTitle: event.eventTitle,
			eventDate: event.eventDate,
			eventTime: event.eventTime,
			ticketCodes: event.ticketCodes,
			quantity: event.quantity
		});

		// Ticket buyers may not have accounts — use email-only dispatch
		await dispatchEmailOnly({
			type: 'ticket_confirmation',
			toEmail: event.attendeeEmail,
			subject: `Your tickets for ${event.eventTitle}`,
			html
		});
	});

	// --- Event cancellation to ticket holders ---
	domainEvents.on('event.cancelled', async (event) => {
		for (const holder of event.ticketHolders) {
			try {
				const html = templates.eventCancellation({
					attendeeName: holder.attendeeName,
					eventTitle: event.eventTitle,
					eventDate: event.eventDate,
					refundNote: event.refundNote
				});

				if (holder.userId) {
					await dispatch({
						type: 'event_cancellation',
						userId: holder.userId,
						userEmail: holder.attendeeEmail,
						title: `${event.eventTitle} has been cancelled`,
						body: event.refundNote,
						href: '/member/tickets',
						emailSubject: `${event.eventTitle} has been cancelled`,
						emailHtml: html
					});
				} else {
					await dispatchEmailOnly({
						type: 'event_cancellation',
						toEmail: holder.attendeeEmail,
						subject: `${event.eventTitle} has been cancelled`,
						html
					});
				}
			} catch (err) {
				console.error(`[notification] Failed to notify ticket holder ${holder.attendeeEmail}:`, err);
			}
		}
	});

	// --- Reservation reminder ---
	domainEvents.on('reservation.reminder_due', async (event) => {
		const html = templates.reservationReminder({
			userName: event.userName,
			date: event.date,
			startTime: event.startTime,
			endTime: event.endTime,
			siteUrl
		});

		await dispatch({
			type: 'reservation_reminder',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Upcoming reservation reminder',
			body: `${event.date} from ${event.startTime} to ${event.endTime}`,
			href: '/member/reservations',
			emailSubject: `Reservation reminder: ${event.date}`,
			emailHtml: html
		});
	});

	// --- Confirmation reminder ---
	domainEvents.on('reservation.confirmation_reminder_due', async (event) => {
		const html = templates.confirmationReminder({
			userName: event.userName,
			date: event.date,
			startTime: event.startTime,
			endTime: event.endTime,
			siteUrl
		});

		await dispatch({
			type: 'confirmation_reminder',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Please confirm your reservation',
			body: `${event.date} from ${event.startTime} to ${event.endTime}`,
			href: '/member/reservations',
			emailSubject: `Please confirm your reservation: ${event.date}`,
			emailHtml: html
		});
	});

	// --- Band invitation sent ---
	domainEvents.on('band.invitation_sent', async (event) => {
		const html = templates.bandInvitation({
			invitedUserName: event.invitedUserName,
			bandName: event.bandName,
			invitedByName: event.invitedByName,
			siteUrl
		});

		await dispatch({
			type: 'band_invitation',
			userId: event.invitedUserId,
			userEmail: event.invitedUserEmail,
			title: `You've been invited to ${event.bandName}`,
			body: `${event.invitedByName} invited you to join their band`,
			href: '/member',
			emailSubject: `${event.invitedByName} invited you to ${event.bandName}`,
			emailHtml: html
		});
	});

	// --- Band invitation accepted ---
	domainEvents.on('band.invitation_accepted', async (event) => {
		for (const admin of event.bandAdmins) {
			try {
				const html = templates.bandInvitationAccepted({
					adminName: admin.userName,
					acceptedByName: event.acceptedByName,
					bandName: event.bandName,
					siteUrl,
					bandId: event.bandId
				});

				await dispatch({
					type: 'band_invitation_accepted',
					userId: admin.userId,
					userEmail: admin.userEmail,
					title: `${event.acceptedByName} joined ${event.bandName}`,
					body: 'A new member has joined your band',
					href: `/member/bands/${event.bandId}`,
					emailSubject: `${event.acceptedByName} joined ${event.bandName}`,
					emailHtml: html
				});
			} catch (err) {
				console.error(`[notification] Failed to notify band admin ${admin.userEmail}:`, err);
			}
		}
	});

	// --- Contact form submission ---
	domainEvents.on('contact.form_submitted', async (event) => {
		const staffEmail = env.STAFF_CONTACT_EMAIL ?? 'staff@corvmc.com';

		const html = templates.contactFormForward({
			senderName: event.name,
			senderEmail: event.email,
			message: event.message
		});

		await dispatchEmailOnly({
			type: 'contact_form',
			toEmail: staffEmail,
			subject: `Contact form: ${event.name}`,
			html
		});
	});
}
