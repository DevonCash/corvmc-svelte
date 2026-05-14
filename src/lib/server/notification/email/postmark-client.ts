import { ServerClient } from 'postmark';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// Postmark email client
// ---------------------------------------------------------------------------
// Thin wrapper around the Postmark SDK. Lazily initialised on first use
// so the server token isn't required during build/test.
// ---------------------------------------------------------------------------

let client: ServerClient | null = null;

function getClient(): ServerClient {
	if (client) return client;

	const token = env.POSTMARK_SERVER_TOKEN;
	if (!token) {
		throw new Error('POSTMARK_SERVER_TOKEN is not configured');
	}

	client = new ServerClient(token);
	return client;
}

export interface SendEmailParams {
	to: string;
	subject: string;
	htmlBody: string;
	textBody?: string;
	tag?: string;
	/** Metadata attached to the message for tracking in Postmark */
	metadata?: Record<string, string>;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
	const fromAddress = env.EMAIL_FROM_ADDRESS ?? 'noreply@corvmc.com';
	const fromName = env.EMAIL_FROM_NAME ?? 'CorvMC';

	try {
		await getClient().sendEmail({
			From: `${fromName} <${fromAddress}>`,
			To: params.to,
			Subject: params.subject,
			HtmlBody: params.htmlBody,
			TextBody: params.textBody,
			Tag: params.tag,
			Metadata: params.metadata
		});
	} catch (err) {
		console.error('[email] Failed to send:', {
			to: params.to,
			subject: params.subject,
			error: err
		});
		throw err;
	}
}
