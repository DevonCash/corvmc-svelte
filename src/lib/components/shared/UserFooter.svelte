<script lang="ts">
	let {
		name,
		email
	}: {
		name: string;
		email: string;
	} = $props();
</script>

<div class="border-t border-base-300 p-4">
	<div class="flex items-center gap-3">
		<div class="avatar placeholder">
			<div class="bg-neutral text-neutral-content w-8 rounded-full">
				<span class="text-xs">{name.charAt(0).toUpperCase()}</span>
			</div>
		</div>
		<div class="flex-1 truncate">
			<p class="text-sm font-medium truncate">{name}</p>
			<p class="text-xs opacity-60 truncate">{email}</p>
		</div>
	</div>
</div>
