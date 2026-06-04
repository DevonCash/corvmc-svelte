<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { compTickets } from '$lib/remote/events.remote';

	const { fields } = compTickets;

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
		<input {...fields.eventId.as('hidden', eventId)} />
		<div class="space-y-3">
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Attendee name</span></div>
				<input {...fields.attendeeName.as('text')} class="input input-bordered w-full" required />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Email</span></div>
				<input {...fields.attendeeEmail.as('email')} class="input input-bordered w-full" required />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Quantity</span></div>
				<input
					{...fields.quantity.as('text')}
					type="number"
					class="input input-bordered w-full"
					value="1"
					min="1"
					max="50"
				/>
			</label>
		</div>
	{/snippet}
</Action>
