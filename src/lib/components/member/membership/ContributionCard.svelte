<script lang="ts">
	import { DOLLARS_PER_UNIT, type SubscriptionInfo } from '$lib/finance/types';
	import SubscriptionForm from './SubscriptionForm.svelte';

	let {
		subscription,
		billingPortalUrl,
		showModifyForm = false
	}: {
		subscription: SubscriptionInfo;
		billingPortalUrl: string | null;
		showModifyForm?: boolean;
	} = $props();

	let editing = $state(showModifyForm);

	const amountPerMonth = $derived(subscription.quantity * DOLLARS_PER_UNIT);
	const nextBilling = $derived(subscription.currentPeriodEnd.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	}));
</script>

<div class="card bg-base-100 shadow-sm">
	<div class="card-body">
		<div class="flex items-center gap-4">
			<div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 text-primary">
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
				</svg>
			</div>
			<div>
				<h3 class="text-xl font-semibold">Your Contribution</h3>
				<p class="text-sm opacity-60">Manage your monthly support</p>
			</div>
		</div>

		<div class="mt-4 flex items-center justify-between rounded-lg bg-base-200/50 p-4">
			<div>
				<div class="flex items-center gap-2">
					<span class="text-3xl font-bold">${amountPerMonth}/month</span>
					{#if subscription.coveringFees}
						<span class="badge badge-sm badge-secondary">+ fees covered</span>
					{/if}
				</div>
				<p class="mt-1 text-sm opacity-60">Next bill {nextBilling}</p>
			</div>
		</div>

		<div class="mt-4 flex flex-wrap gap-2">
			<button class="btn btn-sm btn-outline" onclick={() => editing = !editing}>
				{editing ? 'Cancel' : 'Modify Amount'}
			</button>
			{#if billingPortalUrl}
				<a href={billingPortalUrl} class="btn btn-sm btn-outline">
					Manage Billing
				</a>
			{/if}
		</div>

		{#if editing}
			<div class="mt-4 border-t border-base-200 pt-4">
				<SubscriptionForm
					mode="modify"
					currentAmount={amountPerMonth}
					currentCoverFees={subscription.coveringFees}
					formAction="?/updateAmount"
				/>
			</div>
		{/if}
	</div>
</div>
