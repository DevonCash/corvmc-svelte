<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { inviteByEmailApi } from '$lib/remote/bands';

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
</script>

<Action
	action={inviteByEmailApi}
	label="Invite by Email"
	modalTitle="Invite by Email"
	successToast="Email invitation sent"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="bandId" value={bandId} />
		<div class="space-y-3">
			<p class="text-sm opacity-70">Invite someone who doesn't have a CorvMC account. They'll get a signup link and be auto-added to this band.</p>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Email</span></div>
				<input type="email" name="email" class="input input-bordered w-full" placeholder="musician@example.com" />
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Role</span></div>
				<select class="select select-bordered w-full" name="role">
					<option value="member">Member</option>
					<option value="admin">Admin</option>
				</select>
			</label>
			<label class="form-control w-full">
				<div class="label"><span class="label-text">Position (optional)</span></div>
				<input type="text" name="position" class="input input-bordered w-full" placeholder="e.g. Bassist" />
			</label>
		</div>
	{/snippet}
</Action>
