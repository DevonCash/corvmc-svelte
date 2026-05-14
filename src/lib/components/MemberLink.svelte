<script lang="ts">
	import { Avatar } from 'bits-ui';

	let {
		name,
		email,
		userId,
		avatar = false,
		class: extraClass = ''
	}: {
		name: string;
		email: string;
		userId?: string;
		avatar?: boolean;
		class?: string;
	} = $props();

	const initials = $derived(
		name
			.split(' ')
			.map((w) => w[0])
			.join('')
			.toUpperCase()
			.slice(0, 2)
	);
</script>

<div class="flex items-center gap-3 {extraClass}">
	{#if avatar}
		<Avatar.Root
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-content"
			loadingStatus="loaded"
		>
			<Avatar.Fallback>{initials}</Avatar.Fallback>
		</Avatar.Root>
	{/if}
	<div class="min-w-0">
		{#if userId}
			<a href="/staff/users/{userId}" class="link font-medium link-primary">{name}</a>
		{:else}
			<p class="font-medium">{name}</p>
		{/if}
		<a href="mailto:{email}" class="link text-sm opacity-60">{email}</a>
	</div>
</div>
