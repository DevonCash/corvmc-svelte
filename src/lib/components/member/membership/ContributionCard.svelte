<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { IconCreditCard } from '@tabler/icons-svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { DOLLARS_PER_UNIT, type SubscriptionInfo } from '$lib/finance/types';
	import SubscriptionForm from './SubscriptionForm.svelte';
	import type { RemoteForm } from '$lib/components/shared/Form/Form.svelte';

	let {
		subscription,
		billingPortalUrl,
		updateRemote,
		showModifyForm = false
	}: {
		subscription: SubscriptionInfo;
		billingPortalUrl: string | null;
		updateRemote: RemoteForm<any, any>;
		showModifyForm?: boolean;
	} = $props();

	let editing = $state(untrack(() => showModifyForm));

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
				<IconCreditCard size={24} class="text-primary" />
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
						<Badge variant="secondary">+ fees covered</Badge>
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
					remote={updateRemote}
					onsuccess={() => { editing = false; toast.success('Contribution updated'); }}
				/>
			</div>
		{/if}
	</div>
</div>
