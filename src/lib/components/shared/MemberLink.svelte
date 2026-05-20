<script lang="ts">
	import type { MemberSummary } from '$lib/server/db/schema/api';
	import Avatar from './Avatar.svelte';
	import { IconUser, IconUserCog, IconUserShield, IconUserHeart } from '@tabler/icons-svelte';

	let {
		member,
		class: extraClass = '',
		hideAvatar = false
	}: {
		member: MemberSummary;
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
		member.role && member.role in roleIcons ? roleIcons[member.role as keyof typeof roleIcons] : IconUser
	);
</script>

<a
	href={member.userId ? `/staff/users/${member.userId}` : '#'}
	class="flat btn inline-flex items-center justify-start gap-3 text-left btn-ghost {extraClass}"
>
	{#if member.avatarUrl && !hideAvatar}
		<Avatar class="size-8" src={member.avatarUrl} name={member.name} />
	{/if}
	<div class="min-w-0">
		<p class="flex items-center gap-1 font-medium">
			{#if member.role}
				<span class="tooltip tooltip-right" data-tip={member.role ?? 'member'}>
					<RoleIcon size={14}></RoleIcon>
				</span>
			{/if}
			{member.name}{#if member.pronouns}
				<span class="text-xs font-normal opacity-60">{member.pronouns}</span>{/if}
		</p>
		{#if member.email}<span class="link text-sm opacity-60">{member.email}</span>{/if}
	</div>
</a>
