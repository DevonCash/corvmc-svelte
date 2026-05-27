<script lang="ts">
	import '$lib/themes/band-site/index.css';
	import { getBandSiteData } from '$lib/remote/band-site.remote';
	import { page } from '$app/state';

	let { children } = $props();
	let data = $derived(await getBandSiteData(page.params.slug!));
	const themeClass = $derived(`theme-${data.config?.theme ?? 'default'}`);
</script>

<svelte:head>
	<title>{data.band.name}</title>
	<meta name="description" content={data.band.tagline || data.band.name} />
</svelte:head>

<div class="band-site-container {themeClass} min-h-screen">
	{@render children()}

	{#if data.config?.customCss}
		{@html `<style>.band-site-container { ${data.config.customCss} }</style>`}
	{/if}
</div>
