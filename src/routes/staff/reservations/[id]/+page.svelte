<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import {
		confirmReservation,
		completeReservation,
		noShowReservation,
		cancelReservation,
		cashReceived,
		compReservation,
		refundReservation
	} from './data.remote';
	import DayTimeline from '$lib/components/shared/DayTimeline.svelte';
	import RecordNav from '$lib/components/shared/RecordNav.svelte';
	import CopyableId from '$lib/components/shared/CopyableId.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import {
		fullDate,
		formatTime,
		durationHours as calcDurationHours,
		formatCents
	} from '$lib/utils/format';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import { IconLink, IconMail, IconPhone } from '@tabler/icons-svelte';
	import type { StaffReservationDetailResponse } from '$lib/types/api';
	import { visibleActions } from '$lib/utils/reservation-actions';

	let { data }: { data: StaffReservationDetailResponse } = $props();

	const r = $derived(data.reservation);
	const status = $derived(r.status);
	const actions = $derived(visibleActions(status, r.startsAt, r.endsAt, r.stripePaymentRecordId));

	let cancelReason = $state('');

	// Derived formatting
	const hours = $derived(calcDurationHours(r.startsAt, r.endsAt));
	const durationLabel = $derived(hours === 1 ? '1 hour' : `${hours} hours`);
	const amountFormatted = $derived(formatCents(Math.round(hours * data.hourlyRateCents)));
	const rateFormatted = $derived(formatCents(data.hourlyRateCents));

	const paymentStatus = $derived.by((): { label: string; class: string } => {
		if (status === 'no_show') return { label: 'No-show', class: 'badge-error' };
		if (status === 'cancelled') {
			return r.stripePaymentRecordId
				? { label: 'Refunded', class: 'badge-error' }
				: { label: 'Cancelled', class: 'badge-ghost' };
		}
		if (status === 'scheduled') return { label: 'Unpaid', class: 'badge-warning' };
		return r.stripePaymentRecordId
			? { label: 'Paid', class: 'badge-success' }
			: { label: 'Comped', class: 'badge-info' };
	});
</script>

<PageHeader title="Reservation" backHref="/staff/reservations" />
<PageContent width="3xl">
	<!-- Hero card -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<header class="flex items-start justify-between">
				<hgroup>
					<p class="flex items-center gap-2 text-xl font-medium">
						{fullDate(r.startsAt)}
						<StatusBadge status={r.status} />
					</p>
					<p class="opacity-70">
						{formatTime(r.startsAt)} – {formatTime(r.endsAt)} · {durationLabel}
					</p>
				</hgroup>
				<RecordNav
					prevHref={data.prevId ? `/staff/reservations/${data.prevId}` : undefined}
					nextHref={data.nextId ? `/staff/reservations/${data.nextId}` : undefined}
					endLabel="Last of the day"
				/>
			</header>

			{#if actions.has('confirm') || actions.has('complete') || actions.has('noShow') || actions.has('cancel')}
				<div class="flex flex-wrap items-center gap-2 border-t border-base-200 pt-3">
					{#if actions.has('confirm')}
						<Action
							action={() => confirmReservation({ reservationId: r.id })}
							label="Confirm"
							successToast="Confirmed"
							class="btn-sm btn-success"
							onsuccess={() => invalidateAll()}
						/>
					{/if}
					{#if actions.has('complete')}
						<Action
							action={() => completeReservation({ reservationId: r.id })}
							label="Complete"
							successToast="Completed"
							class="btn-sm btn-success"
							onsuccess={() => invalidateAll()}
						/>
					{/if}
					{#if actions.has('noShow')}
						<Action
							action={() => noShowReservation({ reservationId: r.id })}
							label="No-Show"
							confirm="Mark this reservation as a no-show?"
							successToast="Marked as no-show"
							class="btn-outline btn-sm btn-warning"
							onsuccess={() => invalidateAll()}
						/>
					{/if}
					{#if actions.has('cancel')}
						<Action
							action={() => cancelReservation({ reservationId: r.id, reason: cancelReason || undefined })}
							label="Cancel"
							modalTitle="Cancel Reservation"
							class="btn-outline btn-sm btn-error"
							successToast="Cancelled"
							onsuccess={() => { cancelReason = ''; invalidateAll(); }}
						>
							{#snippet form({ close })}
								<p class="text-sm mb-3">Cancel this reservation?</p>
								<input
									type="text"
									bind:value={cancelReason}
									placeholder="Reason (optional)"
									class="input-bordered input input-sm w-full"
								/>
							{/snippet}
						</Action>
					{/if}
				</div>
			{/if}
		</div>

		<DayTimeline
			current={{ id: r.id, startsAt: r.startsAt, endsAt: r.endsAt, bookerType: r.bookerType }}
			others={data.sameDayReservations.map((o) => ({
				id: o.id,
				startsAt: o.startsAt,
				endsAt: o.endsAt,
				bookerType: o.bookerType,
				label: o.memberName,
				href: `/staff/reservations/${o.id}`
			}))}
		/>
	</div>

	<!-- Member + Payment grid -->
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<!-- Member card -->
		<InfoCard title="Member">
			{#snippet header(title)}
				<header class="flex justify-between">
					<span class="card-title">{title}</span>
					{#if r.createdByUserId}
						<a href="/staff/users/{r.createdByUserId}" class="btn btn-sm"> View Profile </a>
					{/if}
				</header>
			{/snippet}
			<div class="flex flex-col items-center">
				<Avatar src={r.memberImage ?? undefined} name={r.memberName} class="size-16 mb-4" />
				<h3 class='text-lg'>{r.memberName}</h3>
				{#if r.memberPronouns}
					<p class="text-xs text-muted">{r.memberPronouns}</p>
				{/if}
				<div class="join join-vertical mt-4">
					<a href="mailto:{r.memberEmail}" class="btn join-item btn-outline">
						<IconMail class="size-5" />
						{r.memberEmail}
					</a>
					{#if r.memberPhone}
						<a href="tel:{r.memberPhone}" class="btn join-item btn-outline">
							<IconPhone class="size-5" />
							{r.memberPhone}
						</a>
					{/if}
				</div>
			</div>
		</InfoCard>

		<!-- Payment card (not shown for event reservations) -->
		{#if r.bookerType !== 'event'}
			<InfoCard title="Payment">
				<div class="mb-1 flex items-baseline justify-between">
					<span class="text-2xl font-medium">{amountFormatted}</span>
					<span class="badge {paymentStatus.class}">{paymentStatus.label}</span>
				</div>
				<p class="text-sm opacity-60">{durationLabel} × {rateFormatted}/hr</p>

				{#if r.stripePaymentRecordId}
					<div class="mt-3 border-t border-base-200 pt-3">
						<CopyableId value={r.stripePaymentRecordId} label="Stripe record" />
					</div>
				{/if}

				{#if actions.has('cashReceived') || actions.has('comp') || actions.has('refund')}
					<div class="mt-3 flex flex-wrap gap-2 border-t border-base-200 pt-3">
						{#if actions.has('cashReceived')}
							<Action
								action={() =>
									cashReceived({
										reservationId: r.id,
										userId: r.createdByUserId,
										startsAt: r.startsAt,
										endsAt: r.endsAt
									})}
								label="Cash Received"
								successToast="Marked as paid"
								class="btn-outline btn-sm btn-success flex-1"
								onsuccess={() => invalidateAll()}
							/>
						{/if}
						{#if actions.has('comp')}
							<Action
								action={() => compReservation({ reservationId: r.id })}
								label="Comp"
								confirm="Waive payment for this reservation?"
								successToast="Reservation comped"
								class="btn-outline btn-sm btn-info flex-1"
								onsuccess={() => invalidateAll()}
							/>
						{/if}
						{#if actions.has('refund')}
							<Action
								action={() => refundReservation({
									reservationId: r.id,
									userId: r.createdByUserId,
									stripePaymentRecordId: r.stripePaymentRecordId!
								})}
								label="Refund"
								confirm="Refund the payment for this reservation? This does not cancel the reservation."
								successToast="Payment refunded"
								class="btn-outline btn-sm btn-error flex-1"
								onsuccess={() => invalidateAll()}
							/>
						{/if}
					</div>
				{/if}
			</InfoCard>
		{/if}
	</div>

	<!-- Notes -->
	{#if r.notes}
		<InfoCard title="Notes">
			<p>{r.notes}</p>
		</InfoCard>
	{/if}

	<!-- Cancellation -->
	{#if status === 'cancelled'}
		<InfoCard title="Cancelled" class="border-l-4 border-error">
			{#if r.cancellationReason}
				<p>{r.cancellationReason}</p>
			{:else}
				<p class="opacity-50">No reason provided</p>
			{/if}
		</InfoCard>
	{/if}
</PageContent>
