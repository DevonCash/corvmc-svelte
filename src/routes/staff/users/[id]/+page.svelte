<script lang="ts">
	import { page } from '$app/state';
	import { getUser, getAllRoles, updateUser } from './data.remote';
	import Form from '$lib/components/Form.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import TagInput from '$lib/components/TagInput.svelte';

	let id = $derived(page.params.id!);
	let [member, allRoles] = $derived(await Promise.all([getUser(id), getAllRoles()]));

	let roleOptions = $derived(
		allRoles.map((r) => ({ id: String(r.id), label: r.name }))
	);

	let initialRoles = $derived(
		allRoles
			.filter((r) => member.roles.includes(r.name))
			.map((r) => String(r.id))
	);

	let initial = $derived({
		name: member.name,
		pronouns: member.pronouns ?? '',
		phone: member.phone ?? '',
		roles: initialRoles
	});
</script>

<svelte:boundary>
	<Form
		remote={updateUser}
		{initial}
		successToast="Changes saved"
	>
		<PageHeader subtitle="User" title={member.name} backHref="/staff/users">
			{#if member.deletedAt}
				<span class="badge badge-error">Deleted</span>
			{/if}
			<SubmitButton shortcut="mod+s">
				{#snippet icon()}
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path d="M15.173 2H4a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4.827a2 2 0 00-.586-1.414l-1.827-1.827A2 2 0 0015.173 2zM10 14a2 2 0 110-4 2 2 0 010 4zM6 4h5v3H6V4z" />
					</svg>
				{/snippet}
			</SubmitButton>
		</PageHeader>

		<div class="grid gap-6 lg:grid-cols-2">
			<!-- Profile card -->
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Profile</h2>
					<div class="space-y-4">
						<div class="form-control">
							<label class="label" for="name">Name</label>
							{#each updateUser.fields.name.issues() ?? [] as issue}
								<p class="text-error text-sm">{issue.message}</p>
							{/each}
							<input
								{...updateUser.fields.name.as('text', member.name)}
								id="name"
								class="input input-bordered"
							/>
						</div>
						<div class="form-control">
							<label class="label" for="pronouns">Pronouns</label>
							<input
								{...updateUser.fields.pronouns.as('text', member.pronouns ?? '')}
								id="pronouns"
								class="input input-bordered"
							/>
						</div>
						<div class="form-control">
							<label class="label" for="phone">Phone</label>
							<input
								{...updateUser.fields.phone.as('text', member.phone ?? '')}
								id="phone"
								class="input input-bordered"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Roles card -->
			<div class="card bg-base-100 shadow">
				<div class="card-body">
					<h2 class="card-title">Roles</h2>
					<TagInput
						options={roleOptions}
						value={initialRoles}
						name="roles"
						placeholder="Search roles..."
					/>
				</div>
			</div>

			<!-- Info card -->
			<div class="card bg-base-100 shadow lg:col-span-2">
				<div class="card-body">
					<h2 class="card-title">Details</h2>
					<dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
						<dt class="opacity-60">User ID</dt>
						<dd class="font-mono text-xs">{member.id}</dd>

						<dt class="opacity-60">Stripe ID</dt>
						<dd class="font-mono text-xs">{member.stripeId ?? '—'}</dd>

						<dt class="opacity-60">Joined</dt>
						<dd>{new Date(member.createdAt).toLocaleString()}</dd>

						{#if member.deletedAt}
							<dt class="opacity-60">Deleted</dt>
							<dd>{new Date(member.deletedAt).toLocaleString()}</dd>
						{/if}
					</dl>
				</div>
			</div>
		</div>
	</Form>

	{#snippet pending()}
		<div class="flex items-center justify-center p-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{/snippet}

	{#snippet failed(error, reset)}
		<div class="alert alert-error">
			<p>Failed to load user: {String(error)}</p>
			<button class="btn btn-sm" onclick={reset}>Retry</button>
		</div>
	{/snippet}
</svelte:boundary>
