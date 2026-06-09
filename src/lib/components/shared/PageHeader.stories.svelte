<script module lang="ts">
	import type { ComponentProps } from 'svelte';
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PageHeader from './PageHeader.svelte';

	const { Story } = defineMeta({
		title: 'Shared/PageHeader',
		component: PageHeader,
		tags: ['autodocs'],
		// The sticky negative-margin header reads best against a padded surface.
		parameters: { layout: 'padded' }
	});
</script>

{#snippet actionsTemplate(args: ComponentProps<typeof PageHeader>)}
	<PageHeader {...args}>
		<a href="/member/bands/new" class="btn btn-primary btn-sm">New band</a>
	</PageHeader>
{/snippet}

<Story name="Title only" args={{ title: 'Reservations' }} />
<Story name="With subtitle" args={{ title: 'Reservations', subtitle: 'Member' }} />
<Story name="With back link" args={{ title: 'Edit band', subtitle: 'Band', backHref: '/member/bands' }} />
<Story name="With actions" args={{ title: 'Bands', subtitle: 'Member' }} template={actionsTemplate} />
