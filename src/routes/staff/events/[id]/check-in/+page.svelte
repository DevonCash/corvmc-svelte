<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { checkInTicket } from './data.remote';

	let { data }: { data: any } = $props();

	let search = $state('');
	let checkingIn = $state<string | null>(null);

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

	async function handleCheckIn(ticketId: string) {
		checkingIn = ticketId;
		try {
			await checkInTicket({ ticketId });
			toast.success('Checked in');
			await invalidateAll();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Check-in failed');
		} finally {
			checkingIn = null;
		}
	}
</script>

<div class="max-w-3xl mx-auto space-y-6">
	<PageHeader title="Check-in: {data.event.title}" backHref="/staff/events/{data.event.id}" />

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
						{:else}
							<button
								class="btn btn-primary btn-sm"
								disabled={checkingIn === ticket.id}
								onclick={() => handleCheckIn(ticket.id)}
							>
								{#if checkingIn === ticket.id}
									<span class="loading loading-spinner loading-sm"></span>
								{/if}
								Check In
							</button>
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
</div>
