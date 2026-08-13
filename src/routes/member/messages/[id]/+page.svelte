<script lang="ts">
	import { page } from '$app/state';
	import { IconSend } from '@tabler/icons-svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import ThreadTimeline from '$lib/components/inbox/ThreadTimeline.svelte';
	import {
		getMyConversation,
		sendConversationMessage,
		markConversationRead
	} from '$lib/remote/inbox.remote';

	const threadId = $derived(page.params.id!);

	// Deliberately the only query this page awaits. It carries viewerUserId, so
	// there is no second await for the reader's identity — and in particular not
	// getMemberLayout(), which markConversationRead refreshes to update the nav
	// badge. Awaiting a query that this component's own effect invalidates is an
	// effect_update_depth_exceeded loop.
	const t = $derived(await getMyConversation(threadId));

	const replyForm = sendConversationMessage.for('reply');
	let draft = $state('');

	// Resolved is final: staff closed it, so the next question starts its own
	// conversation rather than reopening a settled one.
	const closed = $derived(t.status === 'resolved');

	// Opening the conversation is what marks it read. Guarded so it fires once
	// per conversation: the command refreshes the layout badge, and an effect
	// that can re-trigger itself off its own write is how this page first
	// deadlocked.
	let markedId: string | undefined;
	$effect(() => {
		const id = threadId;
		if (markedId === id) return;
		markedId = id;
		void markConversationRead(id);
	});
</script>

<PageHeader
	title={t.subject ?? 'Conversation'}
	subtitle="Your conversation with CorvMC staff"
	backHref="/member/messages"
>
	<StatusBadge status={t.status} label />
</PageHeader>
<PageContent width="3xl">
	<ThreadTimeline messages={t.messages} viewerUserId={t.viewerUserId} />

	{#if closed}
		<Alert type="info" href="/member/messages">
			This conversation has been closed. Start a new message if you need anything else.
		</Alert>
	{:else}
		<div class="card border-base-300 bg-base-100 border">
			<div class="card-body gap-3 p-4">
				<Form
					remote={replyForm}
					successToast="Message sent"
					onsuccess={() => {
						draft = '';
					}}
					class="flex flex-col gap-2"
				>
					<input {...replyForm.fields.threadId.as('hidden', t.id)} />
					<FormField name="body" type="textarea" label="" bind:value={draft} />
					<div class="flex justify-end">
						<SubmitButton
							label="Send"
							successLabel="Sent"
							shortcut="mod+enter"
							disabled={!draft.trim()}
							class="btn-primary"
						>
							{#snippet icon()}<IconSend size={16} />{/snippet}
						</SubmitButton>
					</div>
				</Form>
			</div>
		</div>
	{/if}
</PageContent>
