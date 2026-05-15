<script lang="ts">
	import { page } from '$app/state';
	import { IconMenu2, IconMusic, IconChevronDown } from '@tabler/icons-svelte';
	import NotificationBell from './NotificationBell.svelte';
	import AccountDropdown from './AccountDropdown.svelte';

	export interface PanelTab {
		key: string;
		label: string;
		href: string;
		type: 'member' | 'staff' | 'band';
	}

	let {
		drawerId,
		user,
		panels,
		activePanel
	}: {
		drawerId: string;
		user: { name: string; email: string };
		panels: PanelTab[];
		activePanel: string;
	} = $props();

	const primaryPanels = $derived(panels.filter((p) => p.type !== 'band'));
	const bandPanels = $derived(panels.filter((p) => p.type === 'band'));
	const activeBand = $derived(bandPanels.find((b) => b.key === activePanel));

	let bandsOpen = $state(false);

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.bands-dropdown-wrapper')) {
			bandsOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<nav class="navbar bg-base-100 border-b border-base-300 z-50 min-h-0 px-3 py-1.5">
	<!-- Left: hamburger (mobile) + brand + panel tabs (desktop) -->
	<div class="flex-1 flex items-center gap-1">
		<label for={drawerId} class="btn btn-square btn-ghost btn-sm lg:hidden">
			<IconMenu2 size={20} />
		</label>

		<a href="/member" class="text-lg font-bold hidden lg:inline">CorvMC</a>

		<!-- Panel tabs - desktop only -->
		<div class="hidden lg:flex items-center gap-1 ml-4">
			{#each primaryPanels as panel (panel.key)}
				<a
					href={panel.href}
					class="btn btn-sm {panel.key === activePanel ? 'btn-primary' : 'btn-ghost'}"
				>
					{panel.label}
				</a>
			{/each}

			{#if bandPanels.length > 0}
				<div class="bands-dropdown-wrapper relative">
					<button
						class="btn btn-sm gap-1 {activeBand ? 'btn-primary' : 'btn-ghost'}"
						onclick={() => (bandsOpen = !bandsOpen)}
					>
						<IconMusic size={16} />
						{activeBand?.label ?? 'Bands'}
						<IconChevronDown size={14} />
					</button>

					{#if bandsOpen}
						<div
							class="absolute left-0 top-full z-[1000] mt-1 w-48 rounded-lg border border-base-300 bg-base-100 shadow-lg"
						>
							<ul class="menu menu-sm p-2">
								{#each bandPanels as band (band.key)}
									<li>
										<a
											href={band.href}
											class:active={band.key === activePanel}
											onclick={() => (bandsOpen = false)}
										>
											{band.label}
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Mobile brand -->
		<span class="text-lg font-bold lg:hidden">CorvMC</span>
	</div>

	<!-- Right: notifications + account -->
	<div class="flex-none flex items-center gap-1">
		<NotificationBell />
		<AccountDropdown {user} />
	</div>
</nav>
