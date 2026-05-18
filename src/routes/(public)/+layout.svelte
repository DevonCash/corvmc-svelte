<script lang="ts">
	import { Toaster } from 'svelte-sonner';
	import SiteHeader from '$lib/components/public/SiteHeader.svelte';
	import SiteFooter from '$lib/components/public/SiteFooter.svelte';
	import ErrorToastBoundary from '$lib/components/shared/ErrorToastBoundary.svelte';

	let { data, children } = $props();
</script>

<Toaster position="bottom-right" richColors closeButton />
<div class="flex min-h-screen flex-col">
	<SiteHeader user={data.user} />
	<main class="flex-1">
		<ErrorToastBoundary>
			{@render children()}
		</ErrorToastBoundary>
	</main>
	<SiteFooter />
</div>
