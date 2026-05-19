<script lang="ts">
	import type { MemberSummary } from '$lib/types/api';
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
		sustaining: IconUserHeart
	} as const;

	const roleIcon = $derived(member.role && member.role in roleIcons ? roleIcons[member.role as keyof typeof roleIcons] : IconUser);
</script>

<a
	href={member.userId ? `/staff/users/${member.userId}` : '#'}
	class="btn btn-ghost inline-flex items-center justify-start gap-3! text-left  {extraClass}"
>
	{#if !hideAvatar}
		<Avatar class='size-8' src={member.avatarUrl ?? ''} name={member.name} />
	{/if}
	<div class="min-w-0">
		<p class="font-medium flex items-center gap-1">
			<span class="tooltip tooltip-right" data-tip={member.role ?? 'member'}>
				<roleIcon size={14} class="opacity-60"></roleIcon>
			</span>
			{member.name}{#if member.pronouns} <span class="text-xs font-normal opacity-60">{member.pronouns}</span>{/if}
		</p>
		{#if member.email}<span class="link text-sm opacity-60">{member.email}</span>{/if}
	</div>
</a>
