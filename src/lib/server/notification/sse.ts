// ---------------------------------------------------------------------------
// SSE connection registry
// ---------------------------------------------------------------------------
// Manages active SSE connections per user. When a notification is created,
// call pushToUser() to send it to all open tabs/windows for that user.
// ---------------------------------------------------------------------------

/** Minimal interface for pushing SSE chunks. Avoids faking WritableStreamDefaultWriter. */
export interface SSEWriter {
	write(chunk: Uint8Array): Promise<void>;
}

const connections = new Map<string, Set<SSEWriter>>();

const encoder = new TextEncoder();

export function addConnection(userId: string, writer: SSEWriter): void {
	let set = connections.get(userId);
	if (!set) {
		set = new Set();
		connections.set(userId, set);
	}
	set.add(writer);
}

export function removeConnection(userId: string, writer: SSEWriter): void {
	const set = connections.get(userId);
	if (!set) return;
	set.delete(writer);
	if (set.size === 0) {
		connections.delete(userId);
	}
}

export interface SSENotificationPayload {
	id: string;
	type: string;
	title: string;
	body?: string | null;
	href?: string | null;
	createdAt: string;
}

/**
 * Push a notification to all active SSE connections for a user.
 * Non-blocking — silently drops if the user has no open connections.
 */
export function pushToUser(userId: string, payload: SSENotificationPayload): void {
	const set = connections.get(userId);
	if (!set || set.size === 0) return;

	const data = `data: ${JSON.stringify(payload)}\n\n`;
	const encoded = encoder.encode(data);

	for (const writer of set) {
		writer.write(encoded).catch(() => {
			// Connection dead — clean up
			set.delete(writer);
			if (set.size === 0) connections.delete(userId);
		});
	}
}
