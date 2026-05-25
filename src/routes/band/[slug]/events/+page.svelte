<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { formatDate, formatTime } from '$lib/utils/format';
	import { getBandEvents } from '$lib/remote/band-events.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	let events = $derived(await getBandEvents(page.params.slug!));
	const band = $derived(layout.band);
	const isAdmin = $derived(layout.userRole === 'owner' || layout.userRole === 'admin');
</script>

<PageHeader title="Events" subtitle={band.name}>
	{#if isAdmin}
		<Button href="events/create" class="btn-sm">Create Event</Button>
	{/if}
</PageHeader>
<PageContent width="2xl">
	{#if events.length === 0}
		<EmptyState>
			<p>No events yet</p>
			{#if isAdmin}
				<a href="events/create" class="mt-2 inline-block link link-primary">
					Create your first event
				</a>
			{/if}
		</EmptyState>
	{:else}
		<div class="space-y-3">
			{#each events as evt (evt.id)}
				<a href="events/{evt.id}" class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow block">
					<div class="card-body flex-row items-center justify-between py-4">
						<div>
							<p class="font-medium">{evt.title}</p>
							<p class="text-sm opacity-70">
								{formatDate(evt.startsAt)} &middot; {formatTime(evt.startsAt)}–{formatTime(evt.endsAt)}
							</p>
							{#if evt.location}
								<p class="text-xs opacity-60">{evt.location}</p>
							{/if}
						</div>
						<StatusBadge status={evt.status} />
					</div>
				</a>
			{/each}
		</div>
	{/if}
</PageContent>
