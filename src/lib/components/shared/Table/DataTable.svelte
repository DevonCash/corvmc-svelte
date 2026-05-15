<script module lang="ts">
	import type { Snippet } from 'svelte';

	// ---------------------------------------------------------------------------
	// Public types
	// ---------------------------------------------------------------------------

	export type ColumnType = 'text' | 'date' | 'datetime' | 'currency' | 'badge';

	/** Internal column definition registered by Column child components. */
	export interface ColumnDef {
		key: string;
		header: string;
		sortable: boolean;
		type: ColumnType;
		class: string;
		shrink: boolean;
		stopClick: boolean;
		cell?: Snippet<[value: any, row: any]>;
	}

	/** Context shape that Column children use to register themselves. */
	export interface DataTableContext {
		register(id: symbol, def: ColumnDef): void;
		unregister(id: symbol): void;
	}

	/**
	 * Legacy column definition — passed as the `columns` prop.
	 * @deprecated Use `<Column>` child components instead.
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

	/** Resolved column used internally — unifies both APIs. */
	interface ResolvedColumn {
		key: string;
		header: string;
		sortable: boolean;
		type: ColumnType;
		class: string;
		shrink: boolean;
		stopClick: boolean;
		cell?: Snippet<[any, any]>;
		legacyCell?: (value: unknown, row: any) => string;
	}
</script>

<script lang="ts" generics="T extends Record<string, any>">
	import { setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { formatDate, formatDateTime, formatCents } from '$lib/utils/format';

	let {
		data,
		columns: columnsProp,
		row: rowSnippet,
		children,
		groupBy,
		rowHref,
		pageSize = 20,
		empty = 'No items found',
		class: className = ''
	}: {
		data: T[];
		/** @deprecated Use `<Column>` child components instead. */
		columns?: Column<T>[];
		/** Full control over row rendering. Receives the sorted row item. */
		row?: Snippet<[T]>;
		/** Column child components register via this slot. */
		children?: Snippet;
		/** Group rows by a label derived from each item. */
		groupBy?: (item: T) => string;
		/** Make rows clickable — returns the href for a given row. */
		rowHref?: (item: T) => string;
		/** Rows per page. Default 20. */
		pageSize?: number;
		/** Message shown when data is empty. */
		empty?: string;
		class?: string;
	} = $props();

	// ---------------------------------------------------------------------------
	// Column registration (new API via child Column components)
	// ---------------------------------------------------------------------------

	let registered = $state<{ id: symbol; def: ColumnDef }[]>([]);

	setContext<DataTableContext>('datatable', {
		register(id, def) {
			registered.push({ id, def });
		},
		unregister(id) {
			registered = registered.filter((c) => c.id !== id);
		}
	});

	// ---------------------------------------------------------------------------
	// Resolve columns: registered children (new) or prop (legacy)
	// ---------------------------------------------------------------------------

	const columns = $derived.by((): ResolvedColumn[] => {
		if (registered.length > 0) {
			return registered.map((c) => c.def);
		}
		if (columnsProp) {
			return columnsProp.map((c) => ({
				key: c.key,
				header: c.header,
				sortable: c.sortable ?? false,
				type: 'text' as ColumnType,
				class: c.class ?? '',
				shrink: false,
				stopClick: false,
				cell: undefined,
				legacyCell: c.cell
			}));
		}
		return [];
	});

	// ---------------------------------------------------------------------------
	// Sorting
	// ---------------------------------------------------------------------------

	let sortKey = $state<string | null>(null);
	let sortDir = $state<'asc' | 'desc'>('asc');

	function toggleSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}

	const sorted = $derived.by(() => {
		if (!sortKey) return data;
		const key = sortKey;
		const dir = sortDir;
		return [...data].sort((a, b) => {
			const va = a[key];
			const vb = b[key];
			if (va == null && vb == null) return 0;
			if (va == null) return 1;
			if (vb == null) return -1;
			// Relies on ISO-8601 strings sorting lexicographically for date/datetime columns
		const cmp = va < vb ? -1 : va > vb ? 1 : 0;
			return dir === 'asc' ? cmp : -cmp;
		});
	});

	// ---------------------------------------------------------------------------
	// Pagination
	// ---------------------------------------------------------------------------

	let pageIndex = $state(0);
	const pageCount = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
	const paged = $derived(sorted.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize));

	// Reset page when data changes (identity or length)
	let prevData = data;
	$effect(() => {
		if (data !== prevData) {
			prevData = data;
			pageIndex = 0;
		}
	});

	// ---------------------------------------------------------------------------
	// Cell formatting (built-in types)
	// ---------------------------------------------------------------------------

	function formatCell(value: unknown, type: ColumnType): string {
		if (value == null) return '—';
		switch (type) {
			case 'date':
				return formatDate(String(value));
			case 'datetime':
				return formatDateTime(String(value));
			case 'currency':
				return formatCents(Number(value));
			default:
				return String(value);
		}
	}
</script>

<!-- Mount Column children (renderless — they just register via context) -->
{@render children?.()}

{#if columns.length > 0}
	<div class="overflow-x-auto">
		<table class="table {className}">
			<thead>
				<tr>
					{#each columns as col, i (i)}
						{#if col.sortable}
							<th class="cursor-pointer" onclick={() => toggleSort(col.key)}>
								<div class="flex items-center gap-1">
									{col.header}
									{#if sortKey === col.key}
										<span class="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
									{/if}
								</div>
							</th>
						{:else}
							<th>{col.header}</th>
						{/if}
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each paged as item, idx (idx)}
					{#if groupBy}
						{@const label = groupBy(item)}
						{@const prevLabel = idx > 0 ? groupBy(paged[idx - 1]) : null}
						{#if label !== prevLabel}
							<tr>
								<td
									colspan={columns.length}
									class="bg-base-200 px-4 py-2 text-xs font-semibold tracking-wide uppercase opacity-60"
								>
									{label}
								</td>
							</tr>
						{/if}
					{/if}

					{#if rowSnippet}
						{@render rowSnippet(item)}
					{:else}
						<tr
							class="hover"
							class:cursor-pointer={!!rowHref}
							onclick={rowHref
								? () => goto(rowHref!(item))
								: undefined}
						>
							{#each columns as col, i (i)}
								<td
									class="{col.class}{col.shrink ? ' w-px' : ''}"
									onclick={col.stopClick ? (e) => e.stopPropagation() : undefined}
								>
									{#if col.cell}
										{@render col.cell(item[col.key], item)}
									{:else if col.type === 'badge'}
										<span class="badge badge-outline badge-sm"
											>{item[col.key] ?? ''}</span
										>
									{:else if col.legacyCell}
										{col.legacyCell(item[col.key], item)}
									{:else}
										{formatCell(item[col.key], col.type)}
									{/if}
								</td>
							{/each}
						</tr>
					{/if}
				{:else}
					<tr>
						<td colspan={columns.length} class="text-center opacity-60 py-8">{empty}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if pageCount > 1}
		<div class="flex items-center justify-between px-4 py-3">
			<span class="text-sm opacity-60">
				Page {pageIndex + 1} of {pageCount}
			</span>
			<div class="join">
				<button
					class="btn join-item btn-sm"
					disabled={pageIndex === 0}
					onclick={() => (pageIndex = 0)}
				>
					&laquo;
				</button>
				<button
					class="btn join-item btn-sm"
					disabled={pageIndex === 0}
					onclick={() => pageIndex--}
				>
					&lsaquo;
				</button>
				<button
					class="btn join-item btn-sm"
					disabled={pageIndex >= pageCount - 1}
					onclick={() => pageIndex++}
				>
					&rsaquo;
				</button>
				<button
					class="btn join-item btn-sm"
					disabled={pageIndex >= pageCount - 1}
					onclick={() => (pageIndex = pageCount - 1)}
				>
					&raquo;
				</button>
			</div>
		</div>
	{/if}
{/if}
