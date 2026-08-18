<script lang="ts">
	/**
	 * One box for both outbound replies and internal notes.
	 *
	 * The two used to be separate forms — one always visible, one behind a toggle —
	 * which meant two textareas doing the same job and a decision to make before
	 * you started typing. Here the draft is owned by the component and the mode
	 * only decides where it gets sent, so switching mid-sentence keeps the text.
	 *
	 * Both modes submit through the same `<Form>`; only the `remote` prop swaps.
	 * `Form` derives its enhance attributes, and both branches render the same
	 * `<form>` element, so the textarea is never remounted. That also buys the
	 * pending state for free: `SubmitButton` spins and disables for the whole
	 * round-trip, which for an email reply is a real wait.
	 */
	import type { RemoteForm } from '@sveltejs/kit';
	import { IconNote, IconSend } from '@tabler/icons-svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';

	let {
		threadId,
		replyForm,
		noteForm,
		/** Why replying is impossible, if it is. Set = the Reply tab is disabled. */
		replyBlockedReason,
		onsent
	}: {
		threadId: string;
		replyForm: Omit<RemoteForm<{ threadId: string; body: string }, unknown>, 'for'>;
		noteForm: Omit<RemoteForm<{ threadId: string; body: string }, unknown>, 'for'>;
		replyBlockedReason?: string;
		onsent?: () => void;
	} = $props();

	let requestedMode = $state<'reply' | 'note'>('reply');
	let draft = $state('');

	// When replying is impossible the composer is a note box regardless of what
	// was last picked — a channel can be disabled while the page is open, and the
	// draft should not end up pointed at a target it can't reach.
	const isNote = $derived(requestedMode === 'note' || !!replyBlockedReason);
	const mode = $derived(isNote ? 'note' : 'reply');
	const activeForm = $derived(isNote ? noteForm : replyForm);

	const tabs = $derived([
		{ key: 'reply', label: 'Reply' },
		{ key: 'note', label: 'Internal note' }
	]);
</script>

<div
	class="card border {isNote ? 'border-warning/40 bg-warning/5' : 'border-base-300 bg-base-100'}"
>
	<div class="card-body gap-3 p-4">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<TabBar
				{tabs}
				active={mode}
				onchange={(key) => {
					if (key === 'reply' && replyBlockedReason) return;
					requestedMode = key as 'reply' | 'note';
				}}
			/>
			{#if isNote}
				<span class="flex items-center gap-1 text-subtle">
					<IconNote size={14} /> Staff only — the contact never sees this
				</span>
			{/if}
		</div>

		{#if replyBlockedReason}
			<p class="text-warning text-xs">{replyBlockedReason}</p>
		{/if}

		<Form
			remote={activeForm}
			successToast={isNote ? 'Note added' : 'Reply sent'}
			onsuccess={() => {
				draft = '';
				onsent?.();
			}}
			class="flex flex-col gap-2"
		>
			<input {...activeForm.fields.threadId.as('hidden', threadId)} />
			<FormField
				name="body"
				type="textarea"
				label=""
				rows={isNote ? 2 : 4}
				placeholder={isNote ? 'Add an internal note…' : 'Type your reply…'}
				bind:value={draft}
			/>
			<div class="flex justify-end">
				<SubmitButton
					label={isNote ? 'Add Note' : 'Send Reply'}
					successLabel={isNote ? 'Added' : 'Sent'}
					shortcut="mod+enter"
					disabled={!draft.trim()}
					class={isNote ? 'btn-neutral' : 'btn-primary'}
				>
					{#snippet icon()}
						{#if isNote}<IconNote size={16} />{:else}<IconSend size={16} />{/if}
					{/snippet}
				</SubmitButton>
			</div>
		</Form>
	</div>
</div>
