<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getSlots, bookReservation } from './data.remote';
	import Form from '$lib/components/Form.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';

	// Resolve date from URL, default to today
	let dateParam = $derived(
		page.url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
	);

	let slotData = $derived(await getSlots(dateParam));

	const slots = $derived(slotData.slots);
	const currentDate = $derived(slotData.date);
	const config = $derived(slotData.config);

	let selectedStart = $state('');
	let selectedEnd = $state('');

	const minSlots = $derived(config.minDurationHours * (60 / config.slotMinutes));
	const maxSlots = $derived(config.maxDurationHours * (60 / config.slotMinutes));

	/** Count contiguous available slots starting at a given index. */
	function contiguousFrom(startIdx: number): number {
		let count = 0;
		for (let i = startIdx; i < slots.length && slots[i].available; i++) {
			count++;
		}
		return count;
	}

	// Available start times: only slots with enough contiguous availability
	// to reach the minimum booking duration.
	const startTimeOptions = $derived(
		slots
			.filter((s, i) => s.available && contiguousFrom(i) >= minSlots)
			.map((s) => s.startTime)
	);

	// Valid end times: contiguous available slots from selected start,
	// capped at MAX_DURATION_HOURS, minimum MIN_DURATION_HOURS.
	const endTimeOptions = $derived.by(() => {
		if (!selectedStart) return [];

		const startIdx = slots.findIndex((s) => s.startTime === selectedStart);
		if (startIdx === -1) return [];

		const ends: string[] = [];
		const run = Math.min(contiguousFrom(startIdx), maxSlots);

		for (let i = 0; i < run; i++) {
			if (i + 1 >= minSlots) {
				ends.push(slots[startIdx + i].endTime);
			}
		}

		return ends;
	});

	// When date changes, reset selections and navigate to reload slots
	function onDateChange(e: Event) {
		const input = e.target as HTMLInputElement;
		selectedStart = '';
		selectedEnd = '';
		goto(`?date=${input.value}`);
	}

	// When start changes, clear end
	function onStartChange() {
		selectedEnd = '';
	}

	// Duration display
	const durationHours = $derived.by(() => {
		if (!selectedStart || !selectedEnd) return 0;
		const [sh, sm] = selectedStart.split(':').map(Number);
		const [eh, em] = selectedEnd.split(':').map(Number);
		return (eh * 60 + em - (sh * 60 + sm)) / 60;
	});

	function formatTimeLabel(time: string): string {
		const [h, m] = time.split(':').map(Number);
		const suffix = h >= 12 ? 'PM' : 'AM';
		const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
		return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
	}

	// Form dirty tracking watches these fields
	let initial = $derived({ startTime: '', endTime: '', notes: '' });
</script>

<svelte:boundary>
	<div class="space-y-6 max-w-md">
		<h1 class="text-2xl font-bold">Book a Session</h1>

		<!-- Date picker is a navigation control, lives outside the Form -->
		<div class="form-control">
			<label class="label" for="date">
				<span class="label-text">Date</span>
			</label>
			<input
				id="date"
				type="date"
				value={currentDate}
				onchange={onDateChange}
				class="input input-bordered"
			/>
		</div>

		<Form
			remote={bookReservation}
			{initial}
			errorToast="Booking failed"
			onsuccess={() => {
				const id = bookReservation.result?.reservationId;
				if (id) goto(`/member/reservations/${id}/pay`);
			}}
		>
			<!-- Hidden date — submitted with the form but not tracked for dirty -->
			<input type="hidden" name="date" value={currentDate} />

			<div class="form-control">
				<label class="label" for="startTime">
					<span class="label-text">Start time</span>
				</label>
				{#each bookReservation.fields.startTime.issues() ?? [] as issue}
					<p class="text-error text-sm">{issue.message}</p>
				{/each}
				<select
					id="startTime"
					name="startTime"
					class="select select-bordered"
					bind:value={selectedStart}
					onchange={onStartChange}
					disabled={startTimeOptions.length === 0}
				>
					<option value="" disabled>
						{startTimeOptions.length === 0 ? 'No times available' : 'Select a start time'}
					</option>
					{#each startTimeOptions as time}
						<option value={time}>{formatTimeLabel(time)}</option>
					{/each}
				</select>
			</div>

			<div class="form-control mt-4">
				<label class="label" for="endTime">
					<span class="label-text">End time</span>
				</label>
				{#each bookReservation.fields.endTime.issues() ?? [] as issue}
					<p class="text-error text-sm">{issue.message}</p>
				{/each}
				<select
					id="endTime"
					name="endTime"
					class="select select-bordered"
					bind:value={selectedEnd}
					disabled={endTimeOptions.length === 0}
				>
					<option value="" disabled>
						{#if !selectedStart}
							Select a start time first
						{:else if endTimeOptions.length === 0}
							No end times available
						{:else}
							Select an end time
						{/if}
					</option>
					{#each endTimeOptions as time}
						<option value={time}>{formatTimeLabel(time)}</option>
					{/each}
				</select>
			</div>

			{#if durationHours > 0}
				<p class="text-sm mt-2 text-primary font-medium">
					{durationHours} hour{durationHours === 1 ? '' : 's'} —
					${((durationHours * config.hourlyRateCents) / 100).toFixed(2)}
				</p>
			{/if}

			<div class="form-control mt-4">
				<label class="label" for="notes">
					<span class="label-text">Notes (optional)</span>
				</label>
				<textarea
					id="notes"
					name="notes"
					class="textarea textarea-bordered"
					rows="2"
					placeholder="What are you working on?"
				></textarea>
			</div>

			<div class="mt-6">
				<SubmitButton
					label="Book Session"
					successLabel="Booked!"
					errorLabel="Booking failed"
					disabled={!selectedStart || !selectedEnd}
					class="btn-primary w-full"
				/>
			</div>
		</Form>
	</div>

	{#snippet pending()}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/snippet}

	{#snippet failed(err, reset)}
		<div class="alert alert-error">
			<p>Failed to load available times: {String(err)}</p>
			<button class="btn btn-sm" onclick={reset}>Retry</button>
		</div>
	{/snippet}
</svelte:boundary>
