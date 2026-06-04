<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { subscribe } from '$lib/remote/account.remote';

	const { fields } = subscribe;

	let {
		audienceId,
		name,
		class: className = 'btn-primary btn-xs',
		onsuccess,
		...rest
	}: {
		audienceId: string;
		name: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={subscribe}
	label="Subscribe"
	modalTitle="Subscribe"
	successToast={`Subscribed to ${name}`}
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.audienceId.as('hidden', audienceId)} />
		<p class="py-4">Subscribe to {name}?</p>
	{/snippet}
</Action>
