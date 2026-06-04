<script lang="ts">
	import ManageRecurringReservations from './ManageRecurringReservations.svelte';
	import BookingPolicy from '$lib/components/reservations/BookingPolicy.svelte';
	import FreeHoursRemaining from '$lib/components/member/membership/FreeHoursRemaining.svelte';

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import {
		confirmWaitlisted,
		getReservations,
		getMembershipStatus
	} from '$lib/remote/reservations.remote';

	const { fields } = confirmWaitlisted;
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import CreateModal from './CreateModal.svelte';
	import ReservationCard from './ReservationCard.svelte';
	import { Tabs } from 'bits-ui';
	import clsx from 'clsx';
	import { format, formatDistanceStrict } from 'date-fns';

	let activeTab = $state<'active' | 'all'>('active');

	let creditData = $derived(await getMembershipStatus());
	const isSustaining = $derived(creditData.isSustainingMember);

	let activeReservations = $state(getReservations({ after: new Date().toISOString() }));
	let allReservations = $state(getReservations({ includeTerminal: true }));

	// Waitlist confirmation via ?confirm={id}
	const confirmId = $derived(page.url.searchParams.get('confirm'));
	let confirmModalOpen = $state(false);
	let confirmReservation = $state<Awaited<typeof activeReservations>[number] | null>(null);

	$effect(() => {
		if (confirmId) {
			activeReservations.then((reservations) => {
				const match = reservations.find(
					(r) => r.id === confirmId && r.status === 'waitlisted' && r.waitlistNotifiedAt
				);
				if (match) {
					confirmReservation = match;
					confirmModalOpen = true;
				}
			});
		}
	});

	function closeConfirmModal() {
		confirmModalOpen = false;
		confirmReservation = null;
		goto('/member/reservations', { replaceState: true });
	}
</script>

<PageHeader title="Reserve Practice Space">
	<CreateModal {isSustaining} />
</PageHeader>
<PageContent>
	<BookingPolicy />
	<FreeHoursRemaining />
	<article class="@container">
		<Tabs.Root bind:value={activeTab}>
			<header class="mb-4 flex w-full items-center justify-between">
				<h2 class="title">My Reservations</h2>
				<Tabs.List class="join">
					<Tabs.Trigger
						value="active"
						class={clsx('btn join-item btn-sm', {
							'latched btn-primary': activeTab === 'active'
						})}>Active</Tabs.Trigger
					>
					<Tabs.Trigger
						value="all"
						class={clsx('btn join-item btn-sm', {
							'latched btn-primary': activeTab === 'all'
						})}>All</Tabs.Trigger
					>
				</Tabs.List>
			</header>
			<Tabs.Content value="active" class="card-grid">
				{#each await activeReservations as reservation (reservation.id)}
					<ReservationCard {reservation} />
				{:else}
					<p class="text-sm opacity-60">No upcoming reservations. Book your next practice slot!</p>
				{/each}
			</Tabs.Content>
			<Tabs.Content value="all" class="card-grid">
				{#each await allReservations as reservation (reservation.id)}
					<ReservationCard {reservation} />
				{:else}
					<p class="text-sm opacity-60">
						No reservations found. Start by creating your first practice space reservation.
					</p>
				{/each}
			</Tabs.Content>
		</Tabs.Root>
	</article>
	<ManageRecurringReservations />
</PageContent>

{#if confirmReservation}
	<Modal
		bind:open={confirmModalOpen}
		title="Slot Available"
		maxWidth="max-w-md"
		onclose={closeConfirmModal}
	>
		<Form
			remote={confirmWaitlisted}
			successToast="Reservation confirmed"
			onsuccess={async () => {
				closeConfirmModal();
				activeReservations = getReservations({ after: new Date().toISOString() });
			}}
		>
			<div class="space-y-4">
				<p class="text-sm">A slot has opened up for your waitlisted reservation:</p>
				<div class="rounded-lg border border-base-300 bg-base-200/50 px-4 py-3">
					<p class="font-medium">{format(confirmReservation.startsAt, 'PPP')}</p>
					<p class="text-sm opacity-70">
						{format(confirmReservation.startsAt, 'p')} – {format(confirmReservation.endsAt, 'p')}
					</p>
				</div>
				{#if confirmReservation.waitlistExpiresAt}
					<p class="text-xs opacity-60">
						Confirm by {format(confirmReservation.waitlistExpiresAt, 'PPP')} or the slot will be offered
						to someone else.
					</p>
				{/if}
				<input {...fields.id.as('hidden', confirmReservation.id)} />
				<div class="flex justify-end gap-2">
					<Button type="button" class="btn-outline btn-sm" onclick={closeConfirmModal}
						>Dismiss</Button
					>
					<SubmitButton label="Confirm Reservation" class="btn-sm btn-success" />
				</div>
			</div>
		</Form>
	</Modal>
{/if}

<style lang="postcss">
	@reference '#/routes/layout.css';
	article .title {
		@apply shrink-0 text-2xl font-bold text-nowrap;
	}

	:global(.card-grid) {
		@apply grid grid-cols-1 gap-2 @lg:grid-cols-2 @3xl:grid-cols-3;
	}
</style>
