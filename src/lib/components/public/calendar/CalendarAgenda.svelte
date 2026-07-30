<script module lang="ts">
	import { toLocalDate } from '$lib/utils/format';
	import type { CalendarEntry } from '$lib/types/calendar';

	/** Events grouped by local calendar day; input is sorted by startsAt, so a
	 * run-length pass preserves chronological group order. */
	export function groupByDay(list: CalendarEntry[]): [string, CalendarEntry[]][] {
		const groups: [string, CalendarEntry[]][] = [];
		for (const evt of list) {
			const key = toLocalDate(evt.startsAt);
			const last = groups[groups.length - 1];
			if (last && last[0] === key) last[1].push(evt);
			else groups.push([key, [evt]]);
		}
		return groups;
	}
</script>

<script lang="ts">
	import { IconMapPin, IconTicket } from '@tabler/icons-svelte';
	import { formatDate, formatTime } from '$lib/utils/format';

	let { events }: { events: CalendarEntry[] } = $props();

	const days = $derived(groupByDay(events));
	const todayKey = toLocalDate(new Date());
</script>

<div class="cal-agenda">
	{#each days as [day, dayEvents] (day)}
		<section id="day-{day}" class="cal-agenda__day">
			<h3 class="cal-agenda__day-head" class:cal-agenda__day-head--today={day === todayKey}>
				{formatDate(dayEvents[0].startsAt)}
				{#if day === todayKey}<span class="cal-agenda__today-tag">Today</span>{/if}
			</h3>
			<ul class="cal-agenda__list">
				{#each dayEvents as evt (evt.id)}
					<li class="cal-agenda__row">
						<span class="cal-agenda__time">{formatTime(evt.startsAt)}</span>
						<div class="cal-agenda__body">
							<div class="cal-agenda__title-line">
								<a class="cal-agenda__title" href={evt.href}>{evt.title}</a>
								{#if evt.source === 'band' && evt.bandName}
									<span class="sticker-badge sticker-badge--sm sticker-badge--teal"
										>{evt.bandName}</span
									>
								{:else}
									<span class="sticker-badge sticker-badge--sm sticker-badge--orange">CMC</span>
								{/if}
							</div>
							{#if evt.location}
								<span class="cal-agenda__location">
									<IconMapPin size={14} />
									{evt.location}
								</span>
							{/if}
							{#if evt.externalTicketUrl}
								<a
									class="cal-agenda__tickets"
									href={evt.externalTicketUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									<IconTicket size={14} />
									Tickets
								</a>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.cal-agenda {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.cal-agenda__day {
		scroll-margin-top: 5rem;
	}

	.cal-agenda__day-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--cmc-navy);
		border-bottom: 1px solid var(--surface-border);
		padding-bottom: 0.35rem;
		margin-bottom: 0.5rem;
	}

	.cal-agenda__today-tag {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--cmc-orange);
		border: 1px solid var(--cmc-orange);
		border-radius: 9999px;
		padding: 1px 8px;
	}

	.cal-agenda__list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.cal-agenda__row {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
	}

	.cal-agenda__time {
		flex-shrink: 0;
		width: 4.5rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--fg-2);
		text-align: right;
	}

	.cal-agenda__body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.cal-agenda__title-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.cal-agenda__title {
		font-weight: 600;
	}

	.cal-agenda__title:hover {
		text-decoration: underline;
	}

	.cal-agenda__location,
	.cal-agenda__tickets {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.8rem;
		color: var(--fg-2);
	}

	.cal-agenda__tickets:hover {
		text-decoration: underline;
	}
</style>
