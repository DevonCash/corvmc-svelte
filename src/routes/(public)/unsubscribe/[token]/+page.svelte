<script lang="ts">
	import type { UnsubscribeResponse } from '$lib/server/db/schema/api';
	import Button from '$lib/components/shared/Button.svelte';

	let { data }: { data: UnsubscribeResponse } = $props();
</script>

<div class="max-w-md mx-auto p-6 text-center space-y-4">
	{#if data.valid}
		<h1 class="text-2xl font-bold">Unsubscribed</h1>
		<p class="opacity-70">
			You've been unsubscribed from <strong>{data.audienceName}</strong>.
			You won't receive any more emails from this list.
		</p>
	{:else}
		<h1 class="text-2xl font-bold">Invalid Link</h1>
		<p class="opacity-70">
			This unsubscribe link is invalid or has already been used.
		</p>
	{/if}

	<Button href="/" class="btn-ghost btn-sm">Back to CorvMC</Button>
</div>
