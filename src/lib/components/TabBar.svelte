<script lang="ts">
	import { Tabs } from 'bits-ui';
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
		const tab = tabs.find((t) => t.key === value);
		if (tab?.href) {
			goto(tab.href);
		} else {
			onchange?.(value);
		}
	}
</script>

<Tabs.Root value={active} onValueChange={handleValueChange}>
	<Tabs.List class="tabs tabs-bordered">
		{#each tabs as tab (tab.key)}
			<Tabs.Trigger value={tab.key} class="tab {active === tab.key ? 'tab-active' : ''}">
				{tab.label}
				{#if tab.badge != null}
					<span class="badge badge-sm ml-1">{tab.badge}</span>
				{/if}
			</Tabs.Trigger>
		{/each}
	</Tabs.List>
</Tabs.Root>
