<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		eventId,
		class: className = 'btn-sm btn-primary btn-outline',
		onsuccess,
		...rest
	}: {
		eventId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let attendeeName = $state('');
	let attendeeEmail = $state('');
	let quantity = $state(1);

	function execute() {
		const result = actionFetch(`/api/events/${eventId}/comp-tickets`, {
			body: { attendeeName, attendeeEmail, quantity }
		});
		attendeeName = '';
		attendeeEmail = '';
		quantity = 1;
		return result;
	}
</script>

<Action
	action={execute}
	label="Comp Tickets"
	modalTitle="Comp Tickets"
	successToast="Comp tickets issued"
	class={className}
	canSubmit={!!attendeeName && !!attendeeEmail && quantity >= 1}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<div class="space-y-3">
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Attendee name</span></div>
				<input type="text" class="input input-bordered w-full" bind:value={attendeeName} />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Email</span></div>
				<input type="email" class="input input-bordered w-full" bind:value={attendeeEmail} />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Quantity</span></div>
				<input type="number" class="input input-bordered w-full" bind:value={quantity} min="1" max="50" />
			</label>
		</div>
	{/snippet}
</Action>
