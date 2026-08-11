import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { PostmarkInboundPayload } from './inbound-handlers';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindOrCreateThread = vi.fn(async () => ({ id: 'new-thread', channel: 'email' }));
const mockFindThreadById = vi.fn(
	async (): Promise<Record<string, unknown> | undefined> => undefined
);
const mockReopenThread = vi.fn(async () => undefined);

vi.mock('./thread-service', () => ({
	findOrCreateThread: (...args: unknown[]) => mockFindOrCreateThread(...(args as [])),
	findThreadById: (...args: unknown[]) => mockFindThreadById(...(args as [])),
	reopenThread: (...args: unknown[]) => mockReopenThread(...(args as []))
}));

interface InboundMessageArgs {
	threadId: string;
	channelMessageId?: string | null;
	channelMetadata?: Record<string, unknown>;
	[key: string]: unknown;
}

const mockAddInboundMessage = vi.fn(async (_params: InboundMessageArgs) => ({ id: 'msg-1' }));
vi.mock('./message-service', () => ({
	addInboundMessage: (params: InboundMessageArgs) => mockAddInboundMessage(params)
}));

const mockParseReplyMailboxHash = vi.fn((): string | null => null);
vi.mock('./reply-address', () => ({
	parseReplyMailboxHash: (...args: unknown[]) => mockParseReplyMailboxHash(...(args as []))
}));

const mockIsChannelEnabled = vi.fn(async () => true);
vi.mock('./channel-config-service', () => ({
	isChannelEnabled: (...args: unknown[]) => mockIsChannelEnabled(...(args as []))
}));

const mockEmit = vi.fn();
vi.mock('$lib/server/events/event-bus', () => ({
	domainEvents: { emit: (...args: unknown[]) => mockEmit(...(args as [])) }
}));

beforeEach(() => {
	vi.clearAllMocks();
	mockFindOrCreateThread.mockResolvedValue({ id: 'new-thread', channel: 'email' });
	mockFindThreadById.mockResolvedValue(undefined);
	mockAddInboundMessage.mockResolvedValue({ id: 'msg-1' });
	mockParseReplyMailboxHash.mockReturnValue(null);
	mockIsChannelEnabled.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function payload(overrides: Partial<PostmarkInboundPayload> = {}): PostmarkInboundPayload {
	return {
		From: 'charlie@example.com',
		FromName: 'Charlie',
		FromFull: { Email: 'charlie@example.com', Name: 'Charlie' },
		To: 'reply+thread-1.sig@replies.test',
		Subject: 'Re: General Inquiry',
		TextBody: 'thanks!',
		HtmlBody: '<p>thanks!</p>',
		StrippedTextReply: 'thanks!',
		MessageID: 'postmark-guid',
		Date: '2026-08-03T00:00:00Z',
		Headers: [{ Name: 'Message-ID', Value: '<real-id@example.com>' }],
		Attachments: [],
		MailboxHash: 'thread-1.sig',
		...overrides
	};
}

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------

// The import stays dynamic so it resolves after the `vi.mock` calls above, but
// it is hoisted out of the test bodies: on a cold `node_modules/.vite` cache the
// first import transforms the whole module graph, which blows the 5s per-test
// timeout if it happens inside an `it()`.
let handlePostmarkInbound: typeof import('./inbound-handlers').handlePostmarkInbound;
let handleContactForm: typeof import('./inbound-handlers').handleContactForm;

beforeAll(async () => {
	({ handlePostmarkInbound, handleContactForm } = await import('./inbound-handlers'));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePostmarkInbound — MailboxHash routing', () => {
	it('appends a reply to the thread the hash names, without creating a new one', async () => {
		mockParseReplyMailboxHash.mockReturnValue('thread-1');
		mockFindThreadById.mockResolvedValue({ id: 'thread-1', channel: 'web', status: 'open' });

		const result = await handlePostmarkInbound(payload());

		expect(mockFindOrCreateThread).not.toHaveBeenCalled();
		expect(mockAddInboundMessage.mock.calls[0][0]).toMatchObject({ threadId: 'thread-1' });
		expect(result.thread).toMatchObject({ id: 'thread-1', channel: 'web' });
	});

	it('reopens a resolved thread when the contact replies', async () => {
		mockParseReplyMailboxHash.mockReturnValue('thread-1');
		mockFindThreadById.mockResolvedValue({ id: 'thread-1', channel: 'web', status: 'resolved' });

		await handlePostmarkInbound(payload());

		expect(mockReopenThread).toHaveBeenCalledWith('thread-1');
	});

	it('routes hash-addressed replies even when the email channel is off', async () => {
		mockIsChannelEnabled.mockResolvedValue(false);
		mockParseReplyMailboxHash.mockReturnValue('thread-1');
		mockFindThreadById.mockResolvedValue({ id: 'thread-1', channel: 'web', status: 'open' });

		await handlePostmarkInbound(payload());

		expect(mockAddInboundMessage).toHaveBeenCalledTimes(1);
	});

	it('stores the real Message-ID header rather than Postmark’s internal guid', async () => {
		mockParseReplyMailboxHash.mockReturnValue('thread-1');
		mockFindThreadById.mockResolvedValue({ id: 'thread-1', channel: 'web', status: 'open' });

		await handlePostmarkInbound(payload());

		expect(mockAddInboundMessage.mock.calls[0][0]).toMatchObject({
			channelMessageId: '<real-id@example.com>'
		});
	});

	it('does not overwrite the thread contact when a forwarded reply arrives', async () => {
		mockParseReplyMailboxHash.mockReturnValue('thread-1');
		mockFindThreadById.mockResolvedValue({
			id: 'thread-1',
			channel: 'web',
			status: 'open',
			contactEmail: 'charlie@example.com'
		});

		const result = await handlePostmarkInbound(
			payload({
				From: 'someone-else@example.com',
				FromFull: { Email: 'someone-else@example.com', Name: 'Forwarder' }
			})
		);

		expect(result.thread).toMatchObject({ contactEmail: 'charlie@example.com' });
		const metadata = mockAddInboundMessage.mock.calls[0][0].channelMetadata!;
		expect(metadata.fromEmail).toBe('someone-else@example.com');
	});
});

describe('handlePostmarkInbound — fallback for unrecognised mail', () => {
	it('creates an email thread when there is no hash', async () => {
		await handlePostmarkInbound(payload({ MailboxHash: undefined }));

		expect(mockFindOrCreateThread).toHaveBeenCalledWith(
			expect.objectContaining({ channel: 'email', contactEmail: 'charlie@example.com' })
		);
	});

	it('records an unresolvable hash so the routing failure is diagnosable', async () => {
		await handlePostmarkInbound(payload({ MailboxHash: 'garbage.hash' }));

		const metadata = mockAddInboundMessage.mock.calls[0][0].channelMetadata!;
		expect(metadata.unresolvedMailboxHash).toBe('garbage.hash');
	});

	it('falls back to find-or-create when the hash names a thread that no longer exists', async () => {
		mockParseReplyMailboxHash.mockReturnValue('deleted-thread');
		mockFindThreadById.mockResolvedValue(undefined);

		await handlePostmarkInbound(payload());

		expect(mockFindOrCreateThread).toHaveBeenCalledTimes(1);
	});

	it('drops unsolicited mail when the email channel is disabled', async () => {
		mockIsChannelEnabled.mockResolvedValue(false);

		const result = await handlePostmarkInbound(payload({ MailboxHash: undefined }));

		expect(mockFindOrCreateThread).not.toHaveBeenCalled();
		expect(result.thread).toBeNull();
	});
});

describe('handleContactForm', () => {
	it('emits contact.form_submitted so staff get the alert email', async () => {
		mockFindOrCreateThread.mockResolvedValue({ id: 'thread-9', channel: 'web' });

		await handleContactForm({
			name: 'Charlie',
			email: 'charlie@example.com',
			subject: 'General Inquiry',
			message: 'Hello!'
		});

		expect(mockEmit).toHaveBeenCalledWith('contact.form_submitted', {
			threadId: 'thread-9',
			name: 'Charlie',
			email: 'charlie@example.com',
			subject: 'General Inquiry',
			message: 'Hello!'
		});
	});
});
