<script lang="ts">
	import Action from '../Action.svelte';
	import Select from '$lib/components/shared/Form/Select.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import { invalidateAll } from '$app/navigation';
	import { adjustCredits } from '$lib/remote/users.remote';

	let {
		userId,
		class: className = 'btn-outline btn-sm',
		onsuccess,
		...rest
	}: {
		userId: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();

	const { fields } = adjustCredits;

	let creditType = $state<'free_hours' | 'equipment_credits'>('free_hours');
	let amount = $state(0);
	let description = $state('');
</script>

<Action
	action={adjustCredits}
	label="Adjust"
	modalTitle="Adjust Credits"
	successToast="Credits adjusted"
	class={className}
	canSubmit={amount !== 0 && description.trim().length > 0}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
>
	{#snippet form()}
		<input {...fields.userId.as('hidden', userId)} />
		<div class="space-y-3">
			<!-- FormField in custom-input mode: the inputs keep their own
			     `fields.*.as(...)` spreads so what gets submitted is unchanged, but
			     the wrapper supplies the error slot. Without it, a field issue from
			     the server sets aria-invalid and renders no message at all — which
			     is what happened to the over-deduction message before. -->
			<FormField field={fields.creditType} label="Credit Type">
				<Select
					class="select-bordered w-full"
					{...fields.creditType.as('select')}
					bind:value={creditType}
				>
					<option value="free_hours">Free Hours</option>
					<option value="equipment_credits">Equipment Credits</option>
				</Select>
			</FormField>
			<FormField field={fields.amount} label="Amount">
				<input
					{...fields.amount.as('text')}
					type="number"
					class="input input-bordered w-full"
					bind:value={amount}
					placeholder="Positive to add, negative to deduct"
				/>
			</FormField>
			<FormField field={fields.description} label="Reason">
				<input
					{...fields.description.as('text')}
					class="input input-bordered w-full"
					bind:value={description}
					placeholder="Why is this adjustment being made?"
				/>
			</FormField>
		</div>
	{/snippet}
</Action>
