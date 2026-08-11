<script lang="ts">
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import Table from '$lib/components/shared/Table.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import {
		VOLUNTEER_ROLE_DESCRIPTION_MAX,
		volunteerRoleGroups,
		volunteerRoleGroupLabels
	} from '$lib/config';
	import { CheckboxGroup } from '$lib/components/shared/Form';
	import {
		IconPencil,
		IconArchive,
		IconArchiveOff,
		IconTrash,
		IconCertificate
	} from '@tabler/icons-svelte';
	import {
		getVolunteerRoles,
		getActiveCertifications,
		setRoleCertifications,
		createVolunteerRole,
		updateVolunteerRole,
		archiveVolunteerRole,
		restoreVolunteerRole,
		deleteVolunteerRole
	} from '$lib/remote/volunteer.remote';

	let roles = $derived(getVolunteerRoles());
	let certifications = $derived(getActiveCertifications());

	const groupOptions = volunteerRoleGroups.map((g) => ({
		value: g,
		label: volunteerRoleGroupLabels[g]
	}));

	const descriptionHelp =
		'Markdown. This is what members read on their volunteering page, so say what the job actually involves.';
</script>

<PageHeader title="Volunteer Roles" subtitle="Staff" backHref="/staff/volunteer">
	<Action
		action={createVolunteerRole}
		label="New Role"
		modalTitle="New volunteer role"
		submitLabel="Create"
		successToast="Role created"
	>
		{#snippet form()}
			<FormField name="name" label="Name" type="text" />
			<FormField
				name="description"
				label="Job description"
				type="textarea"
				description={descriptionHelp}
				maxlength={VOLUNTEER_ROLE_DESCRIPTION_MAX}
			/>
			<FormField name="group" label="Group" type="select" options={groupOptions} />
			<FormField
				name="displayOrder"
				label="Display order"
				type="number"
				value="0"
				description="Lower sorts first."
			/>
		{/snippet}
	</Action>
</PageHeader>

<PageContent width="3xl">
	{#await roles then rows}
		{#if rows.length === 0}
			<EmptyState
				title="No volunteer roles yet"
				description="Add a role and members can start logging hours against it."
			/>
		{:else}
			<Table>
				{#snippet head()}
					<th class="w-px"><span class="sr-only">Status</span></th>
					<th>Role</th>
					<th class="col-support cell-num">Logs</th>
					<th class="col-extra cell-num">Order</th>
					<th class="w-px"><span class="sr-only">Actions</span></th>
				{/snippet}

				{#each rows as role (role.id)}
					<tr class="hover">
						<td class="w-px">
							<StatusBadge status={role.isActive ? 'active' : 'retired'} />
						</td>

						<td class="cell-primary">
							<div class="truncate font-medium">{role.name}</div>
							{#if role.description}
								<div class="truncate text-xs opacity-60" title={role.description}>
									{role.description}
								</div>
							{/if}
							{#if role.requiredCertifications.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each role.requiredCertifications as cert (cert.id)}
										<span class="badge badge-ghost badge-xs">{cert.name}</span>
									{/each}
								</div>
							{/if}
						</td>

						<td class="col-support cell-num">{role.logCount}</td>
						<td class="col-extra cell-num">{role.displayOrder}</td>

						<td class="w-px">
							<div class="flex justify-end gap-1">
								<!--
									Requirements are their own action rather than a field on the edit
									form: they post an array to a different remote, and folding them
									in would mean one form writing to two services.
								-->
								{#await certifications then certOptions}
									{#if certOptions.length > 0}
										<Action
											action={setRoleCertifications.for(role.id)}
											label="Clearances"
											iconOnly
											icon={certificateIcon}
											class="btn-ghost btn-sm"
											modalTitle="What {role.name} requires"
											successToast="Requirements saved"
										>
											{#snippet form()}
												<input type="hidden" name="roleId" value={role.id} />
												<p class="text-sm opacity-70">
													Someone must hold all of these before they can claim a shift for this
													role. Logging hours is never blocked — the review queue just flags it.
												</p>
												<CheckboxGroup
													field={setRoleCertifications.fields.certificationIds}
													selected={role.requiredCertifications.map((c) => c.id)}
													options={certOptions.map((c) => ({
														value: c.id,
														label: c.name,
														description: c.issuedBy ?? 'Granted by CMC'
													}))}
												/>
											{/snippet}
										</Action>
									{/if}
								{/await}

								<Action
									action={updateVolunteerRole.for(role.id)}
									label="Edit"
									iconOnly
									icon={pencilIcon}
									class="btn-ghost btn-sm"
									modalTitle="Edit {role.name}"
									successToast="Role updated"
								>
									{#snippet form()}
										<input type="hidden" name="id" value={role.id} />
										<FormField name="name" label="Name" type="text" value={role.name} />
										<FormField
											name="description"
											label="Job description"
											type="textarea"
											value={role.description ?? ''}
											description={descriptionHelp}
											maxlength={VOLUNTEER_ROLE_DESCRIPTION_MAX}
										/>
										<FormField
											name="group"
											label="Group"
											type="select"
											value={role.group}
											options={groupOptions}
										/>
										<FormField
											name="displayOrder"
											label="Display order"
											type="number"
											value={String(role.displayOrder)}
										/>
									{/snippet}
								</Action>

								<!--
									Archive rather than delete is the normal retirement path: the
									role's hour logs stay resolvable in every report. Delete is
									offered only for a role nothing was ever logged against.
								-->
								{#if role.isActive}
									<Action
										action={archiveVolunteerRole.for(role.id)}
										label="Archive"
										iconOnly
										icon={archiveIcon}
										class="btn-ghost btn-sm"
										modalTitle="Archive {role.name}?"
										submitLabel="Archive"
										successToast="Role archived"
									>
										{#snippet form()}
											<input type="hidden" name="id" value={role.id} />
											<p class="text-sm">
												Members won't be able to log new hours against this role. Existing hours
												stay in the queue and in every report.
											</p>
										{/snippet}
									</Action>
								{:else}
									<Action
										action={restoreVolunteerRole.for(role.id)}
										label="Restore"
										iconOnly
										icon={unarchiveIcon}
										class="btn-ghost btn-sm"
										modalTitle="Restore {role.name}?"
										submitLabel="Restore"
										successToast="Role restored"
									>
										{#snippet form()}
											<input type="hidden" name="id" value={role.id} />
											<p class="text-sm">Members will be able to log hours against this again.</p>
										{/snippet}
									</Action>
								{/if}

								{#if role.logCount === 0}
									<Action
										action={deleteVolunteerRole.for(role.id)}
										label="Delete"
										iconOnly
										icon={trashIcon}
										class="btn-ghost btn-sm text-error"
										modalTitle="Delete {role.name}?"
										submitLabel="Delete"
										submitClass="btn-error"
										successToast="Role deleted"
									>
										{#snippet form()}
											<input type="hidden" name="id" value={role.id} />
											<p class="text-sm">
												Nothing has been logged against this role, so it can be removed outright.
											</p>
										{/snippet}
									</Action>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</Table>
		{/if}
	{/await}
</PageContent>

{#snippet certificateIcon()}
	<IconCertificate size={16} />
{/snippet}

{#snippet pencilIcon()}
	<IconPencil size={16} />
{/snippet}

{#snippet archiveIcon()}
	<IconArchive size={16} />
{/snippet}

{#snippet unarchiveIcon()}
	<IconArchiveOff size={16} />
{/snippet}

{#snippet trashIcon()}
	<IconTrash size={16} />
{/snippet}
