<script lang="ts">
	import { IconMail, IconMapPin } from '@tabler/icons-svelte';
	import { resolve } from '$app/paths';
	import { submitContactForm } from '$lib/remote/inbox.remote';
	import { toast } from 'svelte-sonner';

	let submitted = $state(false);

	const subjects = [
		'General Inquiry',
		'Membership Questions',
		'Practice Space',
		'Performance Inquiry',
		'Volunteer Opportunities',
		'Donations'
	];

	const rf = submitContactForm.for('contact');
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
				<div class="alert alert-success">Thanks for reaching out! We'll get back to you soon.</div>
			{:else}
				<form
					{...rf.enhance(async ({ submit }) => {
						if (await submit()) submitted = true;
						else toast.error('Something went wrong. Please try again.');
					})}
					class="flex flex-col gap-4"
				>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Name</span></div>
							<input {...rf.fields.name.as('text')} class="input input-bordered w-full" required />
						</label>
						<label class="form-control w-full">
							<div class="label"><span class="label-text">Email</span></div>
							<input
								{...rf.fields.email.as('email')}
								class="input input-bordered w-full"
								required
							/>
						</label>
					</div>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Subject</span></div>
						<select {...rf.fields.subject.as('select')} class="select select-bordered w-full">
							{#each subjects as s (s)}
								<option value={s}>{s}</option>
							{/each}
						</select>
					</label>
					<label class="form-control w-full">
						<div class="label"><span class="label-text">Message</span></div>
						<textarea name="message" class="textarea textarea-bordered w-full" rows="5" required
						></textarea>
					</label>
					<button type="submit" class="btn btn-primary">Send Message</button>
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
						<summary class="collapse-title font-medium py-2 min-h-0"
							>How do I become a member?</summary
						>
						<div class="collapse-content text-sm" style="color: var(--fg-2)">
							<a href={resolve('/login?redirect=/member')} class="link">Create an account</a> to get started.
							Free memberships are available.
						</div>
					</details>
					<details class="collapse collapse-arrow bg-base-200">
						<summary class="collapse-title font-medium py-2 min-h-0"
							>Can I use the practice space?</summary
						>
						<div class="collapse-content text-sm" style="color: var(--fg-2)">
							The practice space is available to all members. Sign up for a free membership to book
							your first session.
						</div>
					</details>
					<details class="collapse collapse-arrow bg-base-200">
						<summary class="collapse-title font-medium py-2 min-h-0"
							>How do I submit music for a show?</summary
						>
						<div class="collapse-content text-sm" style="color: var(--fg-2)">
							Use the contact form on this page with "Performance Inquiry" as the subject, and tell
							us about your act.
						</div>
					</details>
				</div>
			</div>
		</div>
	</div>
</div>
