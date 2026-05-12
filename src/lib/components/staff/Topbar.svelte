<script lang="ts">
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
			<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
			</svg>
		</label>
	</div>
	<div class="flex-1">
		<span class="text-lg font-semibold">CorvMC Staff</span>
	</div>
	<div class="flex-none">
		<span class="text-sm opacity-70">{userName}</span>
	</div>
</nav>
