<script lang="ts" generics="T extends Record<string, any>">
	import { IconX } from '@tabler/icons-svelte';
	import { Combobox } from 'bits-ui';

	let {
		search,
		value = $bindable(null),
		labelKey = 'name' as keyof T & string,
		descriptionKey = 'email' as keyof T & string,
		placeholder = 'Search by name or email...',
		minChars = 2,
		name
	}: {
		search: (query: string) => Promise<T[]>;
		value?: T | null;
		labelKey?: keyof T & string;
		descriptionKey?: keyof T & string;
		placeholder?: string;
		minChars?: number;
		name?: string;
	} = $props();

	let query = $state('');
	let comboValue = $state<string[]>([]);

	const results = $derived(query.length >= minChars ? await search(query) : []);

	$effect(() => {
		if (comboValue.length > 0) {
			const id = comboValue[0];
			const found = results.find((r) => r.id === id);
			if (found) {
				value = found;
				query = '';
			}
		}
	});

	function clear() {
		value = null;
		comboValue = [];
	}
</script>

{#if name && value}
	<input type="hidden" {name} value={value.id} />
{/if}

{#if value}
	<div class="flex items-center gap-2">
		<div class="badge gap-2 badge-lg">
			{value[labelKey]}
			<button type="button" class="btn btn-circle btn-ghost btn-xs" onclick={clear}>✕</button>
		</div>
		{#if value[descriptionKey]}
			<span class="text-sm opacity-60">{value[descriptionKey]}</span>
		{/if}
	</div>
{:else}
	<svelte:boundary>
		<Combobox.Root type="multiple" bind:value={comboValue} inputValue={query}>
			<div class="relative">
				<Combobox.Input
					{placeholder}
					class="input-bordered input w-full"
					oninput={(e: Event) => {
						query = (e.target as HTMLInputElement).value;
					}}
				/>
				<Combobox.Content
					class="menu z-10 max-h-40 w-full overflow-y-auto rounded-box bg-base-100 p-1 shadow-lg"
					sideOffset={4}
				>
					{#each results as item (item.id)}
						<Combobox.Item
							value={item.id}
							label={item[labelKey]}
							class="rounded-btn cursor-pointer px-3 py-2 data-[highlighted]:bg-base-200"
						>
							<span class="font-medium">{item[labelKey]}</span>
							{#if item[descriptionKey]}
								<span class="ml-2 text-sm opacity-60">{item[descriptionKey]}</span>
							{/if}
						</Combobox.Item>
					{:else}
						{#if query.length >= minChars}
							<div class="px-3 py-2 opacity-60">No results</div>
						{:else}
							<div class="px-3 py-2 opacity-60">Type to search...</div>
						{/if}
					{/each}
				</Combobox.Content>
			</div>
		</Combobox.Root>

		{#snippet pending()}
			<div class="flex items-center gap-2 p-2">
				<span class="loading loading-spinner loading-sm"></span>
				<span class="text-sm opacity-60">Searching...</span>
			</div>
		{/snippet}
	</svelte:boundary>
{/if}
