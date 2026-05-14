<script module lang="ts">
	/**
	 * Column definition for DataTable.
	 *
	 * This is our own type — TanStack column defs are an internal detail.
	 * If we swap the underlying library, this type stays the same.
	 */
	export type Column<T> = {
		/** Property key on the data object. */
		key: string & keyof T;
		/** Header label text. */
		header: string;
		/** Enable sorting on this column. Default: false. */
		sortable?: boolean;
		/** Format the cell value as text. Receives (value, row). Falls back to raw value. */
		cell?: (value: unknown, row: T) => string;
		/** Extra CSS classes on the <td>. */
		class?: string;
	};
</script>

<script lang="ts" generics="T extends Record<string, any>">
	import { createTable, Subscribe } from '@humanspeak/svelte-headless-table';
	import { addSortBy, addPagination } from '@humanspeak/svelte-headless-table/plugins';
	import { writable } from 'svelte/store';
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';

	let {
		data,
		columns,
		row: rowSnippet,
		groupBy,
		pageSize: pageSizeProp = 20,
		empty = 'No items found',
		class: className = ''
	}: {
		data: T[];
		columns: Column<T>[];
		/** Optional: full control over row rendering. Receives the sorted row item. */
		row?: Snippet<[T]>;
		/** Optional: group rows by a label derived from each item. Returns the heading text for the group. */
		groupBy?: (item: T) => string;
		/** Rows per page. Default 20. */
		pageSize?: number;
		empty?: string;
		class?: string;
	} = $props();

	const dataStore = writable(untrack(() => data));
	$effect(() => {
		dataStore.set(data);
	});

	const table = createTable(dataStore, {
		sort: addSortBy(),
		page: addPagination({ initialPageSize: untrack(() => pageSizeProp) })
	});

	const tableColumns = table.createColumns(
		untrack(() => columns).map((col) =>
			table.column({
				header: col.header,
				accessor: col.key as string,
				plugins: {
					sort: { disable: !(col.sortable ?? false) }
				}
			})
		)
	);

	const { headerRows, pageRows, pluginStates, tableAttrs, tableBodyAttrs } =
		table.createViewModel(tableColumns);

	const { pageIndex, pageSize, hasPreviousPage, hasNextPage, pageCount } = pluginStates.page;

	// Sync pageSize prop changes
	$effect(() => {
		$pageSize = pageSizeProp;
	});
</script>

<div class="card bg-base-100 shadow {className}">
	<div class="card-body p-0">
		<div class="overflow-x-auto">
			<table class="table" {...$tableAttrs}>
				<thead>
					{#each $headerRows as headerRow (headerRow.id)}
						<Subscribe rowAttrs={headerRow.attrs()} let:rowAttrs>
							<tr {...rowAttrs}>
								{#each headerRow.cells as cell, i (cell.id)}
									<Subscribe attrs={cell.attrs()} props={cell.props()} let:attrs let:props>
										{@const col = columns[i]}
										<th {...attrs} class:cursor-pointer={col.sortable}>
											<div class="flex items-center gap-1">
												{col.header}
												{#if props.sort.order === 'asc'}
													<span class="text-xs">&#9650;</span>
												{:else if props.sort.order === 'desc'}
													<span class="text-xs">&#9660;</span>
												{/if}
											</div>
										</th>
									</Subscribe>
								{/each}
							</tr>
						</Subscribe>
					{/each}
				</thead>
				<tbody {...$tableBodyAttrs}>
					{#each $pageRows as row, idx (row.id)}
						{#if groupBy}
							{@const label = groupBy(row.original)}
							{@const prevLabel = idx > 0 ? groupBy($pageRows[idx - 1].original) : null}
							{#if label !== prevLabel}
								<tr>
									<td colspan={columns.length} class="bg-base-200 text-xs font-semibold uppercase tracking-wide opacity-60 py-2 px-4">
										{label}
									</td>
								</tr>
							{/if}
						{/if}
						{#if rowSnippet}
							{@render rowSnippet(row.original)}
						{:else}
							<Subscribe rowAttrs={row.attrs()} let:rowAttrs>
								<tr {...rowAttrs} class="hover">
									{#each row.cells as cell, i (cell.id)}
										{@const col = columns[i]}
										<Subscribe attrs={cell.attrs()} let:attrs>
											{@const val = cell.isData() ? cell.value : ''}
											<td {...attrs} class={col.class ?? ''}>
												{col.cell ? col.cell(val, row.original) : (val ?? '')}
											</td>
										</Subscribe>
									{/each}
								</tr>
							</Subscribe>
						{/if}
					{:else}
						<tr>
							<td colspan={columns.length} class="text-center opacity-60 py-8">{empty}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if data.length > 0}
			<div class="flex items-center justify-between px-4 py-3">
				<span class="text-sm opacity-60">
					Page {$pageIndex + 1} of {$pageCount}
				</span>
				<div class="join">
					<button
						class="btn join-item btn-sm"
						disabled={!$hasPreviousPage}
						onclick={() => ($pageIndex = 0)}
					>
						&laquo;
					</button>
					<button
						class="btn join-item btn-sm"
						disabled={!$hasPreviousPage}
						onclick={() => $pageIndex--}
					>
						&lsaquo;
					</button>
					<button
						class="btn join-item btn-sm"
						disabled={!$hasNextPage}
						onclick={() => $pageIndex++}
					>
						&rsaquo;
					</button>
					<button
						class="btn join-item btn-sm"
						disabled={!$hasNextPage}
						onclick={() => ($pageIndex = $pageCount - 1)}
					>
						&raquo;
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>
