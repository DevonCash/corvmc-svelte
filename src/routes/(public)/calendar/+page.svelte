<script lang="ts">
	import { page } from '$app/state';
	import { IconChevronLeft, IconChevronRight } from '@tabler/icons-svelte';
	import CalendarMonthGrid from '$lib/components/public/calendar/CalendarMonthGrid.svelte';
	import CalendarAgenda from '$lib/components/public/calendar/CalendarAgenda.svelte';
	import { toLocalDate } from '$lib/utils/format';
	import { getPublicCalendar } from '$lib/remote/calendar.remote';

	const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	const currentMonth = toLocalDate(new Date()).slice(0, 7);

	// Malformed ?month= params fall back to the current month before querying.
	const month = $derived.by(() => {
		const param = page.url.searchParams.get('month');
		return param && MONTH_RE.test(param) ? param : currentMonth;
	});

	let data = $derived(await getPublicCalendar({ month }));

	function shiftMonth(m: string, delta: number): string {
		const [year, mo] = m.split('-').map(Number);
		const shifted = new Date(Date.UTC(year, mo - 1 + delta, 1));
		return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
	}

	const monthLabel = $derived.by(() => {
		const [year, mo] = month.split('-').map(Number);
		return `${monthNames[mo - 1]} ${year}`;
	});
</script>

<svelte:head>
	<title>Calendar | Corvallis Music Collective</title>
	<meta
		name="description"
		content="What's happening this month — shows at the Collective and gigs from our member bands around the region."
	/>
	<meta property="og:title" content="Calendar | Corvallis Music Collective" />
	<meta
		property="og:description"
		content="What's happening this month — shows at the Collective and gigs from our member bands around the region."
	/>
</svelte:head>

<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-10">
			<h1 class="text-4xl font-bold tracking-tight mb-2" style="color: var(--cmc-navy)">
				Calendar
			</h1>
			<p class="text-base" style="color: var(--fg-2)">
				Shows at the Collective{data.bandEventsEnabled
					? ' and gigs from our member bands around the region'
					: ''}
			</p>
		</div>

		<div class="cal-nav">
			<a
				class="btn btn-ghost btn-sm btn-square"
				href="/calendar?month={shiftMonth(month, -1)}"
				aria-label="Previous month"
			>
				<IconChevronLeft size={18} />
			</a>
			<h2 class="cal-nav__label">{monthLabel}</h2>
			<a
				class="btn btn-ghost btn-sm btn-square"
				href="/calendar?month={shiftMonth(month, 1)}"
				aria-label="Next month"
			>
				<IconChevronRight size={18} />
			</a>
			{#if month !== currentMonth}
				<a class="btn btn-ghost btn-sm" href="/calendar">Today</a>
			{/if}
		</div>

		<div class="cal-legend">
			<span class="cal-legend__item">
				<span class="cal-legend__dot" style="background: var(--cmc-orange)"></span>
				CMC shows
			</span>
			{#if data.bandEventsEnabled}
				<span class="cal-legend__item">
					<span class="cal-legend__dot" style="background: var(--cmc-teal)"></span>
					Member bands
				</span>
			{/if}
		</div>

		{#if data.events.length === 0}
			<div class="text-center py-12 opacity-60">
				<p class="text-base">Nothing on the calendar for {monthLabel} yet. Check back soon!</p>
			</div>
		{:else}
			<div class="mb-10">
				<CalendarMonthGrid {month} events={data.events} />
			</div>
			<CalendarAgenda events={data.events} />
		{/if}
	</div>
</section>

<style>
	.cal-nav {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.cal-nav__label {
		font-size: 1.15rem;
		font-weight: 700;
		color: var(--cmc-navy);
		min-width: 11rem;
		text-align: center;
	}

	.cal-legend {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.25rem;
		margin-bottom: 1.5rem;
		font-size: 0.85rem;
		color: var(--fg-2);
	}

	.cal-legend__item {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
	}

	.cal-legend__dot {
		width: 9px;
		height: 9px;
		border-radius: 9999px;
	}
</style>
