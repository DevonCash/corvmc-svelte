<script lang="ts">
	import type { PageServerData } from './$types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import AsyncButton from '$lib/components/AsyncButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import {
		confirmReservation,
		completeReservation,
		noShowReservation,
		cancelReservation,
		cashReceived
	} from './data.remote';
	import { IconArrowLeft, IconArrowRight } from '@tabler/icons-svelte';
	import DayTimeline from '$lib/components/DayTimeline.svelte';
	import InfoCard from '$lib/components/InfoCard.svelte';
	import {
		fullDate,
		formatTime,
		durationHours as calcDurationHours,
		formatCents
	} from '$lib/utils/format';

	let { data }: { data: PageServerData } = $props();

	const r = $derived(data.reservation);
	const status = $derived(r.status);

	let cancelReason = $state('');
	let showCancelForm = $state(false);

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

	function initials(name: string): string {
		return name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	// Keyboard shortcuts for prev/next
	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft' && data.prevId) {
			window.location.href = `/staff/reservations/${data.prevId}`;
		} else if (e.key === 'ArrowRight' && data.nextId) {
			window.location.href = `/staff/reservations/${data.nextId}`;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="mx-auto max-w-3xl space-y-6">
	<PageHeader title="Reservation" backHref="/staff/reservations">
		<div class="flex items-center gap-2">
			<div class="divider mx-0 divider-horizontal"></div>

			<!-- Actions -->
			{#if status === 'scheduled'}
				<AsyncButton
					action={async () => {
						await confirmReservation({ reservationId: r.id });
					}}
					label="Confirm"
					successToast="Confirmed"
					class="btn-sm btn-success"
					onsuccess={() => invalidateAll()}
				/>
				<AsyncButton
					action={async () => {
						await cashReceived({
							reservationId: r.id,
							userId: r.createdByUserId,
							startsAt: r.startsAt,
							endsAt: r.endsAt
						});
					}}
					label="Cash Received"
					successToast="Marked as paid"
					class="btn-outline btn-sm btn-success"
					onsuccess={() => invalidateAll()}
				/>
			{/if}

			{#if status === 'confirmed'}
				<AsyncButton
					action={async () => {
						await completeReservation({ reservationId: r.id });
					}}
					label="Complete"
					successToast="Completed"
					class="btn-sm btn-success"
					onsuccess={() => invalidateAll()}
				/>
			{/if}

			{#if status === 'scheduled' || status === 'confirmed'}
				<button
					class="btn btn-outline btn-sm btn-error"
					onclick={() => (showCancelForm = !showCancelForm)}
				>
					Cancel
				</button>
				<AsyncButton
					action={async () => {
						await noShowReservation({ reservationId: r.id });
					}}
					label="No-Show"
					successToast="Marked as no-show"
					class="btn-outline btn-sm btn-warning"
					onsuccess={() => invalidateAll()}
				/>
			{/if}
		</div>
	</PageHeader>

	<!-- Cancel reason form (inline, shown when cancel clicked) -->
	{#if showCancelForm}
		<div class="alert alert-error">
			<div class="w-full">
				<p class="mb-2 font-medium">Cancel this reservation?</p>
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={cancelReason}
						placeholder="Reason (optional)"
						class="input-bordered input input-sm flex-1"
					/>
					<AsyncButton
						action={async () => {
							await cancelReservation({
								reservationId: r.id,
								reason: cancelReason || undefined
							});
						}}
						label="Confirm Cancel"
						successToast="Cancelled"
						class="btn-sm btn-error"
						onsuccess={() => {
							showCancelForm = false;
							invalidateAll();
						}}
					/>
					<button class="btn btn-ghost btn-sm" onclick={() => (showCancelForm = false)}>
						Nevermind
					</button>
				</div>
			</div>
		</div>
	{/if}

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
				<div class="flex items-center gap-4">
					<!-- Prev/Next navigation -->
					{#if data.prevId}
						<a
							href="/staff/reservations/{data.prevId}"
							class="btn btn-ghost btn-sm"
							title="Previous reservation (←)"
						>
							<IconArrowLeft size={16} />
							Prev
						</a>
					{:else}
						<span class="btn btn-disabled btn-ghost btn-sm">← Prev</span>
					{/if}

					{#if data.nextId}
						<a
							href="/staff/reservations/{data.nextId}"
							class="btn btn-ghost btn-sm"
							title="Next reservation (→)"
						>
							Next
							<IconArrowRight size={16} />
						</a>
					{:else}
						<span class="text-xs opacity-50">Last of the day</span>
					{/if}
				</div>
			</header>
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
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
		<!-- Member card -->
		<InfoCard title="Member">
			<div class="mb-3 flex items-center gap-3">
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-content"
				>
					{initials(r.memberName)}
				</div>
				<div class="min-w-0">
					<div class="flex items-center gap-2">
						<a href="/staff/users/{r.createdByUserId}" class="link font-medium link-primary">
							{r.memberName}
						</a>
						{#if data.isFirstReservation}
							<span class="badge badge-sm badge-info">First reservation</span>
						{/if}
					</div>
					<a href="mailto:{r.memberEmail}" class="link text-sm opacity-60">{r.memberEmail}</a>
				</div>
			</div>

			{#if r.memberPhone}
				<p class="text-sm opacity-60">
					<a href="tel:{r.memberPhone}" class="link">{r.memberPhone}</a>
				</p>
			{/if}
			{#if r.memberPronouns}
				<p class="text-sm opacity-50">{r.memberPronouns}</p>
			{/if}

			<div class="mt-3 flex items-center justify-between border-t border-base-200 pt-3">
				<span class="text-xs opacity-50">
					Booked as: <span class="badge badge-ghost badge-sm">{r.bookerType}</span>
				</span>
				<a href="/staff/users/{r.createdByUserId}" class="link text-sm link-primary">
					View profile →
				</a>
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
						<p class="text-xs opacity-50">Stripe record</p>
						<div class="mt-1 flex items-center gap-2">
							<code class="text-xs opacity-70"
								>{r.stripePaymentRecordId.slice(0, 10)}...{r.stripePaymentRecordId.slice(
									-4
								)}</code
							>
							<button
								class="btn btn-ghost btn-xs"
								onclick={() => navigator.clipboard.writeText(r.stripePaymentRecordId ?? '')}
								title="Copy"
							>
								📋
							</button>
						</div>
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
</div>
