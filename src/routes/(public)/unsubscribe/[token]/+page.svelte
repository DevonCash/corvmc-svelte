<script lang="ts">
	import Button from '$lib/components/shared/Button.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { getUnsubscribeInfo, confirmUnsubscribe } from '$lib/remote/marketing.remote';
	import { page } from '$app/state';

	let token = $derived(page.params.token!);
	let data = $derived(await getUnsubscribeInfo(token));

	const { fields } = confirmUnsubscribe;

	// Loading the page no longer unsubscribes — that was happening on a GET, so
	// mail-client prefetchers and link scanners were unsubscribing people who
	// never clicked. The write happens when this form is submitted.
	let done = $state(false);
</script>

<div class="max-w-md mx-auto p-6 text-center space-y-4">
	{#if !data.valid}
		<h1 class="text-2xl font-bold">Invalid Link</h1>
		<p class="opacity-70">This unsubscribe link is invalid or has already been used.</p>
	{:else if done}
		<h1 class="text-2xl font-bold">Unsubscribed</h1>
		<p class="opacity-70">
			You've been unsubscribed from <strong>{data.audienceName}</strong>. You won't receive any more
			emails from this list.
		</p>
	{:else}
		<h1 class="text-2xl font-bold">Unsubscribe</h1>
		<p class="opacity-70">
			Stop receiving emails from <strong>{data.audienceName}</strong>?
		</p>
		<Form remote={confirmUnsubscribe} onsuccess={() => (done = true)}>
			<input {...fields.token.as('hidden', token)} />
			<SubmitButton label="Unsubscribe" class="btn-primary" />
		</Form>
	{/if}

	<Button href="/" class="btn-ghost btn-sm">Back to CorvMC</Button>
</div>
