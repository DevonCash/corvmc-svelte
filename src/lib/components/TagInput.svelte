<script lang="ts">
	import { Combobox } from 'bits-ui';

	let {
		options,
		value = [],
		name,
		placeholder = 'Type to search...'
	}: {
		options: { id: string; label: string }[];
		value?: string[];
		name: string;
		placeholder?: string;
	} = $props();

	let selected = $state<string[]>([]);
	let query = $state('');
	let selectEl: HTMLSelectElement | undefined = $state();

	// Sync internal state from the prop (initial mount + after a save refreshes the query)
	$effect(() => {
		selected = [...value];
	});

	let filtered = $derived(
		query
			? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
			: options
	);

	let selectedOptions = $derived(
		options.filter((o) => selected.includes(o.id))
	);

	function remove(id: string) {
		selected = selected.filter((s) => s !== id);
	}

	// Sync the hidden select when selections change, so FormData stays current
	let initialized = false;
	$effect(() => {
		if (!selectEl) return;
		for (const option of selectEl.options) {
			option.selected = selected.includes(option.value);
		}
		// Skip the change event on initial mount — only notify the form of actual user changes
		if (initialized) {
			selectEl.dispatchEvent(new Event('change', { bubbles: true }));
		}
		initialized = true;
	});
</script>

<!-- Hidden select for form submission -->
<select bind:this={selectEl} {name} multiple class="hidden" tabindex="-1" aria-hidden="true">
	{#each options as opt (opt.id)}
		<option value={opt.id}>{opt.label}</option>
	{/each}
</select>

<Combobox.Root type="multiple" bind:value={selected} inputValue={query}>
	<div class="space-y-2">
		{#if selectedOptions.length > 0}
			<div class="flex flex-wrap gap-1">
				{#each selectedOptions as opt (opt.id)}
					<span class="badge badge-primary gap-[1px] pr-0 overflow-clip">
						{opt.label}
						<button
							type="button"
							class="btn btn-ghost btn-xs px-1 mx-[1.5px] h-auto min-h-0 rounded-[6px]"
							onclick={(e) => { e.stopPropagation(); remove(opt.id); }}
							aria-label="Remove {opt.label}"
						>✕</button>
					</span>
				{/each}
			</div>
		{/if}

		<div class="relative">
			<Combobox.Input
				{placeholder}
				class="input input-bordered w-full"
				oninput={(e: Event) => query = (e.target as HTMLInputElement).value}
			/>

			<Combobox.Content
				class="menu bg-base-100 rounded-box shadow-lg z-10 w-full max-h-60 overflow-y-auto p-1"
				sideOffset={4}
			>
				{#each filtered as opt (opt.id)}
					<Combobox.Item
						value={opt.id}
						label={opt.label}
						class="rounded-btn px-3 py-2 cursor-pointer data-[highlighted]:bg-base-200 data-[selected]:font-bold"
					>
						{opt.label}
					</Combobox.Item>
				{:else}
					<div class="px-3 py-2 opacity-60">No results</div>
				{/each}
			</Combobox.Content>
		</div>
	</div>
</Combobox.Root>
