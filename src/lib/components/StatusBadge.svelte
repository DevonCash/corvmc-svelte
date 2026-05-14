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
		IconAlertTriangle
	} from '@tabler/icons-svelte';
	import type { SvelteComponent } from 'svelte';

	type IconComponent = typeof SvelteComponent<any>;

	let {
		status,
		size = 20,
		class: className = ''
	}: {
		status: string;
		size?: number;
		class?: string;
	} = $props();

	type Variant = { icon: IconComponent; color: string };

	const variants: Record<string, Variant> = {
		// Reservation statuses
		scheduled: { icon: IconClock, color: 'text-warning' },
		confirmed: { icon: IconCircleCheck, color: 'text-info' },
		completed: { icon: IconCircleCheckFilled, color: 'text-success' },
		no_show: { icon: IconUserX, color: 'text-error' },
		cancelled: { icon: IconCircleX, color: 'opacity-40' },

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
	const label = $derived(status.replace(/_/g, ' '));
</script>

<span class="{variant.color} {className}" title={label}>
	<variant.icon {size} />
</span>
