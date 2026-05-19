<script lang="ts">
	import Avatar from './Avatar.svelte';
	import { IconUser, IconUserCog, IconUserShield, IconUserHeart } from '@tabler/icons-svelte';

	interface Member {
		name: string;
		email: string;
		pronouns?: string;
		role?: string;
		id?: string;
		avatarUrl?: string;
	}

	let {
		member,
		name,
		email,
		pronouns,
		role,
		userId,
		avatarUrl = '',
		class: extraClass = '',
		hideAvatar = false
	}: {
		member: Member;
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
		sustaining: IconUserHeart,
		member: IconUser
	} as const;

	const RoleIcon = $derived(
		role && role in roleIcons ? roleIcons[role as keyof typeof roleIcons] : IconUser
	);
</script>

<a
	href={userId ? `/staff/users/${userId}` : '#'}
	class="flat btn inline-flex items-center justify-start gap-3 text-left btn-ghost {extraClass}"
>
	{#if member?.avatarUrl && !hideAvatar}
		<Avatar class="size-8" src={member.avatarUrl} {name} />
	{/if}
	<div class="min-w-0">
		<p class="flex items-center gap-1 font-medium">
			{#if member?.role}
				<span class="tooltip tooltip-right" data-tip={role ?? 'member'}>
					<RoleIcon size={14}></RoleIcon>
				</span>
			{/if}
			{member?.name}{#if member?.pronouns}
				<span class="text-xs font-normal opacity-60">{member.pronouns}</span>{/if}
		</p>
		{#if member?.email}<span class="link text-sm opacity-60">{member.email}</span>{/if}
	</div>
</a>
