<script lang="ts">
	import Button from '$lib/components/shared/Button.svelte';
	import { searchBandsForLineup } from '$lib/remote/band-events.remote';

	export type LineupChip = {
		name: string;
		bandId?: string;
		/** Absent on chips added in this session — the server decides. */
		status?: 'unlinked' | 'pending' | 'confirmed' | 'declined';
	};

	let {
		value = $bindable<LineupChip[]>([]),
		ownerBandId
	}: {
		value?: LineupChip[];
		/** The band doing the editing; its own slot can't be removed. */
		ownerBandId: string;
	} = $props();

	let query = $state('');

	const matches = $derived(
		query.trim().length >= 2 ? await searchBandsForLineup(query.trim()) : []
	);

	/** Suggestions minus anyone already on the bill. */
	const suggestions = $derived(matches.filter((m) => !value.some((v) => v.bandId === m.id)));

	function add(chip: LineupChip) {
		const nameKey = chip.name.trim().toLowerCase();
		if (!nameKey) return;
		const dupe = chip.bandId
			? value.some((v) => v.bandId === chip.bandId)
			: value.some((v) => v.name.trim().toLowerCase() === nameKey);
		if (dupe) return;

		value = [...value, { ...chip, name: chip.name.trim() }];
		query = '';
	}

	/** Enter on a non-match is the common case: most acts have no CMC account. */
	function onkeydown(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		if (query.trim()) add({ name: query });
	}

	function remove(i: number) {
		value = value.filter((_, j) => j !== i);
	}

	function move(i: number, delta: number) {
		const j = i + delta;
		if (j < 0 || j >= value.length) return;
		const next = [...value];
		[next[i], next[j]] = [next[j], next[i]];
		value = next;
	}

	function chipLabel(chip: LineupChip): string {
		if (!chip.bandId) return 'not on CMC';
		if (chip.status === 'confirmed') return 'confirmed';
		if (chip.status === 'declined') return 'declined';
		return 'awaiting reply';
	}

	function chipClass(chip: LineupChip): string {
		if (!chip.bandId) return 'badge-ghost';
		if (chip.status === 'confirmed') return 'badge-success';
		if (chip.status === 'declined') return 'badge-error';
		return 'badge-warning';
	}

	/** Serialized for the remote form; billingOrder is just the visual order. */
	const serialized = $derived(
		JSON.stringify(value.map((v, i) => ({ name: v.name, bandId: v.bandId, billingOrder: i })))
	);
</script>

<input type="hidden" name="lineup" value={serialized} />

<div class="space-y-2">
	{#each value as chip, i (chip.name + i)}
		<div class="flex items-center gap-2 rounded border border-base-300 bg-base-100 px-3 py-2">
			<span class="text-xs opacity-50 tabular-nums w-6">{i === 0 ? '★' : i + 1}</span>
			<span class="flex-1 truncate text-sm font-medium">{chip.name}</span>
			<span class="badge badge-sm {chipClass(chip)}">{chipLabel(chip)}</span>
			<div class="flex gap-1">
				<Button
					type="button"
					class="btn-ghost btn-xs"
					disabled={i === 0}
					onclick={() => move(i, -1)}
					aria-label="Move {chip.name} up">↑</Button
				>
				<Button
					type="button"
					class="btn-ghost btn-xs"
					disabled={i === value.length - 1}
					onclick={() => move(i, 1)}
					aria-label="Move {chip.name} down">↓</Button
				>
				<Button
					type="button"
					class="btn-ghost btn-xs text-error"
					disabled={chip.bandId === ownerBandId}
					onclick={() => remove(i)}
					aria-label="Remove {chip.name}">✕</Button
				>
			</div>
		</div>
	{/each}

	<div>
		<input
			type="text"
			class="input input-bordered w-full"
			placeholder="Add a band — type any name and press Enter"
			bind:value={query}
			{onkeydown}
		/>

		{#if suggestions.length > 0}
			<ul class="menu menu-sm mt-1 rounded border border-base-300 bg-base-100 p-1">
				{#each suggestions as b (b.id)}
					<li>
						<button type="button" onclick={() => add({ name: b.name, bandId: b.id })}>
							{b.name}
							<span class="badge badge-ghost badge-xs">on CMC</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<p class="mt-1 text-xs opacity-60">
			Anyone can go on the bill. Bands with a CMC account are asked to confirm before the show
			appears on their own profile — everyone else is listed as plain text.
		</p>
	</div>
</div>
