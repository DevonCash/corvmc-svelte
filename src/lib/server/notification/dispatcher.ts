import { sendEmail } from './email/postmark-client';
import { createNotification } from './in-app-service';
import { getPreference } from './preference-service';
import { pushToUser } from './sse';
import { captureException } from '$lib/server/sentry';

// ---------------------------------------------------------------------------
// Notification dispatcher
// ---------------------------------------------------------------------------
// Central function that routes a notification to the appropriate channels
// based on user preferences. Called by notification listeners.
//
// The dispatcher does NOT know about specific notification types — callers
// provide the type key, recipient, content, and pre-compiled email HTML.
// ---------------------------------------------------------------------------

export interface DispatchParams {
	/** The notification type key (from schema/notification.ts) */
	type: string;
	/** Target user */
	userId: string;
	userEmail: string;
	/** In-app notification content */
	title: string;
	body?: string;
	href?: string;
	data?: Record<string, unknown>;
	/** Email content (pre-compiled HTML) */
	emailSubject?: string;
	emailHtml?: string;
	/** Override: send email even if no userId (e.g., ticket buyer without account) */
	forceEmail?: boolean;
}

/**
 * Dispatch a notification through enabled channels.
 * Checks user preferences, creates in-app notification, sends email,
 * and pushes SSE event. Fire-and-forget — errors are logged, not thrown.
 */
export async function dispatch(params: DispatchParams): Promise<void> {
	const pref = await getPreference(params.userId, params.type);

	// In-app notification
	if (pref.inApp) {
		try {
			const row = await createNotification({
				userId: params.userId,
				type: params.type,
				title: params.title,
				body: params.body,
				href: params.href,
				data: params.data
			});

			// Push via SSE for real-time delivery
			pushToUser(params.userId, {
				id: row.id,
				type: row.type,
				title: row.title,
				body: row.body,
				href: row.href,
				createdAt: row.createdAt.toISOString()
			});
		} catch (err) {
			captureException(err, { channel: 'in-app', type: params.type, userId: params.userId });
		}
	}

	// Email
	if ((pref.email || params.forceEmail) && params.emailSubject && params.emailHtml) {
		try {
			await sendEmail({
				to: params.userEmail,
				subject: params.emailSubject,
				htmlBody: params.emailHtml,
				tag: params.type
			});
		} catch (err) {
			captureException(err, { channel: 'email', type: params.type, to: params.userEmail });
		}
	}
}

/**
 * Dispatch to a recipient who may not have an account (e.g., ticket buyer).
 * Sends email only — no in-app notification or SSE.
 */
export async function dispatchEmailOnly(params: {
	type: string;
	toEmail: string;
	subject: string;
	html: string;
}): Promise<void> {
	try {
		await sendEmail({
			to: params.toEmail,
			subject: params.subject,
			htmlBody: params.html,
			tag: params.type
		});
	} catch (err) {
		captureException(err, { channel: 'email-only', type: params.type, to: params.toEmail });
	}
}
