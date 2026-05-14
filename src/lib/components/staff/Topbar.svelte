<script lang="ts">
	import { IconMenu2 } from '@tabler/icons-svelte';

	let {
		drawerId,
		userName
	}: {
		drawerId: string;
		userName: string;
	} = $props();
</script>

<nav class="navbar bg-base-100 border-b border-base-300 lg:hidden">
	<div class="flex-none">
		<label for={drawerId} class="btn btn-square btn-ghost">
			<IconMenu2 size={20} />
		</label>
	</div>
	<div class="flex-1">
		<span class="text-lg font-semibold">CorvMC Staff</span>
	</div>
	<div class="flex-none">
		<span class="text-sm opacity-70">{userName}</span>
	</div>
</nav>
