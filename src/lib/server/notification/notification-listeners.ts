import { domainEvents } from '$lib/server/events/event-bus';
import { dispatch, dispatchEmailOnly } from './dispatcher';
import { captureException } from '$lib/server/sentry';
import { listStaffUsers } from '$lib/server/authorization';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// Notification listeners
// ---------------------------------------------------------------------------
// Subscribes to domain events and dispatches notifications through the
// appropriate channels. Each listener maps a domain event to one or more
// notification dispatches.
//
// Email bodies and subjects live in Postmark templates (source of truth in
// postmark/templates, pushed via `pnpm email:push`). Listeners supply only the
// template alias and its Mustachio model — never HTML.
// ---------------------------------------------------------------------------

function formatPickupDate(value: string): string {
	return new Date(value).toLocaleDateString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
}

export function registerAllNotificationListeners(): void {
	const siteUrl = env.PUBLIC_SITE_URL ?? 'https://corvmc.org';

	// --- Ticket purchase confirmation ---
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
					attendeeName: holder.attendeeName,
					eventTitle: event.eventTitle,
					eventDate: event.eventDate,
					refundNote: event.refundNote
				};

				if (holder.userId) {
					await dispatch({
						type: 'event_cancellation',
						userId: holder.userId,
						userEmail: holder.attendeeEmail,
						title: `${event.eventTitle} has been cancelled`,
						body: event.refundNote,
						href: '/member/tickets',
						emailTemplate: { alias: 'event-cancellation', model }
					});
				} else {
					await dispatchEmailOnly({
						type: 'event_cancellation',
						toEmail: holder.attendeeEmail,
						templateAlias: 'event-cancellation',
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
				alias: 'reservation-reminder',
				model: {
					userName: event.userName,
					date: event.date,
					startTime: event.startTime,
					endTime: event.endTime,
					siteUrl
				}
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
				alias: 'confirmation-reminder',
				model: {
					userName: event.userName,
					date: event.date,
					startTime: event.startTime,
					endTime: event.endTime,
					siteUrl
				}
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
				alias: 'band-invitation',
				model: {
					invitedUserName: event.invitedUserName,
					bandName: event.bandName,
					invitedByName: event.invitedByName,
					siteUrl
				}
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
						alias: 'band-invitation-accepted',
						model: {
							adminName: admin.userName,
							acceptedByName: event.acceptedByName,
							bandName: event.bandName,
							siteUrl,
							bandId: event.bandId
						}
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
			templateAlias: 'platform-invitation',
			model: {
				email: event.email,
				bandName: event.bandName,
				invitedByName: event.invitedByName,
				role: event.role,
				signupUrl
			}
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
				alias: 'recurring-skipped',
				model: {
					userName: event.userName,
					skippedDate: event.skippedDate,
					startTime: event.startTime,
					endTime: event.endTime,
					reason: event.reason,
					siteUrl
				}
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
				alias: 'loan-scheduled-confirmation',
				model: {
					userName: event.userName,
					equipmentName: event.equipmentName,
					scheduledPickupDate: formatPickupDate(event.scheduledPickupDate),
					siteUrl
				}
			}
		});
	});

	// --- Equipment loan requested (notify staff) ---
	domainEvents.on('equipment.loan_requested', async ({ data: event }) => {
		const staffEmail = env.STAFF_CONTACT_EMAIL ?? 'staff@corvmc.org';

		await dispatchEmailOnly({
			type: 'equipment_loan_requested',
			toEmail: staffEmail,
			templateAlias: 'loan-requested-staff',
			model: {
				userName: event.userName,
				equipmentName: event.equipmentName,
				memberNotes: event.memberNotes,
				requestedPickupDate: formatPickupDate(event.requestedPickupDate),
				siteUrl,
				loanId: event.loanId
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
				alias: 'recurring-waitlisted',
				model: {
					userName: event.userName,
					date: event.date,
					startTime: event.startTime,
					endTime: event.endTime,
					reason: event.reason,
					siteUrl
				}
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
				alias: 'waitlist-slot-available',
				model: {
					userName: event.userName,
					date: event.date,
					startTime: event.startTime,
					endTime: event.endTime,
					expiresAt: event.expiresAt,
					confirmUrl: event.confirmUrl
				}
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
				alias: 'waitlist-expired',
				model: {
					userName: event.userName,
					date: event.date,
					startTime: event.startTime,
					endTime: event.endTime,
					siteUrl
				}
			}
		});
	});

	// --- Contact form submission ---
	domainEvents.on('contact.form_submitted', async ({ data: event }) => {
		const staffEmail = env.STAFF_CONTACT_EMAIL ?? 'staff@corvmc.org';

		await dispatchEmailOnly({
			type: 'contact_form',
			toEmail: staffEmail,
			templateAlias: 'contact-form-forward',
			model: {
				senderName: event.name,
				senderEmail: event.email,
				message: event.message
			}
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
