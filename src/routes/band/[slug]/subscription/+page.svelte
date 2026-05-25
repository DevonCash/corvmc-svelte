<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { formatDate } from '$lib/utils/format';
	import {
		getBandSubscriptionInfo,
		upgradeToPremium,
		cancelPremium,
		resumePremium
	} from '$lib/remote/band-subscription.remote';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));
	let info = $derived(await getBandSubscriptionInfo(page.params.slug!));
	const band = $derived(layout.band);
	const isOwner = $derived(layout.userRole === 'owner');
</script>

<PageHeader title="Subscription" subtitle={band.name} />
<PageContent width="2xl">
	{#if info.tier === 'premium' && info.subscription}
		<!-- Active premium subscription -->
		<div class="card bg-base-100 shadow-sm">
			<div class="card-body">
				<div class="flex items-center gap-3">
					<h2 class="card-title">Premium Band Page</h2>
					<Badge variant="success">Active</Badge>
				</div>
				<dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
					<div>
						<dt class="font-medium opacity-60">Billing</dt>
						<dd class="capitalize">{info.subscription.billingInterval}</dd>
					</div>
					<div>
						<dt class="font-medium opacity-60">Renews</dt>
						<dd>{formatDate(new Date(info.subscription.currentPeriodEnd))}</dd>
					</div>
				</dl>

				{#if info.subscription.cancelAtPeriodEnd}
					<div class="alert alert-warning mt-4">
						<p>Your subscription will end on {formatDate(new Date(info.subscription.currentPeriodEnd))}.</p>
					</div>
					{#if isOwner}
						<form
							{...resumePremium.enhance(async (form) => {
								try {
									if (await form.submit()) {
										toast.success('Subscription resumed');
										invalidateAll();
									}
								} catch {
									toast.error('Something went wrong');
								}
							})}
						>
							<input {...resumePremium.fields.slug.as('hidden', band.slug)} />
							<button class="btn btn-primary btn-sm mt-2">Resume Subscription</button>
						</form>
					{/if}
				{:else if isOwner}
					<form
						{...cancelPremium.enhance(async (form) => {
							try {
								if (await form.submit()) {
									toast.success('Subscription will cancel at end of billing period');
									invalidateAll();
								}
							} catch {
								toast.error('Something went wrong');
							}
						})}
					>
						<input {...cancelPremium.fields.slug.as('hidden', band.slug)} />
						<button class="btn btn-ghost btn-sm mt-4 text-error">Cancel Subscription</button>
					</form>
				{/if}
			</div>
		</div>
	{:else}
		<!-- Free tier — upgrade CTA -->
		<div class="space-y-6">
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body text-center">
					<h2 class="text-2xl font-bold">Upgrade to Premium</h2>
					<p class="mt-2 opacity-70">
						Get a custom band page on your own subdomain with a block editor,
						custom CSS, genre themes, and a full EPK.
					</p>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<!-- Monthly -->
				<div class="card bg-base-100 shadow-sm border">
					<div class="card-body items-center text-center">
						<h3 class="text-lg font-bold">Monthly</h3>
						<p class="text-3xl font-bold">$15<span class="text-sm font-normal opacity-60">/mo</span></p>
						{#if isOwner}
							<form
								{...upgradeToPremium.enhance(async (form) => {
									try {
										const result = await form.submit();
										if (result && upgradeToPremium.result?.redirectUrl) {
											goto(upgradeToPremium.result.redirectUrl);
										}
									} catch {
										toast.error('Something went wrong');
									}
								})}
							>
								<input {...upgradeToPremium.fields.slug.as('hidden', band.slug)} />
								<input {...upgradeToPremium.fields.billingInterval.as('hidden', 'monthly')} />
								<button class="btn btn-primary mt-4">Subscribe Monthly</button>
							</form>
						{/if}
					</div>
				</div>

				<!-- Yearly -->
				<div class="card bg-base-100 shadow-sm border border-primary">
					<div class="card-body items-center text-center">
						<Badge variant="primary">2 months free</Badge>
						<h3 class="text-lg font-bold">Yearly</h3>
						<p class="text-3xl font-bold">$120<span class="text-sm font-normal opacity-60">/yr</span></p>
						{#if isOwner}
							<form
								{...upgradeToPremium.enhance(async (form) => {
									try {
										const result = await form.submit();
										if (result && upgradeToPremium.result?.redirectUrl) {
											goto(upgradeToPremium.result.redirectUrl);
										}
									} catch {
										toast.error('Something went wrong');
									}
								})}
							>
								<input {...upgradeToPremium.fields.slug.as('hidden', band.slug)} />
								<input {...upgradeToPremium.fields.billingInterval.as('hidden', 'yearly')} />
								<button class="btn btn-primary mt-4">Subscribe Yearly</button>
							</form>
						{/if}
					</div>
				</div>
			</div>

			<!-- Feature list -->
			<div class="card bg-base-100 shadow-sm">
				<div class="card-body">
					<h3 class="font-bold">What's included</h3>
					<ul class="mt-2 space-y-2 text-sm">
						<li class="flex items-start gap-2">
							<span class="text-success">&#10003;</span>
							Custom subdomain (yourband.corvmc.com)
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">&#10003;</span>
							Block editor with drag-and-drop page building
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">&#10003;</span>
							Genre-themed templates (Punk, Jazz, Metal, Indie, Electronic, Folk)
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">&#10003;</span>
							Full custom CSS
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">&#10003;</span>
							Electronic Press Kit (EPK) with tech rider &amp; stage plot
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">&#10003;</span>
							Photo gallery with downloadable press images
						</li>
						<li class="flex items-start gap-2">
							<span class="text-success">&#10003;</span>
							Embedded music players (Spotify, SoundCloud, YouTube)
						</li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</PageContent>
