<script lang="ts">
	import { enhance } from '$app/forms';
	import { IconAlertTriangle } from '@tabler/icons-svelte';
	import type { SubscriptionInfo } from '$lib/finance/types';

	let {
		subscription,
		billingPortalUrl
	}: {
		subscription: SubscriptionInfo;
		billingPortalUrl: string | null;
	} = $props();

	let resuming = $state(false);

	const endDate = $derived(subscription.currentPeriodEnd.toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	}));
	const freeHours = $derived(subscription.quantity);
</script>

<div class="alert alert-warning">
	<IconAlertTriangle size={24} class="shrink-0" />

	<div>
		<p>
			Your sustaining membership has been cancelled, but your benefits — including <strong>{freeHours} free practice hours</strong> — are still active until <strong>{endDate}</strong>. You can pick it back up anytime before then.
		</p>

		<div class="mt-3 flex flex-wrap gap-2">
			<form method="POST" action="?/resumeSubscription" use:enhance={() => {
				resuming = true;
				return async ({ update }) => {
					resuming = false;
					await update();
				};
			}}>
				<button type="submit" class="btn btn-sm btn-primary" disabled={resuming}>
					{#if resuming}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Resume Membership
				</button>
			</form>

			{#if billingPortalUrl}
				<a href={billingPortalUrl} class="btn btn-sm btn-outline">Manage Billing</a>
			{/if}
		</div>
	</div>
</div>
