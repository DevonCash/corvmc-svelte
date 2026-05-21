<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { revokeBandInvite } from '$lib/remote/bands.remote';

	let {
		bandId,
		memberId,
		name,
		class: className = 'btn-ghost btn-xs text-warning',
		onsuccess,
		...rest
	}: {
		bandId: string;
		memberId: string;
		name: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={revokeBandInvite}
	label="Revoke"
	modalTitle="Confirm"
	successToast="Invitation revoked"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="memberId" value={memberId} />
		<p class="py-4">Revoke invitation for {name}?</p>
	{/snippet}
</Action>
