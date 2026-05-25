<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { revokePlatformInvite } from '$lib/remote/bands.remote';

	const { fields } = revokePlatformInvite;

	let {
		bandId,
		inviteId,
		email,
		class: className = 'btn-ghost btn-xs text-warning',
		onsuccess,
		...rest
	}: {
		bandId: string;
		inviteId: string;
		email: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={revokePlatformInvite}
	label="Revoke"
	modalTitle="Confirm"
	successToast="Invite revoked"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.inviteId.as('hidden', inviteId)} />
		<p class="py-4">Revoke invite for {email}?</p>
	{/snippet}
</Action>
