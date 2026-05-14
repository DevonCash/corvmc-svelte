<script lang="ts">
	import Avatar from './Avatar.svelte';

	let {
		name,
		email,
		userId,
		avatarUrl = '',
		class: extraClass = '',
		hideAvatar = false
	}: {
		name: string;
		email: string;
		userId?: string;
		avatarUrl?: string;
		class?: string;
		hideAvatar?: boolean;
	} = $props();
</script>

<a
	href={userId ? `/staff/users/${userId}` : '#'}
	class="btn btn-ghost inline-flex items-center justify-start gap-3! text-left  {extraClass}"
>
	{#if !hideAvatar}
		<Avatar class='size-8' src={avatarUrl} {name} />
	{/if}
	<div class="min-w-0">
		<p class="font-medium">{name}</p>
		<span class="link text-sm opacity-60">{email}</span>
	</div>
</a>
