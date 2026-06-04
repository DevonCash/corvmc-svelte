<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Modal from '$lib/components/shared/Modal.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import ConflictWarnings from '$lib/components/shared/reservations/ConflictWarnings.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { checkConflicts, createEvent } from '$lib/remote/events.remote';

	const { fields } = createEvent;

	let { open = $bindable(false) }: { open: boolean } = $props();

	let title = $state('');
	let description = $state('');
	let eventDate = $state(new Date().toISOString().split('T')[0]);
	let eventStartTime = $state('');
	let eventEndTime = $state('');
	let doorsTime = $state('');
	let tags = $state('');
	let reserveSpace = $state(false);
	let reservationStartTime = $state('');
	let reservationEndTime = $state('');
	let ticketingEnabled = $state(false);
	let ticketPriceDollars = $state('');
	let ticketQuantity = $state('');
	let posterFile = $state<File | null>(null);
	let hasConflicts = $state(false);

	// Compute the ticket price in cents for the hidden field
	const ticketPriceCents = $derived(
		ticketingEnabled && ticketPriceDollars
			? String(Math.round(parseFloat(ticketPriceDollars) * 100))
			: ''
	);

	$effect(() => {
		if (reserveSpace && !reservationStartTime && eventStartTime) {
			reservationStartTime = eventStartTime;
		}
		if (reserveSpace && !reservationEndTime && eventEndTime) {
			reservationEndTime = eventEndTime;
		}
	});

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		posterFile = input.files?.[0] ?? null;
	}

	async function handleSuccess(result?: { eventId?: string }) {
		if (posterFile && result?.eventId) {
			const formData = new FormData();
			formData.append('poster', posterFile);
			const res = await fetch(`/api/events/${result.eventId}/poster`, {
				method: 'POST',
				body: formData
			});
			if (!res.ok) {
				toast.warning('Event created but poster upload failed');
			}
		}

		open = false;
		resetForm();
		await invalidateAll();

		if (result?.eventId) {
			goto(`/staff/events/${result.eventId}`);
		}
	}

	function resetForm() {
		title = '';
		description = '';
		eventDate = new Date().toISOString().split('T')[0];
		eventStartTime = '';
		eventEndTime = '';
		doorsTime = '';
		tags = '';
		ticketingEnabled = false;
		ticketPriceDollars = '';
		ticketQuantity = '';
		reserveSpace = false;
		reservationStartTime = '';
		reservationEndTime = '';
		posterFile = null;
	}
</script>

<Modal bind:open title="New Event" maxWidth="max-w-md" onclose={resetForm}>
	<svelte:boundary>
		<Form
			remote={createEvent}
			successToast="Event created"
			onsuccess={handleSuccess}
			class="space-y-4"
		>
			<Field name="title" type="text" label="Title" bind:value={title} />
			<Field name="description" type="textarea" label="Description" bind:value={description} />
			<Field name="eventDate" type="date" label="Date" bind:value={eventDate} />

			<div class="grid grid-cols-2 gap-4">
				<Field name="eventStartTime" type="time" label="Start time" bind:value={eventStartTime} />
				<Field name="eventEndTime" type="time" label="End time" bind:value={eventEndTime} />
			</div>

			<Field name="doorsTime" type="time" label="Doors time" bind:value={doorsTime} />
			<Field name="tags" type="text" label="Tags" bind:value={tags} />

			<Field name="poster" label="Poster image">
				<input
					type="file"
					accept="image/jpeg,image/png,image/webp"
					onchange={handleFileSelect}
					class="file-input file-input-bordered w-full"
				/>
				{#if posterFile}
					<p class="text-sm opacity-60 mt-1">
						{posterFile.name} ({(posterFile.size / 1024).toFixed(0)} KB)
					</p>
				{/if}
			</Field>

			<Field
				name="ticketingEnabled"
				type="toggle"
				value={ticketingEnabled}
				checkboxLabel="Enable ticketing"
			/>

			{#if ticketingEnabled}
				<div class="card bg-base-200 p-4 space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<Field
							name="ticketPriceDollars"
							type="number"
							label="Ticket price ($)"
							bind:value={ticketPriceDollars}
						/>
						<input {...fields.ticketPrice.as('hidden', ticketPriceCents)} />
						<Field
							name="ticketQuantity"
							type="number"
							label="Capacity"
							bind:value={ticketQuantity}
						/>
					</div>
					<p class="text-sm opacity-60">Leave capacity blank for unlimited tickets.</p>
				</div>
			{/if}

			<Field
				name="reserveSpace"
				type="toggle"
				value={reserveSpace}
				checkboxLabel="Reserve practice space"
			/>

			{#if reserveSpace}
				<div class="card bg-base-200 p-4 space-y-4">
					<p class="text-sm opacity-60">
						Reservation times can differ from event times to allow for setup and teardown.
					</p>

					<div class="grid grid-cols-2 gap-4">
						<Field
							name="reservationStartTime"
							type="time"
							label="Reservation start"
							bind:value={reservationStartTime}
						/>
						<Field
							name="reservationEndTime"
							type="time"
							label="Reservation end"
							bind:value={reservationEndTime}
						/>
					</div>

					{#if reserveSpace}
						<ConflictWarnings
							date={eventDate}
							startTime={reservationStartTime}
							endTime={reservationEndTime}
							{checkConflicts}
							bind:hasConflicts
						/>
					{/if}
				</div>
			{/if}

			{#if hasConflicts}
				<input {...fields.overrideConflicts.as('hidden', 'on')} />
			{/if}

			<div class="modal-action">
				<Button type="button" class="btn-ghost" onclick={() => (open = false)}>Cancel</Button>
				<SubmitButton
					label={hasConflicts ? 'Create with Override' : 'Create Event'}
					class={hasConflicts ? 'btn-warning' : 'btn-primary'}
				/>
			</div>
		</Form>

		{#snippet pending()}
			<div class="flex items-center justify-center p-8">
				<span class="loading loading-spinner loading-md"></span>
			</div>
		{/snippet}
	</svelte:boundary>
</Modal>
