<script lang="ts">
	import { getRecurringTimeSlots } from '$lib/remote/reservations.remote';
	import * as Form from '$lib/components/shared/Form';
	import { formatSlotTime, formatScheduleLabel } from '$lib/utils/format';

	let frequency = $state<'weekly' | 'biweekly' | 'monthly'>('weekly');
	let date = $state('');
	let startTime = $state('');
	let endTime = $state('');
	let seriesEndsAt = $state('');
	let notes = $state('');

	let slotsData = $state<{
		startSlots: { value: string; label: string }[];
		allSlots: { value: string; label: string }[];
		config: { slotMinutes: number; minDurationHours: number; maxDurationHours: number };
	} | null>(null);

	$effect(() => {
		getRecurringTimeSlots().then((data) => {
			slotsData = data;
		});
	});

	const frequencyLabel = $derived(
		frequency === 'weekly' ? 'Weekly' : frequency === 'biweekly' ? 'Every 2 weeks' : 'Monthly'
	);

	const scheduleLabel = $derived.by(() => {
		if (!date || !frequency) return '';
		const iso = `${date}T12:00:00`;
		return formatScheduleLabel(frequencyLabel, iso);
	});

	const endTimeOptions = $derived.by(() => {
		if (!slotsData || !startTime) return [];
		const { allSlots, config } = slotsData;
		const startIdx = allSlots.findIndex((s) => s.value === startTime);
		if (startIdx === -1) return [];

		const minSlots = config.minDurationHours * (60 / config.slotMinutes);
		const maxSlots = config.maxDurationHours * (60 / config.slotMinutes);
		const cap = Math.min(allSlots.length - 1 - startIdx, maxSlots);

		const options: { value: string; label: string }[] = [];
		for (let i = 0; i < cap; i++) {
			if (i + 1 >= minSlots) {
				options.push(allSlots[startIdx + i + 1]);
			}
		}
		return options;
	});

	$effect(() => {
		startTime;
		endTime = '';
	});

	const tomorrow = $derived.by(() => {
		const d = new Date();
		d.setDate(d.getDate() + 1);
		return d.toISOString().split('T')[0];
	});

	const minEndsAt = $derived.by(() => {
		if (!date) return '';
		const d = new Date(date + 'T00:00:00');
		d.setDate(d.getDate() + 7);
		return d.toISOString().split('T')[0];
	});

	const step1Valid = $derived(!!frequency && !!date && !!startTime && !!endTime);
</script>

<Form.Step valid={step1Valid}>
	{#if !slotsData}
		<div class="space-y-4 py-2">
			<div class="skeleton h-10 w-full rounded-lg"></div>
			<div class="skeleton h-12 w-full rounded-lg"></div>
			<div class="grid grid-cols-2 gap-2">
				<div class="skeleton h-12 w-full rounded-lg"></div>
				<div class="skeleton h-12 w-full rounded-lg"></div>
			</div>
		</div>
	{:else}
		<input type="hidden" name="recurring" value={frequency} />
		<input type="hidden" name="seriesEndsAt" value={seriesEndsAt} />

		<fieldset class="fieldset">
			<legend class="fieldset-legend">Frequency</legend>
			<div class="flex gap-1">
				{#each [
					{ value: 'weekly', label: 'Weekly' },
					{ value: 'biweekly', label: 'Every 2 Weeks' },
					{ value: 'monthly', label: 'Monthly' }
				] as opt (opt.value)}
					<button
						type="button"
						class="btn btn-sm flex-1"
						class:btn-primary={frequency === opt.value}
						onclick={() => (frequency = opt.value as typeof frequency)}
					>
						{opt.label}
					</button>
				{/each}
			</div>
		</fieldset>

		<Form.Field
			name="date"
			label="First occurrence"
			type="date"
			bind:value={date}
			min={tomorrow}
		/>

		{#if scheduleLabel}
			<p class="mt-[-0.5rem] text-sm opacity-60">{scheduleLabel}</p>
		{/if}

		<div class="grid grid-cols-2 gap-2">
			<Form.Field
				name="startTime"
				label="Start time"
				type="select"
				bind:value={startTime}
				options={slotsData.startSlots}
				placeholder="Select a start time"
				required
			/>

			<Form.Field
				name="endTime"
				label="End time"
				type="select"
				bind:value={endTime}
				options={endTimeOptions}
				placeholder={!startTime ? 'Select start first' : 'Select an end time'}
				required
			/>
		</div>

		<Form.Field
			name="_seriesEndsAt"
			label="End date (optional)"
			type="date"
			bind:value={seriesEndsAt}
			min={minEndsAt}
			description="Leave empty for ongoing"
		/>

		<Form.Field
			name="notes"
			label="Notes (optional)"
			type="textarea"
			bind:value={notes}
			placeholder="What are you working on?"
			rows={2}
		/>

		<div class="flex justify-end pt-2">
			<Form.SubmitButton continueLabel="Review Schedule" class="btn-primary" />
		</div>
	{/if}
</Form.Step>
