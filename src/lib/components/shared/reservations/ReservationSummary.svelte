<script lang="ts">
	import type { Reservation } from '$lib/server/reservation';
	import { format, formatDistanceStrict, formatDistanceToNow } from 'date-fns';

	let {
		reservation,
		member,
		class: className = ''
	}: {
		reservation: Reservation & { price?: number };
		member?: { name: string };
		class?: string;
	} = $props();
</script>

<div class={className}>
	<p class="font-medium">{format(reservation.startsAt, 'PPP')}</p>
	<p class="text-sm opacity-70">
		{format(reservation.startsAt, 'p')} – {format(reservation.endsAt, 'p')} · {formatDistanceStrict(
			reservation.endsAt,
			reservation.startsAt,
			{ addSuffix: false, unit: 'minute' }
		)}
	</p>
	{#if reservation.price}
		<p class="text-sm opacity-70">
			{reservation.price.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} ·
			{#if reservation.refundedAt}
				Refunded {format(reservation.refundedAt, 'PP')}
			{:else if reservation.paidAt}
				Paid {format(reservation.paidAt, 'PP')}
			{:else if reservation.status === 'cancelled'}
				Payment Cancelled
			{:else}
				Due {formatDistanceToNow(reservation.startsAt, { addSuffix: true })}
			{/if}
		</p>
	{/if}
	{#if member?.name}
		<p class="text-sm opacity-70">{member.name}</p>
	{/if}
</div>
