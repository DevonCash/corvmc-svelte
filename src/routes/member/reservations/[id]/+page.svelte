<script lang="ts">
	import { DEFAULT_TIMEZONE } from '$lib/config';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { getReservationDetail } from '$lib/remote/reservations.remote';
	import { page } from '$app/state';

	let data = $derived(await getReservationDetail(page.params.id!));

	const res = $derived(data.reservation);
	const durationHours = $derived(data.durationHours);

	function formatDate(d: Date): string {
		return d.toLocaleDateString('en-US', {
			timeZone: DEFAULT_TIMEZONE,
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatTime(d: Date): string {
		return d.toLocaleTimeString('en-US', {
			timeZone: DEFAULT_TIMEZONE,
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<PageHeader title="Your Reservation" backHref="/member/reservations" />
<PageContent width="md">
	<div class="card bg-base-100 shadow-sm">
		<div class="card-body">
			<header class="flex items-start justify-between gap-2">
				<hgroup>
					<p class="font-medium">{formatDate(res.startsAt)}</p>
					<p class="text-sm opacity-70">
						{formatTime(res.startsAt)}–{formatTime(res.endsAt)} · {durationHours} hour{durationHours ===
						1
							? ''
							: 's'}
					</p>
				</hgroup>
				<StatusBadge status={res.status} label />
			</header>
			{#if res.notes}
				<p class="mt-2 text-sm opacity-60">{res.notes}</p>
			{/if}
		</div>
	</div>

	{#if res.status === 'confirmed'}
		<InfoCard title="Door Code">
			{#if res.lockCode}
				<p class="font-mono text-4xl font-bold tracking-[0.3em]">{res.lockCode}</p>
				<p class="text-sm opacity-70">
					Enter this code on the door keypad to get in. It works for the length of your reservation.
				</p>
			{:else}
				<p class="text-sm opacity-70">
					Your door code will appear here on the day of your reservation.
				</p>
			{/if}
		</InfoCard>
	{/if}

	{#if res.status === 'scheduled'}
		<Button href="/member/reservations/{res.id}/pay" class="btn-primary w-full">
			Pay for this session
		</Button>
	{/if}

	<Button href="/member/reservations" class="btn-ghost w-full">Back to Reservations</Button>
</PageContent>
