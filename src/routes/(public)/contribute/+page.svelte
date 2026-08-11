<script lang="ts">
	import {
		IconBuildingCommunity,
		IconCoin,
		IconGuitarPick,
		IconMicrophone,
		IconSpeakerphone,
		IconTicket
	} from '@tabler/icons-svelte';
	import type { Icon } from '@tabler/icons-svelte';
	import Button from '$lib/components/shared/Button.svelte';

	type VolunteerGroup = {
		icon: Icon;
		title: string;
		/** Only the committees group needs a lead-in above its roles. */
		desc?: string;
		roles: { name: string; desc: string }[];
	};

	type ContributeWay = {
		icon: Icon;
		title: string;
		desc: string;
		href: string;
		cta: string;
		/** Opens in a new tab; set for links that leave the site. */
		external?: boolean;
	};

	// The form's share link, which redirects to the published `/d/e/…/viewform`
	// URL. Not the `docs.google.com/…/edit` link the form editor shows you —
	// that one is a permission-denied screen for everyone but its owners.
	const VOLUNTEER_FORM_URL = 'https://forms.gle/1yYx7WSiD2fdKtGG6';

	// Zeffy's hosted donation form (zero-fee for nonprofits). Distinct from the
	// `/embed/...` variant, which is the bare iframe payload meant for embedding.
	const ZEFFY_DONATION_URL =
		'https://www.zeffy.com/donation-form/donate-to-the-corvallis-music-collective';

	const volunteerGroups: VolunteerGroup[] = [
		{
			icon: IconTicket,
			title: 'At shows',
			roles: [
				{ name: 'Host', desc: 'Welcome bands, introduce sets, keep things on schedule.' },
				{ name: 'Tech', desc: 'Operate the soundboard and run soundcheck.' },
				{ name: 'Door', desc: 'Handle entry, welcome the audience, keep an eye on the space.' },
				{ name: 'Merch', desc: 'Run CMC merch and concessions, coordinate band merch tables.' },
				{ name: 'Photos or Video', desc: 'Document the show with your own equipment.' }
			]
		},
		{
			icon: IconSpeakerphone,
			title: 'Away from shows',
			roles: [
				{ name: 'Street team', desc: 'Put up posters around town.' },
				{ name: 'Tabling', desc: 'Staff a table at festivals and community events.' },
				{ name: 'Work parties', desc: 'Cleaning, organizing, and building projects.' },
				{ name: 'Gear repair', desc: 'Clean, maintain, and repair lending library equipment.' },
				{ name: 'Audio engineering', desc: 'Help members record, mix, or master.' }
			]
		},
		{
			icon: IconBuildingCommunity,
			title: 'Committees',
			desc: 'Committees meet monthly to build and guide the organization.',
			roles: [
				{ name: 'Programming', desc: 'Planning and booking CMC-produced events.' },
				{ name: 'Production', desc: 'Operating, staffing, and running CMC events.' },
				{ name: 'Development', desc: 'Fundraising, member and partner development, outreach.' },
				{ name: 'Communications', desc: 'Social media, posters, press, and the newsletter.' },
				{ name: 'Art and merchandise', desc: 'CMC merch and local artists for poster art.' },
				{ name: 'Facility', desc: 'Building management, gear library, rehearsal scheduling.' }
			]
		}
	];

	const otherWays: ContributeWay[] = [
		{
			icon: IconCoin,
			title: 'One-Time Donation',
			desc: 'Not ready to commit monthly? A one-time gift goes straight toward keeping the doors open.',
			href: ZEFFY_DONATION_URL,
			cta: 'Donate Now',
			external: true
		},
		{
			icon: IconGuitarPick,
			title: 'Donate Gear',
			desc: 'Working amps, drums, mics, or instruments find a new home in our lending library.',
			href: '/contact',
			cta: 'Get in Touch'
		},
		{
			icon: IconMicrophone,
			title: 'Host a Workshop',
			desc: 'Share your craft with other musicians — songwriting, recording, gear repair, theory.',
			href: '/contact',
			cta: 'Pitch an Idea'
		}
	];
</script>

<svelte:head>
	<title>Contribute | Corvallis Music Collective</title>
	<meta
		name="description"
		content="Volunteer with the Corvallis Music Collective, become a sustaining member, donate gear, or make a gift. Shows are run by volunteers — no experience needed."
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

<!--
	Volunteering leads the page: it's the ask with the lowest barrier and the one
	the collective depends on most. The role list mirrors the sign-up form, so
	someone can decide what they're interested in before they open it.
-->
<section class="py-16 px-6">
	<div class="max-w-5xl mx-auto">
		<div class="text-center max-w-2xl mx-auto flex flex-col items-center gap-4 mb-12">
			<h2 class="text-4xl font-bold tracking-tight">Volunteer with Us</h2>
			<p class="text-base leading-relaxed" style="color: var(--fg-2)">
				Shows here are run by volunteers. Pick anything that interests you — saying you're
				interested isn't a commitment, it just helps us know who to contact when opportunities come
				up. We'll provide whatever training the role needs.
			</p>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
			{#each volunteerGroups as group (group.title)}
				<div
					class="flex flex-col gap-3 rounded-lg p-6"
					style="background: var(--surface); border: 1px solid var(--surface-border)"
				>
					<div class="flex items-center gap-2" style="color: var(--cmc-navy)">
						<group.icon size={24} />
						<h3 class="text-lg font-bold">{group.title}</h3>
					</div>
					{#if group.desc}
						<p class="text-sm leading-relaxed" style="color: var(--fg-3)">{group.desc}</p>
					{/if}
					<ul class="flex flex-col gap-2">
						{#each group.roles as role (role.name)}
							<li class="text-sm leading-relaxed">
								<span class="font-bold">{role.name}</span>
								<span style="color: var(--fg-2)"> — {role.desc}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<div class="text-center max-w-2xl mx-auto flex flex-col items-center gap-4">
			<p class="text-base leading-relaxed" style="color: var(--fg-2)">
				Have an idea for a program, club, or class? Want to show art or perform? Not sure and just
				want to help? There's a spot for each of those on the form.
			</p>
			<Button href={VOLUNTEER_FORM_URL} class="btn-lg" target="_blank" rel="noopener noreferrer"
				>Sign Up to Volunteer</Button
			>
		</div>
	</div>
</section>

<!-- Become a Sustaining Member (pointer to /membership) -->
<section class="section-tint-secondary py-16 px-6">
	<div class="max-w-2xl mx-auto text-center flex flex-col items-center gap-4">
		<h2 class="text-4xl font-bold tracking-tight">Become a Sustaining Member</h2>
		<p class="text-base leading-relaxed" style="color: var(--fg-2)">
			The most direct way to support the space is a monthly contribution on a sliding scale —
			starting at $10/month. Sustaining members earn free practice hours every month, can lock in a
			recurring weekly practice slot, and get discounts on show tickets and gear. Your contribution
			keeps the doors open.
		</p>
		<Button href="/membership" class="btn-lg">Explore Membership</Button>
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
					<Button
						href={item.href}
						class="btn-sm mt-auto"
						target={item.external ? '_blank' : undefined}
						rel={item.external ? 'noopener noreferrer' : undefined}>{item.cta}</Button
					>
				</div>
			{/each}
		</div>
	</div>
</section>
