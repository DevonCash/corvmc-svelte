/**
 * How each entity type is *drawn*: its glyph, and whether its avatar is round
 * or square.
 *
 * Split from the vocabulary in `$lib/config` on purpose. These values carry
 * Svelte icon components, so server code cannot import this file — while
 * `entityTypes` and `entityLabels` are read by both. The routing half lives in
 * `$lib/utils/entity-href`, which is pure so the policy can be unit-tested.
 *
 * A plain `.ts` rather than a `<script module>` on a component (the
 * `StatusBadge` precedent) because four components and a spec consume it, and a
 * module needs no rendering to be imported.
 *
 * `registry.spec.ts` asserts every `entityTypes` value appears here, that no
 * stale keys linger, and that **no two types share an icon** — a chip whose
 * only distinguishing mark is its glyph cannot survive a collision.
 */
import {
	IconUser,
	IconUsersGroup,
	IconCalendarEvent,
	IconMetronome,
	IconBulb,
	IconMessages,
	IconFlag,
	IconMail,
	IconAddressBook,
	IconTool,
	IconPackageExport,
	IconClock,
	IconHeartHandshake,
	IconRepeat,
	IconHelp
} from '@tabler/icons-svelte';
import type { SvelteComponent } from 'svelte';
import { entityTypes, type EntityType } from '$lib/config';

type IconComponent = typeof SvelteComponent<any>;

export type EntityKind = {
	icon: IconComponent;
	/**
	 * The directory-wide convention, stated in ui-patterns: a member avatar is
	 * always round, a band avatar always square. `none` is for the types that
	 * have no image of their own and render the glyph instead.
	 */
	shape: 'round' | 'square' | 'none';
};

export const entityKinds: Record<EntityType, EntityKind> = {
	member: { icon: IconUser, shape: 'round' },
	band: { icon: IconUsersGroup, shape: 'square' },
	event: { icon: IconCalendarEvent, shape: 'square' },
	reservation: { icon: IconMetronome, shape: 'none' },
	suggestion: { icon: IconBulb, shape: 'none' },
	thread: { icon: IconMessages, shape: 'none' },
	flag: { icon: IconFlag, shape: 'none' },
	campaign: { icon: IconMail, shape: 'none' },
	audience: { icon: IconAddressBook, shape: 'none' },
	equipment: { icon: IconTool, shape: 'square' },
	loan: { icon: IconPackageExport, shape: 'none' },
	shift: { icon: IconClock, shape: 'none' },
	role: { icon: IconHeartHandshake, shape: 'none' },
	recurring: { icon: IconRepeat, shape: 'none' },
	help: { icon: IconHelp, shape: 'none' }
};

/** Declaration order, for gallery stories and exhaustiveness checks. */
export const allEntityTypes = entityTypes;
