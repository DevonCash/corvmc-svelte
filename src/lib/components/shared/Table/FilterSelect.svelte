<script lang="ts">
	let {
		name,
		value = '',
		placeholder = 'All',
		options,
		class: className = ''
	}: {
		name: string;
		value?: string;
		placeholder?: string;
		options: readonly string[] | readonly [string, string][] | readonly { value: string; label: string }[];
		class?: string;
	} = $props();

	const normalized = $derived(
		options.map((o) => {
			if (typeof o === 'string') return { value: o, label: o.replaceAll('_', ' ') };
			if (Array.isArray(o)) return { value: o[0], label: o[1] };
			return o;
		})
	);
</script>

<select {name} data-filter class="select-bordered select select-sm {className}">
	<option value="">{placeholder}</option>
	{#each normalized as opt}
		<option value={opt.value} selected={value === opt.value}>{opt.label}</option>
	{/each}
</select>
