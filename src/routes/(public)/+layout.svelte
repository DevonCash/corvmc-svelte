<script lang="ts">
	import SiteHeader from '$lib/components/public/SiteHeader.svelte';
	import SiteFooter from '$lib/components/public/SiteFooter.svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader user={data.user} />
	<main class="flex-1">
		{@render children()}
	</main>
	<SiteFooter />
</div>
