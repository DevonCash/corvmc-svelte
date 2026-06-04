<script lang="ts">
	import ProfileSection from './ProfileSection.svelte';
	import { formatDayNumber, formatShortMonth, formatDayOfWeek } from '$lib/utils/format';

	export type Show = {
		id: string;
		title: string;
		startsAt: Date;
		location?: string | null;
		/** member (aggregated) view: which band this show is with */
		bandName?: string | null;
		bandSlug?: string | null;
		/** band (own) view: slot / role tags */
		tags?: string | null;
	};

	let {
		upcoming,
		pastCount,
		bandHref
	}: {
		upcoming: Show[];
		pastCount: number;
		/** base path for band links from member-aggregated rows, e.g. /member/directory/bands */
		bandHref?: string;
	} = $props();

	let tab = $state<'upcoming' | 'past'>('upcoming');
</script>

<ProfileSection title="Shows">
	{#snippet actions()}
		<div class="seg">
			<button
				type="button"
				class="seg__opt"
				class:is-active={tab === 'upcoming'}
				onclick={() => (tab = 'upcoming')}
			>
				Upcoming
			</button>
			<button
				type="button"
				class="seg__opt"
				class:is-active={tab === 'past'}
				onclick={() => (tab = 'past')}
			>
				Past · {pastCount}
			</button>
		</div>
	{/snippet}

	{#if tab === 'upcoming'}
		{#if upcoming.length > 0}
			<div class="shows">
				{#each upcoming as show (show.id)}
					<div class="show-row">
						<div class="show-row__date">
							<b>{formatDayNumber(show.startsAt)}</b>
							<span>{formatShortMonth(show.startsAt)} · {formatDayOfWeek(show.startsAt)}</span>
						</div>
						<div class="show-row__title">
							<p class="show-row__name">{show.title}</p>
							{#if show.location}
								<p class="show-row__sub">{show.location}</p>
							{/if}
						</div>
						{#if show.bandName}
							{#if bandHref && show.bandSlug}
								<a
									href="{bandHref}/{show.bandSlug}"
									class="sticker-badge sticker-badge--orange sticker-badge--sm"
								>
									w/ {show.bandName}
								</a>
							{:else}
								<span class="sticker-badge sticker-badge--orange sticker-badge--sm"
									>w/ {show.bandName}</span
								>
							{/if}
						{:else if show.tags}
							<span class="sticker-badge sticker-badge--sm">{show.tags}</span>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="shows__empty">No upcoming dates.</p>
		{/if}
	{:else if pastCount > 0}
		<p class="shows__empty">{pastCount} past {pastCount === 1 ? 'show' : 'shows'} played.</p>
	{:else}
		<p class="shows__empty">No past shows yet.</p>
	{/if}
</ProfileSection>

<style>
	.seg {
		display: inline-flex;
		border: 1px solid color-mix(in oklch, var(--cmc-brown) 28%, transparent);
		border-radius: var(--radius-pill, 9999px);
		overflow: hidden;
	}
	.seg__opt {
		font-size: 11px;
		font-weight: 600;
		padding: 4px 11px;
		background: var(--bg-card);
		color: var(--fg-2);
		cursor: pointer;
		font-variant-numeric: tabular-nums;
	}
	.seg__opt.is-active {
		background: var(--color-secondary);
		color: var(--color-secondary-content);
	}
	.shows {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.show-row {
		display: grid;
		grid-template-columns: 56px 1fr auto;
		gap: 12px;
		align-items: center;
		padding: 8px;
		border: 1px solid var(--surface-border);
		border-radius: var(--radius, 8px);
		background: var(--bg-card);
	}
	.show-row__date {
		text-align: center;
		border-right: 1px dashed color-mix(in oklch, var(--cmc-brown) 22%, transparent);
		padding-right: 10px;
		font-variant-numeric: tabular-nums;
	}
	.show-row__date b {
		display: block;
		font-size: 18px;
		line-height: 1;
		color: var(--color-secondary);
	}
	.show-row__date span {
		font-size: 10px;
		color: var(--fg-3);
	}
	.show-row__title {
		min-width: 0;
	}
	.show-row__name {
		margin: 0;
		font-weight: 600;
		font-size: 14px;
		color: var(--fg-1);
	}
	.show-row__sub {
		margin: 2px 0 0;
		font-size: 12px;
		color: var(--fg-3);
	}
	.shows__empty {
		margin: 0;
		font-size: 13px;
		color: var(--fg-3);
	}
</style>
