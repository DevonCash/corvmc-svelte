<script lang="ts">
	import { formatDayNumber, formatShortMonth, formatDate, formatTime } from '$lib/utils/format';
	import { tagToColor } from '$lib/utils/tag-colors';

	interface TicketData {
		id: string;
		eventId: string;
		code: string;
		status: string;
		attendeeName: string;
		checkedInAt: Date | null;
		createdAt: Date;
		event: { title: string; startsAt: Date; endsAt: Date } | null;
	}

	let {
		ticket,
		tags,
		class: className = ''
	}: {
		ticket: TicketData;
		tags?: string | null;
		class?: string;
	} = $props();

	const stubColor = $derived.by(() => {
		if (!tags) return '';
		const primary = tags.split(',')[0]?.trim();
		if (!primary) return '';
		const color = tagToColor(primary);
		return color === 'goldenrod' ? '' : `stub--${color}`;
	});

	const eyebrowText = $derived.by(() => {
		if (!tags) return 'Event';
		return tags.split(',')[0]?.trim() || 'Event';
	});
</script>

{#if ticket.event}
	<a href="/member/events/{ticket.eventId}" class="stub {stubColor} {className}">
		<div class="stub__main">
			<span class="stub__eyebrow">{eyebrowText}</span>
			<span class="stub__title">{ticket.event.title}</span>
			<span class="stub__when">
				{formatDate(ticket.event.startsAt)} · {formatTime(ticket.event.startsAt)}
			</span>
		</div>
		<div class="stub__perf"></div>
		<div class="stub__stub">
			<span class="stub__date-num">{formatDayNumber(ticket.event.startsAt)}</span>
			<span class="stub__date-month">{formatShortMonth(ticket.event.startsAt)}</span>
			<span class="stub__id">{ticket.code}</span>
		</div>
	</a>
{/if}
