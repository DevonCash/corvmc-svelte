<script lang="ts">
	import type { PageServerData } from './$types';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Form from '$lib/components/Form.svelte';
	import FormField from '$lib/components/FormField.svelte';
	import SubmitButton from '$lib/components/SubmitButton.svelte';
	import InfoCard from '$lib/components/InfoCard.svelte';
	import { updateProfile, changePassword } from './data.remote';

	let { data }: { data: PageServerData } = $props();

	const profileInitial = $derived({
		name: data.user.name,
		pronouns: data.user.pronouns ?? '',
		phone: data.user.phone ?? ''
	});

	const passwordInitial = { currentPassword: '', newPassword: '', confirmPassword: '' };
</script>

<div class="max-w-2xl space-y-6">
	<PageHeader title="Account Settings" />

	<!-- Profile info -->
	<InfoCard title="Profile">
		<Form
			remote={updateProfile}
			initial={profileInitial}
			successToast="Profile updated"
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

	<!-- Change password -->
	<InfoCard title="Change Password">
		<Form
			remote={changePassword}
			initial={passwordInitial}
			successToast="Password changed"
			errorToast="Password change failed"
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
	</InfoCard>
</div>
