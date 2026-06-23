<script lang="ts">
	import {
		IconClock,
		IconCalendarRepeat,
		IconTicket,
		IconDeviceSpeaker
	} from '@tabler/icons-svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { resolve } from '$app/paths';

	// Sustaining membership is a sliding scale: every $5/month earns one free hour
	// of practice time (up to 12), and every tier gets the same benefits. Kept in
	// sync with the member-facing pricing in SlidingScale.svelte and /contribute.
	const tiers = [
		{
			amount: '$10',
			hours: '2 free practice hours',
			body: 'A great way to start — plus 50% off every show ticket you buy online.',
			featured: false
		},
		{
			amount: '$25',
			hours: '5 free practice hours',
			body: 'Free gear accessories, member events, and 50% off show tickets.',
			featured: true
		},
		{
			amount: '$60',
			hours: '12 free practice hours',
			body: 'The most practice time per dollar, with every member benefit included.',
			featured: false
		}
	];

	const benefits = [
		{
			icon: IconClock,
			title: 'Free Practice Hours',
			desc: 'A monthly allotment of free rehearsal time that refreshes each billing cycle.'
		},
		{
			icon: IconCalendarRepeat,
			title: 'Recurring Reservations',
			desc: 'Lock in a standing weekly practice slot — a members-only perk.'
		},
		{
			icon: IconTicket,
			title: 'Show Discounts',
			desc: '50% off show tickets you buy online, plus invites to member-only events.'
		},
		{
			icon: IconDeviceSpeaker,
			title: 'Gear Perks',
			desc: 'Free accessory loans and reduced rates on major equipment from the lending library.'
		}
	];
</script>

<svelte:head>
	<title>Membership | Corvallis Music Collective</title>
	<meta
		name="description"
		content="A free account gets you started at the Corvallis Music Collective. Sustaining membership is a sliding-scale monthly contribution that supports the space and unlocks free practice hours and more."
	/>
</svelte:head>

<!-- Hero -->
<section class="sunburst section-tint-secondary py-24 px-6 text-center">
	<div class="max-w-2xl mx-auto flex flex-col items-center gap-4">
		<h1
			class="text-5xl font-bold leading-tight tracking-tight text-balance"
			style="color: var(--cmc-navy)"
		>
			Become a Member
		</h1>
		<p class="text-lg leading-relaxed" style="color: var(--fg-2)">
			A free account gets you in the door. Sustaining membership keeps the doors open — and unlocks
			free practice hours, recurring reservations, and member perks.
		</p>
	</div>
</section>

<!-- Free vs Sustaining -->
<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-10">
			<h2 class="text-4xl font-bold tracking-tight mb-3">Two Ways to Belong</h2>
			<p class="text-base max-w-2xl mx-auto leading-relaxed" style="color: var(--fg-2)">
				Everyone starts with a free account. Sustaining members chip in monthly to keep the
				collective running — and get more out of the space in return.
			</p>
		</div>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Free -->
			<div
				class="rounded-lg p-8 flex flex-col gap-4"
				style="background: var(--surface); border: 1px solid var(--surface-border)"
			>
				<div>
					<div class="text-3xl font-bold">Free Account</div>
					<div class="text-sm" style="color: var(--fg-3)">Always free</div>
				</div>
				<p class="text-sm leading-relaxed" style="color: var(--fg-2)">
					Create an account to use the basics — book practice space at the standard hourly rate,
					browse the member directory, and RSVP to events.
				</p>
				<ul class="text-sm space-y-2" style="color: var(--fg-2)">
					<li>• Reserve practice space hourly</li>
					<li>• Member directory access</li>
					<li>• RSVP to events</li>
				</ul>
				<Button href="/login?redirect=/member" class="btn-outline mt-auto">Create an Account</Button
				>
			</div>

			<!-- Sustaining -->
			<div
				class="rounded-lg p-8 flex flex-col gap-4"
				style="background: var(--cmc-navy); color: #fff"
			>
				<div>
					<div class="text-3xl font-bold">Sustaining Member</div>
					<div class="text-sm" style="opacity: 0.85">From $10/month · sliding scale</div>
				</div>
				<p class="text-sm leading-relaxed" style="opacity: 0.9">
					A recurring contribution that supports the space and unlocks the full set of member
					benefits. Change or cancel anytime.
				</p>
				<ul class="text-sm space-y-2" style="opacity: 0.9">
					<li>• Everything in the free account</li>
					<li>• Free practice hours every month</li>
					<li>• Recurring reservations</li>
					<li>• Ticket discounts &amp; gear perks</li>
				</ul>
				<a
					href={resolve('/login?redirect=/member/membership')}
					class="btn btn-sm mt-auto"
					style="background: var(--cmc-orange); color: #fff; border-color: rgba(0,0,0,0.3)"
				>
					Become a Sustaining Member
				</a>
			</div>
		</div>
	</div>
</section>

<!-- Benefits -->
<section class="section-tint-secondary py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-12">
			<h2 class="text-4xl font-bold tracking-tight mb-3">What Sustaining Members Get</h2>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			{#each benefits as item (item.title)}
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

<!-- Sliding scale tiers -->
<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center mb-10">
			<h2 class="text-4xl font-bold tracking-tight mb-3">Pick Your Contribution</h2>
			<p class="text-base max-w-2xl mx-auto leading-relaxed" style="color: var(--fg-2)">
				It's a sliding scale: every <strong>$5/month</strong> earns you another free hour of practice
				time — up to 12. Every tier gets the same member benefits, you just walk away with more practice
				hours. Change or cancel anytime.
			</p>
		</div>
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
			{#each tiers as tier (tier.amount)}
				<div
					class="rounded-lg p-8 text-center flex flex-col items-center"
					style={tier.featured
						? 'background: var(--cmc-orange); color: #fff'
						: 'background: var(--surface); border: 1px solid var(--surface-border)'}
				>
					<div class="text-5xl font-bold leading-none mb-1">{tier.amount}</div>
					<div class="text-xs mb-3" style={tier.featured ? 'opacity: 0.85' : 'color: var(--fg-3)'}>
						per month
					</div>
					<div
						class="text-sm font-bold uppercase tracking-widest mb-3"
						style={tier.featured ? 'opacity: 0.95' : 'color: var(--cmc-teal)'}
					>
						{tier.hours}
					</div>
					<p
						class="text-sm leading-relaxed mb-6"
						style={tier.featured ? 'opacity: 0.9' : 'color: var(--fg-2)'}
					>
						{tier.body}
					</p>
					<a
						href={resolve('/login?redirect=/member/membership')}
						class="btn btn-sm btn-wide mt-auto"
						style={tier.featured
							? 'background: var(--cmc-navy); color: #fff; border-color: rgba(0,0,0,0.3)'
							: ''}
					>
						Become a Member
					</a>
				</div>
			{/each}
		</div>
		<p class="text-center text-sm mt-8" style="color: var(--fg-3)">
			Not looking to join monthly? There are <a
				href={resolve('/contribute')}
				class="underline"
				style="color: var(--cmc-teal)">other ways to support the collective</a
			>.
		</p>
	</div>
</section>
