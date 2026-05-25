<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { formatDate, formatTime, formatDuration } from '$lib/utils/format';
	import { getBandUpcoming } from '$lib/remote/bands.remote';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const band = $derived(data.band);
	const isOwnerOrAdmin = $derived(
		data.userRole === 'owner' || data.userRole === 'admin'
	);

	let upcoming = $derived(getBandUpcoming(band.id));
</script>

<PageHeader title="Dashboard" subtitle={band.name} />
<PageContent>
	{#await upcoming}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then sessions}
		<!-- Band overview -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
			<div class="stat bg-base-100 shadow rounded-box">
				<div class="stat-title">Members</div>
				<div class="stat-value text-2xl">{band.memberCount}</div>
			</div>
			<div class="stat bg-base-100 shadow rounded-box">
				<div class="stat-title">Upcoming Sessions</div>
				<div class="stat-value text-2xl">{sessions.length}</div>
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

			{#if sessions.length === 0}
				<EmptyState message="No upcoming sessions scheduled." />
			{:else}
				<div class="grid grid-cols-1 gap-3">
					{#each sessions as res (res.id)}
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
			<Button href="/band/{band.slug}/members" class="btn-outline btn-sm">
				Manage Members
			</Button>
			{#if isOwnerOrAdmin}
				<Button href="/band/{band.slug}/edit" class="btn-outline btn-sm">
					Edit Band Profile
				</Button>
			{/if}
		</div>
	{/await}
</PageContent>
