<script lang="ts">
	type Tab = {
		key: string;
		label: string;
	};

	let {
		tabs,
		active,
		onchange
	}: {
		tabs: Tab[];
		active: string;
		onchange?: (key: string) => void;
	} = $props();
</script>

<div class="button-group">
	{#each tabs as tab, i (tab.key)}
		{@const isActive = tab.key === active}
		{@const hasUnlatchedRight = isActive && i < tabs.length - 1 && tabs[i + 1].key !== active}
		<button
			class="btn"
			class:btn-primary={isActive}
			class:latched={isActive}
			style:z-index={hasUnlatchedRight ? 1 : undefined}
			onclick={() => onchange?.(tab.key)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	.button-group {
		display: inline-flex;
	}

	.button-group > .btn {
		border-radius: 0;
	}

	.button-group > .btn:first-child {
		border-start-start-radius: var(--radius-field);
		border-end-start-radius: var(--radius-field);
	}

	.button-group > .btn:last-child {
		border-start-end-radius: var(--radius-field);
		border-end-end-radius: var(--radius-field);
	}

	.button-group > .btn:not(:first-child) {
		margin-inline-start: -2.5px;
	}
</style>
