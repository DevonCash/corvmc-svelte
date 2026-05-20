<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Form, { Field } from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		searchUsers,
		inviteMember,
		removeMember,
		revokeInvitation,
		transferOwner,
		leave,
		getPlatformInvites,
		inviteByEmail,
		revokePlatformInviteRemote
	} from './data.remote';
	import type { BandLayoutResponse, BandMembersResponse } from '$lib/server/db/schema/api';

	let { data }: { data: BandLayoutResponse & BandMembersResponse } = $props();

	const isAdmin = $derived(data.userRole === 'admin');
	const isOwner = $derived(data.userRole === 'owner');

	// Invite form state
	let showInviteModal = $state(false);
	let searchQuery = $state('');
	let searchResults = $state<{ id: string; name: string; email: string }[]>([]);
	let selectedUser = $state<{ id: string; name: string; email: string } | null>(null);
	let searching = $state(false);
	// Transfer ownership modal
	let showTransferModal = $state(false);
	let transferTarget = $state<{ userId: string; name: string } | null>(null);

	// Leave band modal
	let showLeaveModal = $state(false);

	// Platform invites
	let platformInvites = $state<Awaited<ReturnType<typeof getPlatformInvites>> | null>(null);
	let inviteMode = $state<'search' | 'email'>('search');

	$effect(() => {
		if (isOwner || isAdmin) {
			getPlatformInvites().then((r) => (platformInvites = r));
		}
	});

	const looksLikeEmail = $derived(searchQuery.includes('@') && searchQuery.includes('.'));

	async function handleSearch() {
		if (searchQuery.length < 2) {
			searchResults = [];
			return;
		}
		searching = true;
		searchResults = await searchUsers(searchQuery).catch(() => []);
		searching = false;
	}

	function selectUser(user: { id: string; name: string; email: string }) {
		selectedUser = user;
		searchQuery = user.name;
		searchResults = [];
	}

	let searchTimeout: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		searchQuery = value;
		selectedUser = null;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(handleSearch, 300);
	}
</script>

<PageHeader title="Members" subtitle={data.band.name}>
		{#if isOwner || isAdmin}
			<button class="btn btn-sm btn-primary" onclick={() => (showInviteModal = true)}>
				Invite Member
			</button>
		{/if}
	</PageHeader>
<PageContent width="2xl">
	<!-- Active members -->
	<section>
		<h2 class="mb-3 text-lg font-semibold">Active Members ({data.active.length})</h2>
		<DataTable data={data.active} gridClass="grid grid-cols-1 gap-2" empty="No active members.">
			{#snippet card(member)}
				<div class="card bg-base-100 shadow">
					<div class="card-body flex-row items-center justify-between py-3">
						<div class="flex items-center gap-3">
							<div class="placeholder avatar">
								<div class="w-8 rounded-full bg-neutral text-neutral-content">
									<span class="text-xs">{member.userName?.charAt(0).toUpperCase() ?? '?'}</span>
								</div>
							</div>
							<div>
								<p class="font-medium">{member.userName}</p>
								<p class="text-xs opacity-60">
									{member.userEmail}
									{#if member.position}
										&middot; {member.position}
									{/if}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<StatusBadge status={member.role} />
							{#if (isOwner || isAdmin) && member.role !== 'owner'}
								{@const remove = removeMember.for(member.id)}
								<Form
									remote={remove}
									onsuccess={() => { toast.success('Member removed'); invalidateAll(); }}
									onfailure={() => toast.error('Failed to remove')}
								>
									<input type="hidden" name="memberId" value={member.id} />
									<SubmitButton label="Remove" class="btn-ghost btn-xs" />
								</Form>
							{/if}
							{#if isOwner && member.role !== 'owner'}
								<button
									class="btn btn-ghost btn-xs"
									onclick={() => {
										transferTarget = { userId: member.userId, name: member.userName ?? '' };
										showTransferModal = true;
									}}
								>
									Transfer
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/snippet}
		</DataTable>
	</section>

	<!-- Pending invitations -->
	{#if data.pending.length > 0}
		<section>
			<h2 class="mb-3 text-lg font-semibold">Pending Invitations ({data.pending.length})</h2>
			<DataTable data={data.pending} gridClass="grid grid-cols-1 gap-2" empty="No pending invitations.">
				{#snippet card(invite)}
					<div class="card bg-base-100 shadow">
						<div class="card-body flex-row items-center justify-between py-3">
							<div>
								<p class="font-medium">{invite.userName}</p>
								<p class="text-xs opacity-60">
									{invite.userEmail} &middot; Invited as {invite.role}
									{#if invite.position}
										&middot; {invite.position}
									{/if}
								</p>
							</div>
							{#if isOwner || isAdmin}
								{@const revoke = revokeInvitation.for(invite.id)}
								<Form
									remote={revoke}
									onsuccess={() => { toast.success('Invitation revoked'); invalidateAll(); }}
									onfailure={() => toast.error('Failed to revoke')}
								>
									<input type="hidden" name="memberId" value={invite.id} />
									<SubmitButton label="Revoke" class="btn-ghost btn-xs" />
								</Form>
							{/if}
						</div>
					</div>
				{/snippet}
			</DataTable>
		</section>
	{/if}

	<!-- Platform invites (awaiting signup) -->
	{#if (isOwner || isAdmin) && platformInvites && platformInvites.length > 0}
		<section>
			<h2 class="mb-3 text-lg font-semibold">Awaiting Signup ({platformInvites.filter((i) => i.status === 'pending').length})</h2>
			<DataTable data={platformInvites.filter((i) => i.status === 'pending')} gridClass="grid grid-cols-1 gap-2" empty="No pending email invites.">
				{#snippet card(invite)}
					<div class="card bg-base-100 shadow">
						<div class="card-body flex-row items-center justify-between py-3">
							<div>
								<p class="font-medium">{invite.email}</p>
								<p class="text-xs opacity-60">
									Invited as {invite.role}
									{#if invite.position}
										&middot; {invite.position}
									{/if}
									&middot; by {invite.invitedByName}
								</p>
							</div>
							<div class="flex items-center gap-2">
								<Badge variant="warning">awaiting signup</Badge>
								<Form
									remote={revokePlatformInviteRemote}
									onsuccess={() => {
										toast.success('Invite revoked');
										getPlatformInvites().then((r) => (platformInvites = r));
									}}
									onfailure={() => toast.error('Failed to revoke')}
								>
									<input type="hidden" name="inviteId" value={invite.id} />
									<SubmitButton label="Revoke" class="btn-ghost btn-xs" />
								</Form>
							</div>
						</div>
					</div>
				{/snippet}
			</DataTable>
		</section>
	{/if}

	<!-- Leave band (non-owners) -->
	{#if !isOwner && data.userRole !== 'staff'}
		<div class="pt-4">
			<button class="btn btn-outline btn-sm btn-error" onclick={() => (showLeaveModal = true)}>
				Leave Band
			</button>
		</div>
	{/if}
</PageContent>

<!-- Invite Member Modal -->
<Modal title="Invite Member" bind:open={showInviteModal}>
	<!-- Tab toggle -->
	<div class="tabs tabs-boxed mb-4">
		<button
			class="tab"
			class:tab-active={inviteMode === 'search'}
			onclick={() => (inviteMode = 'search')}
		>
			Search Members
		</button>
		<button
			class="tab"
			class:tab-active={inviteMode === 'email'}
			onclick={() => (inviteMode = 'email')}
		>
			Invite by Email
		</button>
	</div>

	{#if inviteMode === 'search'}
		<Form
			remote={inviteMember}
			onsuccess={() => {
				toast.success('Invitation sent');
				showInviteModal = false;
				selectedUser = null;
				searchQuery = '';
				invalidateAll();
			}}
			onfailure={() => toast.error('Failed to send invitation')}
		>
			<div class="space-y-4">
				<Field
					label="Search by name or email"
					id="user-search"
				>
					<input
						id="user-search"
						type="text"
						class="input-bordered input w-full"
						placeholder="Start typing a name or email..."
						value={searchQuery}
						oninput={onSearchInput}
						autocomplete="off"
					/>
					{#if selectedUser}
						<input type="hidden" name="userId" value={selectedUser.id} />
					{/if}

					<!-- Search results dropdown -->
					{#if searchResults.length > 0 && !selectedUser}
						<ul class="menu mt-1 max-h-48 overflow-y-auto rounded-box bg-base-200">
							{#each searchResults as result (result.id)}
								<li>
									<button type="button" onclick={() => selectUser(result)}>
										<span class="font-medium">{result.name}</span>
										<span class="text-xs opacity-60">{result.email}</span>
									</button>
								</li>
							{/each}
						</ul>
					{/if}
					{#if searching}
						<p class="mt-1 text-xs opacity-60">Searching...</p>
					{/if}
					{#if searchQuery.length >= 2 && searchResults.length === 0 && !searching && !selectedUser && looksLikeEmail}
						<p class="mt-1 text-xs opacity-60">
							No existing members found.
							<button type="button" class="link" onclick={() => (inviteMode = 'email')}>
								Invite {searchQuery} by email?
							</button>
						</p>
					{/if}
				</Field>

				<div class="grid grid-cols-2 gap-4">
					<Field label="Role" id="invite-role" type="select">
						<option value="member">Member</option>
						<option value="admin">Admin</option>
					</Field>
					<Field label="Position" name="invite-position" type="text" placeholder="e.g. Guitar" />
				</div>

				<div class="flex justify-end pt-2">
					<SubmitButton
						label="Send Invitation"
						successLabel="Sent"
						class="btn-primary"
						disabled={!selectedUser}
					/>
				</div>
			</div>
		</Form>
	{:else}
		<Form
			remote={inviteByEmail}
			onsuccess={() => {
				toast.success('Invitation sent');
				showInviteModal = false;
				searchQuery = '';
				invalidateAll();
				getPlatformInvites().then((r) => (platformInvites = r));
			}}
			onfailure={() => toast.error('Failed to send invitation')}
		>
			<div class="space-y-4">
				<p class="text-sm opacity-70">
					Invite someone who doesn't have a CorvMC account yet. They'll receive an email with a signup link and be automatically added to your band.
				</p>
				<Field name="email" type="email" label="Email address" value={looksLikeEmail ? searchQuery : ''} />
				<div class="grid grid-cols-2 gap-4">
					<Field label="Role" name="role" type="select">
						<option value="member">Member</option>
						<option value="admin">Admin</option>
					</Field>
					<Field label="Position" name="position" type="text" placeholder="e.g. Guitar" />
				</div>
				<div class="flex justify-end pt-2">
					<SubmitButton label="Send Email Invite" successLabel="Sent" class="btn-primary" />
				</div>
			</div>
		</Form>
	{/if}
</Modal>

<!-- Transfer Ownership Modal -->
<Modal title="Transfer Ownership" bind:open={showTransferModal}>
	{#if transferTarget}
		<Form
			remote={transferOwner}
			onsuccess={() => {
				toast.success('Ownership transferred');
				showTransferModal = false;
				invalidateAll();
			}}
			onfailure={() => toast.error('Failed to transfer')}
		>
			<div class="space-y-4">
				<div class="alert alert-warning">
					<p>
						You are about to transfer ownership of <strong>{data.band.name}</strong> to
						<strong>{transferTarget.name}</strong>. You will be demoted to admin. This cannot be
						undone without the new owner's consent.
					</p>
				</div>
				<input type="hidden" name="newOwnerId" value={transferTarget.userId} />
				<div class="flex justify-end pt-2">
					<SubmitButton label="Transfer Ownership" successLabel="Transferred" class="btn-warning" />
				</div>
			</div>
		</Form>
	{/if}
</Modal>

<!-- Leave Band Modal -->
<Modal title="Leave Band" bind:open={showLeaveModal}>
	<Form
		remote={leave}
		onsuccess={() => { toast.success('You have left the band'); goto('/member/bands'); }}
		onfailure={() => toast.error('Failed to leave')}
	>
		<div class="space-y-4">
			<p>
				Are you sure you want to leave <strong>{data.band.name}</strong>? You will need to be re-invited
				to rejoin.
			</p>
			<div class="flex justify-end pt-2">
				<SubmitButton label="Leave Band" successLabel="Left" class="btn-error" />
			</div>
		</div>
	</Form>
</Modal>
