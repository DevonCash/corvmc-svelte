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
	domainEvents.on('ticket.purchased', async ({ data: event }) => {
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
	domainEvents.on('event.cancelled', async ({ data: event }) => {
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
	domainEvents.on('reservation.reminder_due', async ({ data: event }) => {
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
	domainEvents.on('reservation.confirmation_reminder_due', async ({ data: event }) => {
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
	domainEvents.on('band.invitation_sent', async ({ data: event }) => {
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
	domainEvents.on('band.invitation_accepted', async ({ data: event }) => {
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

	// --- Platform invite (non-user) ---
	domainEvents.on('platform_invite.created', async ({ data: event }) => {
		const signupUrl = `${siteUrl}/login?invite=${event.token}`;
		const html = templates.platformInvitation({
			email: event.email,
			bandName: event.bandName,
			invitedByName: event.invitedByName,
			role: event.role,
			signupUrl
		});

		await dispatchEmailOnly({
			type: 'platform_invitation',
			toEmail: event.email,
			subject: `${event.invitedByName} invited you to join ${event.bandName} on CorvMC`,
			html
		});
	});

	// --- Recurring reservation skipped ---
	domainEvents.on('reservation.recurring_skipped', async ({ data: event }) => {
		const html = templates.recurringSkipped({
			userName: event.userName,
			skippedDate: event.skippedDate,
			startTime: event.startTime,
			endTime: event.endTime,
			reason: event.reason,
			siteUrl
		});

		await dispatch({
			type: 'recurring_skipped',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Recurring reservation skipped',
			body: `${event.skippedDate} ${event.startTime}–${event.endTime}: ${event.reason}`,
			href: '/member/reservations',
			emailSubject: `Recurring reservation skipped: ${event.skippedDate}`,
			emailHtml: html
		});
	});

	// --- Equipment loan scheduled (notify member) ---
	domainEvents.on('equipment.loan_scheduled', async ({ data: event }) => {
		const html = templates.loanScheduledConfirmation({
			userName: event.userName,
			equipmentName: event.equipmentName,
			scheduledPickupDate: new Date(event.scheduledPickupDate).toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'long',
				day: 'numeric'
			}),
			siteUrl
		});

		await dispatch({
			type: 'equipment_loan_scheduled',
			userId: event.userId,
			userEmail: event.userEmail,
			title: `Equipment pickup confirmed: ${event.equipmentName}`,
			body: `Pickup on ${new Date(event.scheduledPickupDate).toLocaleDateString()}`,
			href: '/member/equipment/loans',
			emailSubject: `Equipment pickup confirmed: ${event.equipmentName}`,
			emailHtml: html
		});
	});

	// --- Equipment loan requested (notify staff) ---
	domainEvents.on('equipment.loan_requested', async ({ data: event }) => {
		const staffEmail = env.STAFF_CONTACT_EMAIL ?? 'staff@corvmc.com';

		const html = templates.loanRequestedStaffNotification({
			userName: event.userName,
			equipmentName: event.equipmentName,
			memberNotes: event.memberNotes,
			requestedPickupDate: new Date(event.requestedPickupDate).toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'long',
				day: 'numeric'
			}),
			siteUrl,
			loanId: event.loanId
		});

		await dispatchEmailOnly({
			type: 'equipment_loan_requested',
			toEmail: staffEmail,
			subject: `Equipment request from ${event.userName}`,
			html
		});
	});

	// --- Recurring reservation waitlisted ---
	domainEvents.on('reservation.recurring_waitlisted', async ({ data: event }) => {
		const html = templates.recurringWaitlisted({
			userName: event.userName,
			date: event.date,
			startTime: event.startTime,
			endTime: event.endTime,
			reason: event.reason,
			siteUrl
		});

		await dispatch({
			type: 'recurring_waitlisted',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Recurring reservation waitlisted',
			body: `${event.date} ${event.startTime}–${event.endTime}: waiting for slot`,
			href: '/member/reservations',
			emailSubject: `Recurring reservation waitlisted: ${event.date}`,
			emailHtml: html
		});
	});

	// --- Waitlist slot available ---
	domainEvents.on('reservation.waitlist_slot_available', async ({ data: event }) => {
		const html = templates.waitlistSlotAvailable({
			userName: event.userName,
			date: event.date,
			startTime: event.startTime,
			endTime: event.endTime,
			expiresAt: event.expiresAt,
			confirmUrl: event.confirmUrl
		});

		await dispatch({
			type: 'waitlist_slot_available',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'A slot has opened up!',
			body: `${event.date} ${event.startTime}–${event.endTime} is available — confirm within 24 hours`,
			href: `/member/reservations?confirm=${event.reservationId}`,
			emailSubject: `Slot available: ${event.date} ${event.startTime}`,
			emailHtml: html
		});
	});

	// --- Waitlist expired ---
	domainEvents.on('reservation.waitlist_expired', async ({ data: event }) => {
		const html = templates.waitlistExpired({
			userName: event.userName,
			date: event.date,
			startTime: event.startTime,
			endTime: event.endTime,
			siteUrl
		});

		await dispatch({
			type: 'waitlist_expired',
			userId: event.userId,
			userEmail: event.userEmail,
			title: 'Waitlisted reservation expired',
			body: `${event.date} ${event.startTime}–${event.endTime} was not confirmed in time`,
			href: '/member/reservations',
			emailSubject: `Waitlisted reservation expired: ${event.date}`,
			emailHtml: html
		});
	});

	// --- Contact form submission ---
	domainEvents.on('contact.form_submitted', async ({ data: event }) => {
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
