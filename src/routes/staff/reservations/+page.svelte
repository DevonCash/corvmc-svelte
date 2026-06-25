<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import BookerTypeIcon from '$lib/components/shared/reservations/BookerTypeIcon.svelte';
	import Pagination from '$lib/components/shared/Pagination.svelte';
	import {
		ConfirmReservationAction,
		CompleteReservationAction
	} from '$lib/components/shared/actions';
	import ResolveModal from './ResolveModal.svelte';
	import CreateReservation from './CreateModal.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import {
		IconCheck,
		IconCircleCheck,
		IconClock,
		IconGift,
		IconCoin,
		IconArrowBackUp,
		IconUserX,
		IconCircleX,
		IconRepeat
	} from '@tabler/icons-svelte';
	import { formatDate, formatTimeRange, formatDurationAmount } from '$lib/utils/format';
	import { DEFAULT_TIMEZONE } from '$lib/config';
	import { visibleActions, reservationPaymentState } from '$lib/utils/reservation-actions';
	import Badge from '$lib/components/shared/Badge.svelte';
	import {
		getStaffReservations,
		getReservationCounts,
		getUnresolvedReservations,
		getHourlyRate
	} from '$lib/remote/reservations.remote';

	type Reservation = Awaited<ReturnType<typeof getStaffReservations>>['rows'][number];

	let tab = $state<'upcoming' | 'all'>('upcoming');
	let search = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		search = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = search;
			page = 1;
		}, 300);
	}

	let filters = $derived({
		tab,
		search: searchDebounced || undefined,
		dateFrom: dateFrom || undefined,
		dateTo: dateTo || undefined,
		page
	});

	let result = $derived(getStaffReservations(filters));
	let counts = $derived(getReservationCounts());
	let unresolved = $derived(getUnresolvedReservations());
	let hourlyRate = $derived(getHourlyRate());

	let resolveOpen = $state(false);

	function paymentStatus(r: Reservation): { label: string; color: string; icon: typeof IconCheck } {
		switch (reservationPaymentState(r)) {
			case 'no_show':
				return { label: 'No-show', color: 'text-error', icon: IconUserX };
			case 'refunded':
				return { label: 'Refunded', color: 'text-error', icon: IconArrowBackUp };
			case 'cancelled':
				return { label: 'Cancelled', color: 'text-base-content', icon: IconCircleX };
			case 'paid':
				return { label: 'Paid', color: 'text-success', icon: IconCheck };
			case 'cash_due':
				return { label: 'Cash due', color: 'text-warning', icon: IconClock };
			case 'unpaid':
				return { label: 'Unpaid', color: 'text-warning', icon: IconClock };
			case 'credits':
				return { label: 'Paid with credits', color: 'text-info', icon: IconCoin };
			case 'comped':
				return { label: 'Comped', color: 'text-info', icon: IconGift };
		}
	}

	function dayLabel(r: Reservation): string {
		const localDate = new Date(r.startsAt).toLocaleDateString('en-CA', {
			timeZone: DEFAULT_TIMEZONE
		});
		const now = new Date();
		const today = now.toLocaleDateString('en-CA', { timeZone: DEFAULT_TIMEZONE });
		const tomorrow = new Date(now.getTime() + 86400000).toLocaleDateString('en-CA', {
			timeZone: DEFAULT_TIMEZONE
		});
		const label = formatDate(r.startsAt);
		if (localDate === today) return `${label} (Today)`;
		if (localDate === tomorrow) return `${label} (Tomorrow)`;
		return label;
	}

	function hasActiveFilters(): boolean {
		return !!(searchDebounced || dateFrom || dateTo);
	}

	function clearFilters() {
		search = '';
		searchDebounced = '';
		dateFrom = '';
		dateTo = '';
		page = 1;
	}
</script>

<PageHeader title="Reservations">
	<div class="flex gap-2">
		{#await Promise.all([unresolved, counts])}
			<button class="btn btn-sm btn-ghost" onclick={() => (resolveOpen = true)}>Resolve</button>
		{:then [unresolvedData]}
			<button
				class="btn btn-sm {unresolvedData.length > 0 ? 'btn-warning' : 'btn-ghost'}"
				onclick={() => (resolveOpen = true)}
			>
				Resolve
				{#if unresolvedData.length > 0}
					<Badge>{unresolvedData.length}</Badge>
				{/if}
			</button>
		{/await}
		<CreateReservation />
	</div>
</PageHeader>
<PageContent>
	{#await counts}
		<TabBar
			tabs={[
				{ key: 'upcoming', label: 'Upcoming' },
				{ key: 'all', label: 'All' }
			]}
			active={tab}
			onchange={(key) => {
				tab = key as 'upcoming' | 'all';
				page = 1;
			}}
		/>
	{:then c}
		<TabBar
			tabs={[
				{ key: 'upcoming', label: 'Upcoming', badge: c.upcoming },
				{ key: 'all', label: 'All', badge: c.all }
			]}
			active={tab}
			onchange={(key) => {
				tab = key as 'upcoming' | 'all';
				page = 1;
			}}
		/>
	{/await}

	<div class="flex flex-wrap items-end gap-2">
		<input
			type="text"
			class="input input-bordered input-sm"
			placeholder="Search name or email..."
			value={search}
			oninput={onSearchInput}
		/>
		<input
			type="date"
			class="input input-bordered input-sm"
			bind:value={dateFrom}
			onchange={() => {
				page = 1;
			}}
		/>
		<input
			type="date"
			class="input input-bordered input-sm"
			bind:value={dateTo}
			onchange={() => {
				page = 1;
			}}
		/>
		{#if hasActiveFilters()}
			<button class="btn btn-ghost btn-sm" onclick={clearFilters}>Clear</button>
		{/if}
	</div>

	{#await result}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { rows: reservations, pagination }}
		{#if reservations.length === 0}
			<p class="text-center opacity-60 py-8">No reservations found</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th></th>
							<th>Time</th>
							<th>Reserved for</th>
							<th class="text-center">Payment</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each reservations as r, idx (r.id)}
							{@const label = dayLabel(r)}
							{@const prevLabel = idx > 0 ? dayLabel(reservations[idx - 1]) : null}
							{#if label !== prevLabel}
								<tr>
									<td
										colspan="5"
										class="bg-base-200 px-4 py-2 text-xs font-semibold tracking-wide uppercase opacity-60"
									>
										{label}
									</td>
								</tr>
							{/if}
							<tr
								class="hover cursor-pointer"
								onclick={() => (window.location.href = `/staff/reservations/${r.id}`)}
							>
								<td class="w-px">
									<StatusBadge status={r.status} class="size-6" />
								</td>
								<td class="w-min">
									<div class="flex items-center gap-1">
										{formatTimeRange(r.startsAt, r.endsAt)}
										{#if r.recurringSeriesId}
											<span class="tooltip" data-tip="Recurring">
												<IconRepeat size={14} class="text-base-content" />
											</span>
										{/if}
									</div>
									<div class="text-sm opacity-60">{formatDate(r.startsAt)}</div>
								</td>
								<td onclick={(e) => e.stopPropagation()} style="padding-inline: 0;">
									<div class="flex items-center gap-1">
										{#if r.bookerType !== 'user'}
											<span class="tooltip" data-tip={r.bookerType}>
												<BookerTypeIcon type={r.bookerType} size={16} />
											</span>
										{/if}
										<MemberLink
											hideAvatar
											member={{
												name: r.memberName,
												email: r.memberEmail,
												pronouns: r.memberPronouns,
												role: r.memberRole,
												userId: r.createdByUserId
											}}
											class="p-7 px-4 w-full"
										/>
									</div>
								</td>
								<td>
									{#await hourlyRate then rate}
										{#if r.bookerType === 'event'}
											<span class="text-sm opacity-40">—</span>
										{:else}
											{@const ps = paymentStatus(r)}
											<div class="flex items-center justify-center gap-1">
												{formatDurationAmount(r.startsAt, r.endsAt, rate)}
												<span class="tooltip" data-tip={ps.label}>
													<ps.icon size={16} class={ps.color} />
												</span>
											</div>
										{/if}
									{/await}
								</td>
								<td onclick={(e) => e.stopPropagation()}>
									<div class="flex items-center gap-1">
										{#if visibleActions(r.status, r.startsAt, r.endsAt, r.stripePaymentRecordId).has('confirm')}
											<ConfirmReservationAction
												reservation={r}
												staff
												class="btn-ghost btn-sm latched"
											>
												{#snippet icon()}<IconCheck size={16} />{/snippet}
											</ConfirmReservationAction>
										{/if}
										{#if visibleActions(r.status, r.startsAt, r.endsAt, r.stripePaymentRecordId).has('complete')}
											<CompleteReservationAction
												reservation={r}
												class="btn-ghost btn-xs btn-square"
											>
												{#snippet icon()}<IconCircleCheck size={16} />{/snippet}
											</CompleteReservationAction>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<Pagination
				page={pagination.page}
				totalPages={pagination.totalPages}
				onpage={(p) => (page = p)}
			/>
		{/if}
	{/await}
</PageContent>

{#await Promise.all([unresolved, hourlyRate]) then [unresolvedData, rate]}
	<ResolveModal bind:open={resolveOpen} unresolved={unresolvedData} hourlyRateCents={rate} />
{/await}
