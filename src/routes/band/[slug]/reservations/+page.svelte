<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import Form from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { formatDate, formatTime, formatDuration } from '$lib/utils/format';
	import { cancelBandReservation, getBandReservations } from '$lib/remote/reservations.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	const { fields: cancelFields } = cancelBandReservation;

	let layout = $derived(await getBandLayout(page.params.slug!));
	let data = $derived(await getBandReservations(page.params.slug!));
	const upcoming = $derived(data.upcoming);
	const past = $derived(data.past);
	const band = $derived(layout.band);
	let activeTab = $state<'upcoming' | 'past'>('upcoming');
</script>

<PageHeader title="Reservations" subtitle={band.name}>
	<Button href="reservations/new" class="btn-sm">Book a Session</Button>
</PageHeader>
<PageContent width="2xl">
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
			<EmptyState>
				<p>No upcoming reservations</p>
				<a
					href={resolve(`/band/${band.slug}/reservations/new`)}
					class="mt-2 inline-block link link-primary"
				>
					Book your first session
				</a>
			</EmptyState>
		{:else}
			<div class="space-y-3">
				{#each upcoming as res (res.id)}
					{@const cancel = cancelBandReservation.for(res.id)}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body flex-row items-center justify-between py-4">
							<div>
								<p class="font-medium">
									{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(
										res.endsAt
									)}
								</p>
								<p class="text-xs opacity-60">
									{formatDuration(res.startsAt, res.endsAt)}
									{#if res.bookedByName}
										&middot; Booked by {res.bookedByName}
									{/if}
									{#if res.notes}
										&middot; {res.notes}
									{/if}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<StatusBadge status={res.status} />
								{#if res.status === 'scheduled' || res.status === 'confirmed'}
									<Form
										remote={cancel}
										onsuccess={() => {
											toast.success('Reservation cancelled');
											invalidateAll();
										}}
										onfailure={() => toast.error('Failed to cancel')}
									>
										<input {...cancelFields.reservationId.as('hidden', res.id)} />
										<SubmitButton label="Cancel" class="btn-ghost btn-xs" />
									</Form>
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
				{#each past as res (res.id)}
					<div class="card bg-base-100 shadow-sm">
						<div class="card-body flex-row items-center justify-between py-4">
							<div>
								<p class="font-medium">
									{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(
										res.endsAt
									)}
								</p>
								<p class="text-xs opacity-60">
									{formatDuration(res.startsAt, res.endsAt)}
									{#if res.bookedByName}
										&middot; Booked by {res.bookedByName}
									{/if}
								</p>
							</div>
							<StatusBadge status={res.status} />
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</PageContent>
