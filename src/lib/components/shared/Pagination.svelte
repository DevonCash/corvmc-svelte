<script lang="ts">
	let {
		page,
		totalPages,
		buildHref
	}: {
		page: number;
		totalPages: number;
		buildHref: (page: number) => string;
	} = $props();
</script>

{#if totalPages > 1}
	<div class="flex justify-center">
		<div class="join">
			{#if page > 1}
				<a href={buildHref(page - 1)} class="join-item btn">«</a>
			{/if}

			{#each Array.from({ length: totalPages }, (_, i) => i + 1) as p (p)}
				<a
					href={buildHref(p)}
					class="join-item btn"
					class:btn-active={p === page}
				>
					{p}
				</a>
			{/each}

			{#if page < totalPages}
				<a href={buildHref(page + 1)} class="join-item btn">»</a>
			{/if}
		</div>
	</div>
{/if}
