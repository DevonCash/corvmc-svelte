<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { removeBandMember } from '$lib/remote/bands.remote';

	let {
		bandId,
		memberId,
		name,
		class: className = 'btn-ghost btn-xs text-error',
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
	action={removeBandMember}
	label="Remove"
	modalTitle="Confirm"
	successToast="Member removed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="memberId" value={memberId} />
		<p class="py-4">Remove {name} from this band?</p>
	{/snippet}
</Action>
