<script lang="ts">
	/**
	 * Messages and internal notes on one chronological spine.
	 *
	 * Notes used to render as a block after every message, so a note about the
	 * second message appeared below the ninth. They are also deliberately lighter
	 * than messages: no bubble, no card, just an indented annotation — a note is a
	 * margin scribble on the conversation, not a turn in it.
	 */
	import { IconNote } from '@tabler/icons-svelte';
	import { formatDateTime } from '$lib/utils/format';

	type Message = {
		id: string;
		direction: 'inbound' | 'outbound';
		body: string;
		authorName: string | null;
		createdAt: Date;
	};

	type Note = {
		id: string;
		body: string;
		authorName: string | null;
		createdAt: Date;
	};

	let {
		messages,
		notes,
		contactName
	}: {
		messages: Message[];
		notes: Note[];
		contactName?: string | null;
	} = $props();

	type Entry =
		| { kind: 'message'; at: number; message: Message }
		| { kind: 'note'; at: number; note: Note };

	const entries = $derived.by(() => {
		const combined: Entry[] = [
			...messages.map((message) => ({
				kind: 'message' as const,
				at: new Date(message.createdAt).getTime(),
				message
			})),
			...notes.map((note) => ({
				kind: 'note' as const,
				at: new Date(note.createdAt).getTime(),
				note
			}))
		];
		return combined.sort((a, b) => a.at - b.at);
	});
</script>

<div class="space-y-4">
	{#each entries as entry (entry.kind === 'message' ? `m${entry.message.id}` : `n${entry.note.id}`)}
		{#if entry.kind === 'message'}
			{@const msg = entry.message}
			<div class="chat {msg.direction === 'inbound' ? 'chat-start' : 'chat-end'}">
				<div class="chat-header mb-1">
					{msg.authorName ?? (msg.direction === 'inbound' ? (contactName ?? 'Contact') : 'Staff')}
					<time class="ml-2 text-xs opacity-50">{formatDateTime(msg.createdAt)}</time>
				</div>
				<!-- Bodies arrive as plain text; without this every multi-paragraph
				     email collapsed into one run-on block. -->
				<div
					class="chat-bubble whitespace-pre-wrap {msg.direction === 'outbound'
						? 'chat-bubble-primary'
						: ''}"
				>
					{msg.body}
				</div>
			</div>
		{:else}
			{@const note = entry.note}
			<div class="border-base-content/20 mx-6 border-l-2 border-dashed py-1 pl-3">
				<div class="flex items-center gap-1.5 text-xs opacity-50">
					<IconNote size={13} />
					{note.authorName ?? 'Staff'} · {formatDateTime(note.createdAt)}
				</div>
				<div class="text-sm whitespace-pre-wrap opacity-70">{note.body}</div>
			</div>
		{/if}
	{:else}
		<p class="py-8 text-center text-sm opacity-60">No messages in this conversation yet.</p>
	{/each}
</div>
