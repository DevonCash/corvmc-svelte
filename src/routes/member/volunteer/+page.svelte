<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatCard from '$lib/components/shared/StatCard.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import Form, { CheckboxGroup, SubmitButton } from '$lib/components/shared/Form';
	import { formatDateShort, formatDateShortYear } from '$lib/utils/format';
	import {
		clubToday,
		formatVolunteerHours,
		volunteerRoleGroups,
		volunteerRoleGroupLabels,
		DEFAULT_TIMEZONE,
		VOLUNTEER_HOUR_STEP
	} from '$lib/config';
	import { IconPencil, IconTrash } from '@tabler/icons-svelte';
	import {
		getActiveVolunteerRoles,
		getMyVolunteerHours,
		getMyVolunteerInterests,
		getMyVolunteerSummary,
		saveVolunteerInterests,
		submitVolunteerHours,
		editVolunteerHours,
		withdrawVolunteerHours
	} from '$lib/remote/volunteer.remote';

	type Role = { id: string; name: string; group: string; descriptionHtml: string | null };

	let roles = $derived(getActiveVolunteerRoles());
	let interests = $derived(getMyVolunteerInterests());
	let logs = $derived(getMyVolunteerHours());
	let summary = $derived(getMyVolunteerSummary());

	// Group order comes from the enum, not from the data, so the columns stay put
	// as roles are added. Empty groups drop out rather than rendering a bare
	// heading — a club with no committees shouldn't see the word.
	function groupedRoles(all: Role[]) {
		return volunteerRoleGroups
			.map((key) => ({ key, roles: all.filter((r) => r.group === key) }))
			.filter((g) => g.roles.length > 0);
	}

	// Club time, not UTC: after 5pm PT the UTC date is already tomorrow, and the
	// service rejects a future date — so a UTC-defaulted input offered a value
	// that could not be submitted.
	const today = clubToday();

	function toDateInput(date: Date): string {
		return new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TIMEZONE }).format(new Date(date));
	}

	function toHoursInput(minutes: number): string {
		return String(minutes / 60);
	}
</script>

<PageHeader title="Volunteering" subtitle="Member">
	{#await roles then roleOptions}
		{#if roleOptions.length > 0}
			<Action
				action={submitVolunteerHours}
				label="Log Hours"
				modalTitle="Log volunteer hours"
				submitLabel="Submit for review"
				successToast="Hours submitted for review"
			>
				{#snippet form()}
					<FormField
						name="volunteerRoleId"
						label="What did you help with?"
						type="select"
						options={roleOptions.map((r) => ({ value: r.id, label: r.name }))}
					/>
					<FormField name="workedOn" label="Date" type="date" value={today} max={today} />
					<FormField
						name="hours"
						label="Hours"
						type="number"
						step={VOLUNTEER_HOUR_STEP}
						min="0.25"
						description="To the nearest quarter hour."
					/>
					<FormField
						name="description"
						label="What you did"
						type="textarea"
						description="A sentence is plenty — it's what staff read when reviewing."
					/>
				{/snippet}
			</Action>
		{/if}
	{/await}
</PageHeader>

<PageContent width="3xl">
	{#await summary then s}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<StatCard title="Approved hours" value={formatVolunteerHours(s.approvedMinutes)} />
			<StatCard title="This year" value={formatVolunteerHours(s.approvedMinutesThisYear)} />
			<StatCard title="Awaiting review" value={formatVolunteerHours(s.pendingMinutes)} />
		</div>
	{/await}

	<!--
		The role list is the reason this page is worth opening when you have no
		hours to log: it's the only place that says what volunteering here involves,
		and ticking a box here is how staff know who to ask.
	-->
	{#await Promise.all([roles, interests]) then [roleOptions, myInterests]}
		<InfoCard title="What you can help with">
			{#if roleOptions.length === 0}
				<p class="text-sm opacity-60">
					No volunteer roles are open right now. Get in touch and we'll find you something.
				</p>
			{:else}
				<Form remote={saveVolunteerInterests} successToast="Saved — we'll be in touch">
					<p class="text-sm text-base-content/70">
						Tick anything that interests you. It isn't a commitment — it just tells us who to ask
						when something comes up, and we'll show you how to do it.
					</p>

					{#each groupedRoles(roleOptions) as group (group.key)}
						<CheckboxGroup
							field={saveVolunteerInterests.fields.roleIds}
							legend={volunteerRoleGroupLabels[group.key]}
							selected={myInterests}
							descriptionHtml
							options={group.roles.map((r) => ({
								value: r.id,
								label: r.name,
								description: r.descriptionHtml
							}))}
						/>
					{/each}

					<p class="text-sm opacity-60">
						Got an idea for a program, club, or class, or want to show art or perform? <a
							href={resolve('/contact')}
							class="link">Get in touch</a
						> — that's not a role, but we want to hear it.
					</p>

					<SubmitButton label="Save what I'm up for" class="btn-primary" />
				</Form>
			{/if}
		</InfoCard>
	{/await}

	{#await logs then rows}
		<InfoCard title="Your hours">
			{#if rows.length === 0}
				<EmptyState
					title="No hours logged yet"
					description="Once you've helped out, log the time here and staff will review it."
				/>
			{:else}
				<Table>
					{#snippet head()}
						<th class="w-px"><span class="sr-only">Status</span></th>
						<th>Role</th>
						<th class="col-support cell-num">Hours</th>
						<th class="col-support whitespace-nowrap">Date</th>
						<th class="w-px"><span class="sr-only">Actions</span></th>
					{/snippet}

					{#each rows as log (log.id)}
						<tr>
							<td class="w-px"><StatusBadge status={log.status} /></td>
							<td class="cell-primary">
								<div class="truncate font-medium">{log.roleName}</div>
								<div class="truncate text-xs opacity-60" title={log.description}>
									{log.description}
								</div>
								{#if log.status === 'rejected' && log.reviewNotes}
									<div class="mt-1 text-xs text-error">{log.reviewNotes}</div>
								{/if}
							</td>
							<td class="col-support cell-num">{formatVolunteerHours(log.minutes)}</td>
							<td class="col-support whitespace-nowrap">{formatDateShortYear(log.workedOn)}</td>
							<td class="w-px">
								<!-- Editing and withdrawing both close the moment staff act on it. -->
								{#if log.status === 'pending'}
									{#await roles then roleOptions}
										<div class="flex justify-end gap-1">
											<Action
												action={editVolunteerHours.for(log.id)}
												label="Edit"
												iconOnly
												icon={pencilIcon}
												class="btn-ghost btn-sm"
												modalTitle="Edit hours"
												successToast="Hours updated"
											>
												{#snippet form()}
													<input type="hidden" name="id" value={log.id} />
													<FormField
														name="volunteerRoleId"
														label="What did you help with?"
														type="select"
														value={log.volunteerRoleId}
														options={roleOptions.map((r) => ({ value: r.id, label: r.name }))}
													/>
													<FormField
														name="workedOn"
														label="Date"
														type="date"
														value={toDateInput(log.workedOn)}
														max={today}
													/>
													<FormField
														name="hours"
														label="Hours"
														type="number"
														step={VOLUNTEER_HOUR_STEP}
														min="0.25"
														value={toHoursInput(log.minutes)}
													/>
													<FormField
														name="description"
														label="What you did"
														type="textarea"
														value={log.description}
													/>
												{/snippet}
											</Action>

											<Action
												action={withdrawVolunteerHours.for(log.id)}
												label="Withdraw"
												iconOnly
												icon={trashIcon}
												class="btn-ghost btn-sm text-error"
												modalTitle="Withdraw these hours?"
												submitLabel="Withdraw"
												successToast="Hours withdrawn"
											>
												{#snippet form()}
													<input type="hidden" name="id" value={log.id} />
													<p class="text-sm">
														{formatVolunteerHours(log.minutes)} of {log.roleName} on
														{formatDateShort(log.workedOn)} will be deleted. You can log it again later.
													</p>
												{/snippet}
											</Action>
										</div>
									{/await}
								{/if}
							</td>
						</tr>
					{/each}
				</Table>
			{/if}
		</InfoCard>
	{/await}
</PageContent>

{#snippet pencilIcon()}
	<IconPencil size={16} />
{/snippet}

{#snippet trashIcon()}
	<IconTrash size={16} />
{/snippet}
