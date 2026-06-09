<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import { fn } from 'storybook/test';
	import Button from './Button.svelte';

	const { Story } = defineMeta({
		title: 'Shared/Button',
		component: Button,
		tags: ['autodocs'],
		args: { onclick: fn() }
	});
</script>

<Story name="Primary">Primary</Story>
<Story name="Secondary" args={{ class: 'btn-secondary' }}>Secondary</Story>
<Story name="Accent" args={{ class: 'btn-accent' }}>Accent</Story>
<Story name="Ghost" args={{ class: 'btn-ghost' }}>Ghost</Story>
<Story name="Outline" args={{ class: 'btn-outline' }}>Outline</Story>
<Story name="Error" args={{ class: 'btn-error' }}>Delete</Story>
<Story name="Small" args={{ class: 'btn-primary btn-sm' }}>Small</Story>
<Story name="Large" args={{ class: 'btn-primary btn-lg' }}>Large</Story>
<Story name="Disabled" args={{ disabled: true }}>Disabled</Story>
