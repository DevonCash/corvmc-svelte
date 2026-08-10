<script lang="ts">
	import { ToggleGroup } from 'bits-ui';
	import Badge from '$lib/components/shared/Badge.svelte';
	import ButtonGroup from '$lib/components/shared/ButtonGroup.svelte';

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

	// Two rendering modes, because a tab that navigates and a tab that flips local
	// state are different things. Link tabs render real anchors rather than a
	// ToggleGroup of buttons calling goto(), so the destination is a real link:
	// middle-click and open-in-new-tab work, the target is copyable, and
	// SvelteKit's router handles the click without any goto() of ours. A
	// ToggleGroup of links would also be the wrong role — these are navigations,
	// not a pressed state.
	//
	// Note this does not make the tab crawlable today: every page under
	// `(public)` currently server-renders as the layout boundary's pending
	// spinner, so no initial HTML carries these anchors either way.
	const asLinks = $derived(tabs.some((t) => t.href));

	function itemClass(key: string) {
		return `join-item btn btn-sm ${key === active ? 'latched btn-primary depth-0' : 'depth-2'}`;
	}

	function handleValueChange(value: string) {
		if (value === active) return;
		onchange?.(value);
	}
</script>

{#snippet contents(tab: Tab)}
	{tab.label}
	{#if tab.badge != null}
		<Badge class="ml-1">{tab.badge}</Badge>
	{/if}
{/snippet}

{#if asLinks}
	<ButtonGroup class={className}>
		{#each tabs as tab (tab.key)}
			<a
				href={tab.href}
				class={itemClass(tab.key)}
				aria-current={tab.key === active ? 'page' : undefined}
			>
				{@render contents(tab)}
			</a>
		{/each}
	</ButtonGroup>
{:else}
	<ToggleGroup.Root type="single" value={active} onValueChange={handleValueChange}>
		<ButtonGroup class={className}>
			{#each tabs as tab (tab.key)}
				<ToggleGroup.Item value={tab.key} class={itemClass(tab.key)}>
					{@render contents(tab)}
				</ToggleGroup.Item>
			{/each}
		</ButtonGroup>
	</ToggleGroup.Root>
{/if}
