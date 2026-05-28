<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import Badge from '$lib/components/shared/Badge.svelte';
	import ButtonGroup from '$lib/components/shared/ButtonGroup.svelte';
	import { goto } from '$app/navigation';

	type Tab = {
		key: string;
		label: string;
		badge?: string | number;
		href?: string;
	};

	let {
		tabs,
		active,
		onchange,
		class: className = ''
	}: {
		tabs: Tab[];
		active: string;
		onchange?: (key: string) => void;
		class?: string;
	} = $props();

	function handleValueChange(value: string) {
		if (value === active) return;
		const tab = tabs.find((t) => t.key === value);
		if (tab?.href) {
			goto(tab.href);
		} else {
			onchange?.(value);
		}
	}
</script>

<ToggleGroup.Root type="single" value={active} onValueChange={handleValueChange}>
	<ButtonGroup class={className}>
		{#each tabs as tab (tab.key)}
			<ToggleGroup.Item value={tab.key} class="join-item btn btn-sm {active === tab.key ? 'latched btn-primary depth-0' : 'depth-2'}">
				{tab.label}
				{#if tab.badge != null}
					<Badge class="ml-1">{tab.badge}</Badge>
				{/if}
			</ToggleGroup.Item>
		{/each}
	</ButtonGroup>
</ToggleGroup.Root>
