<script lang="ts">
	import type { PageData } from './$types';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDate, formatTime, formatDuration } from '$lib/utils/format';

	let { data }: { data: PageData } = $props();

	const band = $derived(data.band);
	const upcoming = $derived(data.upcoming);
	const isOwnerOrAdmin = $derived(
		data.userRole === 'owner' || data.userRole === 'admin'
	);
</script>

<div class="space-y-6">
	<PageHeader title="Dashboard" subtitle={band.name} />

	<!-- Band overview -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
		<div class="stat bg-base-100 shadow rounded-box">
			<div class="stat-title">Members</div>
			<div class="stat-value text-2xl">{band.memberCount}</div>
		</div>
		<div class="stat bg-base-100 shadow rounded-box">
			<div class="stat-title">Upcoming Sessions</div>
			<div class="stat-value text-2xl">{upcoming.length}</div>
		</div>
		<div class="stat bg-base-100 shadow rounded-box">
			<div class="stat-title">Your Role</div>
			<div class="stat-value text-2xl capitalize">{data.userRole}</div>
		</div>
	</div>

	<!-- Upcoming reservations -->
	<section>
		<div class="flex items-center justify-between mb-3">
			<h2 class="text-lg font-semibold">Upcoming Sessions</h2>
			<a href="/band/{band.slug}/reservations" class="link link-primary text-sm">
				View all
			</a>
		</div>

		{#if upcoming.length === 0}
			<EmptyState message="No upcoming sessions scheduled." />
		{:else}
			<div class="space-y-3">
				{#each upcoming as res (res.id)}
					<div class="card bg-base-100 shadow">
						<div class="card-body py-4 flex-row items-center justify-between">
							<div>
								<p class="font-medium">
									{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(res.endsAt)}
								</p>
								<p class="text-sm opacity-60">
									{formatDuration(res.startsAt, res.endsAt)}
									{#if res.bookedByName}
										&middot; Booked by {res.bookedByName}
									{/if}
									{#if res.notes}
										&middot; {res.notes}
									{/if}
								</p>
							</div>
							<StatusBadge status={res.status} />
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Quick links -->
	<div class="flex gap-3">
		<a href="/band/{band.slug}/members" class="btn btn-outline btn-sm">
			Manage Members
		</a>
		{#if isOwnerOrAdmin}
			<a href="/band/{band.slug}/edit" class="btn btn-outline btn-sm">
				Edit Band Profile
			</a>
		{/if}
	</div>
</div>
