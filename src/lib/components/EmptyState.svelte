<script lang="ts">
	let {
		message = 'No items found.',
		class: className = ''
	}: {
		message?: string;
		class?: string;
	} = $props();
</script>

<p class="text-center py-12 opacity-60 {className}">{message}</p>
