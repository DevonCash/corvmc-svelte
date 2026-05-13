<script lang="ts">
	import { enhance } from '$app/forms';
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
	<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6 shrink-0">
		<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
	</svg>

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
