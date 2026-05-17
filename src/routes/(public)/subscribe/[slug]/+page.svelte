<script lang="ts">
	import Alert from '$lib/components/shared/Alert.svelte';
	import Form, { Field, SubmitButton } from '$lib/components/shared/Form';
	import type { AudienceDetailResponse } from '$lib/types/api';

	let { data }: { data: AudienceDetailResponse } = $props();

	let success = $state(false);

	async function handleSubmit(formData: FormData) {
		const email = (formData.get('email') as string).trim();
		const name = (formData.get('name') as string)?.trim() || undefined;
		if (!email) return;

		const res = await fetch(`/api/marketing/audiences/${data.audience.slug}`, {
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

<div class="max-w-md mx-auto p-6 space-y-6">
	<div class="text-center">
		<h1 class="text-2xl font-bold">{data.audience.name}</h1>
		{#if data.audience.description}
			<p class="opacity-60 mt-1">{data.audience.description}</p>
		{/if}
	</div>

	{#if success}
		<Alert type="success">You're subscribed! Look out for our next email.</Alert>
	{:else}
		<Form action={handleSubmit} class="space-y-4">
			<Field name="email" type="email" label="Email" placeholder="your@email.com" />
			<Field name="name" type="text" label="Name (optional)" placeholder="Your name" />
			<SubmitButton label="Subscribe" class="btn-primary w-full" />
		</Form>
	{/if}
</div>
