<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import { Toaster } from 'svelte-sonner';
	import AppTopbar from './AppTopbar.svelte';
	import type { PanelTab } from './AppTopbar.svelte';
	import Sidebar from './Sidebar.svelte';

	let {
		drawerId,
		user,
		panels,
		activePanel,
		brand: brandSnippet,
		navigation: navSnippet,
		children
	}: {
		drawerId: string;
		user: { name: string; email: string };
		panels: PanelTab[];
		activePanel: string;
		brand?: Snippet;
		navigation: Snippet;
		children: Snippet;
	} = $props();

	let mounted = $state(false);
	onMount(() => (mounted = true));
</script>

{#if mounted}
	<Toaster position="bottom-right" richColors closeButton />
{/if}

<AppTopbar {drawerId} {user} {panels} {activePanel} />
<div class="tri-stripe"></div>

<div class="drawer lg:drawer-open">
	<input id={drawerId} type="checkbox" class="drawer-toggle" />

	<div class="drawer-content flex flex-col">
		<main class="flex-1 p-6">
			{@render children()}
		</main>
	</div>

	<div class="drawer-side z-40">
		<label for={drawerId} class="drawer-overlay"></label>
		<Sidebar>
			{#snippet brand()}
				{@render brandSnippet?.()}

				<!-- Mobile panel nav -->
				<div class="lg:hidden border-b border-base-300 px-4 py-2">
					<select
						class="select select-sm select-bordered w-full"
						value={activePanel}
						onchange={(e) => {
							const panel = panels.find((p) => p.key === e.currentTarget.value);
							if (panel) window.location.href = panel.href;
						}}
					>
						{#each panels as panel (panel.key)}
							<option value={panel.key}>{panel.label}</option>
						{/each}
					</select>
				</div>
			{/snippet}
			{#snippet navigation()}
				{@render navSnippet()}
			{/snippet}
		</Sidebar>
	</div>
</div>
