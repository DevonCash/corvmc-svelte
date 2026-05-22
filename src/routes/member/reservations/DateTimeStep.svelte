<script lang="ts">
	import { untrack } from 'svelte';
	import {
		getAvailableDates,
		getReservationStartTimes,
		getReservationEndTimes,
		getMembershipStatus
	} from '$lib/remote/reservations.remote';
	import * as Form from '$lib/components/shared/Form';
	import { today, getLocalTimeZone, type DateValue } from '@internationalized/date';

	const tz = getLocalTimeZone();

	let date = $state(today(tz).toString());
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');
	let recurring = $state('');

	const minDate = today(tz);
	const maxDate = today(tz).add({ days: 14 });

	let availableDates = $state<string[]>([]);
	let membership = $state({ isSustainingMember: false, freeHoursBalance: 0 });
	let initialLoading = $state(true);

	$effect(() => {
		Promise.all([getAvailableDates(), getMembershipStatus()]).then(([dates, m]) => {
			availableDates = dates;
			membership = m;
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

		{#if membership.isSustainingMember}
			<Form.Field
				name="recurring"
				label="Repeat this reservation"
				type="select"
				bind:value={recurring}
				options={[
					{ value: '', label: "Don't repeat (one-time)" },
					{ value: 'weekly', label: 'Weekly' },
					{ value: 'biweekly', label: 'Every 2 weeks' },
					{ value: 'monthly', label: 'Monthly' }
				]}
			/>
			{#if recurring}
				<p class="mt-1 text-sm opacity-60">
					Future instances will be generated automatically. You'll confirm each one
					individually.
				</p>
			{/if}
		{/if}
	{/if}

	<div class="flex justify-end pt-2">
		<Form.SubmitButton continueLabel="Continue" class="btn-primary" />
	</div>
</Form.Step>
