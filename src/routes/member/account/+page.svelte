<script lang="ts">
	import type { PageServerData } from './$types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Form from '$lib/components/Form.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import InfoCard from '$lib/components/InfoCard.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { goto } from '$app/navigation';
	import { updateProfile, changePassword, deleteAccount } from './data.remote';

	let { data }: { data: PageServerData } = $props();

	const profileInitial = $derived({
		name: data.user.name,
		pronouns: data.user.pronouns ?? '',
		phone: data.user.phone ?? ''
	});

	const passwordInitial = { currentPassword: '', newPassword: '', confirmPassword: '' };
	const deleteInitial = { password: '' };

	let showPasswordModal = $state(false);
	let showDeleteModal = $state(false);
</script>

<div class="max-w-2xl space-y-6">
	<PageHeader title="Account Settings" />

	<!-- Profile info -->
	<InfoCard title="Contact Information">
		<Form
			remote={updateProfile}
			initial={profileInitial}
			successToast="Contact info updated"
			errorToast="Update failed"
		>
			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<FormField label="Name" id="name" issues={updateProfile.fields.name.issues()}>
						<input
							id="name"
							name="name"
							type="text"
							value={data.user.name}
							class="input input-bordered w-full"
							required
						/>
					</FormField>

					<FormField label="Pronouns" id="pronouns" issues={updateProfile.fields.pronouns.issues()}>
						<input
							id="pronouns"
							name="pronouns"
							type="text"
							value={data.user.pronouns ?? ''}
							class="input input-bordered w-full"
							placeholder="e.g. they/them"
						/>
					</FormField>
				</div>

				<FormField label="Email" id="email" issues={[]}>
					<input
						id="email"
						type="email"
						value={data.user.email}
						class="input input-bordered w-full"
						disabled
					/>
					<p class="text-xs opacity-50 mt-1">Contact staff to change your email address.</p>
				</FormField>

				<FormField label="Phone" id="phone" issues={updateProfile.fields.phone.issues()}>
					<input
						id="phone"
						name="phone"
						type="tel"
						value={data.user.phone ?? ''}
						class="input input-bordered w-full"
						placeholder="(541) 555-0123"
					/>
				</FormField>

				<div class="flex justify-end pt-2">
					<SubmitButton label="Save" successLabel="Saved" class="btn-primary" shortcut="mod+s" />
				</div>
			</div>
		</Form>
	</InfoCard>

	<!-- Security -->
	<InfoCard title="Security">
		<div class="space-y-4">
			<div class="flex items-center justify-between">
				<p class="text-sm opacity-70">Change your account password.</p>
				<button class="btn btn-outline btn-sm" onclick={() => (showPasswordModal = true)}>
					Change Password
				</button>
			</div>

			<div class="divider my-0"></div>

			<div class="flex items-center justify-between">
				{#if data.isStaff}
					<p class="text-sm opacity-70">Contact an admin to delete your account.</p>
					<span class="btn btn-error btn-sm btn-disabled">Delete Account</span>
				{:else}
					<p class="text-sm opacity-70">Permanently delete your account and all associated data.</p>
					<button class="btn btn-error btn-sm" onclick={() => (showDeleteModal = true)}>
						Delete Account
					</button>
				{/if}
			</div>
		</div>
	</InfoCard>

	<Modal title="Change Password" bind:open={showPasswordModal}>
		<Form
			remote={changePassword}
			initial={passwordInitial}
			successToast="Password changed"
			errorToast="Password change failed"
			onsuccess={() => (showPasswordModal = false)}
		>
			<div class="space-y-4">
				<FormField label="Current password" id="currentPassword" issues={changePassword.fields.currentPassword.issues()}>
					<input
						id="currentPassword"
						name="currentPassword"
						type="password"
						class="input input-bordered w-full"
						autocomplete="current-password"
					/>
				</FormField>

				<FormField label="New password" id="newPassword" issues={changePassword.fields.newPassword.issues()}>
					<input
						id="newPassword"
						name="newPassword"
						type="password"
						class="input input-bordered w-full"
						autocomplete="new-password"
					/>
				</FormField>

				<FormField label="Confirm new password" id="confirmPassword" issues={changePassword.fields.confirmPassword.issues()}>
					<input
						id="confirmPassword"
						name="confirmPassword"
						type="password"
						class="input input-bordered w-full"
						autocomplete="new-password"
					/>
				</FormField>

				<div class="flex justify-end pt-2">
					<SubmitButton label="Change Password" successLabel="Changed" class="btn-primary" />
				</div>
			</div>
		</Form>
	</Modal>

	<Modal title="Delete Account" bind:open={showDeleteModal}>
		<Form
			remote={deleteAccount}
			initial={deleteInitial}
			successToast="Account deleted"
			errorToast="Deletion failed"
			onsuccess={() => goto('/demo/better-auth/login')}
		>
			<div class="space-y-4">
				<div class="alert alert-error">
					<p>
						This action is permanent. Deleting your account will cancel all of your current and
						future reservations and end your subscription. This cannot be undone.
					</p>
				</div>

				<FormField
					label="Enter your password to confirm"
					id="password"
					issues={deleteAccount.fields.password.issues()}
				>
					<input
						id="password"
						name="password"
						type="password"
						class="input input-bordered w-full"
						autocomplete="current-password"
					/>
				</FormField>

				<div class="flex justify-end pt-2">
					<SubmitButton label="Delete My Account" successLabel="Deleted" class="btn-error" />
				</div>
			</div>
		</Form>
	</Modal>
</div>
