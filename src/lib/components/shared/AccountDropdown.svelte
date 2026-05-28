<script lang="ts">
	import { IconUser, IconSettings, IconStar, IconLogout } from '@tabler/icons-svelte';
	import Avatar from './Avatar.svelte';
	import { getMe } from '$lib/remote/layout.remote';

	let me = $derived(await getMe());
	let open = $state(false);

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.account-dropdown-wrapper')) {
			open = false;
		}
	}

	function signOut() {
		window.location.href = '/logout';
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="account-dropdown-wrapper relative">
	<button
		class="btn btn-ghost btn-circle btn-sm"
		onclick={() => (open = !open)}
		aria-label="Account menu"
	>
		<Avatar class="size-7 text-xs" name={me?.name ?? ''} src={me?.image ?? undefined} />
	</button>

	{#if open}
		<div
			class="absolute right-0 top-full z-[1000] mt-2 w-56 rounded-lg border border-base-300 bg-base-100 shadow-lg"
		>
			<div class="border-b border-base-300 px-4 py-3">
				<p class="text-sm font-medium truncate">{me?.name}</p>
				<p class="text-xs opacity-60 truncate">{me?.email}</p>
			</div>

			<ul class="menu menu-sm p-2">
				<li>
					<a href="/member/profile" onclick={() => (open = false)}>
						<IconUser size={16} />
						Profile
					</a>
				</li>
				<li>
					<a href="/member/account" onclick={() => (open = false)}>
						<IconSettings size={16} />
						Account
					</a>
				</li>
				<li>
					<a href="/member/membership" onclick={() => (open = false)}>
						<IconStar size={16} />
						Membership
					</a>
				</li>
			</ul>

			<div class="border-t border-base-300 p-2">
				<button
					class="btn btn-ghost btn-sm w-full justify-start gap-2 font-normal"
					onclick={signOut}
				>
					<IconLogout size={16} />
					Sign Out
				</button>
			</div>
		</div>
	{/if}
</div>
