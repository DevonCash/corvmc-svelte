<script lang="ts">
	import {
		CancelReservationAction,
		ConfirmReservationAction,
		ConfirmWaitlistedAction,
		PayReservationAction
	} from '$lib/components/shared/actions';
	import ReservationSummary from '$lib/components/shared/reservations/ReservationSummary.svelte';
	import type { Reservation } from '$lib/server/db/schema';

	import { isToday, isTomorrow, isThisWeek, format } from 'date-fns';

	let { reservation }: { reservation: Reservation } = $props();

	let isTerminal = $derived(['completed', 'cancelled', 'no-show'].includes(reservation.status));
</script>

<div
	class="relative my-2 flex rounded-md border-[2.5px] border-(--cmc-brown) bg-base-100 {reservation.status}"
>
	<div class="date-block">
		{#if !isTerminal}
			{#if isThisWeek(reservation.startsAt)}
				<span class="upcoming-tag">
					{#if isToday(reservation.startsAt)}
						Today
					{:else if isTomorrow(reservation.startsAt)}
						Tomorrow
					{:else}
						This Week
					{/if}
				</span>
			{/if}
		{/if}
		<span>{format(reservation.startsAt, 'E')}</span>
		<span class="text-3xl">{format(reservation.startsAt, 'd')}</span>
		<span>{format(reservation.startsAt, 'MMM')}</span>
	</div>
	<div class="flex flex-1 flex-col">
		<ReservationSummary {reservation} class="space-y-1 p-2 px-3" />
		<span class="reservation-status">{reservation.status}</span>
		<div class="mt-5 flex h-0 items-center justify-end gap-2 px-2">
			{#if ['waitlisted', 'scheduled', 'confirmed'].includes(reservation.status)}
				<CancelReservationAction {reservation} class="btn-outline btn-xs btn-error" />
				{#if reservation.status === 'waitlisted' && reservation.waitlistNotifiedAt}
					<ConfirmWaitlistedAction {reservation} class="btn-xs btn-success" />
				{:else if reservation.status === 'scheduled'}
					<ConfirmReservationAction {reservation} class="btn-xs btn-primary" />
				{:else if reservation.status === 'confirmed' && !reservation.paidAt}
					<PayReservationAction {reservation} label="Pay Ahead" class="btn-xs btn-primary" />
				{/if}
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	@reference '#/routes/layout.css';

	.upcoming-tag {
		@apply absolute -top-3 left-0 ml-[-2.5px] rounded-sm rounded-bl-none border-[2.5px] border-(--cmc-brown) bg-error px-1 text-[.6rem] font-bold tracking-wide text-error-content uppercase;
	}

	.date-block {
		@apply relative flex w-20 shrink-0 flex-col items-center justify-center rounded-l-sm border-r-2 border-(--cmc-brown) py-3 text-xs leading-tight font-bold;
	}

	.confirmed .date-block {
		@apply bg-secondary text-secondary-content;
	}

	.scheduled .date-block {
		@apply bg-warning text-warning-content;
	}

	.completed .date-block {
		@apply bg-success text-success-content;
	}

	.no-show .date-block {
		@apply bg-base-300 text-error;
	}

	.cancelled .date-block {
		@apply bg-base-300 text-base-content/50;
	}

	.reservation-status {
		@apply absolute top-2 right-2 text-xs font-bold uppercase opacity-50 tracking-wide ;
		font-family: var(--font-mono);
	}
</style>
