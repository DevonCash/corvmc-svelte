<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		audienceId,
		class: className = 'btn-primary btn-sm',
		onsuccess,
		...rest
	}: {
		audienceId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	let email = $state('');
	let name = $state('');

	function execute() {
		const result = actionFetch(`/api/marketing/audiences/${audienceId}/subscribers`, {
			body: { email: email.trim(), name: name.trim() || undefined }
		});
		email = '';
		name = '';
		return result;
	}
</script>

<Action
	action={execute}
	label="Add Subscriber"
	modalTitle="Add Subscriber"
	canSubmit={!!email.trim()}
	successToast="Subscriber added"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form({ close })}
		<div>
			<label for="sub-email" class="text-xs opacity-60">Email</label>
			<input
				id="sub-email"
				type="email"
				bind:value={email}
				placeholder="email@example.com"
				class="input-bordered input w-full"
				required
			/>
		</div>
		<div>
			<label for="sub-name" class="text-xs opacity-60">Name (optional)</label>
			<input
				id="sub-name"
				type="text"
				bind:value={name}
				placeholder="Name"
				class="input-bordered input w-full"
			/>
		</div>
	{/snippet}
</Action>
