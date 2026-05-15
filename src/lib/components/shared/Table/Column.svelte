<script lang="ts">
	import { getContext, onDestroy, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { DataTableContext, ColumnType } from './DataTable.svelte';

	let {
		key,
		header,
		sortable = false,
		type = 'text' as ColumnType,
		class: className = '',
		shrink = false,
		stopClick = false,
		cell
	}: {
		key: string;
		header: string;
		sortable?: boolean;
		type?: ColumnType;
		class?: string;
		shrink?: boolean;
		stopClick?: boolean;
		cell?: Snippet<[value: any, row: any]>;
	} = $props();

	const ctx = getContext<DataTableContext>('datatable');
	const colId = Symbol();

	untrack(() => {
		ctx.register(colId, {
			key,
			header,
			sortable,
			type,
			class: className,
			shrink,
			stopClick,
			cell
		});
	});

	onDestroy(() => ctx.unregister(colId));
</script>
