<script lang="ts">
	import SiteHeader from '$lib/components/public/SiteHeader.svelte';
	import SiteFooter from '$lib/components/public/SiteFooter.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen flex-col">
	<SiteHeader user={data.user} />
	<main class="flex-1">
		<svelte:boundary>
			{@render children()}

			{#snippet failed(error, reset)}
				<div class="container mx-auto px-4 py-12">
					<Alert type="error" {reset}>Something went wrong: {String(error)}</Alert>
				</div>
			{/snippet}
		</svelte:boundary>
	</main>
	<SiteFooter />
</div>
