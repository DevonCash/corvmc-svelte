<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import BookerTypeIcon from '$lib/components/shared/reservations/BookerTypeIcon.svelte';
	import DataList from '$lib/components/shared/DataList.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import FilterBar from '$lib/components/shared/FilterBar.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
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
	// `searchText`, not `search`: FilterBar's always-visible slot is a snippet
	// named `search`, and a snippet shadows a same-named script binding.
	let searchText = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');
	let page = $state(1);

	let searchDebounced = $state('');
	let searchTimer: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		searchText = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			searchDebounced = searchText;
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

	const activeFilterCount = $derived(
		(searchDebounced ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)
	);

	function clearFilters() {
		searchText = '';
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

	<FilterBar activeCount={activeFilterCount} onclear={clearFilters}>
		{#snippet search()}
			<input
				type="text"
				class="input input-bordered input-sm w-full"
				placeholder="Search name or email..."
				value={searchText}
				oninput={onSearchInput}
			/>
		{/snippet}
		<input
			type="date"
			aria-label="From date"
			class="input input-bordered input-sm"
			bind:value={dateFrom}
			onchange={() => {
				page = 1;
			}}
		/>
		<input
			type="date"
			aria-label="To date"
			class="input input-bordered input-sm"
			bind:value={dateTo}
			onchange={() => {
				page = 1;
			}}
		/>
	</FilterBar>

	<DataList {result} empty="No reservations found" onpage={(p) => (page = p)}>
		{#snippet children(reservations)}
			<!-- No zebra: the bg-base-200 day-group rows are the striping here. -->
			<Table zebra={false}>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Reservation</th>
					<th class="col-support cell-num">Payment</th>
					<th class="w-px"><span class="sr-only">Actions</span></th>
				{/snippet}

				{#each reservations as r, idx (r.id)}
					{@const label = dayLabel(r)}
					{@const prevLabel = idx > 0 ? dayLabel(reservations[idx - 1]) : null}
					{#if label !== prevLabel}
						<tr>
							<td
								colspan="4"
								class="bg-base-200 px-4 py-2 text-xs font-semibold tracking-wide uppercase opacity-60"
							>
								{label}
							</td>
						</tr>
					{/if}
					{@const actions = visibleActions(r.status, r.startsAt, r.endsAt, r.stripePaymentRecordId)}
					{@const href = resolve(`/staff/reservations/${r.id}`)}
					<tr class="hover cursor-pointer" use:rowLink={href}>
						<td class="w-px">
							<StatusBadge status={r.status} class="size-6" />
						</td>

						<!--
							Primary cell: the time is the ordering key, the member is its
							closest qualifier. These were two columns; merging them is what
							lets the row fit a phone without hiding the actions.
							The day is not repeated — the group header above carries it.
						-->
						<td class="cell-primary">
							<a
								{href}
								class="flex items-center gap-1 font-medium whitespace-nowrap hover:underline"
							>
								{formatTimeRange(r.startsAt, r.endsAt)}
								{#if r.recurringSeriesId}
									<span class="tooltip" data-tip="Recurring">
										<IconRepeat size={14} class="text-base-content" />
									</span>
								{/if}
							</a>
							<div class="flex min-w-0 items-center gap-1">
								{#if r.bookerType !== 'user'}
									<span class="tooltip" data-tip={r.bookerType}>
										<BookerTypeIcon type={r.bookerType} size={14} />
									</span>
								{/if}
								<!--
									No email: the member is already the *subline* of this cell,
									and a third line puts the row back over two. The email is one
									click away on the reservation detail page.
								-->
								<MemberLink
									variant="inline"
									hideAvatar
									member={{
										name: r.memberName,
										pronouns: r.memberPronouns,
										role: r.memberRole,
										sustaining: !!r.memberSustaining,
										userId: r.createdByUserId
									}}
								/>
							</div>
						</td>

						<td class="col-support cell-num">
							{#await hourlyRate then rate}
								{#if r.bookerType === 'event'}
									<span class="opacity-40">—</span>
								{:else}
									{@const ps = paymentStatus(r)}
									<span class="inline-flex items-center justify-end gap-1">
										{formatDurationAmount(r.startsAt, r.endsAt, rate)}
										<span class="tooltip" data-tip={ps.label}>
											<ps.icon size={16} class={ps.color} />
										</span>
									</span>
								{/if}
							{/await}
						</td>

						<td class="w-px">
							<div class="flex items-center justify-end gap-1">
								{#if actions.has('confirm')}
									<ConfirmReservationAction
										reservation={r}
										staff
										iconOnly
										class="btn-ghost btn-sm btn-square latched"
									>
										{#snippet icon()}<IconCheck size={16} />{/snippet}
									</ConfirmReservationAction>
								{/if}
								{#if actions.has('complete')}
									<CompleteReservationAction
										reservation={r}
										iconOnly
										class="btn-ghost btn-sm btn-square"
									>
										{#snippet icon()}<IconCircleCheck size={16} />{/snippet}
									</CompleteReservationAction>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</Table>
		{/snippet}
	</DataList>
</PageContent>

{#await Promise.all([unresolved, hourlyRate]) then [unresolvedData, rate]}
	<ResolveModal bind:open={resolveOpen} unresolved={unresolvedData} hourlyRateCents={rate} />
{/await}
