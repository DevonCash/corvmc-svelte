<script lang="ts">
	let {
		name = 'q',
		value = '',
		placeholder = 'Search...',
		class: className = 'w-48'
	}: {
		name?: string;
		value?: string;
		placeholder?: string;
		class?: string;
	} = $props();
</script>

<input
	type="text"
	{name}
	{value}
	{placeholder}
	data-filter
	class="input-bordered input input-sm {className}"
/>
