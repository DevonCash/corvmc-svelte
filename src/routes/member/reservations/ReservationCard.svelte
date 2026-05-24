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
	import { DateTime } from 'luxon';
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

	let isToday = $derived.by(() =>
		DateTime.fromISO(reservation.startsAt).hasSame(DateTime.now(), 'day')
	);
	let isTomorrow = $derived.by(() =>
		DateTime.fromISO(reservation.startsAt).hasSame(DateTime.now().plus(1, 'day'), 'day')
	);
	let isThisWeek = $derived.by(() =>
		DateTime.fromISO(reservation.startsAt).hasSame(DateTime.now(), 'week')
	);

	const isPast = $derived(new Date(reservation.startsAt) < new Date());

	const dateBlockClasses = $derived.by(() => {
		const r = reservation;
		if (
			isPast &&
			!r.paidAt &&
			!r.paidWithCredits &&
			(r.status === 'completed' || r.status === 'no_show')
		)
			return 'bg-(--cmc-red-orange) text-white';
		if (r.status === 'cancelled' || r.refundedAt) return 'bg-base-300 text-base-content';
		if (r.status === 'confirmed' && (r.paidAt || r.paidWithCredits))
			return 'bg-(--cmc-green) text-white';
		if (r.status === 'confirmed') return 'bg-(--cmc-teal) text-white';
		if (r.status === 'scheduled') return 'bg-(--cmc-goldenrod) text-(--cmc-brown)';
		return 'bg-primary text-primary-content';
	});

	const statusTag = $derived.by(() => {
		const r = reservation;
		if (r.refundedAt) return 'Refunded';
		if (r.status === 'cancelled') return 'Cancelled';
		if (
			isPast &&
			!r.paidAt &&
			!r.paidWithCredits &&
			(r.status === 'completed' || r.status === 'no_show')
		)
			return 'Overdue';
		if (r.status === 'confirmed' && (r.paidAt || r.paidWithCredits)) return 'Paid';
		if (r.status === 'confirmed') return 'Confirmed';
		if (r.status === 'scheduled') return 'Needs Confirm';
		if (r.status === 'waitlisted') return 'Waiting';
		return null;
	});

	const urgencyClass = $derived.by(() => {
		const r = reservation;
		if (r.paidAt || r.paidWithCredits || r.status === 'cancelled' || r.refundedAt) return '';
		if (r.status === 'completed' || r.status === 'no_show')
			return 'text-(--cmc-red-orange) font-bold';

		const now = new Date();
		const start = new Date(r.startsAt);
		const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

		if (diffDays < 0) return 'text-(--cmc-red-orange) font-bold';
		if (diffDays <= 3) return 'text-(--cmc-goldenrod) font-semibold';
		return '';
	});
</script>

<div class="my-1 flex rounded-md border-[2.5px] border-(--cmc-brown) bg-base-100">
	<div
		class="relative flex w-20 shrink-0 flex-col items-center justify-center rounded-l-sm border-r-2 border-(--cmc-brown) {dateBlockClasses} py-3"
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
				{#if statusTag}
					<span class="text-[.6rem] font-bold tracking-wide uppercase opacity-60"
						>{statusTag}</span
					>
				{/if}
			</div>
			<div class="flex items-baseline justify-between gap-2 text-sm">
				<span>{formatTimeRange(reservation.startsAt, reservation.endsAt)}</span>
				<span class="text-xs opacity-60">{durationLabel}</span>
			</div>
			<div class="flex items-baseline justify-between gap-2 text-sm">
				<span>{formatDurationAmount(reservation.startsAt, reservation.endsAt, 1500)}</span>
				<span class="text-xs {urgencyClass || 'opacity-40'}">
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
						{'• '}Unpaid
					{:else if new Date(reservation.startsAt) < new Date()}
						{'• '}Overdue
					{:else}
						{#if urgencyClass}{'• '}{/if}Due {formatDate(reservation.startsAt)}
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
