<script lang="ts">
	import Button from '$lib/components/shared/Button.svelte';

	// CMC processes donations through Zeffy (zero-fee for nonprofits). The form is
	// embedded as an iframe so the whole flow stays on-page. Recurring sustaining
	// membership that grants free practice hours lives separately at /member.
	const ZEFFY_FORM_URL =
		'https://www.zeffy.com/embed/donation-form/donate-to-the-corvallis-music-collective';
</script>

<svelte:head>
	<title>Donate | Corvallis Music Collective</title>
	<meta
		name="description"
		content="Donate to the Corvallis Music Collective, a 501(c)(3) nonprofit all-ages music venue and practice space in Corvallis, Oregon."
	/>
</svelte:head>

<!-- Hero -->
<section class="sunburst section-tint-secondary py-20 px-6 text-center">
	<div class="max-w-2xl mx-auto flex flex-col items-center gap-4">
		<h1
			class="text-5xl font-bold leading-tight tracking-tight text-balance"
			style="color: var(--cmc-navy)"
		>
			Support the Collective
		</h1>
		<p class="text-lg leading-relaxed" style="color: var(--fg-2)">
			CMC is a 501(c)(3) nonprofit — volunteer-run and member-governed. Every dollar goes directly
			toward affordable practice space, all-ages shows, and programs for local musicians.
		</p>
	</div>
</section>

<!-- Zeffy donation form -->
<section class="py-16 px-6">
	<div class="max-w-2xl mx-auto">
		<div
			style="position: relative; overflow: hidden; width: 100%; height: 0; padding-top: 125%; border-radius: 0.75rem;"
		>
			<iframe
				title="Donate to the Corvallis Music Collective"
				src={ZEFFY_FORM_URL}
				allow="payment"
				style="position: absolute; border: 0; top: 0; left: 0; bottom: 0; right: 0; width: 100%; height: 100%;"
			></iframe>
		</div>
		<p class="text-center text-sm mt-6" style="color: var(--fg-3)">
			Looking to give monthly and earn free practice hours? <a href="/contribute" class="link"
				>Become a sustaining member</a
			>.
		</p>
	</div>
</section>

<!-- Other ways to give -->
<section class="section-tint-secondary py-12 px-6 text-center">
	<div class="max-w-xl mx-auto flex flex-col items-center gap-4">
		<p class="text-base leading-relaxed" style="color: var(--fg-2)">
			Prefer to give gear, time, or a workshop instead? There are plenty of other ways to pitch in.
		</p>
		<Button href="/contribute" class="btn-ghost">See all the ways to contribute &rarr;</Button>
	</div>
</section>
