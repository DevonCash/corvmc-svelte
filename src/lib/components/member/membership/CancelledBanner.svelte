<script lang="ts">
	import { IconAlertTriangle } from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';
	import type { SubscriptionInfo } from '$lib/server/db/schema/finance';
	import Action from '$lib/components/shared/Action.svelte';

	let {
		subscription,
		billingPortalUrl,
		resumeAction
	}: {
		subscription: SubscriptionInfo;
		billingPortalUrl: string | null;
		resumeAction: () => Promise<unknown>;
	} = $props();

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
			<Action
				action={resumeAction}
				label="Resume Membership"
				class="btn-sm btn-primary"
				onsuccess={() => toast.success('Membership resumed')}
			/>

			{#if billingPortalUrl}
				<a href={billingPortalUrl} class="btn btn-sm btn-outline">Manage Billing</a>
			{/if}
		</div>
	</div>
</div>
