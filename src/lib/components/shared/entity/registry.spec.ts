import { describe, it, expect } from 'vitest';
import { entityKinds, statusRing } from './registry';
import { entityTypes, entityLabels, flagEntityTypeToEntity, type EntityType } from '$lib/config';
import { flagEntityTypes } from '$lib/server/db/schema/flag';
import { variants } from '../StatusBadge.svelte';

/**
 * The entity vocabulary is split across three files by necessity — values in
 * `config.ts` because the browser needs them, icons in `registry.ts` because
 * server code cannot import Svelte components, routes in `entity-href.ts`
 * because that has to stay pure. Nothing in the type system holds the three
 * together, so this does.
 *
 * Same idea as `StatusBadge.spec.ts`: adding an entity type and forgetting half
 * its wiring should fail here rather than render a wrong glyph in production.
 */
describe('entity registry', () => {
	it('draws every entity type', () => {
		const missing = entityTypes.filter((t) => !(t in entityKinds));
		expect(missing, `add these to entityKinds: ${missing.join(', ')}`).toEqual([]);
	});

	it('names every entity type', () => {
		const missing = entityTypes.filter((t) => !(t in entityLabels));
		expect(missing, `add these to entityLabels: ${missing.join(', ')}`).toEqual([]);
	});

	it('has no entries for types that no longer exist', () => {
		const known = new Set<string>(entityTypes);
		const stale = [...Object.keys(entityKinds), ...Object.keys(entityLabels)].filter(
			(k) => !known.has(k)
		);
		expect(stale, `remove these, or add them to entityTypes: ${stale.join(', ')}`).toEqual([]);
	});

	/**
	 * A chip is a glyph and a name. Two types sharing a glyph makes the glyph
	 * say nothing, which is the one failure the smallest tier cannot absorb.
	 */
	it('gives every type its own icon', () => {
		const byIcon = new Map<unknown, EntityType[]>();
		for (const type of entityTypes) {
			const icon = entityKinds[type].icon;
			byIcon.set(icon, [...(byIcon.get(icon) ?? []), type]);
		}
		const collisions = [...byIcon.values()].filter((types) => types.length > 1);
		expect(collisions, `these types share an icon: ${JSON.stringify(collisions)}`).toEqual([]);
	});

	/** The directory-wide convention, stated in prose in ui-patterns. */
	it('keeps member avatars round and band avatars square', () => {
		expect(entityKinds.member.shape).toBe('round');
		expect(entityKinds.band.shape).toBe('square');
	});

	/**
	 * A gig poster is portrait, always. Cropping one into a landscape strip
	 * throws away the half that carries the lineup, so the event type gets its
	 * own shape rather than borrowing the square avatar box.
	 */
	it('gives events a portrait poster box', () => {
		expect(entityKinds.event.shape).toBe('poster');
	});

	/**
	 * `contentFlag.entityType` is an older, narrower vocabulary. Before the
	 * bridge existed, `staff/flags/[id]` carried a hand-written label map and a
	 * five-deep nested ternary to turn one into a URL.
	 */
	it('maps every flag entity type onto an entity type', () => {
		const unmapped = flagEntityTypes.filter((t) => !(t in flagEntityTypeToEntity));
		expect(unmapped, `add these to flagEntityTypeToEntity: ${unmapped.join(', ')}`).toEqual([]);

		const known = new Set<string>(entityTypes);
		const dangling = Object.entries(flagEntityTypeToEntity).filter(([, v]) => !known.has(v));
		expect(dangling, `these point at unknown entity types: ${JSON.stringify(dangling)}`).toEqual(
			[]
		);
	});

	/**
	 * A card carries status as an outline round its media rather than a labelled
	 * badge. The ring colours are literal strings because Tailwind only emits
	 * classes it can see, so a new `variants` colour silently loses its ring
	 * unless this catches it.
	 */
	it('has a ring colour for every status colour StatusBadge uses', () => {
		const colours = [...new Set(Object.values(variants).map((v) => v.color))];
		const missing = colours.filter((c) => !(c in statusRing));
		expect(missing, `add these to statusRing: ${missing.join(', ')}`).toEqual([]);
	});
});
