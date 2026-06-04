<script lang="ts">
	import type { RemoteForm } from '@sveltejs/kit';
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';

	let {
		entityId,
		isDeactivated,
		deactivateAction,
		reactivateAction,
		entityLabel = 'item',
		deactivateWarning,
		class: className,
		onsuccess,
		...rest
	}: {
		entityId: string;
		isDeactivated: boolean;
		deactivateAction: RemoteForm<any, any>;
		reactivateAction: RemoteForm<any, any>;
		entityLabel?: string;
		deactivateWarning?: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	const action = $derived(isDeactivated ? reactivateAction : deactivateAction);
	const fields = $derived(action.fields);
	const label = $derived(isDeactivated ? 'Reactivate' : 'Deactivate');
	const resolvedClass = $derived(
		className ?? (isDeactivated ? 'btn-success btn-sm' : 'btn-error btn-sm')
	);
	const confirmText = $derived(
		isDeactivated ? undefined : (deactivateWarning ?? `Deactivate this ${entityLabel}?`)
	);
	const toast = $derived(
		isDeactivated ? `${entityLabel} reactivated` : `${entityLabel} deactivated`
	);
</script>

<Action
	{action}
	{label}
	modalTitle="Confirm"
	successToast={toast}
	class={resolvedClass}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input {...fields.id.as('hidden', entityId)} />
		{#if confirmText}
			<p class="py-4">{confirmText}</p>
		{:else}
			<p class="py-4">Reactivate this {entityLabel}?</p>
		{/if}
	{/snippet}
</Action>
