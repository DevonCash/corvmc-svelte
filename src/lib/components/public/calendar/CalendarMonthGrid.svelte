<script lang="ts">
	import { CalendarDate, today, getLocalTimeZone } from '@internationalized/date';
	import { toLocalDate } from '$lib/utils/format';
	import type { CalendarEntry } from '$lib/types/calendar';

	let { month, events }: { month: string; events: CalendarEntry[] } = $props();

	const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const tz = getLocalTimeZone();
	const todayStr = today(tz).toString();
	const MAX_CHIPS = 3;

	const monthNumber = $derived(Number(month.split('-')[1]));

	const eventsByDay = $derived.by(() => {
		const byDay: Record<string, CalendarEntry[]> = {};
		for (const evt of events) {
			(byDay[toLocalDate(evt.startsAt)] ??= []).push(evt);
		}
		return byDay;
	});

	/** Sunday-aligned week rows covering the whole month (cf. CalendarSelect). */
	const weeks = $derived.by(() => {
		const [y, m] = month.split('-').map(Number);
		const first = new CalendarDate(y, m, 1);
		const last = first.add({ months: 1 }).subtract({ days: 1 });

		let cursor = first.subtract({ days: first.toDate(tz).getDay() });
		const lastDay = last.add({ days: 6 - last.toDate(tz).getDay() });

		const rows: CalendarDate[][] = [];
		while (cursor.compare(lastDay) <= 0) {
			const week: CalendarDate[] = [];
			for (let d = 0; d < 7; d++) {
				week.push(cursor);
				cursor = cursor.add({ days: 1 });
			}
			rows.push(week);
		}
		return rows;
	});
</script>

<div class="cal-grid hidden md:block" role="grid" aria-label="Month calendar">
	<div class="cal-grid__head" role="row">
		{#each weekdays as day (day)}
			<span role="columnheader">{day}</span>
		{/each}
	</div>
	{#each weeks as week, wi (wi)}
		<div class="cal-grid__row" role="row">
			{#each week as date (date.toString())}
				{@const key = date.toString()}
				{@const dayEvents = eventsByDay[key] ?? []}
				{@const inMonth = date.month === monthNumber}
				<div class="cal-grid__cell" class:cal-grid__cell--out={!inMonth} role="gridcell">
					<span class="cal-grid__daynum" class:cal-grid__daynum--today={key === todayStr}>
						{date.day}
					</span>
					{#each dayEvents.slice(0, MAX_CHIPS) as evt (evt.id)}
						<a class="cal-grid__chip" href={evt.href} title={evt.title}>
							<span
								class="cal-grid__dot"
								style="background: var({evt.source === 'band' ? '--cmc-teal' : '--cmc-orange'})"
							></span>
							<span class="cal-grid__chip-title">{evt.title}</span>
						</a>
					{/each}
					{#if dayEvents.length > MAX_CHIPS}
						<a class="cal-grid__more" href="#day-{key}">+{dayEvents.length - MAX_CHIPS} more</a>
					{/if}
				</div>
			{/each}
		</div>
	{/each}
</div>

<style>
	.cal-grid {
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.cal-grid__head {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		border-bottom: 1px solid var(--surface-border);
		background: color-mix(in oklch, var(--cmc-navy) 4%, transparent);
	}

	.cal-grid__head span {
		padding: 6px 8px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--fg-2);
	}

	.cal-grid__row {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
	}

	.cal-grid__row + .cal-grid__row {
		border-top: 1px solid var(--surface-border);
	}

	.cal-grid__cell {
		min-height: 96px;
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.cal-grid__cell + .cal-grid__cell {
		border-left: 1px solid var(--surface-border);
	}

	.cal-grid__cell--out {
		opacity: 0.35;
	}

	.cal-grid__daynum {
		font-size: 12px;
		font-weight: 600;
		width: 22px;
		height: 22px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
	}

	.cal-grid__daynum--today {
		border: 2px solid var(--cmc-orange);
		color: var(--cmc-orange);
	}

	.cal-grid__chip {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		line-height: 1.2;
		padding: 1px 2px;
		border-radius: 4px;
		min-width: 0;
	}

	.cal-grid__chip:hover {
		background: color-mix(in oklch, var(--cmc-navy) 8%, transparent);
	}

	.cal-grid__dot {
		width: 7px;
		height: 7px;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.cal-grid__chip-title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cal-grid__more {
		font-size: 11px;
		font-weight: 600;
		color: var(--fg-2);
		padding-left: 2px;
	}

	.cal-grid__more:hover {
		text-decoration: underline;
	}
</style>
