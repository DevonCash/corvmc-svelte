<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import Modal from '$lib/components/Modal.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import { checkConflicts, createEvent } from './data.remote';

	let { open = $bindable(false) }: { open: boolean } = $props();

	// Form state
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
	let posterFile = $state<File | null>(null);
	let submitting = $state(false);

	// Conflict check for reservation times
	const conflictData = $derived(
		reserveSpace && reservationStartTime && reservationEndTime
			? await checkConflicts({
					date: eventDate,
					startTime: reservationStartTime,
					endTime: reservationEndTime
				})
			: null
	);

	const warnings = $derived.by(() => {
		if (!conflictData) return [];
		const msgs: string[] = [];

		for (const c of conflictData.conflicts) {
			if (c.type === 'reservation') {
				const range = `${formatSlotTime(formatTimeFromDate(c.startsAt))} – ${formatSlotTime(formatTimeFromDate(c.endsAt))}`;
				msgs.push(`Conflicts with reservation: ${c.label}, ${range}`);
			} else {
				msgs.push(`Overlaps with closure: ${c.label}`);
			}
		}

		msgs.push(...conflictData.validationWarnings);
		return msgs;
	});

	const hasConflicts = $derived(warnings.length > 0);

	// When reservation is toggled on, default reservation times to event times
	$effect(() => {
		if (reserveSpace && !reservationStartTime && eventStartTime) {
			reservationStartTime = eventStartTime;
		}
		if (reserveSpace && !reservationEndTime && eventEndTime) {
			reservationEndTime = eventEndTime;
		}
	});

	function formatSlotTime(time: string): string {
		const [h, m] = time.split(':').map(Number);
		const period = h >= 12 ? 'PM' : 'AM';
		const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
		return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, '0')} ${period}`;
	}

	function formatTimeFromDate(d: Date | string): string {
		const date = typeof d === 'string' ? new Date(d) : d;
		return date.toLocaleTimeString('en-GB', {
			timeZone: 'America/Los_Angeles',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

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
				reserveSpace,
				reservationStartTime: reservationStartTime || undefined,
				reservationEndTime: reservationEndTime || undefined,
				overrideConflicts: hasConflicts
			});

			// Upload poster if selected
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
		reserveSpace = false;
		reservationStartTime = '';
		reservationEndTime = '';
		posterFile = null;
	}

	function close() {
		open = false;
	}
</script>

<Modal bind:open title="New Event" maxWidth="max-w-md" onclose={resetForm}>
	<svelte:boundary>
		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
			<FormField label="Title" id="title" issues={[]}>
				<input
					type="text"
					id="title"
					bind:value={title}
					placeholder="Event title"
					class="input input-bordered w-full"
					required
				/>
			</FormField>

			<FormField label="Description" id="description" issues={[]}>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Optional description (markdown supported)"
					class="textarea textarea-bordered w-full"
					rows="3"
				></textarea>
			</FormField>

			<FormField label="Date" id="eventDate" issues={[]}>
				<input
					type="date"
					id="eventDate"
					bind:value={eventDate}
					class="input input-bordered w-full"
					required
				/>
			</FormField>

			<div class="grid grid-cols-2 gap-4">
				<FormField label="Start time" id="eventStartTime" issues={[]}>
					<input
						type="time"
						id="eventStartTime"
						bind:value={eventStartTime}
						class="input input-bordered w-full"
						required
					/>
				</FormField>

				<FormField label="End time" id="eventEndTime" issues={[]}>
					<input
						type="time"
						id="eventEndTime"
						bind:value={eventEndTime}
						class="input input-bordered w-full"
						required
					/>
				</FormField>
			</div>

			<FormField label="Doors time" id="doorsTime" issues={[]}>
				<input
					type="time"
					id="doorsTime"
					bind:value={doorsTime}
					placeholder="Optional"
					class="input input-bordered w-full"
				/>
			</FormField>

			<FormField label="Tags" id="tags" issues={[]}>
				<input
					type="text"
					id="tags"
					bind:value={tags}
					placeholder="e.g. open mic, workshop, jam"
					class="input input-bordered w-full"
				/>
			</FormField>

			<FormField label="Poster image" id="poster" issues={[]}>
				<input
					type="file"
					id="poster"
					accept="image/jpeg,image/png,image/webp"
					onchange={handleFileSelect}
					class="file-input file-input-bordered w-full"
				/>
				{#if posterFile}
					<p class="text-sm opacity-60 mt-1">{posterFile.name} ({(posterFile.size / 1024).toFixed(0)} KB)</p>
				{/if}
			</FormField>

			<!-- Reserve space toggle -->
			<div class="form-control">
				<label class="label cursor-pointer justify-start gap-3">
					<input type="checkbox" bind:checked={reserveSpace} class="toggle" />
					<span class="label-text">Reserve practice space</span>
				</label>
			</div>

			{#if reserveSpace}
				<div class="card bg-base-200 p-4 space-y-4">
					<p class="text-sm opacity-60">
						Reservation times can differ from event times to allow for setup and teardown.
					</p>

					<div class="grid grid-cols-2 gap-4">
						<FormField label="Reservation start" id="reservationStartTime" issues={[]}>
							<input
								type="time"
								id="reservationStartTime"
								bind:value={reservationStartTime}
								class="input input-bordered w-full"
							/>
						</FormField>

						<FormField label="Reservation end" id="reservationEndTime" issues={[]}>
							<input
								type="time"
								id="reservationEndTime"
								bind:value={reservationEndTime}
								class="input input-bordered w-full"
							/>
						</FormField>
					</div>

					{#if warnings.length > 0}
						<div class="space-y-2">
							{#each warnings as warning, i (i)}
								<div class="alert alert-warning text-sm py-2">
									{warning}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Footer -->
			<div class="modal-action">
				<button type="button" class="btn btn-ghost" onclick={close}>Cancel</button>
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
