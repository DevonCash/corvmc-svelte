<script lang="ts">
	import { IconMail, IconMapPin } from '@tabler/icons-svelte';

	let name = $state('');
	let email = $state('');
	let subject = $state('General Inquiry');
	let message = $state('');
	let submitted = $state(false);
	let loading = $state(false);

	const subjects = [
		'General Inquiry',
		'Membership Questions',
		'Practice Space',
		'Performance Inquiry',
		'Volunteer Opportunities',
		'Donations'
	];

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		// TODO: wire up to an API endpoint or email service
		await new Promise((r) => setTimeout(r, 500));
		submitted = true;
		loading = false;
	}
</script>

<svelte:head>
	<title>Contact — CorvMC</title>
	<meta name="description" content="Get in touch with the Corvallis Music Collective." />
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-12">
	<p class="eyebrow mb-2">Get in Touch</p>
	<h1 class="text-3xl font-bold mb-8">Contact Us</h1>

	<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
		<!-- Form -->
		<div class="md:col-span-2">
			{#if submitted}
				<div class="alert alert-success">
					Thanks for reaching out! We'll get back to you soon.
				</div>
			{:else}
				<form onsubmit={handleSubmit} class="flex flex-col gap-4">
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<label class="floating-label">
							<span>Name</span>
							<input type="text" placeholder="Name" bind:value={name} required class="input input-bordered w-full" />
						</label>
						<label class="floating-label">
							<span>Email</span>
							<input type="email" placeholder="Email" bind:value={email} required class="input input-bordered w-full" />
						</label>
					</div>

					<label class="floating-label">
						<span>Subject</span>
						<select bind:value={subject} class="select select-bordered w-full">
							{#each subjects as s}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</label>

					<label class="floating-label">
						<span>Message</span>
						<textarea
							placeholder="Message"
							bind:value={message}
							required
							rows="5"
							class="textarea textarea-bordered w-full"
						></textarea>
					</label>

					<button type="submit" class="btn btn-primary" disabled={loading}>
						{#if loading}
							<span class="loading loading-spinner loading-sm"></span>
						{/if}
						Send Message
					</button>
				</form>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="space-y-6">
			<div>
				<h3 class="font-semibold flex items-center gap-2 mb-2">
					<span style="color: var(--cmc-teal)"><IconMapPin size={18} /></span> Visit Us
				</h3>
				<p class="text-sm" style="color: var(--fg-2)">
					6775 A Philomath Blvd<br />
					Corvallis, OR 97333
				</p>
				<p class="text-xs mt-1" style="color: var(--fg-3)">Office available by appointment only.</p>
			</div>

			<div>
				<h3 class="font-semibold flex items-center gap-2 mb-2">
					<span style="color: var(--cmc-teal)"><IconMail size={18} /></span> Email
				</h3>
				<a href="mailto:info@corvmc.org" class="link text-sm">info@corvmc.org</a>
			</div>

			<div>
				<h3 class="font-semibold mb-2">Quick Answers</h3>
				<div class="space-y-2 text-sm">
					<details class="collapse collapse-arrow bg-base-200">
						<summary class="collapse-title font-medium py-2 min-h-0">How do I become a member?</summary>
						<div class="collapse-content text-sm" style="color: var(--fg-2)">
							<a href="/login?redirect=/member" class="link">Create an account</a> to get started. Free memberships are available.
						</div>
					</details>
					<details class="collapse collapse-arrow bg-base-200">
						<summary class="collapse-title font-medium py-2 min-h-0">Can I use the practice space?</summary>
						<div class="collapse-content text-sm" style="color: var(--fg-2)">
							The practice space is available to all members. Sign up for a free membership to book your first session.
						</div>
					</details>
					<details class="collapse collapse-arrow bg-base-200">
						<summary class="collapse-title font-medium py-2 min-h-0">How do I submit music for a show?</summary>
						<div class="collapse-content text-sm" style="color: var(--fg-2)">
							Use the contact form on this page with "Performance Inquiry" as the subject, and tell us about your act.
						</div>
					</details>
				</div>
			</div>
		</div>
	</div>
</div>
