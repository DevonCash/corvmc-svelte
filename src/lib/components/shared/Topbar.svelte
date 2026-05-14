<script lang="ts">
	import { IconMenu2 } from '@tabler/icons-svelte';
	import NotificationBell from './NotificationBell.svelte';

	let {
		drawerId,
		userName,
		title = 'CorvMC Staff',
		showNotifications = false
	}: {
		drawerId: string;
		userName: string;
		title?: string;
		showNotifications?: boolean;
	} = $props();
</script>

<nav class="navbar bg-base-100 border-b border-base-300 lg:hidden">
	<div class="flex-none">
		<label for={drawerId} class="btn btn-square btn-ghost">
			<IconMenu2 size={20} />
		</label>
	</div>
	<div class="flex-1">
		<span class="text-lg font-semibold">{title}</span>
	</div>
	<div class="flex-none flex items-center gap-2">
		{#if showNotifications}
			<NotificationBell />
		{/if}
		<span class="text-sm opacity-70">{userName}</span>
	</div>
</nav>
