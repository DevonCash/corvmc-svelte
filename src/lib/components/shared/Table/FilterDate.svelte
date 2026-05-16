<script lang="ts">
	let {
		name,
		value = '',
		class: className = ''
	}: {
		name: string;
		value?: string;
		class?: string;
	} = $props();
</script>

<input
	type="date"
	{name}
	{value}
	data-filter
	class="input-bordered input input-sm {className}"
/>
