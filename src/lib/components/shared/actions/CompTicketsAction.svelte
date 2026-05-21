<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { compTickets } from '$lib/remote/events';

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
</script>

<Action
	action={compTickets}
	label="Comp Tickets"
	modalTitle="Comp Tickets"
	submitLabel="Issue Comp Tickets"
	successToast="Comp tickets issued"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="eventId" value={eventId} />
		<div class="space-y-3">
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Attendee name</span></div>
				<input type="text" name="attendeeName" class="input input-bordered w-full" required />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Email</span></div>
				<input type="email" name="attendeeEmail" class="input input-bordered w-full" required />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Quantity</span></div>
				<input type="number" name="quantity" class="input input-bordered w-full" value="1" min="1" max="50" />
			</label>
		</div>
	{/snippet}
</Action>
