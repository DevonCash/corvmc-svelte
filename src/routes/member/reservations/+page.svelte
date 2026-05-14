<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate, formatTime, formatDuration } from '$lib/utils/format';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import TabBar from '$lib/components/TabBar.svelte';

	let { data } = $props();

	const upcoming = $derived(data.upcoming);
	const past = $derived(data.past);

	let activeTab = $state<'upcoming' | 'past'>('upcoming');

	const statusBadge: Record<string, string> = {
		scheduled: 'badge-warning',
		confirmed: 'badge-success',
		completed: 'badge-info',
		no_show: 'badge-error',
		cancelled: 'badge-ghost'
	};
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold">My Reservations</h1>
		<a href="/member/reservations/new" class="btn btn-primary">Book a Session</a>
	</div>

	<TabBar
		tabs={[
			{ key: 'upcoming', label: `Upcoming (${upcoming.length})` },
			{ key: 'past', label: 'Past' }
		]}
		active={activeTab}
		onchange={(key) => (activeTab = key as 'upcoming' | 'past')}
	/>

	{#if activeTab === 'upcoming'}
		{#if upcoming.length === 0}
			<div class="text-center py-12 opacity-60">
				<p>No upcoming reservations.</p>
				<a href="/member/reservations/new" class="link link-primary mt-2 inline-block">
					Book your first session
				</a>
			</div>
		{:else}
			<div class="space-y-3">
				{#each upcoming as res}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body flex-row items-center justify-between py-4">
							<div>
								<p class="font-medium">
									{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(res.endsAt)}
								</p>
								<p class="text-sm opacity-60">
									{formatDuration(res.startsAt, res.endsAt)}
									{#if res.notes} &middot; {res.notes}{/if}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<span class="badge {statusBadge[res.status] ?? ''}">{res.status}</span>
								{#if res.status === 'scheduled'}
									<a href="/member/reservations/{res.id}/pay" class="btn btn-primary btn-sm">
										Pay Now
									</a>
								{/if}
								{#if res.status === 'scheduled' || res.status === 'confirmed'}
									<form method="POST" action="?/cancel" use:enhance>
										<input type="hidden" name="reservationId" value={res.id} />
										<button type="submit" class="btn btn-ghost btn-sm">Cancel</button>
									</form>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	{#if activeTab === 'past'}
		{#if past.length === 0}
			<EmptyState message="No past reservations." />
		{:else}
			<div class="space-y-3">
				{#each past as res}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body flex-row items-center justify-between py-4">
							<div>
								<p class="font-medium">
									{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(res.endsAt)}
								</p>
								<p class="text-sm opacity-60">{formatDuration(res.startsAt, res.endsAt)}</p>
							</div>
							<span class="badge {statusBadge[res.status] ?? ''}">{res.status}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
