<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { updateClosure } from '$lib/remote/closures.remote';

	let {
		closureId,
		reason,
		startsAt,
		endsAt,
		class: className = 'btn-primary btn-sm',
		onsuccess,
		...rest
	}: {
		closureId: string;
		reason: string;
		startsAt: string;
		endsAt: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	const { fields } = updateClosure;
</script>

<Action
	action={updateClosure}
	label="Save"
	successToast="Closure updated"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.id.as('hidden', closureId)} />
		<input {...fields.reason.as('hidden', reason)} />
		<input {...fields.startsAt.as('hidden', startsAt)} />
		<input {...fields.endsAt.as('hidden', endsAt)} />
	{/snippet}
</Action>
