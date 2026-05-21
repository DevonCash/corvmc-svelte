<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { revokePlatformInvite } from '$lib/remote/bands';

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
		<input type="hidden" name="inviteId" value={inviteId} />
		<p class="py-4">Revoke invite for {email}?</p>
	{/snippet}
</Action>
