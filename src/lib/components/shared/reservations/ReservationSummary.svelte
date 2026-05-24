<script lang="ts">
	import { fullDate, formatTimeRange, formatDuration } from '$lib/utils/format';
	import type { ISODateString } from '$lib/types/dates';

	let {
		reservation
	}: {
		reservation: {
			startsAt: ISODateString;
			endsAt: ISODateString;
			memberName?: string;
		};
	} = $props();
</script>

<div class="rounded-lg border border-base-300 bg-base-200/50 px-4 py-3">
	<p class="font-medium">{fullDate(reservation.startsAt)}</p>
	<p class="text-sm opacity-70">
		{formatTimeRange(reservation.startsAt, reservation.endsAt)} · {formatDuration(reservation.startsAt, reservation.endsAt)}
	</p>
	{#if reservation.memberName}
		<p class="text-sm opacity-70">{reservation.memberName}</p>
	{/if}
</div>
