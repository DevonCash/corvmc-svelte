<script lang="ts">
	import speakerLogo from '$lib/assets/cmc-speaker-icon.svg';

	interface Props {
		href: string;
		name: string;
		image?: string | null;
		pronouns?: string | null;
		tagline?: string | null;
		instruments?: string[];
		genres?: string[];
		bands?: { name: string }[];
		lookingForBand?: boolean;
		memberSince: number;
	}

	let {
		href,
		name,
		image,
		pronouns,
		tagline,
		instruments = [],
		genres = [],
		bands = [],
		lookingForBand = false,
		memberSince
	}: Props = $props();

	function initials(n: string): string {
		return n
			.split(' ')
			.map((p) => p[0])
			.slice(0, 2)
			.join('')
			.toUpperCase();
	}
</script>

<a {href} class="id-card">
	<div class="id-card__header">
		<div class="id-card__brand">
			<img src={speakerLogo} alt="" class="id-card__logo" />
			<span>Corvallis Music<br />Collective</span>
		</div>
		<div class="id-card__tag">MEMBER</div>
	</div>
	<div class="id-card__body">
		<div class="id-card__photo">
			{#if image}
				<img src={image} alt={name} class="h-full w-full rounded object-cover" />
			{:else}
				{initials(name)}
			{/if}
		</div>
		<div class="id-card__info">
			<div class="id-card__name">
				{name}
				{#if pronouns}
					<span class="id-card__pronouns">{pronouns}</span>
				{/if}
			</div>
			{#if tagline}
				<div class="id-card__role">{tagline}</div>
			{/if}
			{#if instruments.length || genres.length}
				<div class="id-card__badges">
					{#each instruments as inst}
						<span class="id-tag id-tag--teal">{inst}</span>
					{/each}
					{#each genres as genre}
						<span class="id-tag id-tag--genre">{genre}</span>
					{/each}
				</div>
			{/if}
			{#if bands.length}
				<div class="id-card__bands">
					{#each bands as b}
						<span class="id-tag id-tag--band">{b.name}</span>
					{/each}
				</div>
			{/if}
		</div>
	</div>
	{#if lookingForBand}
		<div class="id-card__gaff">seeking a band</div>
	{/if}
	<div class="id-card__footer">
		<div class="id-card__since">Member since {memberSince}</div>
		<div class="id-card__barcode" aria-hidden="true"></div>
	</div>
</a>

<style>
	.id-card {
		position: relative;
		display: flex;
		flex-direction: column;
		background: #ffe8d6;
		width: 100%;
		max-width: 320px;
		border-radius: 10px;
		/* box-shadow:
			0 14px 26px -10px rgba(20, 20, 25, 0.4),
			0 4px 10px -4px rgba(20, 20, 25, 0.2),
			inset 0 0 0 1px rgba(0, 0, 0, 0.05); */
		border: 4px solid var(--cmc-brown);
		overflow: visible;
		transform: rotate(var(--tilt, -1deg));
		transition:
			transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1),
			box-shadow 220ms ease;
		cursor: pointer;
		padding: 0;
		aspect-ratio: 5 / 3;
		container-type: inline-size;
	}
	.id-card:focus,
	.id-card:hover {
		transform: rotate(0deg) translateY(-3px);
		box-shadow: -5px -5px -5px 0 var(--cmc-brown);
		/* box-shadow:
			0 20px 34px -10px rgba(20, 20, 25, 0.45),
			0 6px 14px -4px rgba(20, 20, 25, 0.25),
			inset 0 0 0 1px rgba(0, 0, 0, 0.05); */
	}
	.id-card:nth-child(3n + 1) {
		--tilt: -1.2deg;
	}
	.id-card:nth-child(3n + 2) {
		--tilt: 0.8deg;
	}
	.id-card:nth-child(3n + 3) {
		--tilt: -0.3deg;
	}
	.id-card:nth-child(5n) {
		--tilt: 1.6deg;
	}
	.id-card:nth-child(7n) {
		--tilt: -1.8deg;
	}

	.id-card__header {
		padding: 4cqi 5cqi 2.5cqi;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 3cqi;
		position: relative;
	}
	.id-card__brand {
		display: flex;
		align-items: center;
		gap: 1.5cqi;
		font-weight: 700;
		font-size: 3.3cqi;
		letter-spacing: 0.02em;
		color: var(--cmc-teal);
		line-height: 1.1;
		max-width: 65%;
	}
	.id-card__logo {
		height: 8cqi;
		width: auto;
		object-fit: contain;
		flex-shrink: 0;
	}
	.id-card__tag {
		font-weight: 700;
		font-size: 2.8cqi;
		letter-spacing: 0.16em;
		color: var(--cmc-teal);
		line-height: 1;
		padding: 1cqi 2.5cqi;
		border: 1.5px solid var(--cmc-teal);
		border-radius: 3px;
		flex-shrink: 0;
	}
	.id-card__header::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: -2cqi;
		height: 2cqi;
		background: linear-gradient(
			to bottom,
			var(--cmc-teal) 0 33.333%,
			var(--cmc-goldenrod) 33.333% 66.666%,
			var(--cmc-red-orange) 66.666% 100%
		);
	}
	.id-card__body {
		flex: 1;
		display: flex;
		gap: 3.5cqi;
		padding: 5cqi 5cqi 4cqi;
		align-items: stretch;
	}
	.id-card__photo {
		width: 17.5cqi;
		align-self: stretch;
		border-radius: 4px;
		background: var(--photo-bg, var(--cmc-light-blue));
		color: var(--cmc-navy);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 6cqi;
		letter-spacing: 0.02em;
		flex-shrink: 0;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.1);
	}
	.id-card__info {
		display: flex;
		flex-direction: column;
		gap: 0.5cqi;
		min-width: 0;
		flex: 1;
	}
	.id-card__name {
		font-weight: 700;
		font-size: 5.8cqi;
		line-height: 1.15;
		color: var(--cmc-navy);
	}
	.id-card__pronouns {
		white-space: nowrap;
		font-weight: 400;
		font-size: 3.2cqi;
		color: var(--fg-3);
		margin-left: 0.5cqi;
	}
	.id-card__role {
		font-size: 3.8cqi;
		color: var(--fg-2);
	}
	.id-card__badges {
		display: flex;
		gap: 1.2cqi;
		flex-wrap: wrap;
		margin-top: 1cqi;
	}
	.id-card__gaff {
		position: absolute;
		padding: 3px 10px;
		background: var(--color-primary);
		color: var(--color-primary-content);
		font-weight: 700;
		font-size: 0.55rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		transform: rotate(-2deg);
		z-index: 2;
		bottom: 4cqi;
		right: -2cqi;
	}

	.id-tag {
		display: inline-block;
		font-weight: 700;
		font-size: 2.9cqi;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		white-space: nowrap;
		color: rgba(90, 61, 43, 0.55);
		/* text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7); */
	}
	.id-tag--teal {
		color: rgba(0, 133, 155, 0.5);
		&:has(+ .id-tag--teal)::after {
			content: ', ';
		}
	}
	.id-tag--band {
		color: rgba(0, 59, 92, 0.5);

		&:has(+ .id-tag--band)::after {
			content: ', ';
		}
	}

	.id-tag--genre {
		&:has(+ .id-tag--genre)::after {
			content: ', ';
		}
	}
	.id-card__bands {
		display: flex;
		gap: 1.2cqi;
		flex-wrap: wrap;
	}
	.id-card__footer {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		padding: 0 5cqi 3cqi;
		gap: 3cqi;
	}
	.id-card__since {
		font-size: 2.6cqi;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(90, 61, 43, 0.4);
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.6);
		white-space: nowrap;
	}
	.id-card__barcode {
		flex: 1;
		max-width: 28cqi;
		height: 5cqi;
		background: repeating-linear-gradient(
			to right,
			rgba(90, 61, 43, 0.35) 0 0.5cqi,
			transparent 0.5cqi 1cqi,
			rgba(90, 61, 43, 0.35) 1cqi 1.3cqi,
			transparent 1.3cqi 2cqi,
			rgba(90, 61, 43, 0.35) 2cqi 2.3cqi,
			transparent 2.3cqi 3.2cqi,
			rgba(90, 61, 43, 0.35) 3.2cqi 3.5cqi,
			transparent 3.5cqi 4cqi,
			rgba(90, 61, 43, 0.35) 4cqi 5cqi,
			transparent 5cqi 5.4cqi,
			rgba(90, 61, 43, 0.35) 5.4cqi 5.7cqi,
			transparent 5.7cqi 6.5cqi
		);
	}
</style>
