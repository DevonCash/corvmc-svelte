// ---------------------------------------------------------------------------
// Notification type registry
// ---------------------------------------------------------------------------
// Defines all notification types the system can send. Each type has a key,
// a human-readable label (for the preference UI), and default channel
// enablement. The actual email/in-app content is assembled by the
// notification listeners — this registry just controls routing and prefs.
// ---------------------------------------------------------------------------

export interface NotificationTypeDef {
	/** Unique key matching the `type` column in the notification table */
	key: string;
	/** Human label shown in the preferences UI */
	label: string;
	/** Description shown in the preferences UI */
	description: string;
	/** Default channel enablement when no preference row exists */
	defaults: {
		email: boolean;
		inApp: boolean;
		sms: boolean;
	};
	/** If true, this type cannot be disabled (always sent) */
	mandatory?: boolean;
}

export const NOTIFICATION_TYPES: NotificationTypeDef[] = [
	{
		key: 'ticket_confirmation',
		label: 'Ticket purchase confirmation',
		description: 'Confirmation email with your ticket codes after purchase',
		defaults: { email: true, inApp: true, sms: false },
		mandatory: true
	},
	{
		key: 'event_cancellation',
		label: 'Event cancellation',
		description: 'Notification when an event you have tickets for is cancelled',
		defaults: { email: true, inApp: true, sms: false },
		mandatory: true
	},
	{
		key: 'check_in_reminder',
		label: 'Event check-in reminder',
		description: 'Reminder before an event with your ticket code',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'reservation_reminder',
		label: 'Reservation reminder',
		description: 'Reminder about upcoming reservations',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'confirmation_reminder',
		label: 'Confirmation reminder',
		description: 'Reminder to confirm unconfirmed reservations',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'band_invitation',
		label: 'Band invitation',
		description: 'Notification when someone invites you to their band',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'band_invitation_accepted',
		label: 'Band invitation accepted',
		description: 'Notification when someone accepts your band invitation',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'recurring_skipped',
		label: 'Recurring reservation skipped',
		description: 'Notification when a recurring reservation is skipped due to a conflict',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'equipment_loan_scheduled',
		label: 'Equipment loan confirmed',
		description: 'Notification when staff confirms your equipment pickup',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'equipment_loan_requested',
		label: 'Equipment loan requested (staff)',
		description: 'Notification when a member requests equipment',
		defaults: { email: true, inApp: true, sms: false }
	},
	{
		key: 'contact_form',
		label: 'Contact form submission',
		description: 'Forwarded contact form messages (staff only)',
		defaults: { email: true, inApp: false, sms: false },
		mandatory: true
	}
];

/** Lookup a type definition by key */
export function getNotificationType(key: string): NotificationTypeDef | undefined {
	return NOTIFICATION_TYPES.find((t) => t.key === key);
}
