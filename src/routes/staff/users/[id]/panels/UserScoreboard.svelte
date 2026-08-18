<script lang="ts">
	import type { getUserOverview } from '$lib/remote/users.remote';
	import { creditsToHours, formatVolunteerHours } from '$lib/config';
	import { formatCents } from '$lib/utils/format';

	let { overview }: { overview: Awaited<ReturnType<typeof getUserOverview>> } = $props();

	// Five figures, chosen as the ones staff quote back down a phone. Rendered
	// from the overview query that already had to run for the tab badges, so the
	// strip costs nothing beyond what the page was fetching anyway.
	const stats = $derived([
		{ label: 'Free hours', value: `${creditsToHours(overview.credits.free_hours)}` },
		{ label: 'Upcoming', value: String(overview.counts.upcomingReservations) },
		{ label: 'Bands', value: String(overview.counts.bands) },
		{
			label: 'Volunteered (YTD)',
			value: formatVolunteerHours(overview.counts.approvedMinutesThisYear)
		},
		{ label: 'Lifetime paid', value: formatCents(overview.counts.lifetimePaidCents) }
	]);
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
	{#each stats as stat (stat.label)}
		<div class="rounded-box bg-base-100 px-4 py-3 shadow">
			<div class="text-subtle">{stat.label}</div>
			<div class="text-xl font-medium">{stat.value}</div>
		</div>
	{/each}
</div>
