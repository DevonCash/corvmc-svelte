<script module>
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import Alert from './Alert.svelte';

	const { Story } = defineMeta({
		title: 'Shared/Alert',
		component: Alert,
		tags: ['autodocs']
	});
</script>

<Story name="Info" args={{ type: 'info' }}>Heads up — your profile is incomplete.</Story>
<Story name="Success" args={{ type: 'success' }}>Your reservation is confirmed.</Story>
<Story name="Warning" args={{ type: 'warning' }}>Your membership renews in 3 days.</Story>
<Story name="Error" args={{ type: 'error' }}>We couldn't process your payment.</Story>
<Story name="With retry" args={{ type: 'error', reset: () => {} }}>Something went wrong loading shows.</Story>
