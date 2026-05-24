<script lang="ts">
	import {
		formatDate,
		relativeDay,
		formatTimeRange,
		durationHours,
		formatDurationAmount,
		formatDayOfWeek,
		formatDayNumber,
		formatShortMonth
	} from '$lib/utils/format';
	import type { ISODateString } from '$lib/types/dates';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import ActionGroup from '$lib/components/shared/ActionGroup.svelte';
	import {
		ConfirmReservationAction,
		ConfirmWaitlistedAction,
		CancelReservationAction,
		PayReservationAction
	} from '$lib/components/shared/actions';
	import type { MemberReservation } from '$lib/server/db/schema/api';

	let { reservation }: { reservation: MemberReservation } = $props();

	const h = $derived(durationHours(reservation.startsAt, reservation.endsAt));
	const durationLabel = $derived(h === 1 ? '1 hr' : `${h} hrs`);

	let isToday = $derived(reservation.startsAt)
	let isTomorrow = $derived(reservation.startsAt)
	let isThisWeek = $derived(reservation.startsAt)
</script>

<div class="my-1 flex rounded-md border-[2.5px] border-(--cmc-brown) bg-base-100">
	<div
		class="relative flex w-20 shrink-0 flex-col items-center justify-center rounded-l-sm border-r-2 border-(--cmc-brown) bg-primary py-3 text-primary-content"
	>
		{#if isToday}
			<span
				class="absolute -top-3 left-0 ml-[-2.5px] rounded-sm rounded-bl-none border-[2.5px] bg-error px-1 text-[.6rem] font-bold tracking-wide text-error-content uppercase"
				>Today</span
			>
		{:else if isTomorrow}
			<span
				class="absolute -top-3 left-0 ml-[-2.5px] rounded-sm rounded-bl-none border-[2.5px] bg-error px-1 text-[.6rem] font-bold tracking-wide text-error-content uppercase"
				>Tomorrow</span
			>
		{:else if isThisWeek}
			<span
				class="absolute -top-3 left-0 ml-[-2.5px] rounded-sm rounded-bl-none border-[2.5px] bg-error px-1 text-[.6rem] font-bold tracking-wide text-error-content uppercase"
				>This Week</span
			>
		{/if}

		<span class="text-xs leading-tight font-bold">{formatDayOfWeek(reservation.startsAt)}</span>
		<span class="text-3xl leading-tight font-bold">{formatDayNumber(reservation.startsAt)}</span>
		<span class="text-xs leading-tight font-bold">{formatShortMonth(reservation.startsAt)}</span>
	</div>
	<div class="flex min-w-0 flex-1 flex-col">
		<div class="flex flex-1 flex-col gap-1 px-4 py-3">
			<div class="flex items-center justify-between gap-2">
				<span class="font-semibold">{relativeDay(reservation.startsAt)}</span>
				<StatusBadge status={reservation.status} />
			</div>
			<div class="flex items-baseline justify-between gap-2 text-sm">
				<span>{formatTimeRange(reservation.startsAt, reservation.endsAt)}</span>
				<span class="text-xs opacity-60">{durationLabel}</span>
			</div>
			<div class="flex items-baseline justify-between gap-2 text-sm">
				<span>{formatDurationAmount(reservation.startsAt, reservation.endsAt, 1500)}</span>
				<span class="text-xs opacity-40">
					{#if reservation.status === 'waitlisted'}
						{#if reservation.waitlistNotifiedAt}
							Slot available — confirm by {formatDate(reservation.waitlistExpiresAt!)}
						{:else}
							Waiting for slot
						{/if}
					{:else if reservation.refundedAt}
						Refunded {formatDate(reservation.refundedAt!)}
					{:else if reservation.status === 'cancelled'}
						Cancelled
					{:else if reservation.paidAt}
						Paid {formatDate(reservation.paidAt!)}{#if reservation.paidWithCredits}
							· credits{/if}
					{:else if reservation.paidWithCredits}
						Paid with credits
					{:else if reservation.status === 'completed' || reservation.status === 'no_show'}
						Unpaid
					{:else if new Date(reservation.startsAt) < new Date()}
						Overdue
					{:else}
						Due {formatDate(reservation.startsAt)}
					{/if}
				</span>
			</div>
		</div>
		<div class="mt-2 flex h-0 items-center justify-end gap-2 px-2">
			{#if ['waitlisted', 'scheduled', 'confirmed'].includes(reservation.status)}
				<CancelReservationAction {reservation} class="btn-ghost btn-xs" />
				{#if reservation.status === 'waitlisted' && reservation.waitlistNotifiedAt}
					<ConfirmWaitlistedAction {reservation} class="btn-xs btn-success" />
				{:else if reservation.status === 'scheduled'}
					<ConfirmReservationAction {reservation} class="btn-xs btn-primary" />
				{:else if reservation.status === 'confirmed' && !reservation.paidAt && !reservation.paidWithCredits}
					<PayReservationAction {reservation} label="Pay Ahead" class="btn-xs btn-primary" />
				{/if}
			{/if}
		</div>
	</div>
</div>
