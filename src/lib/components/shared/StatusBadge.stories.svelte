<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import StatusBadge from './StatusBadge.svelte';

	const { Story } = defineMeta({
		title: 'Shared/StatusBadge',
		component: StatusBadge,
		tags: ['autodocs'],
		args: { label: true }
	});
</script>

<Story name="Scheduled" args={{ status: 'scheduled' }} />
<Story name="Confirmed" args={{ status: 'confirmed' }} />
<Story name="Cancelled" args={{ status: 'cancelled' }} />
<Story name="Pending" args={{ status: 'pending' }} />
<Story name="Published" args={{ status: 'published' }} />
<Story name="Draft" args={{ status: 'draft' }} />
<Story name="Icon only" args={{ status: 'confirmed', label: false }} />
