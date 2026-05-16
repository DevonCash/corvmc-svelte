<script lang="ts">
	import { IconMusic, IconCalendarEvent, IconUsers, IconSchool } from '@tabler/icons-svelte';

	const programs = [
		{ icon: IconMusic, title: 'Practice Space', desc: 'Affordable hourly rehearsal rooms with full PA and sound treatment.' },
		{ icon: IconCalendarEvent, title: 'Live Events', desc: 'Monthly showcases, open mics, and collaborative performances.' },
		{ icon: IconUsers, title: 'Community', desc: 'Connect with local musicians across genres and skill levels.' },
		{ icon: IconSchool, title: 'Education', desc: 'Workshops, mentorship, and gear lending for growing musicians.' }
	];
</script>

<svelte:head>
	<title>Corvallis Music Collective</title>
	<meta name="description" content="Shared music resources, affordable practice space, and a supportive community for musicians in Corvallis, Oregon." />
</svelte:head>

<!-- Hero -->
<section class="py-20 px-4 text-center">
	<div class="max-w-3xl mx-auto">
		<h1 class="display mb-6">Building and Connecting Music Communities in Corvallis</h1>
		<p class="text-lg opacity-70 mb-8">
			Shared music resources, affordable practice space, and a supportive community for musicians of every level.
		</p>
		<div class="flex flex-wrap justify-center gap-3">
			<a href="/login?redirect=/member" class="btn btn-primary btn-lg">Join Our Community</a>
			<a href="/about" class="btn btn-ghost btn-lg">Learn More About Us</a>
		</div>
	</div>
</section>

<!-- What We Do -->
<section class="py-16 px-4 bg-base-200">
	<div class="max-w-5xl mx-auto">
		<h2 class="text-3xl font-bold text-center mb-12">What We Do</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
			{#each programs as item}
				<div class="card bg-base-100 shadow-sm">
					<div class="card-body items-center text-center">
						<item.icon size={40} class="text-primary mb-2" />
						<h3 class="card-title text-base">{item.title}</h3>
						<p class="text-sm opacity-70">{item.desc}</p>
					</div>
				</div>
			{/each}
		</div>
		<div class="text-center mt-8">
			<a href="/programs" class="btn btn-ghost">View All Programs</a>
		</div>
	</div>
</section>

<!-- Get Involved -->
<section class="py-16 px-4">
	<div class="max-w-5xl mx-auto">
		<h2 class="text-3xl font-bold text-center mb-12">Get Involved</h2>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<div class="card bg-base-200">
				<div class="card-body">
					<h3 class="card-title">Become a Member</h3>
					<p class="text-sm opacity-70">Access the practice space, borrow gear, and join our growing community of musicians.</p>
					<div class="card-actions justify-end mt-2">
						<a href="/login?redirect=/member" class="btn btn-primary btn-sm">Sign Up</a>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h3 class="card-title">Volunteer</h3>
					<p class="text-sm opacity-70">Help with events, facility maintenance, social media, or grant writing.</p>
					<div class="card-actions justify-end mt-2">
						<a href="/contribute" class="btn btn-ghost btn-sm">Learn More</a>
					</div>
				</div>
			</div>
			<div class="card bg-base-200">
				<div class="card-body">
					<h3 class="card-title">Support Us</h3>
					<p class="text-sm opacity-70">Make a donation or contribute supplies to help sustain our mission.</p>
					<div class="card-actions justify-end mt-2">
						<a href="/contribute" class="btn btn-ghost btn-sm">Donate</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
