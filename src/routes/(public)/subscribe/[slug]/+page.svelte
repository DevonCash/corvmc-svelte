<script lang="ts">
	import Alert from '$lib/components/shared/Alert.svelte';
	import type { AudienceDetailResponse } from '$lib/types/api';

	let { data }: { data: AudienceDetailResponse } = $props();

	let email = $state('');
	let name = $state('');
	let submitting = $state(false);
	let success = $state(false);
	let errorMsg = $state('');

	async function handleSubmit() {
		if (!email.trim()) return;
		submitting = true;
		errorMsg = '';

		try {
			const res = await fetch(`/api/marketing/audiences/${data.audience.slug}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined })
			});

			if (!res.ok) {
				const body = await res.json().catch(() => null);
				throw new Error(body?.message ?? 'Something went wrong');
			}

			success = true;
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Something went wrong';
		} finally {
			submitting = false;
		}
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
		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-4"
		>
			<div>
				<label for="sub-email" class="label text-sm font-medium">Email</label>
				<input
					id="sub-email"
					type="email"
					bind:value={email}
					placeholder="your@email.com"
					class="input-bordered input w-full"
					required
				/>
			</div>

			<div>
				<label for="sub-name" class="label text-sm font-medium">Name (optional)</label>
				<input
					id="sub-name"
					type="text"
					bind:value={name}
					placeholder="Your name"
					class="input-bordered input w-full"
				/>
			</div>

			{#if errorMsg}
				<Alert type="error" class="text-sm">{errorMsg}</Alert>
			{/if}

			<button
				type="submit"
				class="btn btn-primary w-full"
				disabled={!email.trim() || submitting}
			>
				{#if submitting}
					<span class="loading loading-sm loading-spinner"></span>
				{/if}
				Subscribe
			</button>
		</form>
	{/if}
</div>
