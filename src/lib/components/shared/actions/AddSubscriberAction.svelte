<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { addSubscriber } from '$lib/remote/marketing.remote';

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
</script>

<Action
	action={addSubscriber}
	label="Add Subscriber"
	modalTitle="Add Subscriber"
	canSubmit={!!email.trim()}
	successToast="Subscriber added"
	class={className}
	onsuccess={() => {
		email = '';
		name = '';
		(onsuccess ?? (() => invalidateAll()))();
	}}
	{...rest}
>
	{#snippet form({ close })}
		<input type="hidden" name="audienceId" value={audienceId} />
		<div>
			<label for="sub-email" class="text-xs opacity-60">Email</label>
			<input
				id="sub-email"
				type="email"
				name="email"
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
				name="name"
				bind:value={name}
				placeholder="Name"
				class="input-bordered input w-full"
			/>
		</div>
	{/snippet}
</Action>
