<script lang="ts">
	import Modal from '$lib/components/shared/Modal.svelte';
	import { formatDate, formatTime } from '$lib/utils/format';
	import QRCode from 'qrcode-svg';

	interface TicketData {
		code: string;
		attendeeName: string;
		event: { title: string; startsAt: Date; endsAt: Date } | null;
	}

	let {
		open = $bindable(false),
		ticket
	}: {
		open?: boolean;
		ticket: TicketData;
	} = $props();

	const qrSvg = $derived(
		new QRCode({
			content: ticket.code,
			width: 200,
			height: 200,
			padding: 0,
			ecl: 'M',
			join: true
		}).svg()
	);
</script>

<Modal bind:open title="Your Ticket" maxWidth="max-w-sm">
	<div class="flex flex-col items-center gap-4 py-2">
		{#if ticket.event}
			<div class="text-center">
				<p class="text-lg font-bold">{ticket.event.title}</p>
				<p class="text-sm opacity-70">
					{formatDate(ticket.event.startsAt)} &middot; {formatTime(ticket.event.startsAt)}
				</p>
			</div>
		{/if}

		<div class="rounded-lg bg-white p-4">
			{@html qrSvg}
		</div>

		<div class="text-center">
			<p class="font-mono text-lg tracking-widest">{ticket.code}</p>
			<p class="text-sm opacity-60">{ticket.attendeeName}</p>
		</div>
	</div>
</Modal>
