<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		bandId,
		class: className = 'btn-sm btn-outline btn-primary',
		onsuccess,
		...rest
	}: {
		bandId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let email = $state('');
	let role = $state<'admin' | 'member'>('member');
	let position = $state('');

	function execute() {
		const result = actionFetch(`/api/bands/${bandId}/invite-email`, {
			body: { email, role, position: position || undefined }
		});
		email = '';
		role = 'member';
		position = '';
		return result;
	}
</script>

<Action
	action={execute}
	label="Invite by Email"
	modalTitle="Invite by Email"
	canSubmit={!!email && email.includes('@')}
	successToast="Email invitation sent"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<div class="space-y-3">
			<p class="text-sm opacity-70">Invite someone who doesn't have a CorvMC account. They'll get a signup link and be auto-added to this band.</p>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Email</span></div>
				<input type="email" class="input input-bordered w-full" bind:value={email} placeholder="musician@example.com" />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Role</span></div>
				<select class="select select-bordered w-full" bind:value={role}>
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Position (optional)</span></div>
				<input type="text" class="input input-bordered w-full" bind:value={position} placeholder="e.g. Bassist" />
			</label>
		</div>
	{/snippet}
</Action>
