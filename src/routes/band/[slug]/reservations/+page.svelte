<script lang="ts">
	import Card from '$lib/components/shared/Card/Card.svelte';
	import CardBody from '$lib/components/shared/Card/CardBody.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { EntityIdentity } from '$lib/components/shared/entity';
	import Button from '$lib/components/shared/Button.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import Form from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
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
	<Button href="reservations/new" variant="default" size="sm">Book a Session</Button>
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
					<Card>
						<CardBody row class="py-4">
							<EntityIdentity ref={res.ref} size="md">
								{#snippet subtitle()}
									{res.ref.subtitle}
									{#if res.bookedBy.id}
										&middot; Booked by {res.bookedBy.title}
									{/if}
									{#if res.notes}
										&middot; {res.notes}
									{/if}
								{/snippet}
							</EntityIdentity>
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
										<SubmitButton label="Cancel" variant="ghost" size="xs" />
									</Form>
								{/if}
							</div>
						</CardBody>
					</Card>
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
					<Card>
						<CardBody row class="py-4">
							<EntityIdentity ref={res.ref} size="md">
								{#snippet subtitle()}
									{res.ref.subtitle}
									{#if res.bookedBy.id}
										&middot; Booked by {res.bookedBy.title}
									{/if}
								{/snippet}
							</EntityIdentity>
							<StatusBadge status={res.status} />
						</CardBody>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}
</PageContent>
