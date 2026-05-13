<script lang="ts">
	import type { SubscriptionInfo, Credits } from '$lib/finance/types';

	let {
		credits,
		subscription,
		allocatedThisMonth,
		usedThisMonth
	}: {
		credits: Credits;
		subscription: SubscriptionInfo;
		allocatedThisMonth: number;
		usedThisMonth: number;
	} = $props();

	const remaining = $derived(credits.free_hours ?? 0);
	const refreshDate = $derived(subscription.currentPeriodEnd.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric'
	}));

	const checkIcon = 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body">
		<div class="flex items-center gap-4">
			<div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 text-primary">
					<path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
				</svg>
			</div>
			<div>
				<h3 class="text-xl font-semibold">Free Practice Hours</h3>
				<p class="text-sm opacity-60">Your monthly allocation</p>
			</div>
		</div>

		<div class="mt-4 grid gap-4 sm:grid-cols-3">
			<div class="rounded-lg bg-base-200/50 p-4 text-center">
				<div class="text-3xl font-bold text-primary">{allocatedThisMonth}</div>
				<div class="text-sm opacity-60">Total This Month</div>
			</div>
			<div class="rounded-lg bg-base-200/50 p-4 text-center">
				<div class="text-3xl font-bold" class:text-success={remaining > 0} class:text-warning={remaining === 0}>{remaining}</div>
				<div class="text-sm opacity-60">Remaining</div>
			</div>
			<div class="rounded-lg bg-base-200/50 p-4 text-center">
				<div class="text-3xl font-bold">{usedThisMonth}</div>
				<div class="text-sm opacity-60">Used</div>
			</div>
		</div>

		<div class="mt-4 rounded-lg bg-primary/5 p-3 text-center">
			<p class="text-sm opacity-70">Your hours refresh on <strong>{refreshDate}</strong></p>
		</div>

		<div class="mt-4 space-y-2 border-t border-base-200 pt-4">
			<div class="flex items-start gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="mt-0.5 size-5 shrink-0 text-success">
					<path stroke-linecap="round" stroke-linejoin="round" d={checkIcon} />
				</svg>
				<span><strong>Recurring reservations</strong> to lock in your regular practice times</span>
			</div>
			<div class="flex items-start gap-2">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="mt-0.5 size-5 shrink-0 text-success">
					<path stroke-linecap="round" stroke-linejoin="round" d={checkIcon} />
				</svg>
				<span><strong>Priority booking</strong> when last-minute openings pop up</span>
			</div>
		</div>
	</div>
</div>
