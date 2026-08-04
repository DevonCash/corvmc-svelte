<script lang="ts">
	/**
	 * A single-choice native select with daisyUI 5's supported markup.
	 *
	 * daisyUI styles `.select` as `display: inline-flex; align-items: center` with a
	 * fixed `height: var(--size)`, and ships rules that only match a wrapper —
	 * `.select > select { … }` and `.select:has(> select[disabled]) > select[disabled]`.
	 * Put the class on the `<select>` itself and a native control ignores the flex
	 * centering, so the selected text sits against the top of the box, and the
	 * disabled styling never matches at all. Hence: the class goes on this wrapper,
	 * the element inside stays bare.
	 *
	 * Sizing/variant/width classes (`select-sm`, `w-full`, `ghost`) belong on the
	 * wrapper via `class`; `id`, `name`, `disabled` and ARIA attributes are forwarded
	 * to the inner `<select>` so labels and validation still target the control.
	 *
	 * Multi-selects are deliberately not covered: daisyUI's `&[multiple]` rule drops
	 * the fixed height and matches the element carrying the class, so those keep the
	 * class on the `<select>` itself.
	 */
	import type { Snippet } from 'svelte';

	let {
		value = $bindable(),
		class: className = '',
		children,
		...rest
	}: {
		value?: unknown;
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	} = $props();
</script>

<div class="select {className}">
	<select bind:value {...rest}>
		{@render children()}
	</select>
</div>

<style>
	/* The bare inner control keeps the UA's 16px rather than picking up the
	   wrapper's size class, which rendered select text larger than the inputs
	   beside it. daisyUI's own `.select > select` rules don't cover this. */
	select {
		font: inherit;
	}
</style>
