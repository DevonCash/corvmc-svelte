<script lang="ts">
	let {
		message = 'No items found.',
		actionLabel,
		actionHref,
		class: className = ''
	}: {
		message?: string;
		actionLabel?: string;
		actionHref?: string;
		class?: string;
	} = $props();
</script>

<div class="text-center py-12 opacity-60 {className}">
	<p>{message}</p>
	{#if actionLabel && actionHref}
		<a href={actionHref} class="link link-primary mt-2 inline-block">{actionLabel}</a>
	{/if}
</div>
