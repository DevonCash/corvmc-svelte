<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		id,
		issues,
		children,
		class: className = ''
	}: {
		label: string;
		id: string;
		/** Validation issues from remote.fields.<name>.issues() */
		issues?: Array<{ message: string }> | null;
		children: Snippet;
		class?: string;
	} = $props();
</script>

<div class="form-control {className}">
	<label class="label" for={id}>
		<span class="label-text">{label}</span>
	</label>
	{#if issues}
		{#each issues as issue}
			<p class="text-error text-sm">{issue.message}</p>
		{/each}
	{/if}
	{@render children()}
</div>
