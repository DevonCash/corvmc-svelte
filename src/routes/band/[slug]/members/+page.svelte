<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Form, { Field } from '$lib/components/shared/Form';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';
	import Button from '$lib/components/shared/Button.svelte';
	import {
		searchBandUsers as searchUsers,
		getBandMembersList,
		inviteMember,
		removeMember,
		revokeInvitation,
		transferOwner,
		leave,
		getBandPlatformInvites as getPlatformInvites,
		inviteByEmail,
		revokePlatformInviteRemote
	} from '$lib/remote/bands.remote';
	import MemberRoleSelect from './MemberRoleSelect.svelte';
	import { getBandLayout } from '$lib/remote/layout.remote';
	import { page } from '$app/state';

	let layout = $derived(await getBandLayout(page.params.slug!));

	const { fields: removeFields } = removeMember;
	const { fields: revokeFields } = revokeInvitation;
	const { fields: revokePlatformFields } = revokePlatformInviteRemote;
	const { fields: inviteFields } = inviteMember;
	const { fields: transferFields } = transferOwner;

	const isAdmin = $derived(layout.userRole === 'admin');
	const isOwner = $derived(layout.userRole === 'owner');

	let membersResult = $derived(getBandMembersList(layout.band.id));

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

	function refreshMembers() {
		void getBandMembersList(layout.band.id).refresh();
	}

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

	const roleOptions = [
		{ value: 'member', label: 'Member' },
		{ value: 'admin', label: 'Admin' }
	];

	let searchTimeout: ReturnType<typeof setTimeout>;
	function onSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		searchQuery = value;
		selectedUser = null;
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(handleSearch, 300);
	}

	onDestroy(() => clearTimeout(searchTimeout));
</script>

<PageHeader title="Members" subtitle={layout.band.name}>
	{#if isOwner || isAdmin}
		<Button class="btn-sm" onclick={() => (showInviteModal = true)}>Invite Member</Button>
	{/if}
</PageHeader>
<PageContent width="2xl">
	{#await membersResult}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:then { active, pending }}
		<!-- Active members -->
		<section>
			<h2 class="mb-3 text-lg font-semibold">Active Members ({active.length})</h2>
			{#if active.length === 0}
				<EmptyState message="No active members." />
			{:else}
				<div class="grid grid-cols-1 gap-2">
					{#each active as member (member.id)}
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
									{#if (isOwner || isAdmin) && member.role !== 'owner'}
										<MemberRoleSelect
											memberId={member.id}
											role={member.role}
											onchanged={refreshMembers}
										/>
									{:else}
										<StatusBadge status={member.role} />
									{/if}
									{#if (isOwner || isAdmin) && member.role !== 'owner'}
										{@const remove = removeMember.for(member.id)}
										<Form
											remote={remove}
											onsuccess={() => {
												toast.success('Member removed');
												refreshMembers();
											}}
											onfailure={() => toast.error('Failed to remove')}
										>
											<input {...removeFields.memberId.as('hidden', member.id)} />
											<SubmitButton label="Remove" class="btn-ghost btn-xs" />
										</Form>
									{/if}
									{#if isOwner && member.role !== 'owner'}
										<Button
											class="btn-ghost btn-xs"
											onclick={() => {
												transferTarget = { userId: member.userId, name: member.userName ?? '' };
												showTransferModal = true;
											}}
										>
											Transfer
										</Button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Pending invitations -->
		{#if pending.length > 0}
			<section>
				<h2 class="mb-3 text-lg font-semibold">Pending Invitations ({pending.length})</h2>
				<div class="grid grid-cols-1 gap-2">
					{#each pending as invite (invite.id)}
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
										onsuccess={() => {
											toast.success('Invitation revoked');
											refreshMembers();
										}}
										onfailure={() => toast.error('Failed to revoke')}
									>
										<input {...revokeFields.memberId.as('hidden', invite.id)} />
										<SubmitButton label="Revoke" class="btn-ghost btn-xs" />
									</Form>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- Platform invites (awaiting signup) -->
		{#if (isOwner || isAdmin) && platformInvites && platformInvites.length > 0}
			{@const pendingPlatform = platformInvites.filter((i) => i.status === 'pending')}
			{#if pendingPlatform.length > 0}
				<section>
					<h2 class="mb-3 text-lg font-semibold">Awaiting Signup ({pendingPlatform.length})</h2>
					<div class="grid grid-cols-1 gap-2">
						{#each pendingPlatform as invite (invite.id)}
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
											<input {...revokePlatformFields.inviteId.as('hidden', invite.id)} />
											<SubmitButton label="Revoke" class="btn-ghost btn-xs" />
										</Form>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		{/if}

		<!-- Leave band (non-owners) -->
		{#if !isOwner && layout.userRole !== 'staff'}
			<div class="pt-4">
				<Button class="btn-outline btn-sm btn-error" onclick={() => (showLeaveModal = true)}>
					Leave Band
				</Button>
			</div>
		{/if}
	{/await}
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
				refreshMembers();
			}}
			onfailure={() => toast.error('Failed to send invitation')}
		>
			<div class="space-y-4">
				<Field label="Search by name or email" id="user-search">
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
						<input {...inviteFields.userId.as('hidden', selectedUser.id)} />
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
					<Field label="Role" name="role" type="select" value="member" options={roleOptions} />
					<Field label="Position" name="position" type="text" placeholder="e.g. Guitar" />
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
				refreshMembers();
				getPlatformInvites().then((r) => (platformInvites = r));
			}}
			onfailure={() => toast.error('Failed to send invitation')}
		>
			<div class="space-y-4">
				<p class="text-sm opacity-70">
					Invite someone who doesn't have a CorvMC account yet. They'll receive an email with a
					signup link and be automatically added to your band.
				</p>
				<Field
					name="email"
					type="email"
					label="Email address"
					value={looksLikeEmail ? searchQuery : ''}
				/>
				<div class="grid grid-cols-2 gap-4">
					<Field label="Role" name="role" type="select" value="member" options={roleOptions} />
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
				refreshMembers();
			}}
			onfailure={() => toast.error('Failed to transfer')}
		>
			<div class="space-y-4">
				<div class="alert alert-warning">
					<p>
						You are about to transfer ownership of <strong>{layout.band.name}</strong> to
						<strong>{transferTarget.name}</strong>. You will be demoted to admin. This cannot be
						undone without the new owner's consent.
					</p>
				</div>
				<input {...transferFields.newOwnerId.as('hidden', transferTarget.userId)} />
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
		onsuccess={() => {
			toast.success('You have left the band');
			goto(resolve('/member/bands'));
		}}
		onfailure={() => toast.error('Failed to leave')}
	>
		<div class="space-y-4">
			<p>
				Are you sure you want to leave <strong>{layout.band.name}</strong>? You will need to be
				re-invited to rejoin.
			</p>
			<div class="flex justify-end pt-2">
				<SubmitButton label="Leave Band" successLabel="Left" class="btn-error" />
			</div>
		</div>
	</Form>
</Modal>
