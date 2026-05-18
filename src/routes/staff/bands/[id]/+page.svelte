<script lang="ts">
	import { page } from '$app/state';
	import { IconDeviceFloppy } from '@tabler/icons-svelte';
	import {
		getBand,
		getBandMembers,
		getBandReservations,
		updateBand,
		removeBandMember,
		transferBandOwnership,
		deactivateBand,
		reactivateBand,
		searchUsers,
		inviteMember,
		updateMemberRole,
		revokeInvite,
		getPlatformInvites,
		inviteByEmail,
		revokePlatformInvite
	} from './data.remote';
	import { invalidateAll } from '$app/navigation';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import { Field } from '$lib/components/shared/Form';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import { formatDate, formatTimeRange } from '$lib/utils/format';

	let id = $derived(page.params.id!);
	let band = $derived(await getBand(id));
	let members = $derived(await getBandMembers(id));
	let reservations = $derived(await getBandReservations(id));
	let platformInvites = $derived(await getPlatformInvites(id));

	let isDeactivated = $derived(!!band.deletedAt);

	// Invite state
	let inviteQuery = $state('');
	let inviteRole = $state<'admin' | 'member'>('member');
	let invitePosition = $state('');
	let inviteUserId = $state('');
	let inviteUserName = $state('');
	let searchResults = $state<{ id: string; name: string; email: string }[]>([]);
	let searching = $state(false);

	// Email invite state
	let emailInviteAddress = $state('');
	let emailInviteRole = $state<'admin' | 'member'>('member');
	let emailInvitePosition = $state('');

	async function handleSearch() {
		if (inviteQuery.length < 2) { searchResults = []; return; }
		searching = true;
		try {
			searchResults = await searchUsers(inviteQuery);
		} finally {
			searching = false;
		}
	}

	function selectUser(u: { id: string; name: string }) {
		inviteUserId = u.id;
		inviteUserName = u.name;
		searchResults = [];
		inviteQuery = '';
	}
</script>

	<Form remote={updateBand} successToast="Band updated">
		<PageHeader subtitle="Band" title={band.name} backHref="/staff/bands">
			{#if isDeactivated}
				<Badge variant="error" size="md">Deactivated</Badge>
			{/if}
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<IconDeviceFloppy size={20} />
				{/snippet}
			</SubmitButton>
		</PageHeader>
		<PageContent width="3xl">
		<div class="grid gap-6 lg:grid-cols-2 mb-6">
			<InfoCard title="Band Info">
				<div class="grid grid-cols-1 gap-x-2">
					<Field name="name" type="text" value={band.name} />
					<Field name="bio" type="textarea" value={band.bio ?? ''} />
				</div>
			</InfoCard>

			<InfoCard title="Details" class="bg-base-200 shadow-none">
				<dl class="grid gap-x-4 gap-y-2 text-sm" style="grid-template-columns: auto 1fr;">
					<dt class="opacity-60">Band ID</dt>
					<dd class="font-mono text-xs">{band.id}</dd>

					<dt class="opacity-60">Slug</dt>
					<dd class="font-mono text-xs">{band.slug}</dd>

					<dt class="opacity-60">Owner</dt>
					<dd><MemberLink name={band.ownerName} email={band.ownerEmail} pronouns={band.ownerPronouns} role={band.ownerRole} userId={band.ownerId} /></dd>

					<dt class="opacity-60">Members</dt>
					<dd>{band.memberCount} active</dd>

					<dt class="opacity-60">Created</dt>
					<dd>{new Date(band.createdAt).toLocaleDateString()}</dd>

					{#if band.deletedAt}
						<dt class="opacity-60">Deactivated</dt>
						<dd>{new Date(band.deletedAt).toLocaleDateString()}</dd>
					{/if}
				</dl>

				<div class="mt-4 flex gap-2">
					{#if isDeactivated}
						<Action
							action={() => reactivateBand({})}
							label="Reactivate"
							successToast="Band reactivated"
							class="btn-success btn-sm"
						/>
					{:else}
						<Action
							action={() => deactivateBand({})}
							label="Deactivate"
							confirm="Deactivate this band? All future reservations will be cancelled."
							successToast="Band deactivated"
							class="btn-error btn-sm"
						/>
					{/if}
				</div>
			</InfoCard>
		</div>
		</PageContent>
	</Form>

	<PageContent width="3xl">
	<InfoCard title="Members">
		{#snippet header(title)}
			<header class="flex justify-between items-center">
				<span class="card-title">{title}</span>
				<div class="flex gap-2">
				<Action
					action={() => {
						const result = inviteByEmail({ email: emailInviteAddress, role: emailInviteRole, position: emailInvitePosition || undefined });
						emailInviteAddress = '';
						emailInviteRole = 'member';
						emailInvitePosition = '';
						return result;
					}}
					label="Invite by Email"
					modalTitle="Invite by Email"
					successToast="Email invitation sent"
					class="btn-sm btn-outline btn-primary"
					canSubmit={!!emailInviteAddress && emailInviteAddress.includes('@')}
				>
					{#snippet form({ close })}
						<div class="space-y-3">
							<p class="text-sm opacity-70">Invite someone who doesn't have a CorvMC account. They'll get a signup link and be auto-added to this band.</p>
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Email</span></div>
								<input type="email" class="input input-bordered w-full" bind:value={emailInviteAddress} placeholder="musician@example.com" />
							</label>
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Role</span></div>
								<select class="select select-bordered w-full" bind:value={emailInviteRole}>
									<option value="member">Member</option>
									<option value="admin">Admin</option>
								</select>
							</label>
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Position (optional)</span></div>
								<input type="text" class="input input-bordered w-full" bind:value={emailInvitePosition} placeholder="e.g. Bassist" />
							</label>
						</div>
					{/snippet}
				</Action>
				<Action
					action={() => {
						const result = inviteMember({ userId: inviteUserId, role: inviteRole, position: invitePosition || undefined });
						inviteUserId = '';
						inviteUserName = '';
						inviteRole = 'member';
						invitePosition = '';
						return result;
					}}
					label="Add Member"
					modalTitle="Invite Member"
					successToast="Invitation sent"
					class="btn-sm btn-primary"
					canSubmit={!!inviteUserId}
					onsuccess={() => invalidateAll()}
				>
					{#snippet form({ close })}
						<div class="space-y-3">
							{#if inviteUserId}
								<div class="flex items-center justify-between bg-base-200 rounded p-2">
									<span class="font-medium">{inviteUserName}</span>
									<button type="button" class="btn btn-ghost btn-xs" onclick={() => { inviteUserId = ''; inviteUserName = ''; }}>Change</button>
								</div>
							{:else}
								<label class="form-control w-full">
									<div class="label"><span class="label-text">Search members</span></div>
									<input
										type="text"
										class="input input-bordered w-full"
										bind:value={inviteQuery}
										oninput={handleSearch}
										placeholder="Name or email..."
									/>
								</label>
								{#if searchResults.length > 0}
									<div class="bg-base-200 rounded max-h-40 overflow-y-auto">
										{#each searchResults as u}
											<button type="button" class="w-full text-left px-3 py-2 hover:bg-base-300 text-sm" onclick={() => selectUser(u)}>
												<span class="font-medium">{u.name}</span>
												<span class="opacity-60 ml-1">{u.email}</span>
											</button>
										{/each}
									</div>
								{/if}
							{/if}
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Role</span></div>
								<select class="select select-bordered w-full" bind:value={inviteRole}>
									<option value="member">Member</option>
									<option value="admin">Admin</option>
								</select>
							</label>
							<label class="form-control w-full">
								<div class="label"><span class="label-text">Position (optional)</span></div>
								<input type="text" class="input input-bordered w-full" bind:value={invitePosition} placeholder="e.g. Guitarist" />
							</label>
						</div>
					{/snippet}
				</Action>
				</div>
			</header>
		{/snippet}
		<DataTable data={members} empty="No members">
			<Column key="userName" header="Member" stopClick>
				{#snippet cell(_, m)}
					<MemberLink name={m.userName} email={m.userEmail} pronouns={m.userPronouns} role={m.userRole} userId={m.userId} />
				{/snippet}
			</Column>
			<Column key="role" header="Role" shrink stopClick>
				{#snippet cell(_, m)}
					{#if m.role !== 'owner' && m.status === 'active'}
						<select
							class="select select-bordered select-xs"
							value={m.role}
							onchange={(e) => updateMemberRole({ memberId: m.id, role: e.currentTarget.value as 'admin' | 'member' })}
						>
							<option value="member">Member</option>
							<option value="admin">Admin</option>
						</select>
					{:else}
						<Badge variant="outline">{m.role}</Badge>
					{/if}
				{/snippet}
			</Column>
			<Column key="position" header="Position">
				{#snippet cell(_, m)}
					<span class="text-sm opacity-70">{m.position ?? '—'}</span>
				{/snippet}
			</Column>
			<Column key="status" header="Status" shrink>
				{#snippet cell(_, m)}
					<StatusBadge status={m.status} />
				{/snippet}
			</Column>
			<Column key="createdAt" header="Joined" type="date" shrink />
			<Column key="actions" header="" shrink stopClick>
				{#snippet cell(_, m)}
					{#if m.role !== 'owner'}
						<div class="flex gap-1 justify-end">
							{#if m.status === 'pending'}
								<Action
									action={() => revokeInvite({ memberId: m.id })}
									label="Revoke"
									confirm={`Revoke invitation for ${m.userName}?`}
									successToast="Invitation revoked"
									class="btn-ghost btn-xs text-warning"
									onsuccess={() => invalidateAll()}
								/>
							{/if}
							{#if m.status === 'active'}
								<Action
									action={() => transferBandOwnership({ newOwnerId: m.userId })}
									label="Make owner"
									confirm={`Transfer ownership to ${m.userName}? The current owner will be demoted to admin.`}
									successToast="Ownership transferred"
									class="btn-ghost btn-xs"
								/>
							{/if}
							<Action
								action={() => removeBandMember({ memberId: m.id })}
								label="Remove"
								confirm={`Remove ${m.userName} from this band?`}
								successToast="Member removed"
								class="btn-ghost btn-xs text-error"
							/>
						</div>
					{/if}
				{/snippet}
			</Column>
		</DataTable>
	</InfoCard>

	<!-- Platform invites -->
	{#if platformInvites.filter((i) => i.status === 'pending').length > 0}
		<InfoCard title="Awaiting Signup">
			<DataTable data={platformInvites.filter((i) => i.status === 'pending')} empty="No pending email invites">
				<Column key="email" header="Email" />
				<Column key="role" header="Role" shrink>
					{#snippet cell(_, inv)}
						<Badge variant="outline">{inv.role}</Badge>
					{/snippet}
				</Column>
				<Column key="position" header="Position">
					{#snippet cell(_, inv)}
						<span class="text-sm opacity-70">{inv.position ?? '—'}</span>
					{/snippet}
				</Column>
				<Column key="invitedByName" header="Invited by" />
				<Column key="actions" header="" shrink stopClick>
					{#snippet cell(_, inv)}
						<Action
							action={() => revokePlatformInvite({ inviteId: inv.id })}
							label="Revoke"
							confirm={`Revoke invite for ${inv.email}?`}
							successToast="Invite revoked"
							class="btn-ghost btn-xs text-warning"
						/>
					{/snippet}
				</Column>
			</DataTable>
		</InfoCard>
	{/if}

	<!-- Email invite action (embedded in Members header) -->

	<InfoCard title="Recent Reservations">
		<DataTable data={reservations} rowHref={(r) => `/staff/reservations/${r.id}`} empty="No reservations">
			<Column key="startsAt" header="Date">
				{#snippet cell(_, r)}
					{formatDate(r.startsAt.toISOString())}
				{/snippet}
			</Column>
			<Column key="time" header="Time">
				{#snippet cell(_, r)}
					<span class="text-sm">{formatTimeRange(r.startsAt.toISOString(), r.endsAt.toISOString())}</span>
				{/snippet}
			</Column>
			<Column key="status" header="Status" shrink>
				{#snippet cell(_, r)}
					<StatusBadge status={r.status} />
				{/snippet}
			</Column>
			<Column key="bookedByName" header="Booked by">
				{#snippet cell(_, r)}
					<span class="text-sm">{r.bookedByName ?? '—'}</span>
				{/snippet}
			</Column>
			<Column key="notes" header="Notes">
				{#snippet cell(_, r)}
					<span class="text-sm opacity-70 max-w-xs truncate">{r.notes ?? '—'}</span>
				{/snippet}
			</Column>
		</DataTable>
	</InfoCard>
	</PageContent>
