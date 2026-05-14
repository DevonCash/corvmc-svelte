<script lang="ts">
	import { Avatar } from 'bits-ui';

	const { src, name, ...rest }: { src?: string; name: string; [key: string]: any } = $props();

	const initials = $derived(
		name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);
</script>

<Avatar.Root
	{...rest}
	class="avatar flex items-center justify-center rounded-full bg-primary {rest.class}"
>
	{#if src}
		<img {src} alt={name} class="object-cover" />
	{/if}
	<Avatar.Fallback class="text-primary-content">{initials}</Avatar.Fallback>
</Avatar.Root>
