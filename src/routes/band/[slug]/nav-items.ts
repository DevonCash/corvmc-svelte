/**
 * Which nav entries a band panel shows, as data.
 *
 * Pulled out of the layout template because this gating has been wrong twice.
 * Settings and Subscription were both keyed on `userRole === 'owner'`, and
 * `getBandLayout` returns `role ?? 'staff'` — so an admin, and any staff member
 * viewing a band they don't belong to, saw no Settings entry and had no route to
 * the band's own address. As a template of nested `{#if}`s the mistake was
 * invisible; as a list it can be asserted against, which `nav-items.spec.ts`
 * does for every role and flag combination.
 */
export type BandNavKey =
	| 'dashboard'
	| 'members'
	| 'reservations'
	| 'events'
	| 'edit'
	| 'page-editor'
	| 'live-site'
	| 'subscription'
	| 'settings'
	| 'staff-tools';

export interface BandNavInput {
	slug: string;
	bandId: string;
	tier: string;
	userRole: string;
	isStaff: boolean;
	features: { bandReservations?: boolean; bandPremium?: boolean };
}

export interface BandNavItem {
	key: BandNavKey;
	label: string;
	/** Relative to the panel base, or absolute when it leaves the panel. */
	href: string;
	external?: boolean;
}

export function bandNavItems(input: BandNavInput): BandNavItem[] {
	const base = `/band/${input.slug}`;
	const isOwner = input.userRole === 'owner';
	const isOwnerOrAdmin = isOwner || input.userRole === 'admin';
	const premium = !!input.features.bandPremium && input.tier === 'premium';

	const items: BandNavItem[] = [
		{ key: 'dashboard', label: 'Dashboard', href: base },
		{ key: 'members', label: 'Members', href: `${base}/members` }
	];

	if (input.features.bandReservations) {
		items.push({ key: 'reservations', label: 'Reservations', href: `${base}/reservations` });
	}

	items.push({ key: 'events', label: 'Events', href: `${base}/events` });

	if (isOwnerOrAdmin) {
		items.push({ key: 'edit', label: 'Edit Profile', href: `${base}/edit` });
	}

	if (premium && isOwnerOrAdmin) {
		items.push({ key: 'page-editor', label: 'Page Editor', href: `${base}/page-editor` });
		items.push({ key: 'live-site', label: 'View Live Site', href: '', external: true });
	}

	if (isOwnerOrAdmin) {
		// Billing is genuinely owner-only — `upgradeToPremium` and friends are
		// `requireBandOwner` — so unlike Settings this one stays keyed on owner.
		if (input.features.bandPremium && isOwner) {
			items.push({ key: 'subscription', label: 'Subscription', href: `${base}/subscription` });
		}
		// Admins get Settings: the page shows them the band's address read-only,
		// which is the thing they could not reach at all before.
		items.push({ key: 'settings', label: 'Settings', href: `${base}/settings` });
	} else if (input.isStaff) {
		// A staff non-member resolves to the pseudo-role 'staff'. Every control on
		// the settings page is owner-guarded, so send them where they can act.
		items.push({ key: 'staff-tools', label: 'Staff tools', href: `/staff/bands/${input.bandId}` });
	}

	return items;
}
