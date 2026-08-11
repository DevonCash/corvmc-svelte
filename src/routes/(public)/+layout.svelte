<script lang="ts">
	import { Toaster } from 'svelte-sonner';
	import SiteHeader from '$lib/components/public/SiteHeader.svelte';
	import SiteFooter from '$lib/components/public/SiteFooter.svelte';
	import ErrorToastBoundary from '$lib/components/shared/ErrorToastBoundary.svelte';
	import { getMe } from '$lib/remote/layout.remote';

	let { children } = $props();

	let user = $derived(await getMe());
</script>

<svelte:head>
	<meta property="og:site_name" content="Corvallis Music Collective" />
	<meta property="og:type" content="website" />
	<meta property="og:image" content="/og-image.png" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<Toaster position="bottom-right" richColors closeButton />
<div class="flex min-h-screen flex-col">
	<SiteHeader {user} />
	<main class="flex-1">
		<!--
			No pending snippet: the public site has to server-render real content for
			crawlers and link-preview scrapers, and a boundary with a pending snippet
			renders that snippet during SSR instead of awaiting its contents.
		-->
		<ErrorToastBoundary showPending={false}>
			{@render children()}
		</ErrorToastBoundary>
	</main>
	<SiteFooter />
</div>
