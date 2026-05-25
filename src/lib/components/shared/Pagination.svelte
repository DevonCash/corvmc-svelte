<script lang="ts">
	import Button from '$lib/components/shared/Button.svelte';

	let {
		page,
		totalPages,
		buildHref,
		onpage
	}: {
		page: number;
		totalPages: number;
		buildHref?: (page: number) => string;
		onpage?: (page: number) => void;
	} = $props();

	function nav(p: number) {
		return onpage ? { onclick: () => onpage(p) } : { href: buildHref!(p) };
	}
</script>

{#if totalPages > 1}
	<div class="flex justify-center">
		<div class="join">
			{#if page > 1}
				<Button {...nav(page - 1)} class="join-item">«</Button>
			{/if}

			{#each Array.from({ length: totalPages }, (_, i) => i + 1) as p (p)}
				<Button
					{...nav(p)}
					class="join-item {p === page ? 'btn-active' : ''}"
				>
					{p}
				</Button>
			{/each}

			{#if page < totalPages}
				<Button {...nav(page + 1)} class="join-item">»</Button>
			{/if}
		</div>
	</div>
{/if}
