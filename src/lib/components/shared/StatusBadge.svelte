<script lang="ts">
	/**
	 * Renders a colored icon with a tooltip label based on the status string.
	 * Extend the `variants` map as new statuses are introduced.
	 */
	import {
		IconClock,
		IconCircleCheck,
		IconCircleCheckFilled,
		IconUserX,
		IconCircleX,
		IconPencil,
		IconWorld,
		IconAlertTriangle,
		IconArrowBackUp
	} from '@tabler/icons-svelte';
	import { Tooltip } from 'bits-ui';
	import type { SvelteComponent } from 'svelte';

	type IconComponent = typeof SvelteComponent<any>;

	let {
		status,
		size = 20,
		label: showLabel = false,
		class: className = ''
	}: {
		status: string;
		size?: number;
		label?: boolean;
		class?: string;
	} = $props();

	const badgeClass: Record<string, string> = {
		scheduled: 'badge-warning',
		confirmed: 'badge-info',
		completed: 'badge-success',
		no_show: 'badge-error',
		cancelled: 'badge-ghost',
		refunded: 'badge-error',
		draft: 'badge-warning',
		published: 'badge-success',
		active: 'badge-success',
		pending: 'badge-warning',
		error: 'badge-error'
	};

	type Variant = { icon: IconComponent; color: string };

	const variants: Record<string, Variant> = {
		// Reservation statuses
		scheduled: { icon: IconClock, color: 'text-warning' },
		confirmed: { icon: IconCircleCheck, color: 'text-info' },
		completed: { icon: IconCircleCheckFilled, color: 'text-success' },
		no_show: { icon: IconUserX, color: 'text-error' },
		cancelled: { icon: IconCircleX, color: 'text-base-content' },
		refunded: { icon: IconArrowBackUp, color: 'text-error' },

		// Event statuses
		draft: { icon: IconPencil, color: 'text-warning' },
		published: { icon: IconWorld, color: 'text-success' },

		// Generic
		active: { icon: IconCircleCheck, color: 'text-success' },
		pending: { icon: IconClock, color: 'text-warning' },
		error: { icon: IconAlertTriangle, color: 'text-error' }
	};

	const fallback: Variant = { icon: IconCircleX, color: 'opacity-40' };
	const variant = $derived(variants[status] ?? fallback);
	const label = $derived.by(() => {
		const s = status.replace(/_/g, ' ');
		return s.charAt(0).toUpperCase() + s.slice(1);
	});
</script>

{#if showLabel}
	<span class="badge badge-sm gap-1 {badgeClass[status] ?? 'badge-ghost'} {className}">
		<variant.icon size={14} />
		{label}
	</span>
{:else}
	<span class="tooltip tooltip-right" data-tip={label}>
		<variant.icon {size} class="{variant.color} {className}"/>
	</span>
{/if}
