<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import {
		getBandSlots,
		getBandMembershipStatus,
		bookBandReservation
	} from '$lib/remote/reservations.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import { formatSlotTime } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';

	let layout = $derived(await getBandLayout(page.params.slug!));

	const band = $derived(layout.band);

	// Resolve date from URL, default to today
	let dateParam = $derived(
		page.url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
	);

	let slotData = $derived(await getBandSlots(dateParam));

	const slots = $derived(slotData.slots);
	const currentDate = $derived(slotData.date);
	const config = $derived(slotData.config);

	let membershipStatus = $derived(await getBandMembershipStatus());
	const hasSustainingMember = $derived(membershipStatus.hasSustainingMember);

	let selectedStart = $state('');
	let selectedEnd = $state('');
	let recurring = $state('');
	let monthlyMode = $state('weekday');

	function ordinal(n: number): string {
		const mod100 = n % 100;
		if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
		switch (n % 10) {
			case 1:
				return `${n}st`;
			case 2:
				return `${n}nd`;
			case 3:
				return `${n}rd`;
			default:
				return `${n}th`;
		}
	}

	const monthlyLabels = $derived.by(() => {
		const d = new Date(currentDate + 'T00:00:00');
		const weekdayName = d.toLocaleDateString('en-US', { weekday: 'long' });
		const dayOfMonth = d.getDate();
		const nth = Math.ceil(dayOfMonth / 7);
		return {
			weekday: `${ordinal(nth)} ${weekdayName} of the month`,
			monthday: `Monthly on the ${ordinal(dayOfMonth)}`
		};
	});
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

	const startTimeOptions = $derived(
		slots.filter((s, i) => s.available && contiguousFrom(i) >= minSlots).map((s) => s.startTime)
	);

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

	function onDateChange(e: Event) {
		const input = e.target as HTMLInputElement;
		selectedStart = '';
		selectedEnd = '';
		goto(resolve(`/band/${page.params.slug}/reservations/new?date=${input.value}`));
	}

	function onStartChange() {
		selectedEnd = '';
	}

	const durationHours = $derived.by(() => {
		if (!selectedStart || !selectedEnd) return 0;
		const [sh, sm] = selectedStart.split(':').map(Number);
		const [eh, em] = selectedEnd.split(':').map(Number);
		return (eh * 60 + em - (sh * 60 + sm)) / 60;
	});

	const { fields } = bookBandReservation;
	let initial = $derived({ startTime: '', endTime: '', notes: '', recurring: '' });
</script>

<PageHeader title="Book a Session" subtitle={band.name} />
<PageContent width="md">
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
			class="input-bordered input"
		/>
	</div>

	<Form
		remote={bookBandReservation}
		{initial}
		onsuccess={() => {
			goto(resolve(`/band/${band.slug}/reservations`));
		}}
		onfailure={() => toast.error('Booking failed')}
	>
		<input {...fields.date.as('hidden', currentDate)} />

		<div class="form-control">
			<label class="label" for="startTime">
				<span class="label-text">Start time</span>
			</label>
			{#each bookBandReservation.fields.startTime.issues() ?? [] as issue, i (i)}
				<p class="text-sm text-error">{issue.message}</p>
			{/each}
			<select
				id="startTime"
				name="startTime"
				class="select-bordered select"
				bind:value={selectedStart}
				onchange={onStartChange}
				disabled={startTimeOptions.length === 0}
			>
				<option value="" disabled>
					{startTimeOptions.length === 0 ? 'No times available' : 'Select a start time'}
				</option>
				{#each startTimeOptions as time (time)}
					<option value={time}>{formatSlotTime(time)}</option>
				{/each}
			</select>
		</div>

		<div class="form-control mt-4">
			<label class="label" for="endTime">
				<span class="label-text">End time</span>
			</label>
			{#each bookBandReservation.fields.endTime.issues() ?? [] as issue, i (i)}
				<p class="text-sm text-error">{issue.message}</p>
			{/each}
			<select
				id="endTime"
				name="endTime"
				class="select-bordered select"
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
				{#each endTimeOptions as time (time)}
					<option value={time}>{formatSlotTime(time)}</option>
				{/each}
			</select>
		</div>

		{#if durationHours > 0}
			<p class="mt-2 text-sm font-medium text-primary">
				{durationHours} hour{durationHours === 1 ? '' : 's'} — ${(
					(durationHours * config.hourlyRateCents) /
					100
				).toFixed(2)}
			</p>
		{/if}

		<div class="form-control mt-4">
			<label class="label" for="notes">
				<span class="label-text">Notes (optional)</span>
			</label>
			<textarea
				id="notes"
				name="notes"
				class="textarea-bordered textarea"
				rows="2"
				placeholder="What are you working on?"
			></textarea>
		</div>

		{#if hasSustainingMember}
			<div class="form-control mt-4">
				<label class="label" for="recurring">
					<span class="label-text">Repeat this reservation</span>
				</label>
				<select
					id="recurring"
					name="recurring"
					class="select select-bordered"
					bind:value={recurring}
				>
					<option value="">Don't repeat (one-time)</option>
					<option value="weekly">Weekly</option>
					<option value="biweekly">Every 2 weeks</option>
					<option value="monthly">Monthly</option>
				</select>
				{#if recurring === 'monthly'}
					<label class="label mt-2" for="monthlyMode">
						<span class="label-text">Monthly pattern</span>
					</label>
					<select
						id="monthlyMode"
						name="monthlyMode"
						class="select select-bordered"
						bind:value={monthlyMode}
					>
						<option value="weekday">{monthlyLabels.weekday}</option>
						<option value="monthday">{monthlyLabels.monthday}</option>
					</select>
				{/if}
				{#if recurring}
					<p class="text-sm mt-1 opacity-60">Future instances will be generated automatically.</p>
				{/if}
			</div>
		{/if}

		<div class="mt-6">
			<SubmitButton
				label={recurring ? 'Book & Start Series' : 'Book Session'}
				successLabel="Booked!"
				errorLabel="Booking failed"
				disabled={!selectedStart || !selectedEnd}
				class="w-full btn-primary"
			/>
		</div>
	</Form>
</PageContent>
