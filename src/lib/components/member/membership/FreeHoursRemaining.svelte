<script lang="ts">
	import { formatDate } from '$lib/utils/format';
	import type { ISODateString } from '$lib/types/dates';
	import { getMembershipStatus } from '$lib/remote/reservations.remote';
	import Button from '$lib/components/shared/Button.svelte';
	import { IconClock } from '@tabler/icons-svelte';
</script>

<div
	class="flex flex-col gap-1 rounded-lg border border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
>
	{#await getMembershipStatus()}
		<div class="flex items-center gap-2">
			<IconClock size={18} class="text-gray-400" />
			<span class="text-gray-400">Loading free hours...</span>
		</div>
	{:then membership}
		{#if membership.isSustainingMember}
			{@const hasHours = membership.freeHoursBalance > 0}
			<div class="flex items-center gap-2">
				<IconClock size={18} class={hasHours ? 'text-success' : 'opacity-40'} />
				<span class={hasHours ? 'font-medium' : 'font-medium opacity-40'}
					>{membership.freeHoursBalance}</span
				>
				<span class="text-sm {hasHours ? 'opacity-60' : 'opacity-30'}">free hours remaining</span>
			</div>
			{#if membership.creditsResetAt}
				<span class="text-sm {hasHours ? 'opacity-60' : 'opacity-30'}">
					Resets to {membership.hoursPerReset} on {formatDate(
						membership.creditsResetAt as ISODateString
					)}
				</span>
			{/if}
		{:else}
			<div class="flex items-center gap-3">
				<IconClock size={18} class="shrink-0 opacity-40" />
				<span>Get free practice hours each month with a sustaining membership.</span>
			</div>
			<Button href="/member/membership" class="self-end btn-sm sm:self-auto">Learn More</Button>
		{/if}
	{/await}
</div>
