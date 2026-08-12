<script lang="ts">
	/**
	 * Start a conversation with staff. A modal on the list page rather than a
	 * /new route, matching every other create flow in the app.
	 */
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { IconPlus } from '@tabler/icons-svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { startConversation } from '$lib/remote/inbox.remote';

	const startForm = startConversation.for('new-conversation');
</script>

<Action
	action={startForm}
	label="New Message"
	modalTitle="Message CorvMC staff"
	submitLabel="Send"
	successToast="Message sent"
	class="btn-primary btn-sm"
	onsuccess={(result) => {
		const { threadId } = (result ?? {}) as { threadId?: string };
		if (threadId) goto(resolve(`/member/messages/${threadId}`));
	}}
>
	{#snippet icon()}<IconPlus size={16} />{/snippet}
	{#snippet form()}
		<FormField
			name="subject"
			label="What's this about?"
			type="text"
			description="A short summary helps staff route your message."
		/>
		<FormField name="body" label="Message" type="textarea" />
	{/snippet}
</Action>
