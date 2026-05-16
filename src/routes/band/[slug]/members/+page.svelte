<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Form, { Field } from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import {
		searchUsers,
		inviteMember,
		removeMember,
		revokeInvitation,
		transferOwner,
		leave
	} from './data.remote';
	import type { BandLayoutResponse, BandMembersResponse } from '$lib/types/api';

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

<div class="max-w-2xl space-y-6">
	<PageHeader title="Members" subtitle={data.band.name}>
		{#if isOwner || isAdmin}
			<button class="btn btn-sm btn-primary" onclick={() => (showInviteModal = true)}>
				Invite Member
			</button>
		{/if}
	</PageHeader>

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
									successToast="Member removed"
									errorToast="Failed to remove"
									onsuccess={() => invalidateAll()}
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
									successToast="Invitation revoked"
									errorToast="Failed to revoke"
									onsuccess={() => invalidateAll()}
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

	<!-- Leave band (non-owners) -->
	{#if !isOwner && data.userRole !== 'staff'}
		<div class="pt-4">
			<button class="btn btn-outline btn-sm btn-error" onclick={() => (showLeaveModal = true)}>
				Leave Band
			</button>
		</div>
	{/if}
</div>

<!-- Invite Member Modal -->
<Modal title="Invite Member" bind:open={showInviteModal}>
	<Form
		remote={inviteMember}
		successToast="Invitation sent"
		errorToast="Failed to send invitation"
		onsuccess={() => {
			showInviteModal = false;
			selectedUser = null;
			searchQuery = '';
			invalidateAll();
		}}
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
			</Field>

			<div class="grid grid-cols-2 gap-4">
				<Field
					label="Role"
					id="invite-role"
					type="select"
				>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</Field>

				<Field
					label="Position"
					name="invite-position"
					type="text"
					placeholder="e.g. Guitar"
				/>
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
</Modal>

<!-- Transfer Ownership Modal -->
<Modal title="Transfer Ownership" bind:open={showTransferModal}>
	{#if transferTarget}
		<Form
			remote={transferOwner}
			successToast="Ownership transferred"
			errorToast="Failed to transfer"
			onsuccess={() => {
				showTransferModal = false;
				invalidateAll();
			}}
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
		successToast="You have left the band"
		errorToast="Failed to leave"
		onsuccess={() => goto('/member/bands')}
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
