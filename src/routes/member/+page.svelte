<script lang="ts">
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import BookerTypeIcon from '$lib/components/shared/BookerTypeIcon.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import { formatDate, formatTimeRange, formatDuration } from '$lib/utils/format';
	import { IconCalendarPlus, IconCalendarEvent, IconStar } from '@tabler/icons-svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import type { DashboardResponse } from '$lib/types/api';

	let { data }: { data: DashboardResponse } = $props();

	const isSustaining = $derived(data.subscription != null && !data.subscription.cancelAtPeriodEnd);
	const freeHours = $derived(data.credits.free_hours ?? 0);
	const pendingInvites = $derived(data.pendingInviteCount ?? 0);
</script>

<PageHeader title="Dashboard" />
<PageContent>

	{#if pendingInvites > 0}
		<Alert type="info" href="/member/bands" class="shadow-sm">
			You have {pendingInvites} pending band invitation{pendingInvites === 1 ? '' : 's'}.
		</Alert>
	{/if}

	<!-- Quick links -->
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<a
			href="/member/reservations/new"
			class="card bg-base-100 btn h-auto"
		>
			<div class="card-body flex-row items-center gap-3 py-4">
				<IconCalendarPlus size={24} class="text-primary" />
				<span class="font-medium">Book a Session</span>
			</div>
		</a>
		<a href="/member/events" class="card bg-base-100 btn h-auto">
			<div class="card-body flex-row items-center gap-3 py-4">
				<IconCalendarEvent size={24} class="text-primary" />
				<span class="font-medium">Browse Events</span>
			</div>
		</a>
		<a href="/member/membership" class="card bg-base-100 btn h-auto">
			<div class="card-body flex-row items-center gap-3 py-4">
				<IconStar size={24} class="text-primary" />
				<span class="font-medium">Manage Membership</span>
			</div>
		</a>
	</div>

	<!-- Reservations + Credits grid -->
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
		<!-- This week's reservations -->
		<div class="lg:col-span-2">
			<InfoCard title="This Week">
				{#if data.weekReservations.length === 0}
					<EmptyState
						message="No sessions booked this week."
						actionLabel="Book a session"
						actionHref="/member/reservations/new"
					/>
				{:else}
					<div class="space-y-2">
						{#each data.weekReservations as res (res.id)}
							<div class="flex items-center justify-between rounded-lg bg-base-200 px-3 py-2">
								<div class="flex items-center gap-3">
									<BookerTypeIcon type={res.bookerType} size={18} class="opacity-60" />
									<div>
										<p class="text-sm font-medium">
											{formatDate(res.startsAt)}
											{#if res.bandName}
												<span class="opacity-60">· {res.bandName}</span>
											{/if}
										</p>
										<p class="text-xs opacity-60">
											{formatTimeRange(res.startsAt, res.endsAt)} · {formatDuration(
												res.startsAt,
												res.endsAt
											)}
										</p>
									</div>
								</div>
								<StatusBadge status={res.status} />
							</div>
						{/each}
					</div>
				{/if}
			</InfoCard>
		</div>

		<!-- Credit balance -->
		<InfoCard title="Practice Credits">
			{#if isSustaining}
				<div class="space-y-3">
					<p class="text-3xl font-medium">
						{freeHours}<span class="text-base opacity-60"> hrs left</span>
					</p>
					<progress
						class="progress w-full progress-primary"
						value={data.usedThisMonth}
						max={data.allocatedThisMonth || 1}
					></progress>
					<p class="text-xs opacity-60">
						{data.usedThisMonth} of {data.allocatedThisMonth} hours used this month
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					<p class="text-sm opacity-70">
						Become a sustaining member to get free practice hours each month.
					</p>
					<a href="/member/membership" class="btn btn-sm btn-primary">Learn More</a>
				</div>
			{/if}
		</InfoCard>
	</div>

	<!-- Upcoming events -->
	<InfoCard title="Upcoming Events">
		{#if data.upcomingEvents.length === 0}
			<EmptyState message="No events on the horizon." />
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each data.upcomingEvents as evt (evt.id)}
					<a href="/member/events/{evt.id}" class="card bg-base-200 transition-shadow hover:shadow-md">
						{#if evt.posterUrl}
							<figure>
								<img src={evt.posterUrl} alt={evt.title} class="h-32 w-full object-cover" />
							</figure>
						{/if}
						<div class="card-body p-3">
							<p class="text-sm font-medium">{evt.title}</p>
							<p class="text-xs opacity-60">{formatDate(evt.startsAt)}</p>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</InfoCard>
</PageContent>
