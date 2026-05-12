<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let {
		items,
		header,
		row,
		empty = 'No items found'
	}: {
		items: T[];
		header: Snippet;
		row: Snippet<[T]>;
		empty?: string;
	} = $props();
</script>

<div class="card bg-base-100 shadow">
	<div class="card-body p-0">
		<div class="overflow-x-auto">
			<table class="table">
				<thead>
					{@render header()}
				</thead>
				<tbody>
					{#each items as item, i (i)}
						{@render row(item)}
					{:else}
						<tr>
							<td colspan="100" class="text-center opacity-60 py-8">{empty}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
