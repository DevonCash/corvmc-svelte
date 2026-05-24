<script lang="ts" generics="T extends Record<string, any>">
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { DataTableContext, ColumnDef, ColumnType } from './DataTable.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { formatDate, formatDateTime, formatCents } from '$lib/utils/format';
	import type { ISODateString } from '$lib/server/db/schema/columns';

	let {
		data,
		empty = 'No items',
		class: className = '',
		children
	}: {
		data: T[];
		empty?: string;
		class?: string;
		children: Snippet;
	} = $props();

	let registered = $state<{ id: symbol; def: ColumnDef }[]>([]);

	setContext<DataTableContext>('datatable', {
		register(id, def) {
			registered.push({ id, def });
		},
		unregister(id) {
			registered = registered.filter((c) => c.id !== id);
		}
	});

	const columns = $derived(registered.map((c) => c.def));

	function formatCell(value: unknown, type: ColumnType): string {
		if (value == null) return '—';
		switch (type) {
			case 'date':
				return formatDate(String(value) as ISODateString);
			case 'datetime':
				return formatDateTime(String(value) as ISODateString);
			case 'currency':
				return formatCents(Number(value));
			default:
				return String(value);
		}
	}
</script>

{@render children()}

{#if columns.length > 0}
	<div class="overflow-x-auto">
		<table class="table table-sm {className}">
			<thead>
				<tr>
					{#each columns as col (col.key)}
						<th class={col.class}>
							{#if col.headerCell}{@render col.headerCell()}{:else}{col.header}{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each data as item, idx (idx)}
					<tr>
						{#each columns as col (col.key)}
							<td class="{col.class}{col.shrink ? ' w-px' : ''}">
								{#if col.cell}
									{@render col.cell(item[col.key], item)}
								{:else if col.type === 'badge'}
									<Badge variant="outline">{item[col.key] ?? ''}</Badge>
								{:else}
									{formatCell(item[col.key], col.type)}
								{/if}
							</td>
						{/each}
					</tr>
				{:else}
					<tr>
						<td colspan={columns.length} class="text-center opacity-60">{empty}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
