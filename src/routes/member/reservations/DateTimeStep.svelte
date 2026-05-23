<script lang="ts">
	import { untrack } from 'svelte';
	import {
		getAvailableDates,
		getReservationStartTimes,
		getReservationEndTimes
	} from '$lib/remote/reservations.remote';
	import * as Form from '$lib/components/shared/Form';
	import { today, getLocalTimeZone, type DateValue } from '@internationalized/date';

	let {
		isSustaining = false
	}: {
		isSustaining?: boolean;
	} = $props();

	const tz = getLocalTimeZone();

	let date = $state(today(tz).toString());
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');
	let frequency = $state('');
	let seriesEndsAt = $state('');

	const isRecurring = $derived(frequency !== '');

	const minEndsAt = $derived.by(() => {
		if (!date) return '';
		const d = new Date(date + 'T00:00:00');
		d.setDate(d.getDate() + 7);
		return d.toISOString().split('T')[0];
	});

	const minDate = today(tz);
	const maxDate = today(tz).add({ days: 14 });

	let availableDates = $state<string[]>([]);
	let initialLoading = $state(true);

	$effect(() => {
		getAvailableDates().then((dates) => {
			availableDates = dates;
			initialLoading = false;
		});
	});

	let availableSet = $derived(new Set(availableDates));
	const isDateUnavailable = (d: DateValue) => !availableSet.has(d.toString());

	let startTimeOptions = $state<{ value: string; label: string }[] | null>(null);
	let endTimeOptions = $state<{ value: string; label: string }[] | null>(null);

	let startGen = 0;
	$effect(() => {
		const d = date;
		const gen = ++startGen;
		startTime = '';
		endTime = '';
		startTimeOptions = null;
		endTimeOptions = null;
		getReservationStartTimes(d).then((opts) => {
			if (gen === startGen) startTimeOptions = opts;
		});
	});

	let endGen = 0;
	$effect(() => {
		const st = startTime;
		const gen = ++endGen;
		endTime = '';
		if (st) {
			endTimeOptions = null;
			const d = untrack(() => date);
			getReservationEndTimes({ date: d, startTime: st }).then((opts) => {
				if (gen === endGen) endTimeOptions = opts;
			});
		} else {
			endTimeOptions = [];
		}
	});

	const step1Valid = $derived(!!date && !!startTime && !!endTime);
</script>

<Form.Step valid={step1Valid}>
	{#if initialLoading}
		<div class="space-y-4 py-2">
			<div class="skeleton h-[175px] w-full rounded-lg"></div>
			<div class="grid grid-cols-2 gap-2">
				<div class="skeleton h-12 w-full rounded-lg"></div>
				<div class="skeleton h-12 w-full rounded-lg"></div>
			</div>
			<div class="skeleton h-20 w-full rounded-lg"></div>
		</div>
	{:else}
		<Form.Field
			name="date"
			label=""
			type="calendar"
			bind:value={date}
			{isDateUnavailable}
			minValue={minDate}
			maxValue={maxDate}
		/>

		{#if date && startTimeOptions !== null && startTimeOptions.length === 0}
			<p class="mt-2 text-sm text-error">
				No available times on this date. Please select another day.
			</p>
		{/if}

		<div class="grid grid-cols-2 gap-2">
			<Form.Field
				name="startTime"
				label="Start time"
				type="select"
				bind:value={startTime}
				options={startTimeOptions ?? []}
				placeholder={startTimeOptions === null
					? 'Loading...'
					: startTimeOptions.length === 0
						? 'No times available'
						: 'Select a start time'}
				required
			/>

			<Form.Field
				name="endTime"
				label="End time"
				type="select"
				bind:value={endTime}
				options={endTimeOptions ?? []}
				placeholder={!startTime
					? 'Select a start time first'
					: endTimeOptions === null
						? 'Loading...'
						: endTimeOptions.length === 0
							? 'No end times available'
							: 'Select an end time'}
				required
			/>
		</div>

		<Form.Field
			name="notes"
			label="Notes (optional)"
			type="textarea"
			bind:value={notes}
			placeholder="What are you working on?"
			rows={2}
		/>

		{#if isSustaining}
			<fieldset class="fieldset">
				<legend class="fieldset-legend">Frequency</legend>
				<div class="flex gap-1">
					{#each [
						{ value: '', label: 'One Time' },
						{ value: 'weekly', label: 'Weekly' },
						{ value: 'biweekly', label: 'Every 2 Weeks' },
						{ value: 'monthly', label: 'Monthly' }
					] as opt (opt.value)}
						<label class="btn btn-sm flex-1" class:btn-primary={frequency === opt.value}>
							<input
								type="radio"
								name="recurring"
								value={opt.value}
								bind:group={frequency}
								class="hidden"
							/>
							{opt.label}
						</label>
					{/each}
				</div>
			</fieldset>

			{#if isRecurring}
				<Form.Field
					name="seriesEndsAt"
					label="End date (optional)"
					type="date"
					bind:value={seriesEndsAt}
					min={minEndsAt}
					description="Leave empty for ongoing"
				/>
			{/if}
		{/if}

	{/if}

	<div class="flex justify-end pt-2">
		<Form.SubmitButton
			label="Save"
			continueLabel="Continue"
			class="btn-primary"
		/>
	</div>
</Form.Step>
