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

	let { data }: { data: PageServerData } = $props();

	const r = $derived(data.reservation);
	const status = $derived(r.status);

	let cancelReason = $state('');
	let showCancelForm = $state(false);

	// Formatting
	function fullDate(iso: string): string {
		return new Date(iso).toLocaleDateString('en-US', {
			timeZone: 'America/Los_Angeles',
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTime(iso: string): string {
		return new Date(iso).toLocaleTimeString('en-US', {
			timeZone: 'America/Los_Angeles',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function durationHours(): number {
		const ms = new Date(r.endsAt).getTime() - new Date(r.startsAt).getTime();
		return ms / (1000 * 60 * 60);
	}

	function durationLabel(): string {
		const h = durationHours();
		return h === 1 ? '1 hour' : `${h} hours`;
	}

	function amountCents(): number {
		return Math.round(durationHours() * data.hourlyRateCents);
	}

	function amountFormatted(): string {
		return `$${(amountCents() / 100).toFixed(2)}`;
	}

	function rateFormatted(): string {
		return `$${(data.hourlyRateCents / 100).toFixed(2)}`;
	}

	function paymentStatus(): { label: string; class: string } {
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
	}

	function initials(name: string): string {
		return name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	}

	// Timeline bar positioning (9am = 0%, 10pm = 100%)
	const TIMELINE_START_HOUR = 9;
	const TIMELINE_END_HOUR = 22;
	const TIMELINE_RANGE = TIMELINE_END_HOUR - TIMELINE_START_HOUR;

	function timelinePercent(iso: string): number {
		const d = new Date(iso);
		const h = Number(d.toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', hour: '2-digit', hour12: false }));
		const m = Number(d.toLocaleTimeString('en-GB', { timeZone: 'America/Los_Angeles', minute: '2-digit' }));
		const hourDecimal = h + m / 60;
		return Math.max(0, Math.min(100, ((hourDecimal - TIMELINE_START_HOUR) / TIMELINE_RANGE) * 100));
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

<div class="max-w-3xl mx-auto space-y-6">
	<PageHeader title="Reservation" backHref="/staff/reservations">
		<div class="flex items-center gap-2">
			<!-- Prev/Next navigation -->
			{#if data.prevId}
				<a href="/staff/reservations/{data.prevId}" class="btn btn-sm btn-ghost" title="Previous reservation (←)">
					← Prev
				</a>
			{:else}
				<span class="btn btn-sm btn-ghost btn-disabled">← Prev</span>
			{/if}

			{#if data.nextId}
				<a href="/staff/reservations/{data.nextId}" class="btn btn-sm btn-ghost" title="Next reservation (→)">
					Next →
				</a>
			{:else}
				<span class="text-sm opacity-50">Last of the day</span>
			{/if}

			<div class="divider divider-horizontal mx-0"></div>

			<!-- Actions -->
			{#if status === 'scheduled'}
				<AsyncButton
					action={async () => { await confirmReservation({ reservationId: r.id }); }}
					label="Confirm"
					successToast="Confirmed"
					class="btn-success btn-sm"
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
					class="btn-success btn-outline btn-sm"
					onsuccess={() => invalidateAll()}
				/>
			{/if}

			{#if status === 'confirmed'}
				<AsyncButton
					action={async () => { await completeReservation({ reservationId: r.id }); }}
					label="Complete"
					successToast="Completed"
					class="btn-success btn-sm"
					onsuccess={() => invalidateAll()}
				/>
			{/if}

			{#if status === 'scheduled' || status === 'confirmed'}
				<button class="btn btn-error btn-outline btn-sm" onclick={() => (showCancelForm = !showCancelForm)}>
					Cancel
				</button>
				<AsyncButton
					action={async () => { await noShowReservation({ reservationId: r.id }); }}
					label="No-Show"
					successToast="Marked as no-show"
					class="btn-warning btn-outline btn-sm"
					onsuccess={() => invalidateAll()}
				/>
			{/if}
		</div>
	</PageHeader>

	<!-- Cancel reason form (inline, shown when cancel clicked) -->
	{#if showCancelForm}
		<div class="alert alert-error">
			<div class="w-full">
				<p class="font-medium mb-2">Cancel this reservation?</p>
				<div class="flex gap-2">
					<input
						type="text"
						bind:value={cancelReason}
						placeholder="Reason (optional)"
						class="input input-bordered input-sm flex-1"
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
						class="btn-error btn-sm"
						onsuccess={() => { showCancelForm = false; invalidateAll(); }}
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
			<div class="flex items-center gap-2 mb-2">
				<StatusBadge status={r.status} />
			</div>

			<p class="text-xl font-medium">{fullDate(r.startsAt)}</p>
			<p class="opacity-70">{formatTime(r.startsAt)} – {formatTime(r.endsAt)} · {durationLabel()}</p>

			<!-- Timeline bar -->
			<div class="mt-4 relative h-7 bg-base-200 rounded overflow-hidden">
				<!-- Other reservations -->
				{#each data.sameDayReservations as other (other.id)}
					<div
						class="absolute h-full bg-base-300 rounded opacity-50"
						style="left: {timelinePercent(other.startsAt)}%; width: {timelinePercent(other.endsAt) - timelinePercent(other.startsAt)}%"
						title="{formatTime(other.startsAt)} – {formatTime(other.endsAt)}"
					></div>
				{/each}

				<!-- This reservation -->
				<div
					class="absolute h-full bg-primary rounded"
					style="left: {timelinePercent(r.startsAt)}%; width: {timelinePercent(r.endsAt) - timelinePercent(r.startsAt)}%"
				></div>

				<!-- Labels -->
				<div class="absolute inset-0 flex justify-between items-center px-1.5 pointer-events-none">
					<span class="text-[10px] opacity-40">9am</span>
					<span class="text-[10px] opacity-40">12pm</span>
					<span class="text-[10px] opacity-40">3pm</span>
					<span class="text-[10px] opacity-40">6pm</span>
					<span class="text-[10px] opacity-40">9pm</span>
				</div>
			</div>
			<div class="flex gap-3 mt-1">
				<span class="text-xs opacity-40 flex items-center gap-1">
					<span class="inline-block w-2 h-2 bg-primary rounded-sm"></span> This reservation
				</span>
				{#if data.sameDayReservations.length > 0}
					<span class="text-xs opacity-40 flex items-center gap-1">
						<span class="inline-block w-2 h-2 bg-base-300 rounded-sm"></span> Other reservations
					</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Member + Payment grid -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
		<!-- Member card -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h3 class="text-sm font-medium opacity-60 mb-3">Member</h3>
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-full bg-primary text-primary-content flex items-center justify-center font-medium text-sm shrink-0">
						{initials(r.memberName)}
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-2">
							<a href="/staff/users/{r.createdByUserId}" class="font-medium link link-primary">
								{r.memberName}
							</a>
							{#if data.isFirstReservation}
								<span class="badge badge-info badge-sm">First reservation</span>
							{/if}
						</div>
						<a href="mailto:{r.memberEmail}" class="text-sm opacity-60 link">{r.memberEmail}</a>
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

				<div class="mt-3 pt-3 border-t border-base-200 flex items-center justify-between">
					<span class="text-xs opacity-50">
						Booked as: <span class="badge badge-ghost badge-sm">{r.bookerType}</span>
					</span>
					<a href="/staff/users/{r.createdByUserId}" class="text-sm link link-primary">
						View profile →
					</a>
				</div>
			</div>
		</div>

		<!-- Payment card -->
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h3 class="text-sm font-medium opacity-60 mb-3">Payment</h3>
				<div class="flex items-baseline justify-between mb-1">
					<span class="text-2xl font-medium">{amountFormatted()}</span>
					{#if true}
						{@const ps = paymentStatus()}
						<span class="badge {ps.class}">{ps.label}</span>
					{/if}
				</div>
				<p class="text-sm opacity-60">{durationLabel()} × {rateFormatted()}/hr</p>

				{#if r.stripePaymentRecordId}
					<div class="mt-3 pt-3 border-t border-base-200">
						<p class="text-xs opacity-50">Stripe record</p>
						<div class="flex items-center gap-2 mt-1">
							<code class="text-xs opacity-70">{r.stripePaymentRecordId.slice(0, 10)}...{r.stripePaymentRecordId.slice(-4)}</code>
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
			</div>
		</div>
	</div>

	<!-- Notes -->
	{#if r.notes}
		<div class="card bg-base-100 shadow">
			<div class="card-body">
				<h3 class="text-sm font-medium opacity-60 mb-2">Notes</h3>
				<p>{r.notes}</p>
			</div>
		</div>
	{/if}

	<!-- Cancellation -->
	{#if status === 'cancelled'}
		<div class="card bg-base-100 shadow border-l-4 border-error">
			<div class="card-body">
				<h3 class="text-sm font-medium opacity-60 mb-2">Cancelled</h3>
				{#if r.cancellationReason}
					<p>{r.cancellationReason}</p>
				{:else}
					<p class="opacity-50">No reason provided</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
