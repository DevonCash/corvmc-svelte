<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Button as BitsButton, Tooltip } from 'bits-ui';
	import { IconCheck, IconX } from '@tabler/icons-svelte';
	import { useShortcut, shortcutLabel } from '$lib/useShortcut.svelte';

	type Status = 'idle' | 'pending' | 'success' | 'error';

	let {
		href,
		type,
		label,
		title,
		icon,
		shortcut,
		status = 'idle',
		successLabel = 'Done',
		errorLabel = 'Error',
		disabled = false,
		class: className = 'btn-primary',
		children,
		...rest
	}: {
		href?: string;
		type?: 'button' | 'submit' | 'reset';
		label?: string;
		title?: string;
		icon?: Snippet;
		shortcut?: string;
		status?: Status;
		successLabel?: string;
		errorLabel?: string;
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		[key: string]: unknown;
	} = $props();

	let keys = useShortcut(
		() => shortcut,
		() => {
			if (!disabled && status !== 'pending') {
				(rest.onclick as (() => void) | undefined)?.();
			}
		}
	);

	let statusClass = $derived(
		status === 'success' ? 'btn-success' : status === 'error' ? 'btn-error' : ''
	);
</script>

{#snippet buttonContent()}
	{#if children}
		{@render children()}
	{:else if status === 'pending'}
		<span class="loading loading-sm loading-spinner"></span>
		{label}
	{:else if status === 'success'}
		<IconCheck size={20} />
		{successLabel}
	{:else if status === 'error'}
		<IconX size={20} />
		{errorLabel}
	{:else}
		{#if keys.modHeld && keys.parsed}
			<kbd class="kbd kbd-sm text-base-content">{shortcutLabel(keys.parsed)}</kbd>
		{:else if icon}
			{@render icon()}
		{/if}
		{label}
	{/if}
{/snippet}

{#snippet renderButton(extraProps?: Record<string, unknown>)}
	{#if href}
		<BitsButton.Root {href} {disabled} class="btn {statusClass || className}" {...extraProps} {...rest}>
			{@render buttonContent()}
		</BitsButton.Root>
	{:else}
		<BitsButton.Root {type} {disabled} class="btn {statusClass || className}" {...extraProps} {...rest}>
			{@render buttonContent()}
		</BitsButton.Root>
	{/if}
{/snippet}

{#if title}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				{@render renderButton(props)}
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Portal>
			<Tooltip.Content
				side="bottom"
				sideOffset={4}
				class="z-50 rounded bg-neutral px-2 py-1 text-xs text-neutral-content shadow-lg"
			>
				{title}
			</Tooltip.Content>
		</Tooltip.Portal>
	</Tooltip.Root>
{:else}
	{@render renderButton()}
{/if}

<style>
	/* ---------------------------------------------------------------------------
	   Retro buttons — default form factor for all DaisyUI buttons.
	   Hard brown border + offset drop shadow with press animation.
	   --------------------------------------------------------------------------- */
	:global(.btn) {
		--shadow: 0.4em;
		--shadow-size: var(--shadow);
		position: relative;
		border: 2.5px solid var(--shadow-color);
		box-shadow: 0 var(--shadow-size) 0 var(--shadow-color);
		transform: translate(0, calc(-1 * var(--shadow-size)));
		transition:
			transform 80ms ease,
			box-shadow 80ms ease;
	}

	:global(.btn:disabled) {
		--shadow: calc(var(--shadow / 2));
	}

	:global(.btn.flat) {
		--shadow: 0;
	}
	:global(.btn.flat:focus),
	:global(.btn.flat:hover) {
		filter: brightness(0.8);
	}

	:global(.btn::before) {
		z-index: -2;
		content: '';
		box-sizing: border-box;
		width: calc(100% + var(--shadow-size));
		height: calc(100% + var(--shadow-size));
		position: absolute;
		top: 0;
		right: 0;
		transition:
			width 80ms ease,
			height 80ms ease;
	}

	:global(.btn.latched) {
		z-index: -1;
		--shadow-size: calc(var(--shadow) / 3);
	}
	:global(.btn.latched:focus),
	:global(.btn.latched:hover) {
		--shadow-size: calc(var(--shadow) / 4);
	}

	:global(.btn:focus),
	:global(.btn:hover) {
		--shadow-size: calc(var(--shadow) * 0.75);
	}
	:global(.btn:active) {
		--shadow-size: 0;
	}

	:global(.btn-sm) {
		--shadow: 4px;
	}

	:global(.btn-xs) {
		--shadow: 2px;
	}

	/* Ghost → outline retro: transparent fill, visible brown border */
	:global(.btn-ghost) {
		background: var(--color-base-100);
		border-color: var(--shadow-color);
	}
</style>
