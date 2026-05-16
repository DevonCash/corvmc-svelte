<script lang="ts">
	import {
		MembershipHero,
		BenefitsGrid,
		SlidingScale,
		CommunityImpact,
		MembershipFAQ,
		SubscriptionForm,
		ContributionCard,
		CreditBalanceCard,
		CancelledBanner
	} from '$lib/components/member/membership';
	import type { MembershipResponse } from '$lib/types/api';

	let { data }: { data: MembershipResponse } = $props();

	const subscription = $derived(data.subscription);
	const credits = $derived(data.credits);
	const billingPortalUrl = $derived(data.billingPortalUrl);
	const communityStats = $derived(data.communityStats);
	const allocatedThisMonth = $derived(data.allocatedThisMonth);
	const usedThisMonth = $derived(data.usedThisMonth);

	const isActive = $derived(subscription != null && !subscription.cancelAtPeriodEnd);
	const isCancelled = $derived(subscription != null && subscription.cancelAtPeriodEnd);
	const isNonMember = $derived(subscription == null);
</script>

{#snippet bottomCta(id?: string)}
	<div id={id} class="rounded-xl bg-primary/5 p-8 text-center">
		<h2 class="mb-4 text-3xl font-bold">Sounds Good?</h2>
		<p class="mx-auto mb-6 max-w-2xl opacity-70">
			{communityStats.sustainingMemberCount} members are already in. Your contribution — whatever the amount — keeps the spaces open, the gear available, and the music going.
		</p>
		<div class="mx-auto max-w-md">
			<SubscriptionForm mode="create" formAction="?/createSubscription" />
		</div>
		<p class="mt-4 text-sm opacity-60">Cancel anytime. Seriously.</p>
	</div>
{/snippet}

<div class="space-y-8">
	<!-- Active sustaining member view -->
	{#if isActive && subscription}
		<MembershipHero variant="dashboard" />

		<ContributionCard {subscription} {billingPortalUrl} />

		<CreditBalanceCard
			{credits}
			{subscription}
			{allocatedThisMonth}
			{usedThisMonth}
		/>

		<BenefitsGrid variant="compact" />

		<CommunityImpact stats={communityStats} />
	{/if}

	<!-- Cancelled-but-active view -->
	{#if isCancelled && subscription}
		<CancelledBanner {subscription} {billingPortalUrl} />

		<MembershipHero variant="cancelled" />

		<BenefitsGrid variant="full" />

		<SlidingScale />

		<CommunityImpact stats={communityStats} />

		<MembershipFAQ />

		{@render bottomCta()}
	{/if}

	<!-- Non-member view -->
	{#if isNonMember}
		<MembershipHero variant="marketing">
			{#snippet actions()}
				<a href="#subscribe" class="btn btn-primary btn-lg">Become a Sustaining Member</a>
			{/snippet}
		</MembershipHero>

		<BenefitsGrid variant="full" />

		<SlidingScale />

		<CommunityImpact stats={communityStats} />

		<MembershipFAQ />

		{@render bottomCta('subscribe')}
	{/if}
</div>
