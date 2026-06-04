<script lang="ts">
	import type { Snippet } from 'svelte';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { getFormContext } from './Form.svelte';
	import { useShortcut, shortcutLabel } from '$lib/useShortcut.svelte';
	import Button from '$lib/components/shared/Button.svelte';

	let {
		shortcut,
		icon,
		label = 'Save',
		continueLabel = 'Continue',
		successLabel = 'Saved',
		errorLabel = 'Error',
		class: className = 'btn-primary',
		disabled = false,
		...rest
	}: {
		shortcut?: string;
		icon?: Snippet;
		label?: string;
		continueLabel?: string;
		successLabel?: string;
		errorLabel?: string;
		class?: string;
		disabled?: boolean;
		[key: string]: unknown;
	} = $props();

	let ctx = getFormContext()!;

	const isLastStep = $derived(!ctx.hasSteps || ctx.currentStep === ctx.totalSteps - 1);
	const activeLabel = $derived(isLastStep ? label : continueLabel);
	const isDisabled = $derived(
		disabled || !ctx.currentStepValid || (ctx.status !== 'idle' && ctx.status !== 'dirty')
	);

	let keys = useShortcut(
		() => shortcut,
		() => {
			if (ctx.status !== 'pending' && !disabled) {
				if (isLastStep) ctx.submit();
				else ctx.next();
			}
		}
	);
</script>

<div class="flex items-center gap-2">
	{#if ctx.hasSteps && ctx.currentStep > 0}
		<Button type="button" class="btn-ghost" onclick={() => ctx.back()}>Back</Button>
	{/if}
	<button
		type={isLastStep ? 'submit' : 'button'}
		class="btn {className} {ctx.status === 'success' ? 'btn-success' : ''} {ctx.status === 'error'
			? 'btn-error'
			: ''}"
		disabled={isDisabled}
		onclick={isLastStep ? undefined : () => ctx.next()}
		{...rest}
	>
		{#if ctx.status === 'pending'}
			<span class="loading loading-spinner loading-sm"></span>
			{activeLabel}
		{:else if ctx.status === 'success'}
			<IconCheck size={20} />
			{successLabel}
		{:else if ctx.status === 'error'}
			<IconX size={20} />
			{errorLabel}
		{:else}
			{#if keys.modHeld && keys.parsed}
				<kbd class="kbd kbd-sm text-base-content">{shortcutLabel(keys.parsed)}</kbd>
			{:else if icon}
				{@render icon()}
			{/if}
			{activeLabel}
		{/if}
	</button>
</div>
