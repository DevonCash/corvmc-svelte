<script lang="ts">
	import { getUserBands } from '$lib/remote/bands.remote';
	import { getUserShows, getUserTicketsAndRsvps } from '$lib/remote/events.remote';
	import { getUserListings } from '$lib/remote/community-events.remote';
	import AsyncCard from './AsyncCard.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import { rowLink } from '$lib/actions/row-link';
	import { resolve } from '$app/paths';
	import { formatDateShortYear } from '$lib/utils/format';

	let { id }: { id: string } = $props();
</script>

<!--
	Bands is the reason this panel exists. The relationship was only ever
	traversable band → members, so a staff member holding a name had no way to
	reach the bands behind it.
-->
<AsyncCard title="Bands" result={getUserBands(id)}>
	{#snippet children(bands)}
		{#if bands.length === 0}
			<EmptyState title="Not in any bands" description="No band membership or invitation." />
		{:else}
			<ul class="flex flex-col gap-2">
				{#each bands as b (b.id)}
					<li>
						<a
							href={resolve(`/staff/bands/${b.id}`)}
							class="flex items-center gap-3 rounded-box px-2 py-2 hover:bg-base-200"
						>
							<!-- Band avatars are square; member avatars are round. -->
							<Avatar src={b.avatarUrl ?? undefined} name={b.name} class="size-10 !rounded" />
							<div class="min-w-0 flex-1">
								<div class="font-medium">{b.name}</div>
								<div class="text-sm opacity-60">{b.memberCount} active members</div>
							</div>
							<StatusBadge status={b.role} label />
							{#if b.status !== 'active'}
								<Badge variant="warning" size="sm">Invite pending</Badge>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/snippet}
</AsyncCard>

<AsyncCard title="Shows played" result={getUserShows(id)}>
	{#snippet children(shows)}
		{#if shows.upcoming.length === 0 && shows.past.length === 0}
			<EmptyState
				title="No shows"
				description="No published show credits this member's bands are confirmed on."
			/>
		{:else}
			<p class="mb-3 text-sm opacity-60">
				{shows.upcoming.length} upcoming · {shows.pastCount} played
			</p>
			<Table>
				{#snippet head()}
					<th>Show</th>
					<th class="col-support">With</th>
					<th class="col-extra">Date</th>
				{/snippet}
				{#each [...shows.upcoming, ...shows.past] as show (show.id)}
					<tr class="hover" use:rowLink={resolve(`/staff/events/${show.id}`)}>
						<td class="cell-primary">
							<a class="font-medium" href={resolve(`/staff/events/${show.id}`)}>{show.title}</a>
						</td>
						<td class="col-support">{show.bandName}</td>
						<td class="col-extra whitespace-nowrap">{formatDateShortYear(show.startsAt)}</td>
					</tr>
				{/each}
			</Table>
		{/if}
	{/snippet}
</AsyncCard>

<AsyncCard title="Community listings" result={getUserListings(id)}>
	{#snippet children(data)}
		{@const all = [...data.rejected, ...data.listings]}
		{#if all.length === 0}
			<EmptyState
				title="No listings"
				description="This member has never submitted an event to the community calendar."
			/>
		{:else}
			<p class="mb-3 text-sm opacity-60">{data.publishedCount} currently on the public calendar</p>
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Listing</th>
					<th class="col-extra">Date</th>
				{/snippet}
				{#each all as e (e.id)}
					<tr class="hover" use:rowLink={resolve(`/staff/events/${e.id}`)}>
						<td class="w-px"><StatusBadge status={e.status} /></td>
						<td class="cell-primary">
							<a class="font-medium" href={resolve(`/staff/events/${e.id}`)}>{e.title}</a>
							{#if e.reviewNotes}
								<div class="text-sm opacity-60">{e.reviewNotes}</div>
							{/if}
						</td>
						<td class="col-extra whitespace-nowrap">{formatDateShortYear(e.startsAt)}</td>
					</tr>
				{/each}
			</Table>
		{/if}
	{/snippet}
</AsyncCard>

<AsyncCard title="Tickets & RSVPs" result={getUserTicketsAndRsvps(id)}>
	{#snippet children(data)}
		{#if data.tickets.length === 0 && data.rsvps.length === 0}
			<EmptyState
				title="No tickets or RSVPs"
				description="This member has not booked onto an event as an attendee."
			/>
		{:else}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Event</th>
					<th class="col-support">Kind</th>
					<th class="col-extra">Date</th>
				{/snippet}
				{#each data.tickets as t (t.id)}
					<tr class="hover" use:rowLink={resolve(`/staff/events/${t.eventId}`)}>
						<td class="w-px"><StatusBadge status={t.status} /></td>
						<td class="cell-primary">
							<a class="font-medium" href={resolve(`/staff/events/${t.eventId}`)}>{t.eventTitle}</a>
							<div class="text-sm opacity-60">{t.code}</div>
						</td>
						<td class="col-support">Ticket</td>
						<td class="col-extra whitespace-nowrap">{formatDateShortYear(t.eventStartsAt)}</td>
					</tr>
				{/each}
				{#each data.rsvps as r (r.id)}
					<tr class="hover" use:rowLink={resolve(`/staff/events/${r.eventId}`)}>
						<td class="w-px"><StatusBadge status={r.eventStatus} /></td>
						<td class="cell-primary">
							<a class="font-medium" href={resolve(`/staff/events/${r.eventId}`)}>{r.eventTitle}</a>
						</td>
						<td class="col-support">RSVP</td>
						<td class="col-extra whitespace-nowrap">{formatDateShortYear(r.startsAt)}</td>
					</tr>
				{/each}
			</Table>
		{/if}
	{/snippet}
</AsyncCard>
