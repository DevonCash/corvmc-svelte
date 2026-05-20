<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		entityType,
		entityId,
		isDeactivated,
		entityLabel = entityType,
		deactivateWarning,
		class: className,
		onsuccess,
		...rest
	}: {
		entityType: string;
		entityId: string;
		isDeactivated: boolean;
		entityLabel?: string;
		deactivateWarning?: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	const label = $derived(isDeactivated ? 'Reactivate' : 'Deactivate');
	const action = $derived(isDeactivated ? 'reactivate' : 'deactivate');
	const resolvedClass = $derived(className ?? (isDeactivated ? 'btn-success btn-sm' : 'btn-error btn-sm'));
	const confirmText = $derived(
		isDeactivated ? undefined : (deactivateWarning ?? `Deactivate this ${entityLabel}?`)
	);
	const toast = $derived(isDeactivated ? `${entityLabel} reactivated` : `${entityLabel} deactivated`);
</script>

<Action
	action={() => actionFetch(`/api/${entityType}/${entityId}/${action}`)}
	{label}
	confirm={confirmText}
	successToast={toast}
	class={resolvedClass}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
