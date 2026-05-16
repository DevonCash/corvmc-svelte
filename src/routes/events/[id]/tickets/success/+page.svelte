<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import { fullDate, formatTime } from '$lib/utils/format';
	import { IconCircleCheck } from '@tabler/icons-svelte';

	let { data }: { data: any } = $props();

	const evt = $derived(data.event);
</script>

<div class="max-w-lg mx-auto space-y-6">
	<PageHeader title="Tickets Confirmed" backHref="/events" />

	<div class="card bg-base-100 shadow">
		<div class="card-body text-center space-y-4">
			<div class="flex justify-center">
				<IconCircleCheck size={64} class="text-success" />
			</div>

			<div>
				<h2 class="text-xl font-bold">{evt.title}</h2>
				<p class="opacity-70 mt-1">
					{fullDate(evt.startsAt)} · {formatTime(evt.startsAt)} – {formatTime(evt.endsAt)}
				</p>
			</div>

			<p class="text-sm opacity-60">
				A confirmation email will be sent to {data.tickets[0]?.attendeeEmail ?? 'your email'}.
			</p>
		</div>
	</div>

	<!-- Ticket codes -->
	<div class="card bg-base-100 shadow">
		<div class="card-body">
			<h3 class="font-medium mb-3">Your Tickets</h3>
			<div class="space-y-3">
				{#each data.tickets as ticket (ticket.id)}
					<div class="flex items-center justify-between p-3 bg-base-200 rounded">
						<div>
							<p class="font-medium">{ticket.attendeeName}</p>
							<p class="text-sm opacity-60">{ticket.attendeeEmail}</p>
						</div>
						<div class="text-right">
							<p class="font-mono text-lg font-bold tracking-wider">{ticket.code}</p>
							<p class="text-xs opacity-50">Ticket code</p>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="text-center">
		<a href="/events" class="btn btn-ghost">Back to Events</a>
	</div>
</div>
