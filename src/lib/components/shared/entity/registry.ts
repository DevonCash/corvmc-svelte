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
	IconHelp,
	IconCrown,
	IconShield,
	IconHeart,
	IconMusic,
	IconSchool,
	IconBuildingCommunity
} from '@tabler/icons-svelte';
import type { SvelteComponent } from 'svelte';
import { entityTypes, entityLabels, type EntityType } from '$lib/config';
import type { EntityRef } from '$lib/types/entity';

type IconComponent = typeof SvelteComponent<any>;

export type EntitySubtype = { icon: IconComponent; label: string };

export type EntityKind = {
	icon: IconComponent;
	/**
	 * The directory-wide convention, stated in ui-patterns: a member avatar is
	 * always round, a band avatar always square.
	 *
	 * `poster` is portrait (2:3). A gig poster is never landscape, so an event
	 * cropped into a wide strip loses the half of the artwork that carries the
	 * lineup. `none` is for the types with no image of their own, which render
	 * the glyph instead.
	 */
	shape: 'round' | 'square' | 'poster' | 'none';
	/**
	 * Kinds *within* a type that are worth telling apart at a glance — a
	 * sustaining member against a plain one, a band's show against the org's.
	 *
	 * **Exception-only, and that is the whole design.** The ordinary case is
	 * deliberately absent here, so it gets no marker: `user` is missing from
	 * reservation and `cmc` from event for the same reason `member` is missing
	 * from member. A glyph on every row marks nothing. This is the rule
	 * `MemberLink` already followed for roles and
	 * `staff/reservations/+page.svelte` already followed with its
	 * `bookerType !== 'user'` guard; it is now stated once instead of at each
	 * call site.
	 */
	subtypes?: Record<string, EntitySubtype>;
};

export const entityKinds: Record<EntityType, EntityKind> = {
	member: {
		icon: IconUser,
		shape: 'round',
		// An explicit staff role outranks a subscription: someone can be both, and
		// which one you need to know about depends on why you are looking — but
		// staff is the one that changes what they can do to the record in front of
		// you. `memberSubtype()` encodes that precedence.
		// Distinct silhouettes, not three variants of a person. `MemberLink` used
		// user-cog / user-shield / user-heart, which at the 14px these render at
		// are one shape with an indistinguishable speck attached — the glyph has
		// to be legible at a glance or it is only decoration.
		subtypes: {
			admin: { icon: IconCrown, label: 'Admin' },
			staff: { icon: IconShield, label: 'Staff' },
			sustaining: { icon: IconHeart, label: 'Sustaining member' }
		}
	},
	band: { icon: IconUsersGroup, shape: 'square' },
	event: {
		icon: IconCalendarEvent,
		shape: 'poster',
		// `cmc` is absent on purpose — the collective's own show is the default,
		// and marking it would mark almost everything.
		subtypes: {
			band: { icon: IconMusic, label: "A band's show" },
			community: { icon: IconBuildingCommunity, label: 'Community listing' }
		}
	},
	reservation: {
		icon: IconMetronome,
		shape: 'none',
		// `user` is absent: a member booking for themselves is the ordinary case.
		// `lesson` is present because `BookerTypeIcon` silently rendered *nothing*
		// for it — the one booker type with no glyph at all.
		subtypes: {
			band: { icon: IconMusic, label: 'Booked by a band' },
			event: { icon: IconCalendarEvent, label: 'Held for an event' },
			lesson: { icon: IconSchool, label: 'Lesson' }
		}
	},
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

/**
 * The ring colour that carries a status on a card's media box.
 *
 * Keyed by `StatusBadge`'s own `variants[...].color`, so the outline and the
 * glyph can never disagree — there is one status registry, and this maps its
 * colours onto a second property rather than restating which status is which.
 *
 * Written as literal class strings on purpose: Tailwind generates only the
 * classes it can see in source, so a computed `text-` → `ring-` swap would
 * emit nothing at all. `registry.spec.ts` asserts every colour in `variants`
 * has an entry here.
 *
 * The neutral statuses share one muted ring. `cancelled` and `dismissed` are
 * not warnings, and a card should not shout them.
 */
export const statusRing: Record<string, string> = {
	'text-success': 'ring-success',
	'text-warning': 'ring-warning',
	'text-info': 'ring-info',
	'text-error': 'ring-error',
	'text-base-content': 'ring-base-content/30',
	'text-base-content/60': 'ring-base-content/30',
	'text-base-content/40': 'ring-base-content/30'
};

/**
 * The glyph and label for one record: its subtype's if it has one, otherwise
 * its type's.
 *
 * Components call this instead of reaching for `kind.icon`, so "which variant
 * of this thing is it" stays a registry fact. `EntityRow` used to carry a
 * hardcoded member-role branch with a comment saying a second branch would mean
 * the registry was missing a field — this is that field.
 */
export function entityGlyph(ref: EntityRef): EntitySubtype {
	const kind = entityKinds[ref.type];
	const sub = ref.subtype ? kind.subtypes?.[ref.subtype] : undefined;
	return sub ?? { icon: kind.icon, label: entityLabels[ref.type].one };
}

/** True when this record is a marked variant rather than the ordinary case. */
export function hasSubtype(ref: EntityRef): boolean {
	return !!ref.subtype && !!entityKinds[ref.type].subtypes?.[ref.subtype];
}
