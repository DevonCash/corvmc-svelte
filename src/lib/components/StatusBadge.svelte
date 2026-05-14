<script lang="ts">
	/**
	 * Renders a daisyUI badge with a color variant based on the status string.
	 * Extend the `variants` map as new statuses are introduced.
	 */

	let {
		status,
		class: className = ''
	}: {
		status: string;
		class?: string;
	} = $props();

	const variants: Record<string, string> = {
		// Reservation statuses
		scheduled: 'badge-warning',
		confirmed: 'badge-info',
		completed: 'badge-success',
		no_show: 'badge-error',
		cancelled: 'badge-ghost',

		// Event statuses
		draft: 'badge-warning',
		published: 'badge-success',

		// Generic
		active: 'badge-success',
		pending: 'badge-warning',
		error: 'badge-error'
	};

	const badgeClass = $derived(variants[status] ?? 'badge-ghost');
	const label = $derived(status.replace(/_/g, ' '));
</script>

<span class="badge {badgeClass} {className}">{label}</span>
