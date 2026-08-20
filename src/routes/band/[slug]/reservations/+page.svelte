<script lang="ts">
	import Card from '$lib/components/shared/Card/Card.svelte';
	import CardBody from '$lib/components/shared/Card/CardBody.svelte';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import TabBar from '$lib/components/shared/TabBar.svelte';
	import Form from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { toast } from 'svelte-sonner';
	import { formatDate, formatTime, formatDuration } from '$lib/utils/format';
	import {
		cancelBandReservation,
		getBandReservations,
		getBandMembershipStatus,
		getBookingContact
	} from '$lib/remote/reservations.remote';
	import CreateModal from './CreateModal.svelte';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	const { fields: cancelFields } = cancelBandReservation;

	let layout = $derived(await getBandLayout(page.params.slug!));
	let data = $derived(await getBandReservations(page.params.slug!));
	// Resolved here and handed down, so the step components stay synchronous.
	let membership = $derived(await getBandMembershipStatus());
	let contact = $derived(await getBookingContact());
	const upcoming = $derived(data.upcoming);
	const past = $derived(data.past);
	const band = $derived(layout.band);
	let activeTab = $state<'upcoming' | 'past'>('upcoming');

	function refresh() {
		void getBandReservations(page.params.slug!).refresh();
	}
</script>

<PageHeader title="Reservations" subtitle={band.name}>
	<CreateModal
		hasSustainingMember={membership.hasSustainingMember}
		needsPhone={contact.needsPhone}
		onbooked={refresh}
	/>
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
			<EmptyState
				title="No upcoming sessions"
				description="Book the practice space and it'll show up here for the whole band."
			/>
		{:else}
			<div class="space-y-3">
				{#each upcoming as res (res.id)}
					{@const cancel = cancelBandReservation.for(res.id)}
					<Card>
						<CardBody row class="py-4">
							<div>
								<p class="font-medium">
									{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(
										res.endsAt
									)}
								</p>
								<p class="text-subtle">
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
								<!-- `canCancel` comes from the server: `cancel()` authorizes on
							     createdByUserId, so this used to render Cancel for every
							     bandmate and answer with an error toast for all but the
							     one who booked. Band admins may cancel any of the band's
							     sessions. Nothing is shown to someone who can't — a
							     disabled button would just raise the same question. -->
								{#if res.canCancel && (res.status === 'scheduled' || res.status === 'confirmed')}
									<Form
										remote={cancel}
										onsuccess={() => {
											toast.success('Reservation cancelled');
											refresh();
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
							<div>
								<p class="font-medium">
									{formatDate(res.startsAt)} &middot; {formatTime(res.startsAt)}–{formatTime(
										res.endsAt
									)}
								</p>
								<p class="text-subtle">
									{formatDuration(res.startsAt, res.endsAt)}
									{#if res.bookedByName}
										&middot; Booked by {res.bookedByName}
									{/if}
								</p>
							</div>
							<StatusBadge status={res.status} />
						</CardBody>
					</Card>
				{/each}
			</div>
		{/if}
	{/if}
</PageContent>
