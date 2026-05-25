<script lang="ts">
	import { Avatar } from 'bits-ui';
	import { hashPattern } from '$lib/utils/patterns';

	const { src, name, ...rest }: { src?: string; name: string; [key: string]: any } = $props();

	const initials = $derived(
		name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);

	const patternClass = $derived(`poster-gen--${hashPattern(name)}`);
</script>

<Avatar.Root
	{...rest}
	class="avatar flex items-center justify-center overflow-hidden rounded-full {rest.class}"
>
	{#if src}
		<img {src} alt={name} class="object-cover" />
	{/if}
	<Avatar.Fallback class="avatar-pattern poster-gen {patternClass}">
		<span class="avatar-initials">{initials}</span>
	</Avatar.Fallback>
</Avatar.Root>

<style>
	:global(.avatar) {
		container-type: size;
	}
	:global(.avatar-pattern) {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	:global(.avatar-initials) {
		font-weight: 700;
		font-size: 50cqmin;
		color: #fff;
		-webkit-text-stroke: 1.5px var(--cmc-brown);
		paint-order: stroke fill;
		letter-spacing: 0.02em;
		z-index: 1;
	}
</style>
