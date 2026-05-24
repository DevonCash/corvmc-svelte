<script lang="ts">
	import { formatDate, formatTime, formatCents } from '$lib/utils/format';
	import type { ISODateString } from '$lib/server/db/schema/columns';
	import Logo from '$lib/components/shared/Logo.svelte';

	interface Props {
		href: string;
		title: string;
		posterUrl?: string | null;
		startsAt: ISODateString;
		ticketingEnabled?: boolean;
		ticketPrice?: number | null;
		tags?: string | null;
		class?: string;
	}

	let {
		href,
		title,
		posterUrl,
		startsAt,
		ticketingEnabled = false,
		ticketPrice,
		tags,
		class: className = ''
	}: Props = $props();

	function parseTags(raw: string | null | undefined): string[] {
		if (!raw) return [];
		return raw.split(',').map((t) => t.trim()).filter(Boolean);
	}

	const tagList = $derived(parseTags(tags));
</script>

<a {href} class="poster-card {className}">
	<figure class="poster-card__figure">
		{#if posterUrl}
			<img src={posterUrl} alt={title} />
		{:else}
			<div class="flex flex-col items-center justify-center gap-2 p-6 text-center" style="color: var(--cmc-navy)">
				<Logo soundLines={false} class="h-16 w-auto opacity-40" />
				<span class="text-sm font-bold opacity-50">{title}</span>
			</div>
		{/if}
	</figure>
	<div class="poster-card__caption">
		<div class="poster-card__caption-text">
			<div class="poster-card__title">{title}</div>
			<div class="poster-card__date">
				{formatDate(startsAt)} · {formatTime(startsAt)}
				{#if ticketingEnabled && ticketPrice}
					· {formatCents(ticketPrice)}
				{/if}
			</div>
		</div>
	</div>
	{#if tagList.length > 0}
		<div class="absolute right-0 top-4 flex flex-col gap-1.5 items-end">
			{#each tagList as tag (tag)}
				<span class="sticker-badge sticker-badge--sm">{tag}</span>
			{/each}
		</div>
	{/if}
</a>

<style>
	.poster-card {
		position: relative;
		display: flex;
		flex-direction: column;
		max-width: 380px;
		border: 5px solid var(--cmc-parchment);
		background: var(--cmc-parchment);
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.08),
			0 8px 18px -8px rgba(40, 25, 10, 0.35);
		text-decoration: none;
		color: inherit;
		cursor: pointer;
		transform: rotate(var(--tilt, 0deg));
		transform-origin: top center;
		transition:
			transform 300ms cubic-bezier(0.34, 1.25, 0.64, 1),
			box-shadow 300ms ease;
		will-change: transform;
	}
	.poster-card:hover {
		transform: rotate(0deg);
		z-index: 2;
		box-shadow:
			0 1px 2px rgba(0, 0, 0, 0.08),
			0 14px 26px -8px rgba(40, 25, 10, 0.45);
	}
	.poster-card:nth-child(3n + 1) {
		--tilt: -1deg;
	}
	.poster-card:nth-child(3n + 2) {
		--tilt: 1.4deg;
	}
	.poster-card:nth-child(3n + 3) {
		--tilt: -0.6deg;
	}
	.poster-card:nth-child(5n) {
		--tilt: 1deg;
	}
	.poster-card:nth-child(7n) {
		--tilt: -1.5deg;
	}

	.poster-card__figure {
		aspect-ratio: 8.5 / 11;
		background: color-mix(in oklch, var(--cmc-light-blue) 60%, transparent);
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.poster-card__figure img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.poster-card__caption {
		background: var(--cmc-parchment);
		padding: 12px 14px;
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.poster-card__caption-text {
		min-width: 0;
		flex: 1;
	}
	.poster-card__title {
		font-weight: 700;
		font-size: 14px;
		line-height: 1.25;
		color: var(--cmc-brown);
		margin-bottom: 3px;
	}
	.poster-card__date {
		font-size: 11px;
		color: var(--cmc-brown);
		opacity: 0.7;
	}
</style>
