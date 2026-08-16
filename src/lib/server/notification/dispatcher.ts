import { sendEmailWithTemplate } from './email/postmark-client';
import { normalizeNotificationModel } from './email/normalize-model';
import { NOTIFICATION_TYPES } from '$lib/server/db/schema/notification';
import { createNotification } from './in-app-service';
import { getPreference } from './preference-service';
import { pushToUser } from './sse';
import { captureException } from '$lib/server/sentry';
import type { NotificationEmailPayload } from '$lib/types/notification-email';

// ---------------------------------------------------------------------------
// Notification dispatcher
// ---------------------------------------------------------------------------
// Central function that routes a notification to the appropriate channels
// based on user preferences. Called by notification listeners.
//
// The dispatcher does NOT know about specific notification types — callers
// provide the type key, recipient, in-app content, and (for email) a Postmark
// template alias plus its model. Email bodies/subjects live in Postmark.
//
// Models bound for the generic `notification` template are passed through
// `normalizeNotificationModel` first, which fills in the derived fields every
// listener would otherwise have to remember (see that module for why).
// ---------------------------------------------------------------------------

/** The generic template whose model gets normalized. */
const GENERIC_ALIAS = 'notification';

function prepareModel(
	alias: string,
	model: Record<string, unknown>,
	type: string
): Record<string, unknown> {
	// Looked up from the registry rather than passed by the caller: whether a
	// notification may quote a member is a property of what kind of notification
	// it is, which is where every other per-type policy already lives.
	const omitUserContent = NOTIFICATION_TYPES.find((t) => t.key === type)?.emailOmitsUserContent;
	return alias === GENERIC_ALIAS
		? normalizeNotificationModel(model as unknown as NotificationEmailPayload, {
				omitUserContent
			})
		: model;
}

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
	/** Email: Postmark template alias + Mustachio model (subject lives in the template) */
	emailTemplate?: { alias: string; model: Record<string, unknown> };
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
	if ((pref.email || params.forceEmail) && params.emailTemplate) {
		try {
			await sendEmailWithTemplate({
				to: params.userEmail,
				templateAlias: params.emailTemplate.alias,
				model: prepareModel(params.emailTemplate.alias, params.emailTemplate.model, params.type),
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
	templateAlias: string;
	model: Record<string, unknown>;
	/** Set when the recipient is expected to reply — see SendTemplateParams. */
	replyTo?: string | null;
}): Promise<void> {
	try {
		await sendEmailWithTemplate({
			to: params.toEmail,
			templateAlias: params.templateAlias,
			// Same per-type policy as dispatch(): this path takes a `type` too, and
			// leaving it out would make the rule hold on one route and not the other.
			model: prepareModel(params.templateAlias, params.model, params.type),
			replyTo: params.replyTo,
			tag: params.type
		});
	} catch (err) {
		captureException(err, { channel: 'email-only', type: params.type, to: params.toEmail });
	}
}
