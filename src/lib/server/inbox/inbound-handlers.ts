import { findOrCreateThread } from './thread-service';
import { addInboundMessage } from './message-service';

export interface ContactFormParams {
	name: string;
	email: string;
	subject: string;
	message: string;
}

export async function handleContactForm(params: ContactFormParams) {
	const thread = await findOrCreateThread({
		channel: 'web',
		contactName: params.name,
		contactEmail: params.email,
		subject: params.subject
	});

	const message = await addInboundMessage({
		threadId: thread.id,
		body: params.message,
		authorName: params.name
	});

	return { thread, message };
}
