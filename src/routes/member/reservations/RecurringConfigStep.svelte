<script lang="ts">
	import { getRecurringTimeSlots } from '$lib/remote/reservations.remote';
	import * as Form from '$lib/components/shared/Form';
	import CalendarSelect from '$lib/components/shared/Form/CalendarSelect.svelte';
	import { formatSlotTime, formatScheduleLabel } from '$lib/utils/format';
	import { today, getLocalTimeZone, startOfMonth, endOfMonth } from '@internationalized/date';
	import { IconChevronLeft, IconChevronRight } from '@tabler/icons-svelte';

	let frequency = $state<'weekly' | 'biweekly' | 'monthly'>('weekly');
	let date = $state('');
	let startTime = $state('');
	let endTime = $state('');
	let seriesEndsAt = $state('');

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

	const tz = getLocalTimeZone();
	const todayDate = today(tz);
	const minDate = todayDate.add({ days: 1 });

	let viewMonth = $state(todayDate);
	const monthStart = $derived(startOfMonth(viewMonth));
	const monthEnd = $derived(endOfMonth(viewMonth));

	function prevMonth() {
		viewMonth = viewMonth.subtract({ months: 1 });
	}
	function nextMonth() {
		viewMonth = viewMonth.add({ months: 1 });
	}

	const canGoPrev = $derived(monthEnd.compare(minDate) >= 0 && monthStart.compare(todayDate) > 0);

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
			<legend class="fieldset-legend">First occurrence</legend>
			<div class="flex items-center justify-between px-2 pb-1">
				<button type="button" class="btn btn-ghost btn-xs btn-square" onclick={prevMonth} disabled={!canGoPrev}>
					<IconChevronLeft size={16} />
				</button>
				<span class="text-sm font-medium">
					{viewMonth.toDate(tz).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
				</span>
				<button type="button" class="btn btn-ghost btn-xs btn-square" onclick={nextMonth}>
					<IconChevronRight size={16} />
				</button>
			</div>
			<div class="hide-calendar-heading">
				<CalendarSelect
					name="date"
					bind:value={date}
					minValue={monthStart}
					maxValue={monthEnd}
					isDateUnavailable={(d) => d.compare(minDate) < 0}
				/>
			</div>
			{#if scheduleLabel}
				<p class="text-sm opacity-60">{scheduleLabel}</p>
			{/if}
		</fieldset>

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

		<div class="flex justify-end pt-2">
			<Form.SubmitButton continueLabel="Review Schedule" class="btn-primary" />
		</div>
	{/if}
</Form.Step>

<style>
	.hide-calendar-heading > :global(div > p:first-child) {
		display: none;
	}
</style>
