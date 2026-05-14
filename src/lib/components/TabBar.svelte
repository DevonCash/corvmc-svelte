<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
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
		onchange
	}: {
		tabs: Tab[];
		active: string;
		onchange?: (key: string) => void;
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

<ToggleGroup.Root type="single" value={active} onValueChange={handleValueChange} class="tabs tabs-bordered">
	{#each tabs as tab (tab.key)}
		<ToggleGroup.Item value={tab.key} class="tab {active === tab.key ? 'tab-active' : ''}">
			{tab.label}
			{#if tab.badge != null}
				<span class="badge badge-sm ml-1">{tab.badge}</span>
			{/if}
		</ToggleGroup.Item>
	{/each}
</ToggleGroup.Root>
