<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import { checkConflicts, createEvent } from './data.remote';

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

	// Generate time options (30-min slots from 09:00 to 22:00)
	const timeOptions = $derived.by(() => {
		const opts: Array<{ value: string; label: string }> = [];
		for (let h = 9; h <= 22; h++) {
			for (const m of [0, 30]) {
				if (h === 22 && m > 0) break;
				const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
				opts.push({ value, label: formatSlotTime(value) });
			}
		}
		return opts;
	});

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
			if (result?.eventId) {
				goto(`/staff/events/${result.eventId}`);
			} else {
				goto('/staff/events');
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to create event');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:boundary>
	<div class="max-w-md space-y-6">
		<PageHeader title="New Event" backHref="/staff/events" />

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
					<select id="eventStartTime" bind:value={eventStartTime} class="select select-bordered w-full" required>
						<option value="">Select</option>
						{#each timeOptions as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</FormField>

				<FormField label="End time" id="eventEndTime" issues={[]}>
					<select id="eventEndTime" bind:value={eventEndTime} class="select select-bordered w-full" required>
						<option value="">Select</option>
						{#each timeOptions as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</FormField>
			</div>

			<FormField label="Doors time" id="doorsTime" issues={[]}>
				<select id="doorsTime" bind:value={doorsTime} class="select select-bordered w-full">
					<option value="">No doors time</option>
					{#each timeOptions as opt (opt.value)}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
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
							<select id="reservationStartTime" bind:value={reservationStartTime} class="select select-bordered w-full">
								<option value="">Select</option>
								{#each timeOptions as opt (opt.value)}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</FormField>

						<FormField label="Reservation end" id="reservationEndTime" issues={[]}>
							<select id="reservationEndTime" bind:value={reservationEndTime} class="select select-bordered w-full">
								<option value="">Select</option>
								{#each timeOptions as opt (opt.value)}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
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

			<div class="flex justify-end gap-2 pt-2">
				<a href="/staff/events" class="btn btn-ghost">Cancel</a>
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
	</div>

	{#snippet pending()}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/snippet}

	{#snippet failed(err, reset)}
		<div class="alert alert-error">
			<p>Failed to load: {String(err)}</p>
			<button class="btn btn-sm" onclick={reset}>Retry</button>
		</div>
	{/snippet}
</svelte:boundary>
