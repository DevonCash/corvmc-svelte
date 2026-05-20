<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		reservationId,
		showReasonInput = false,
		class: className = 'btn-error btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		reservationId: string;
		showReasonInput?: boolean;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let reason = $state('');

	function execute() {
		const body = reason ? { reason } : undefined;
		return actionFetch(`/api/reservations/${reservationId}/cancel`, { body });
	}

	function handleSuccess() {
		reason = '';
		(onsuccess ?? invalidateAll)();
	}
</script>

{#if showReasonInput}
	<Action
		action={execute}
		label="Cancel"
		modalTitle="Cancel Reservation"
		successToast="Cancelled"
		class={className}
		onsuccess={handleSuccess}
		{...rest}
	>
		{#snippet form({ close })}
			<p class="text-sm mb-3">Cancel this reservation?</p>
			<input
				type="text"
				bind:value={reason}
				placeholder="Reason (optional)"
				class="input-bordered input input-sm w-full"
			/>
		{/snippet}
	</Action>
{:else}
	<Action
		action={execute}
		label="Cancel"
		confirm="Cancel this reservation?"
		successToast="Cancelled"
		class={className}
		onsuccess={handleSuccess}
		{...rest}
	/>
{/if}
