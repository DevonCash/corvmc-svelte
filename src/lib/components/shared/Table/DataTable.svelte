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
		headerCell?: Snippet;
		align?: 'left' | 'right' | 'center';
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
		/** Property key on the data object, or a virtual key for custom row snippets. */
		key: (string & keyof T) | (string & {});
		/** Header label text. */
		header: string;
		/** Enable sorting on this column. Default: false. */
		sortable?: boolean;
		/** Format the cell value as text. Receives (value, row). Falls back to raw value. */
		cell?: (value: unknown, row: T) => string;
		/** Extra CSS classes on the <td>. */
		class?: string;
		/** Text alignment. Default: 'left'. */
		align?: 'left' | 'right' | 'center';
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
		headerCell?: Snippet;
		legacyCell?: (value: unknown, row: any) => string;
	}
</script>

<script lang="ts" generics="T extends Record<string, any>">
	import { setContext, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { formatDate, formatDateTime, formatCents } from '$lib/utils/format';

	let {
		data,
		columns: columnsProp,
		row: rowSnippet,
		card: cardSnippet,
		children,
		toolbar,
		groupBy,
		rowHref,
		clearHref,
		pageSize = 20,
		pagination,
		buildPageHref,
		empty = 'No items found',
		gridClass = 'grid grid-cols-1 gap-3',
		class: className = ''
	}: {
		data: T[];
		/** @deprecated Use `<Column>` child components instead. */
		columns?: Column<T>[];
		/** Full control over row rendering. Receives the sorted row item. */
		row?: Snippet<[T]>;
		/** Card layout mode. Renders a CSS grid of cards instead of a table. */
		card?: Snippet<[T]>;
		/** Column child components register via this slot. */
		children?: Snippet;
		/** Filter controls rendered above the table inside a GET form. */
		toolbar?: Snippet;
		/** Group rows by a label derived from each item. */
		groupBy?: (item: T) => string;
		/** Make rows clickable — returns the href for a given row. */
		rowHref?: (item: T) => string;
		/** Href for the "Clear" filter link. Shown when any filter field has a value. */
		clearHref?: string;
		/** Rows per page. Default 20. */
		pageSize?: number;
		/** Server-side pagination metadata. When provided, skips client-side slicing. */
		pagination?: { page: number; totalPages: number };
		/** Generates the href for a given page number. Required when pagination is set. */
		buildPageHref?: (page: number) => string;
		/** Message shown when data is empty. */
		empty?: string;
		/** CSS classes for the card grid container. Default: 'grid grid-cols-1 gap-3'. */
		gridClass?: string;
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
	const displayRows = $derived(pagination ? sorted : paged);

	// Reset page when data changes (identity or length)
	let prevData = untrack(() => data);
	$effect(() => {
		if (data !== prevData) {
			prevData = data;
			pageIndex = 0;
		}
	});

	// ---------------------------------------------------------------------------
	// Toolbar / filter form
	// ---------------------------------------------------------------------------

	let filterFormEl = $state<HTMLFormElement>();

	const hasActiveFilters = $derived.by(() => {
		if (!filterFormEl) return false;
		for (const el of filterFormEl.querySelectorAll('[data-filter]')) {
			if ((el as HTMLInputElement).value?.trim() !== '') return true;
		}
		return false;
	});

	// ---------------------------------------------------------------------------
	// Cell formatting (built-in types)
	// ---------------------------------------------------------------------------

	const isCardMode = $derived(!!cardSnippet);
	const sortableColumns = $derived(columns.filter((c) => c.sortable));

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

{#if toolbar}
	<form method="get" class="flex flex-wrap items-end gap-2" bind:this={filterFormEl}>
		{@render toolbar()}
		<button type="submit" class="btn btn-sm btn-primary">Filter</button>
		{#if clearHref && hasActiveFilters}
			<a href={clearHref} class="btn btn-ghost btn-sm">Clear</a>
		{/if}
	</form>
{/if}

{#if isCardMode}
	<!-- Card mode: sort dropdown -->
	{#if sortableColumns.length > 0}
		<div class="flex items-center gap-2">
			<span class="text-sm opacity-60">Sort by</span>
			<select
				class="select select-bordered select-sm"
				value={sortKey ?? ''}
				onchange={(e) => {
					const val = e.currentTarget.value;
					if (val) toggleSort(val); else { sortKey = null; }
				}}
			>
				<option value="">Default</option>
				{#each sortableColumns as col}
					<option value={col.key}>{col.header}</option>
				{/each}
			</select>
			{#if sortKey}
				<button
					type="button"
					class="btn btn-ghost btn-sm btn-square"
					onclick={() => (sortDir = sortDir === 'asc' ? 'desc' : 'asc')}
					title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
				>
					{sortDir === 'asc' ? '▲' : '▼'}
				</button>
			{/if}
		</div>
	{/if}

	<!-- Card mode: grid -->
	{#if paged.length > 0}
		<div class="@container {gridClass}">
			{#each displayRows as item, idx (idx)}
				{#if groupBy}
					{@const label = groupBy(item)}
					{@const prevLabel = idx > 0 ? groupBy(displayRows[idx - 1]) : null}
					{#if label !== prevLabel}
						<div class="col-span-full py-2 text-xs font-semibold tracking-wide uppercase opacity-60">
							{label}
						</div>
					{/if}
				{/if}
				{@render cardSnippet!(item)}
			{/each}
		</div>
	{:else}
		<p class="text-center opacity-60 py-8">{empty}</p>
	{/if}
{:else if columns.length > 0}
	<!-- Table mode -->
	<div class="overflow-x-auto">
		<table class="table {className}">
			<thead>
				<tr>
					{#each columns as col, i (i)}
						{#if col.sortable}
							<th class="cursor-pointer" onclick={() => toggleSort(col.key)}>
								<div class="flex items-center gap-1">
									{#if col.headerCell}{@render col.headerCell()}{:else}{col.header}{/if}
									{#if sortKey === col.key}
										<span class="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
									{/if}
								</div>
							</th>
						{:else}
							<th>{#if col.headerCell}{@render col.headerCell()}{:else}{col.header}{/if}</th>
						{/if}
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each displayRows as item, idx (idx)}
					{#if groupBy}
						{@const label = groupBy(item)}
						{@const prevLabel = idx > 0 ? groupBy(displayRows[idx - 1]) : null}
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
								? () => { goto(rowHref!(item)); }
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
										<Badge variant="outline">{item[col.key] ?? ''}</Badge>
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
{/if}

{#if pagination && buildPageHref}
	{#if pagination.totalPages > 1}
		<div class="flex justify-center py-3">
			<div class="join">
				{#if pagination.page > 1}
					<a href={buildPageHref(pagination.page - 1)} class="join-item btn btn-sm">«</a>
				{/if}
				{#each Array.from({ length: pagination.totalPages }, (_, i) => i + 1) as p (p)}
					<a
						href={buildPageHref(p)}
						class="join-item btn btn-sm"
						class:btn-active={p === pagination.page}
					>
						{p}
					</a>
				{/each}
				{#if pagination.page < pagination.totalPages}
					<a href={buildPageHref(pagination.page + 1)} class="join-item btn btn-sm">»</a>
				{/if}
			</div>
		</div>
	{/if}
{:else if pageCount > 1}
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
