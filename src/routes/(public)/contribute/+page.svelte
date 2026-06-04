<script lang="ts">
	import { IconGuitarPick, IconHeartHandshake, IconMicrophone } from '@tabler/icons-svelte';
	import { resolve } from '$app/paths';

	const tiers = [
		{
			amount: '$5',
			label: 'Monthly Supporter',
			body: 'Covers one hour of practice space for a musician in need.',
			featured: false
		},
		{
			amount: '$25',
			label: 'Sustaining Member',
			body: 'Gets you 10 free practice hours each month, plus member events.',
			featured: true
		},
		{
			amount: '$100+',
			label: 'Studio Patron',
			body: 'Funds new gear for our lending library and PA upgrades.',
			featured: false
		}
	];

	const otherWays = [
		{
			icon: IconGuitarPick,
			title: 'Donate Gear',
			desc: 'Working amps, drums, mics, or instruments find a new home in our lending library.'
		},
		{
			icon: IconHeartHandshake,
			title: 'Volunteer',
			desc: "Help us run shows, maintain the space, or host meetups. We'll teach you the ropes."
		},
		{
			icon: IconMicrophone,
			title: 'Host a Workshop',
			desc: 'Share your craft with other musicians — songwriting, recording, gear repair, theory.'
		}
	];
</script>

<svelte:head>
	<title>Contribute | Corvallis Music Collective</title>
	<meta
		name="description"
		content="Support the Corvallis Music Collective through memberships, donations, volunteering, or in-kind contributions."
	/>
</svelte:head>

<!-- Hero -->
<section class="sunburst section-tint-secondary py-24 px-6 text-center">
	<div class="max-w-2xl mx-auto flex flex-col items-center gap-4">
		<h1
			class="text-5xl font-bold leading-tight tracking-tight text-balance"
			style="color: var(--cmc-navy)"
		>
			Help Us Keep the Music Going
		</h1>
		<p class="text-lg leading-relaxed" style="color: var(--fg-2)">
			CMC is a 501(c)(3) nonprofit. Every membership, donation, and volunteer hour goes directly
			toward affordable practice space and programs for local musicians.
		</p>
	</div>
</section>

<!-- Pricing Tiers -->
<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
			{#each tiers as tier (tier.label)}
				<div
					class="rounded-lg p-8 text-center flex flex-col items-center"
					style={tier.featured
						? 'background: var(--cmc-orange); color: #fff'
						: 'background: var(--surface); border: 1px solid var(--surface-border)'}
				>
					<div
						class="text-xs font-bold uppercase tracking-widest mb-2"
						style={tier.featured ? 'opacity: 0.85' : 'color: var(--fg-3)'}
					>
						{tier.label}
					</div>
					<div class="text-5xl font-bold leading-none mb-1">{tier.amount}</div>
					<div class="text-xs mb-4" style={tier.featured ? 'opacity: 0.85' : 'color: var(--fg-3)'}>
						per month
					</div>
					<p
						class="text-sm leading-relaxed mb-6"
						style={tier.featured ? 'opacity: 0.9' : 'color: var(--fg-2)'}
					>
						{tier.body}
					</p>
					<a
						href={resolve('/login?redirect=/member')}
						class="btn btn-sm btn-wide mt-auto"
						style={tier.featured
							? 'background: var(--cmc-navy); color: #fff; border-color: rgba(0,0,0,0.3)'
							: ''}
					>
						Choose
					</a>
				</div>
			{/each}
		</div>
	</div>
</section>

<!-- Other Ways to Contribute -->
<section class="section-tint-warning py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-12">
			<h2 class="text-4xl font-bold tracking-tight mb-3">Other Ways to Contribute</h2>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
			{#each otherWays as item (item.title)}
				<div
					class="flex flex-col items-center text-center gap-3 rounded-lg p-6"
					style="background: var(--surface); border: 1px solid var(--surface-border); box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.08))"
				>
					<div style="color: var(--cmc-navy)">
						<item.icon size={40} />
					</div>
					<h3 class="text-lg font-bold">{item.title}</h3>
					<p class="text-sm leading-relaxed" style="color: var(--fg-2)">{item.desc}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
