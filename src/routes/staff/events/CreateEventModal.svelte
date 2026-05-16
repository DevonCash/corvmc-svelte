<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { Field } from '$lib/components/shared/Form';
	import ConflictWarnings from '$lib/components/shared/ConflictWarnings.svelte';
	import { checkConflicts, createEvent } from './data.remote';

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
	let submitting = $state(false);
	let hasConflicts = $state(false);

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

	async function handleSubmit() {
		if (!title || !eventDate || !eventStartTime || !eventEndTime) return;
		submitting = true;

		try {
			const result = await createEvent({
				title,
				description: description || undefined,
				eventDate,
				eventStartTime,
				eventEndTime,
				doorsTime: doorsTime || undefined,
				tags: tags || undefined,
				ticketingEnabled,
				ticketPrice: ticketingEnabled && ticketPriceDollars
					? Math.round(parseFloat(ticketPriceDollars) * 100)
					: undefined,
				ticketQuantity: ticketingEnabled && ticketQuantity
					? parseInt(ticketQuantity, 10)
					: undefined,
				reserveSpace,
				reservationStartTime: reservationStartTime || undefined,
				reservationEndTime: reservationEndTime || undefined,
				overrideConflicts: hasConflicts
			});

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

			toast.success('Event created');
			open = false;
			resetForm();
			await invalidateAll();

			if (result?.eventId) {
				goto(`/staff/events/${result.eventId}`);
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create event');
		} finally {
			submitting = false;
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
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
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
					<p class="text-sm opacity-60 mt-1">{posterFile.name} ({(posterFile.size / 1024).toFixed(0)} KB)</p>
				{/if}
			</Field>

			<Field name="ticketingEnabled" type="toggle" value={ticketingEnabled}
				checkboxLabel="Enable ticketing" />

			{#if ticketingEnabled}
				<div class="card bg-base-200 p-4 space-y-4">
					<div class="grid grid-cols-2 gap-4">
						<Field name="ticketPrice" type="number" label="Ticket price ($)" bind:value={ticketPriceDollars} />
						<Field name="ticketQuantity" type="number" label="Capacity" bind:value={ticketQuantity} />
					</div>
					<p class="text-sm opacity-60">Leave capacity blank for unlimited tickets.</p>
				</div>
			{/if}

			<Field name="reserveSpace" type="toggle" value={reserveSpace}
				checkboxLabel="Reserve practice space" />

			{#if reserveSpace}
				<div class="card bg-base-200 p-4 space-y-4">
					<p class="text-sm opacity-60">
						Reservation times can differ from event times to allow for setup and teardown.
					</p>

					<div class="grid grid-cols-2 gap-4">
						<Field name="reservationStartTime" type="time" label="Reservation start" bind:value={reservationStartTime} />
						<Field name="reservationEndTime" type="time" label="Reservation end" bind:value={reservationEndTime} />
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

			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={() => (open = false)}>Cancel</button>
				<button
					type="submit"
					class="btn {hasConflicts ? 'btn-warning' : 'btn-primary'}"
					disabled={!title || !eventDate || !eventStartTime || !eventEndTime || submitting}
				>
					{#if submitting}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					{hasConflicts ? 'Create with Override' : 'Create Event'}
				</button>
			</div>
		</form>

		{#snippet pending()}
			<div class="flex items-center justify-center p-8">
				<span class="loading loading-spinner loading-md"></span>
			</div>
		{/snippet}
	</svelte:boundary>
</Modal>
