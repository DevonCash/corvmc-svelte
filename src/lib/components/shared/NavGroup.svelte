<script lang="ts">
	const { title, children } = $props();
</script>

<li class="menu-title">{title}</li>
<ul>{@render children()}</ul>
