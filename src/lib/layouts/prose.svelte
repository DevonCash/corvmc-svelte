<script>
	/** @type {string} */
	export let title = '';
	/** @type {string} */
	export let description = '';
</script>

<svelte:head>
	<title>{title} — CorvMC</title>
	{#if description}
		<meta name="description" content={description} />
	{/if}
</svelte:head>

<article class="prose prose-lg mx-auto max-w-3xl px-4 py-12">
	<slot />
</article>
