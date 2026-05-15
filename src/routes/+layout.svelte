<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.bunny.net" />
	<link href="https://fonts.bunny.net/css?family=lexend:300,400,500,600,700" rel="stylesheet" />
	<link rel="icon" href={favicon} />
</svelte:head>
{@render children()}
