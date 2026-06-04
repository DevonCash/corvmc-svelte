<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { removeSubscriber } from '$lib/remote/marketing.remote';

	const { fields } = removeSubscriber;

	let {
		audienceId,
		subscriberId,
		email,
		class: className = 'btn-ghost btn-xs text-error',
		onsuccess,
		...rest
	}: {
		audienceId: string;
		subscriberId: string;
		email: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={removeSubscriber}
	label="Remove"
	modalTitle="Confirm"
	successToast="Subscriber removed"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.audienceId.as('hidden', audienceId)} />
		<input {...fields.subscriberId.as('hidden', subscriberId)} />
		<p class="py-4">Remove {email} from this audience?</p>
	{/snippet}
</Action>
