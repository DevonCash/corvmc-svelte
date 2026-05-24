<script lang="ts">
	import './layout.css';
	import './retro-buttons.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Tooltip } from 'bits-ui';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		const PRESS_MIN_MS = 140;
		const pressedUntil = new WeakMap<Element, number>();
		const releaseTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

		function press(el: Element) {
			if ((el as HTMLButtonElement).disabled) return;
			clearTimeout(releaseTimers.get(el));
			el.classList.add('is-pressing');
			pressedUntil.set(el, performance.now() + PRESS_MIN_MS);
		}
		function release(el: Element) {
			const wait = Math.max(0, (pressedUntil.get(el) ?? 0) - performance.now());
			releaseTimers.set(
				el,
				setTimeout(() => el.classList.remove('is-pressing'), wait)
			);
		}

		document.addEventListener('pointerdown', (e) => {
			const btn = (e.target as Element).closest('.btn');
			if (btn) press(btn);
		});
		for (const evt of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
			window.addEventListener(evt, () => {
				document.querySelectorAll('.btn.is-pressing').forEach(release);
			});
		}
		document.addEventListener('keydown', (e) => {
			if (e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return;
			const btn = (e.target as Element)?.closest?.('.btn');
			if (btn) press(btn);
		});
		document.addEventListener('keyup', (e) => {
			if (e.key !== 'Enter' && e.key !== ' ') return;
			const btn = (e.target as Element)?.closest?.('.btn');
			if (btn) release(btn);
		});
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.bunny.net" />
	<link href="https://fonts.bunny.net/css?family=lexend:300,400,500,600,700" rel="stylesheet" />
	<link rel="icon" href={favicon} />
</svelte:head>
<Tooltip.Provider delayDuration={300}>
	{@render children()}
</Tooltip.Provider>
