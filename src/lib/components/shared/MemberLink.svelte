<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { IconUser, IconUserCog, IconUserShield, IconUserHeart } from '@tabler/icons-svelte';

	let {
		name,
		email,
		pronouns,
		role,
		userId,
		avatarUrl = '',
		class: extraClass = '',
		hideAvatar = false
	}: {
		name: string;
		email?: string;
		pronouns?: string | null;
		role?: string | null;
		userId?: string;
		avatarUrl?: string;
		class?: string;
		hideAvatar?: boolean;
	} = $props();

	const roleIcons = {
		admin: IconUserCog,
		staff: IconUserShield,
		sustaining: IconUserHeart
	} as const;

	const roleIcon = $derived(role && role in roleIcons ? roleIcons[role as keyof typeof roleIcons] : IconUser);
</script>

<a
	href={userId ? `/staff/users/${userId}` : '#'}
	class="btn btn-ghost inline-flex items-center justify-start gap-3! text-left  {extraClass}"
>
	{#if !hideAvatar}
		<Avatar class='size-8' src={avatarUrl} {name} />
	{/if}
	<div class="min-w-0">
		<p class="font-medium flex items-center gap-1">
			<span class="tooltip tooltip-right" data-tip={role ?? 'member'}>
				<roleIcon size={14} class="opacity-60" />
			</span>
			{name}{#if pronouns} <span class="text-xs font-normal opacity-60">{pronouns}</span>{/if}
		</p>
		{#if email}<span class="link text-sm opacity-60">{email}</span>{/if}
	</div>
</a>
