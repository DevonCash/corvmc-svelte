<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import IdCard from './IdCard.svelte';

	// Decorative brand art — the tri-color header stripe and barcode are intentional.
	const { Story } = defineMeta({
		title: 'Shared/Directory/IdCard',
		component: IdCard,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		args: {
			href: '#',
			name: 'Jane Doe',
			pronouns: 'she/her',
			tagline: 'Drummer, occasional synth',
			instruments: ['Drums', 'Synth'],
			genres: ['Post-punk', 'Shoegaze'],
			bands: [{ name: 'The Velvet Underground' }],
			memberSince: 2021
		}
	});
</script>

<Story name="Default" />
<Story name="Looking for a band" args={{ lookingForBand: true, bands: [] }} />
<Story
	name="All flags"
	args={{ availableForHire: true, teachesLessons: true, openToCollaboration: true }}
/>
<Story
	name="With photo"
	args={{ image: 'https://i.pravatar.cc/300?img=32' }}
/>
