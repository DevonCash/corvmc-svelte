<script lang="ts">
	import type { MemberSummary } from '$lib/server/db/schema/api';
	import { resolve } from '$app/paths';
	import Avatar from './Avatar.svelte';
	import { IconUser, IconUserCog, IconUserShield, IconUserHeart } from '@tabler/icons-svelte';

	let {
		member,
		class: extraClass = '',
		hideAvatar = false,
		variant = 'button'
	}: {
		member: MemberSummary;
		class?: string;
		hideAvatar?: boolean;
		/**
		 * `'button'` is the padded, bordered form for detail pages and cards.
		 * `'inline'` is a plain link for table cells — the button form's padding
		 * and min-height were driving 128px table rows.
		 */
		variant?: 'button' | 'inline';
	} = $props();

	const roleIcons = {
		admin: IconUserCog,
		staff: IconUserShield,
		sustaining: IconUserHeart,
		member: IconUser
	} as const;

	// An explicit admin/staff role wins; otherwise a sustaining subscriber gets the heart.
	// `member.role` may carry the legacy 'sustaining member' role name, which we ignore in
	// favour of the subscription-derived `member.sustaining` flag.
	const effectiveRole = $derived(
		member.role === 'admin' || member.role === 'staff'
			? member.role
			: member.sustaining
				? 'sustaining'
				: null
	);

	const RoleIcon = $derived(
		effectiveRole && effectiveRole in roleIcons
			? roleIcons[effectiveRole as keyof typeof roleIcons]
			: IconUser
	);
	const roleLabel = $derived(effectiveRole === 'sustaining' ? 'sustaining member' : member.role);

	const variantClass = {
		button: 'flat btn btn-ghost inline-flex items-center justify-start gap-3 text-left',
		inline: 'inline-flex min-w-0 items-center gap-2 text-left hover:underline'
	} as const;
</script>

<a
	href={member.userId ? resolve(`/staff/users/${member.userId}`) : '#'}
	class="{variantClass[variant]} {extraClass}"
>
	{#if member.avatarUrl && !hideAvatar}
		<Avatar
			class={variant === 'inline' ? 'size-6 shrink-0' : 'size-8'}
			size="avatar-sm"
			src={member.avatarUrl}
			name={member.name}
		/>
	{/if}
	<div class="min-w-0">
		<p class="flex items-center gap-1 font-medium">
			{#if effectiveRole}
				<span class="tooltip tooltip-right" data-tip={roleLabel ?? 'member'}>
					<RoleIcon size={14}></RoleIcon>
				</span>
			{/if}
			<span class="truncate">{member.name}</span>{#if member.pronouns}
				<span class="text-subtle font-normal">{member.pronouns}</span>{/if}
		</p>
		{#if member.email}<span class="block truncate text-muted {variant === 'inline' ? '' : 'link'}"
				>{member.email}</span
			>{/if}
	</div>
</a>
