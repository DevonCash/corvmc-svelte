<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { invalidateAll } from '$app/navigation';
	import { CancelTicketAction } from '$lib/components/shared/actions';
	import { checkInTicket } from '$lib/remote/events.remote';
	import type { StaffCheckInResponse } from '$lib/server/db/schema/api';

	let { data }: { data: StaffCheckInResponse } = $props();

	let search = $state('');

	const filteredTickets = $derived(
		data.tickets.filter((t) => {
			if (!search) return true;
			const q = search.toLowerCase();
			return (
				t.attendeeName.toLowerCase().includes(q) ||
				t.attendeeEmail.toLowerCase().includes(q) ||
				t.code.toLowerCase().includes(q)
			);
		})
	);
</script>

<PageHeader title="Check-in: {data.event.title}" backHref="/staff/events/{data.event.id}" />
<PageContent width="3xl">

	<!-- Stats -->
	<div class="flex gap-6">
		<div class="stat bg-base-100 shadow rounded-box p-4">
			<div class="stat-title">Checked In</div>
			<div class="stat-value text-2xl">{data.stats.checkedIn}</div>
		</div>
		<div class="stat bg-base-100 shadow rounded-box p-4">
			<div class="stat-title">Tickets Sold</div>
			<div class="stat-value text-2xl">{data.stats.sold}</div>
		</div>
	</div>

	<!-- Search -->
	<input
		type="text"
		bind:value={search}
		placeholder="Search by name, email, or code..."
		class="input input-bordered w-full"
	/>

	<!-- Ticket list -->
	<div class="space-y-2">
		{#each filteredTickets as ticket (ticket.id)}
			<div class="card bg-base-100 shadow">
				<div class="card-body p-4 flex-row items-center justify-between">
					<div>
						<p class="font-medium">{ticket.attendeeName}</p>
						<p class="text-sm opacity-60">{ticket.attendeeEmail}</p>
						<p class="font-mono text-xs opacity-50 mt-1">{ticket.code}</p>
					</div>

					<div class="flex items-center gap-3">
						{#if ticket.status === 'checked_in'}
							<StatusBadge status="checked_in" />
						{:else if ticket.status === 'cancelled'}
							<StatusBadge status="cancelled" />
						{:else}
							<Form remote={checkInTicket.for(ticket.id)} successToast="Checked in" onsuccess={() => invalidateAll()} class="inline">
								<input type="hidden" name="ticketId" value={ticket.id} />
								<SubmitButton label="Check In" class="btn-primary btn-sm" />
							</Form>
							<CancelTicketAction eventId={data.event.id} ticketId={ticket.id} attendeeName={ticket.attendeeName} />
						{/if}
					</div>
				</div>
			</div>
		{/each}

		{#if filteredTickets.length === 0}
			<p class="text-center opacity-50 py-8">
				{search ? 'No tickets match your search' : 'No tickets to check in'}
			</p>
		{/if}
	</div>
</PageContent>
