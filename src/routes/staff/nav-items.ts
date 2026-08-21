/**
 * The staff panel's sidebar, as data.
 *
 * Pulled out of the layout template for two reasons. First, `Nav.Collapsible`
 * takes a hand-maintained `childHrefs` array, and a hand-maintained list of
 * routes drifts the moment someone adds one — `childHrefsFor` derives it from
 * the tree instead. Second, the panel had outgrown a single "Operations" group
 * that held eight unrelated rows; as data the grouping is something you can
 * read in one screen and assert against, which `nav-items.spec.ts` does.
 *
 * Nothing here is gated. `getStaffLayout` already redirects anyone without the
 * role, and the staff panel deliberately ignores feature flags so staff can
 * administer a feature before it is switched on for everyone else.
 */

export type StaffNavKey =
	| 'dashboard'
	| 'inbox'
	| 'users'
	| 'bands'
	| 'volunteer'
	| 'volunteer-shifts'
	| 'volunteer-roles'
	| 'volunteer-certifications'
	| 'volunteer-report'
	| 'reservations'
	| 'recurring'
	| 'closures'
	| 'equipment'
	| 'equipment-loans'
	| 'events'
	| 'flags'
	| 'suggestions'
	| 'campaigns'
	| 'audiences'
	| 'help'
	| 'payments'
	| 'credits'
	| 'settings';

export type StaffNavSectionKey =
	| 'people'
	| 'space'
	| 'programs'
	| 'moderation'
	| 'outreach'
	| 'money'
	| 'system';

/**
 * Field names on `getStaffLayout()`'s return. Items name a count rather than
 * carrying one so the nav can stay a `const`: a badge changes a rendered
 * integer, never which rows exist, and rebuilding the array on every poll
 * would churn every `{#each}` for nothing.
 */
export type StaffNavBadgeKey = 'inboxUnread' | 'suggestionsAwaiting' | 'volunteerPending';

export interface StaffNavItem {
	key: StaffNavKey;
	label: string;
	href: string;
	badgeKey?: StaffNavBadgeKey;
	/** Present ⇒ the layout renders this row as a `Nav.Collapsible`. */
	children?: StaffNavItem[];
}

export interface StaffNavSection {
	/** Stable id. The persisted collapse record keys off this, never the title. */
	key: StaffNavSectionKey;
	title: string;
	items: StaffNavItem[];
}

/** Rows above the first section header. */
export const staffNavTop: StaffNavItem[] = [
	{ key: 'dashboard', label: 'Dashboard', href: '/staff' },
	{ key: 'inbox', label: 'Inbox', href: '/staff/inbox', badgeKey: 'inboxUnread' }
];

export const staffNavSections: StaffNavSection[] = [
	{
		key: 'people',
		title: 'People',
		items: [
			{ key: 'users', label: 'Users', href: '/staff/users' },
			{ key: 'bands', label: 'Bands', href: '/staff/bands' },
			{
				key: 'volunteer',
				label: 'Volunteering',
				href: '/staff/volunteer',
				badgeKey: 'volunteerPending',
				children: [
					{ key: 'volunteer-shifts', label: 'Shifts', href: '/staff/volunteer/shifts' },
					{ key: 'volunteer-roles', label: 'Roles', href: '/staff/volunteer/roles' },
					{
						key: 'volunteer-certifications',
						label: 'Certifications',
						href: '/staff/volunteer/certifications'
					},
					{ key: 'volunteer-report', label: 'Report', href: '/staff/volunteer/report' }
				]
			}
		]
	},
	{
		key: 'space',
		title: 'Space',
		items: [
			{
				key: 'reservations',
				label: 'Reservations',
				href: '/staff/reservations',
				children: [
					{ key: 'recurring', label: 'Recurring', href: '/staff/recurring' },
					{ key: 'closures', label: 'Closures', href: '/staff/closures' }
				]
			},
			{
				// Equipment used to hang the other way up: the parent row landed on
				// Loans and the child was labelled Inventory, which the loans page
				// itself contradicts — it declares `backHref="/staff/equipment"`.
				key: 'equipment',
				label: 'Equipment',
				href: '/staff/equipment',
				children: [{ key: 'equipment-loans', label: 'Loans', href: '/staff/equipment/loans' }]
			}
		]
	},
	{
		key: 'programs',
		title: 'Programs',
		items: [{ key: 'events', label: 'Events', href: '/staff/events' }]
	},
	{
		key: 'moderation',
		title: 'Moderation',
		items: [
			{ key: 'flags', label: 'Content Flags', href: '/staff/flags' },
			{
				key: 'suggestions',
				label: 'Suggestions',
				href: '/staff/suggestions',
				badgeKey: 'suggestionsAwaiting'
			}
		]
	},
	{
		key: 'outreach',
		title: 'Outreach',
		items: [
			{ key: 'campaigns', label: 'Campaigns', href: '/staff/marketing/campaigns' },
			{ key: 'audiences', label: 'Audiences', href: '/staff/marketing/audiences' },
			{ key: 'help', label: 'Help Articles', href: '/staff/help' }
		]
	},
	{
		key: 'money',
		title: 'Money',
		items: [
			{ key: 'payments', label: 'Payments', href: '/staff/payments' },
			{ key: 'credits', label: 'Credits', href: '/staff/credits' }
		]
	},
	{
		key: 'system',
		title: 'System',
		items: [{ key: 'settings', label: 'Settings', href: '/staff/settings' }]
	}
];

/** Every row in the panel, parents and children alike, in render order. */
export function allStaffNavItems(): StaffNavItem[] {
	const flat: StaffNavItem[] = [];
	const walk = (items: StaffNavItem[]) => {
		for (const item of items) {
			flat.push(item);
			if (item.children) walk(item.children);
		}
	};
	walk(staffNavTop);
	for (const section of staffNavSections) walk(section.items);
	return flat;
}

/**
 * What `Nav.Collapsible` wants: the hrefs that should hold the row open. The
 * parent counts — being on `/staff/volunteer` itself keeps its children visible.
 */
export function childHrefsFor(item: StaffNavItem): string[] {
	return [item.href, ...(item.children ?? []).map((c) => c.href)];
}

export function sectionHasKey(section: StaffNavSection, key: StaffNavKey | null): boolean {
	if (!key) return false;
	return section.items.some((i) => i.key === key || i.children?.some((c) => c.key === key));
}

/**
 * Which single row to light up for a pathname, by longest matching href.
 *
 * Exact equality — what `NavItem` does on its own — leaves every detail page
 * with no highlighted row at all. Longest-wins resolves `/staff` against
 * everything below it and `/staff/equipment` against `/staff/equipment/loans`
 * without depending on declaration order, and the `href + '/'` test keeps
 * `/staff/users` from claiming a would-be `/staff/usersomething`.
 */
export function activeNavKey(pathname: string): StaffNavKey | null {
	const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	let best: StaffNavKey | null = null;
	let bestLength = -1;
	for (const item of allStaffNavItems()) {
		if (path !== item.href && !path.startsWith(item.href + '/')) continue;
		if (item.href.length > bestLength) {
			bestLength = item.href.length;
			best = item.key;
		}
	}
	return best;
}
