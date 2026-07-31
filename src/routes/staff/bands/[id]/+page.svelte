<script lang="ts">
	import { page } from '$app/state';

	import {
		getStaffBand as getBand,
		getStaffBandMembers as getBandMembers,
		getBandReservations,
		updateMemberRole,
		getStaffPlatformInvites as getPlatformInvites
	} from '$lib/remote/bands.remote';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import MemberLink from '$lib/components/shared/MemberLink.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatDate, formatTimeRange } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import {
		InviteByEmailAction,
		InviteMemberAction,
		RevokeInviteAction,
		TransferOwnershipAction,
		RemoveBandMemberAction,
		RevokePlatformInviteAction
	} from '$lib/components/shared/actions';
	import StaffBandForm from './StaffBandForm.svelte';

	let id = $derived(page.params.id!);
	let band = $derived(await getBand(id));
	let members = $derived(await getBandMembers(id));
	let reservations = $derived(await getBandReservations(id));
	let platformInvites = $derived(await getPlatformInvites(id));
</script>

<!-- The band info form lives in a fully synchronous component: a top-level
     await here marks later declarations "blocked", compiling its bind:value /
     fields expressions into async deriveds — the churn behind the
     effect_update_depth_exceeded crash (same bug as /member/profile). -->
<StaffBandForm {band} {id} />

<PageContent width="3xl">
	<InfoCard title="Members">
		{#snippet header(title)}
			<header class="flex justify-between items-center">
				<span class="card-title">{title}</span>
				<div class="flex gap-2">
					<InviteByEmailAction bandId={id} />
					<InviteMemberAction bandId={id} />
				</div>
			</header>
		{/snippet}
		{#if members.length === 0}
			<p class="text-center opacity-60 py-8">No members</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Member</th>
							<th class="w-px">Role</th>
							<th>Position</th>
							<th class="w-px">Status</th>
							<th class="w-px">Joined</th>
							<th class="w-px"></th>
						</tr>
					</thead>
					<tbody>
						{#each members as m (m.id)}
							<tr class="hover">
								<td onclick={(e) => e.stopPropagation()}>
									<MemberLink
										member={{
											name: m.userName,
											email: m.userEmail,
											pronouns: m.userPronouns,
											role: m.userRole,
											userId: m.userId
										}}
									/>
								</td>
								<td class="w-px" onclick={(e) => e.stopPropagation()}>
									{#if m.role !== 'owner' && m.status === 'active'}
										{@const rf = updateMemberRole.for(m.id)}
										<form
											{...rf.enhance(async ({ submit }) => {
												if (await submit()) toast.success('Role updated');
												else toast.error('Failed to update role');
											})}
										>
											<input {...rf.fields.memberId.as('hidden', m.id)} />
											<select
												class="select select-bordered select-xs"
												name="role"
												value={m.role}
												onchange={(e) => e.currentTarget.form?.requestSubmit()}
											>
												<option value="member">Member</option>
												<option value="admin">Admin</option>
											</select>
										</form>
									{:else}
										<Badge variant="outline">{m.role}</Badge>
									{/if}
								</td>
								<td>
									<span class="text-sm opacity-70">{m.position ?? '—'}</span>
								</td>
								<td class="w-px">
									<StatusBadge status={m.status} />
								</td>
								<td class="w-px">{formatDate(m.createdAt)}</td>
								<td class="w-px" onclick={(e) => e.stopPropagation()}>
									{#if m.role !== 'owner'}
										<div class="flex gap-1 justify-end">
											{#if m.status === 'pending'}
												<RevokeInviteAction bandId={id} memberId={m.id} name={m.userName} />
											{/if}
											{#if m.status === 'active'}
												<TransferOwnershipAction
													bandId={id}
													newOwnerId={m.userId}
													name={m.userName}
												/>
											{/if}
											<RemoveBandMemberAction bandId={id} memberId={m.id} name={m.userName} />
										</div>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</InfoCard>

	<!-- Platform invites -->
	{#if platformInvites.filter((i) => i.status === 'pending').length > 0}
		<InfoCard title="Awaiting Signup">
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Email</th>
							<th class="w-px">Role</th>
							<th>Position</th>
							<th>Invited by</th>
							<th class="w-px"></th>
						</tr>
					</thead>
					<tbody>
						{#each platformInvites.filter((i) => i.status === 'pending') as inv (inv.id)}
							<tr class="hover">
								<td>{inv.email}</td>
								<td class="w-px"><Badge variant="outline">{inv.role}</Badge></td>
								<td><span class="text-sm opacity-70">{inv.position ?? '—'}</span></td>
								<td>{inv.invitedByName}</td>
								<td class="w-px" onclick={(e) => e.stopPropagation()}>
									<RevokePlatformInviteAction bandId={id} inviteId={inv.id} email={inv.email} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</InfoCard>
	{/if}

	<InfoCard title="Recent Reservations">
		{#if reservations.length === 0}
			<p class="text-center opacity-60 py-8">No reservations</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="table">
					<thead>
						<tr>
							<th>Date</th>
							<th>Time</th>
							<th class="w-px">Status</th>
							<th>Booked by</th>
							<th>Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each reservations as r (r.id)}
							<tr
								class="hover cursor-pointer"
								onclick={() => goto(resolve(`/staff/reservations/${r.id}`))}
							>
								<td>{formatDate(r.startsAt)}</td>
								<td><span class="text-sm">{formatTimeRange(r.startsAt, r.endsAt)}</span></td>
								<td class="w-px"><StatusBadge status={r.status} /></td>
								<td><span class="text-sm">{r.bookedByName ?? '—'}</span></td>
								<td><span class="text-sm opacity-70 max-w-xs truncate">{r.notes ?? '—'}</span></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</InfoCard>
</PageContent>
