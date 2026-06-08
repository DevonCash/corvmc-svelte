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
		isSustaining = false,
		reloadToken = 0
	}: {
		isSustaining?: boolean;
		/** Bump to force a fresh reload of availability (e.g. after a slot conflict). */
		reloadToken?: number;
	} = $props();

	const tz = getLocalTimeZone();

	let date = $state(today(tz).toString());
	let startTime = $state('');
	let endTime = $state('');
	let notes = $state('');
	let frequency = $state('');
	let monthlyMode = $state('weekday');

	const isMonthly = $derived(frequency === 'monthly');

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
		if (!date) return { weekday: 'Same weekday each month', monthday: 'Same date each month' };
		const d = new Date(date + 'T00:00:00');
		const weekdayName = d.toLocaleDateString('en-US', { weekday: 'long' });
		const dayOfMonth = d.getDate();
		const nth = Math.ceil(dayOfMonth / 7);
		return {
			weekday: `${ordinal(nth)} ${weekdayName} of the month`,
			monthday: `Monthly on the ${ordinal(dayOfMonth)}`
		};
	});

	const minDate = today(tz);
	const maxDate = today(tz).add({ days: 14 });

	let availableDates = $state<string[]>([]);
	let initialLoading = $state(true);

	let availSeen = 0;
	let availGen = 0;
	$effect(() => {
		const token = reloadToken;
		const forceReload = token > availSeen;
		availSeen = token;
		const gen = ++availGen;
		const q = getAvailableDates();
		(async () => {
			// refresh() re-fetches and updates the resource's reactive `current`;
			// the awaitable itself resolves only once, so read `current` after it.
			if (forceReload) await q.refresh();
			const dates = (forceReload ? q.current : await q) ?? [];
			// Drop a stale resolve (e.g. the initial load finishing after a
			// conflict-triggered refresh already ran).
			if (gen !== availGen) return;
			availableDates = dates;
			initialLoading = false;
		})();
	});

	let availableSet = $derived(new Set(availableDates));
	const isDateUnavailable = (d: DateValue) => !availableSet.has(d.toString());

	let startTimeOptions = $state<{ value: string; label: string }[] | null>(null);
	let endTimeOptions = $state<{ value: string; label: string }[] | null>(null);

	let startGen = 0;
	let startSeen = 0;
	$effect(() => {
		const d = date;
		const token = reloadToken;
		const forceReload = token > startSeen;
		startSeen = token;
		const gen = ++startGen;
		startTime = '';
		endTime = '';
		startTimeOptions = null;
		endTimeOptions = null;
		const q = getReservationStartTimes(d);
		(async () => {
			if (forceReload) await q.refresh();
			const opts = (forceReload ? q.current : await q) ?? [];
			if (gen === startGen) startTimeOptions = opts;
		})();
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
					{#each [{ value: '', label: 'One Time' }, { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: 'Every 2 Weeks' }, { value: 'monthly', label: 'Monthly' }] as opt (opt.value)}
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

			{#if isMonthly}
				<fieldset class="fieldset">
					<legend class="fieldset-legend">Monthly pattern</legend>
					<div class="flex flex-col gap-1">
						{#each [{ value: 'weekday', label: monthlyLabels.weekday }, { value: 'monthday', label: monthlyLabels.monthday }] as opt (opt.value)}
							<label class="btn btn-sm justify-start" class:btn-primary={monthlyMode === opt.value}>
								<input
									type="radio"
									name="monthlyMode"
									value={opt.value}
									bind:group={monthlyMode}
									class="hidden"
								/>
								{opt.label}
							</label>
						{/each}
					</div>
				</fieldset>
			{/if}
		{/if}
	{/if}

	<div class="flex justify-end pt-2">
		<Form.SubmitButton label="Save" continueLabel="Continue" class="btn-primary" />
	</div>
</Form.Step>
