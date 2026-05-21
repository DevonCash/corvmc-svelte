<script lang="ts">
	import { Calendar } from 'bits-ui';
	import { today, getLocalTimeZone, parseDate, type DateValue } from '@internationalized/date';
	import { IconChevronLeft, IconChevronRight } from '@tabler/icons-svelte';

	let {
		value = $bindable(''),
		name,
		isDateDisabled,
		isDateUnavailable,
		minValue,
		maxValue,
		disabled = false
	}: {
		value?: string;
		name: string;
		isDateDisabled?: (date: DateValue) => boolean;
		isDateUnavailable?: (date: DateValue) => boolean;
		minValue?: DateValue;
		maxValue?: DateValue;
		disabled?: boolean;
	} = $props();

	const tz = getLocalTimeZone();

	let calendarValue = $derived(value ? parseDate(value) : today(tz));

	function handleValueChange(d: DateValue | undefined) {
		if (d) value = d.toString();
	}
</script>

<Calendar.Root
	type="single"
	value={calendarValue}
	onValueChange={handleValueChange}
	{isDateDisabled}
	{isDateUnavailable}
	{minValue}
	{maxValue}
	{disabled}
	weekStartsOn={0}
>
	{#snippet children({ months, weekdays })}
		<Calendar.Header class="flex items-center justify-between pb-2">
			<Calendar.PrevButton class="btn btn-ghost btn-sm btn-square">
				<IconChevronLeft size={16} />
			</Calendar.PrevButton>
			<Calendar.Heading class="text-sm font-medium" />
			<Calendar.NextButton class="btn btn-ghost btn-sm btn-square">
				<IconChevronRight size={16} />
			</Calendar.NextButton>
		</Calendar.Header>
		{#each months as month (month.value.toString())}
			<Calendar.Grid class="w-full border-collapse">
				<Calendar.GridHead>
					<Calendar.GridRow class="flex">
						{#each weekdays as day (day)}
							<Calendar.HeadCell class="flex-1 text-center text-xs font-medium opacity-60 pb-1">
								{day}
							</Calendar.HeadCell>
						{/each}
					</Calendar.GridRow>
				</Calendar.GridHead>
				<Calendar.GridBody>
					{#each month.weeks as week, weekIndex (weekIndex)}
						<Calendar.GridRow class="flex">
							{#each week as date (date.toString())}
								<Calendar.Cell {date} month={month.value} class="flex-1 p-0.5">
									<Calendar.Day
										class="flex h-8 w-full items-center justify-center rounded-lg text-sm transition-colors hover:bg-base-200 data-[selected]:bg-primary data-[selected]:text-primary-content data-[disabled]:opacity-30 data-[unavailable]:text-error data-[unavailable]:line-through data-[unavailable]:opacity-50 data-[outside-month]:opacity-0"
									/>
								</Calendar.Cell>
							{/each}
						</Calendar.GridRow>
					{/each}
				</Calendar.GridBody>
			</Calendar.Grid>
		{/each}
	{/snippet}
</Calendar.Root>
<input type="date" {name} value={value} hidden />
