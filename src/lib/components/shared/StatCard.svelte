<script lang="ts">
	let { title, value }: { title: string; value: string | number } = $props();
</script>

<div class="stat bg-base-100 rounded-box shadow">
	<div class="stat-title">{title}</div>
	<div class="stat-value">{value}</div>
</div>
