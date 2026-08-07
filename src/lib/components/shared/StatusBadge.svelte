<script module lang="ts">
	/**
	 * Renders a colored icon with a tooltip label based on the status string,
	 * or a labelled badge when `label` is set.
	 *
	 * `variants` and `badgeClass` are exported so `StatusBadge.spec.ts` can assert
	 * that every status enum in the app is covered. Add the entry here whenever a
	 * new status value is introduced — an unmapped status renders the neutral
	 * fallback dot, which says nothing.
	 */
	import {
		IconClock,
		IconCircleCheck,
		IconCircleCheckFilled,
		IconUserX,
		IconCircleX,
		IconCircleOff,
		IconPencil,
		IconWorld,
		IconAlertTriangle,
		IconArrowBackUp,
		IconClockPause,
		IconInboxOff,
		IconAlarmSnooze,
		IconCrown,
		IconShield,
		IconUser,
		IconTool,
		IconArchive,
		IconPackageExport,
		IconPackageImport,
		IconTicket,
		IconSend,
		IconMailCheck,
		IconBan,
		IconStar,
		IconPointFilled
	} from '@tabler/icons-svelte';
	import type { SvelteComponent } from 'svelte';

	type IconComponent = typeof SvelteComponent<any>;

	export type StatusVariant = { icon: IconComponent; color: string };

	export const badgeClass: Record<string, string> = {
		// Reservations
		scheduled: 'badge-warning',
		confirmed: 'badge-info',
		completed: 'badge-success',
		no_show: 'badge-error',
		cancelled: 'badge-ghost',
		waitlisted: 'badge-ghost',
		refunded: 'badge-error',
		// Events
		draft: 'badge-warning',
		published: 'badge-success',
		// Inbox
		open: 'badge-info',
		resolved: 'badge-success',
		dismissed: 'badge-ghost',
		snoozed: 'badge-ghost',
		// Band roles
		owner: 'badge-warning',
		admin: 'badge-info',
		member: 'badge-ghost',
		// Equipment
		available: 'badge-success',
		maintenance: 'badge-warning',
		retired: 'badge-ghost',
		// Equipment loans
		requested: 'badge-warning',
		checked_out: 'badge-info',
		returned: 'badge-success',
		// Tickets
		valid: 'badge-info',
		checked_in: 'badge-success',
		// Band tiers
		free: 'badge-ghost',
		premium: 'badge-warning',
		// Campaigns
		sending: 'badge-info',
		sent: 'badge-success',
		// Platform invites
		accepted: 'badge-success',
		revoked: 'badge-error',
		// Generic
		active: 'badge-success',
		deactivated: 'badge-ghost',
		pending: 'badge-warning',
		error: 'badge-error'
	};

	export const variants: Record<string, StatusVariant> = {
		// Reservation statuses
		scheduled: { icon: IconClock, color: 'text-warning' },
		confirmed: { icon: IconCircleCheck, color: 'text-info' },
		completed: { icon: IconCircleCheckFilled, color: 'text-success' },
		no_show: { icon: IconUserX, color: 'text-error' },
		cancelled: { icon: IconCircleX, color: 'text-base-content' },
		waitlisted: { icon: IconClockPause, color: 'text-base-content' },
		refunded: { icon: IconArrowBackUp, color: 'text-error' },

		// Event statuses
		draft: { icon: IconPencil, color: 'text-warning' },
		published: { icon: IconWorld, color: 'text-success' },

		// Inbox statuses
		open: { icon: IconClock, color: 'text-info' },
		resolved: { icon: IconInboxOff, color: 'text-success' },
		dismissed: { icon: IconCircleX, color: 'text-base-content' },
		snoozed: { icon: IconAlarmSnooze, color: 'text-base-content' },

		// Band roles
		owner: { icon: IconCrown, color: 'text-warning' },
		admin: { icon: IconShield, color: 'text-info' },
		member: { icon: IconUser, color: 'text-base-content' },

		// Equipment statuses
		available: { icon: IconCircleCheck, color: 'text-success' },
		maintenance: { icon: IconTool, color: 'text-warning' },
		retired: { icon: IconArchive, color: 'text-base-content' },

		// Equipment loan statuses
		requested: { icon: IconClock, color: 'text-warning' },
		checked_out: { icon: IconPackageExport, color: 'text-info' },
		returned: { icon: IconPackageImport, color: 'text-success' },

		// Ticket statuses
		valid: { icon: IconTicket, color: 'text-info' },
		checked_in: { icon: IconCircleCheckFilled, color: 'text-success' },

		// Band tiers
		free: { icon: IconPointFilled, color: 'text-base-content/60' },
		premium: { icon: IconStar, color: 'text-warning' },

		// Campaign statuses
		sending: { icon: IconSend, color: 'text-info' },
		sent: { icon: IconMailCheck, color: 'text-success' },

		// Platform invite statuses
		accepted: { icon: IconCircleCheck, color: 'text-success' },
		revoked: { icon: IconBan, color: 'text-error' },

		// Generic
		active: { icon: IconCircleCheck, color: 'text-success' },
		deactivated: { icon: IconCircleOff, color: 'text-base-content' },
		pending: { icon: IconClock, color: 'text-warning' },
		error: { icon: IconAlertTriangle, color: 'text-error' }
	};

	/**
	 * Neutral, not an X. An unmapped status is a gap in `variants`, not an error
	 * state — rendering a red X made available equipment read as broken.
	 */
	const fallback: StatusVariant = { icon: IconPointFilled, color: 'text-base-content/40' };
</script>

<script lang="ts">
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
		<variant.icon {size} class="{variant.color} {className}" />
	</span>
{/if}
