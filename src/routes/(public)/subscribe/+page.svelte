<script lang="ts">
	import Alert from '$lib/components/shared/Alert.svelte';
	import Form, { Field, SubmitButton } from '$lib/components/shared/Form';
	import { getPublicAudiences } from '$lib/remote/marketing';

	let audiences = $derived(await getPublicAudiences());

	let selectedAudienceId = $state('');
	let success = $state(false);

	async function handleSubmit(formData: FormData) {
		const email = (formData.get('email') as string).trim();
		const name = (formData.get('name') as string)?.trim() || undefined;
		if (!email || !selectedAudienceId) return;

		const slug = audiences.find((a) => a.id === selectedAudienceId)?.slug;
		const res = await fetch(`/api/marketing/audiences/${slug}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, name })
		});

		if (!res.ok) {
			const body = await res.json().catch(() => null) as { message?: string } | null;
			throw new Error(body?.message ?? 'Something went wrong');
		}

		success = true;
	}
</script>

<div class="max-w-lg mx-auto p-6 space-y-6">
	<div class="text-center">
		<h1 class="text-2xl font-bold">Subscribe</h1>
		<p class="opacity-60 mt-1">Join our mailing lists to stay in the loop.</p>
	</div>

	{#if success}
		<Alert type="success">You've been subscribed! Check your inbox for future updates.</Alert>
		<button
			class="btn btn-ghost btn-sm"
			onclick={() => {
				success = false;
				selectedAudienceId = '';
			}}
		>
			Subscribe to another list
		</button>
	{:else if audiences.length === 0}
		<p class="text-center opacity-60">No mailing lists are currently accepting signups.</p>
	{:else}
		<Form action={handleSubmit} class="space-y-4">
			<Field name="audience" label="Choose a list">
				<div class="space-y-2">
					{#each audiences as a (a.id)}
						<label class="label cursor-pointer gap-3 border rounded-lg px-4 py-3 {selectedAudienceId === a.id ? 'border-primary bg-primary/10' : 'border-base-300'}">
							<input
								type="radio"
								name="audience"
								class="radio radio-primary radio-sm"
								value={a.id}
								bind:group={selectedAudienceId}
							/>
							<div class="flex-1">
								<p class="font-medium text-sm">{a.name}</p>
								{#if a.description}
									<p class="text-xs opacity-60">{a.description}</p>
								{/if}
							</div>
						</label>
					{/each}
				</div>
			</Field>

			<Field name="email" type="email" label="Email" placeholder="your@email.com" />
			<Field name="name" type="text" label="Name (optional)" placeholder="Your name" />

			<SubmitButton label="Subscribe" class="btn-primary w-full" />
		</Form>
	{/if}
</div>
