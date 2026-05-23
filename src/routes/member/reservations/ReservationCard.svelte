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
</script>

<div class="flex rounded-md border-[2.5px] border-(--cmc-brown) bg-base-100">
	<div
		class="flex w-20 shrink-0 flex-col items-center justify-center rounded-l-sm border-r-2 border-(--cmc-brown) bg-primary py-3 text-primary-content"
	>
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
							Slot available — confirm by {formatDate(reservation.waitlistExpiresAt ?? '')}
						{:else}
							Waiting for slot
						{/if}
					{:else if reservation.refundedAt}
						Refunded {formatDate(reservation.refundedAt)}
					{:else if reservation.status === 'cancelled'}
						Cancelled
					{:else if reservation.paidAt}
						Paid {formatDate(reservation.paidAt)}{#if reservation.paidWithCredits}
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
		<div class="flex min-h-5 items-center justify-end rounded-br-lg bg-base-200 pt-0">
			{#if reservation.status === 'waitlisted' || reservation.status === 'scheduled' || reservation.status === 'confirmed'}
				<ActionGroup class="m-[-2.4px]">
					{#if reservation.status === 'waitlisted'}
						<CancelReservationAction reservation={reservation} class="btn-ghost btn-xs" />
						{#if reservation.waitlistNotifiedAt}
							<ConfirmWaitlistedAction reservation={reservation} class="btn-xs btn-success" />
						{/if}
					{:else}
						<CancelReservationAction reservation={reservation} class="btn-ghost btn-xs" />
						{#if reservation.status === 'scheduled'}
							<ConfirmReservationAction reservation={reservation} class="btn-xs btn-primary" />
						{:else if reservation.status === 'confirmed' && !reservation.paidAt && !reservation.paidWithCredits}
							<PayReservationAction
								reservation={reservation}
								label="Pay Ahead"
								class="btn-xs btn-primary"
							/>
						{/if}
					{/if}
				</ActionGroup>
			{/if}
		</div>
	</div>
</div>
