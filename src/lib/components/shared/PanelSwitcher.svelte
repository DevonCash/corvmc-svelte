<script lang="ts">
	let { current }: { current: 'member' | 'staff' } = $props();
</script>

<div class="flex gap-1 px-4 pb-2">
	<a
		href="/member"
		class="btn btn-sm flex-1 {current === 'member' ? 'btn-primary' : 'btn-ghost'}"
	>
		Member
	</a>
	<a
		href="/staff"
		class="btn btn-sm flex-1 {current === 'staff' ? 'btn-primary' : 'btn-ghost'}"
	>
		Staff
	</a>
</div>
