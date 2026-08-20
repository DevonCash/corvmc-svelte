import { describe, it, expect } from 'vitest';
import { bandNavItems, type BandNavInput } from './nav-items';

/**
 * The band panel's nav gating has been wrong twice in the same file, both times
 * because a role check that read `userRole === 'owner'` also caught admins and
 * staff — `getBandLayout` returns `role ?? 'staff'`, so those two are the same
 * shape as a real role. This pins the whole matrix.
 */
function labelsFor(overrides: Partial<BandNavInput> = {}): string[] {
	return bandNavItems({
		slug: 'the-velvet-underground',
		bandId: 'band-1',
		tier: 'free',
		userRole: 'member',
		isStaff: false,
		features: {},
		...overrides
	}).map((i) => i.label);
}

describe('bandNavItems', () => {
	it('gives every role Dashboard, Members and Events', () => {
		for (const userRole of ['owner', 'admin', 'member', 'staff']) {
			const labels = labelsFor({ userRole, isStaff: userRole === 'staff' });
			expect(labels).toContain('Dashboard');
			expect(labels).toContain('Members');
			expect(labels).toContain('Events');
		}
	});

	// The reported bug: an admin could not reach the band's address at all,
	// because the whole Settings entry was gated on owner.
	it('gives Settings to an owner and an admin, but not a plain member', () => {
		expect(labelsFor({ userRole: 'owner' })).toContain('Settings');
		expect(labelsFor({ userRole: 'admin' })).toContain('Settings');
		expect(labelsFor({ userRole: 'member' })).not.toContain('Settings');
	});

	it('sends a staff non-member to staff tools instead of Settings', () => {
		const labels = labelsFor({ userRole: 'staff', isStaff: true });
		expect(labels).not.toContain('Settings');
		expect(labels).toContain('Staff tools');
	});

	it('offers no staff-tools shortcut to an ordinary member', () => {
		expect(labelsFor({ userRole: 'member' })).not.toContain('Staff tools');
	});

	// Billing really is owner-only on the server, so this gate stays as it was.
	// The point of the test is that widening Settings did not widen this.
	it('keeps Subscription owner-only', () => {
		const premium = { features: { bandPremium: true } };
		expect(labelsFor({ ...premium, userRole: 'owner' })).toContain('Subscription');
		expect(labelsFor({ ...premium, userRole: 'admin' })).not.toContain('Subscription');
		expect(labelsFor({ userRole: 'owner' })).not.toContain('Subscription');
	});

	// The `bandReservations` flag was retired on main; band booking is on for
	// every member now, so this asserts presence rather than gating.
	it('shows Reservations to every band member', () => {
		for (const userRole of ['owner', 'admin', 'member']) {
			expect(labelsFor({ userRole })).toContain('Reservations');
		}
	});

	it('shows the page editor only to an admin of a premium band with the flag on', () => {
		const on = { features: { bandPremium: true }, tier: 'premium' };
		expect(labelsFor({ ...on, userRole: 'admin' })).toContain('Page Editor');
		expect(labelsFor({ ...on, userRole: 'owner' })).toContain('Page Editor');
		expect(labelsFor({ ...on, userRole: 'member' })).not.toContain('Page Editor');
		// Flag on, still a free band.
		expect(labelsFor({ userRole: 'admin', features: { bandPremium: true } })).not.toContain(
			'Page Editor'
		);
		// Premium tier, flag off.
		expect(labelsFor({ userRole: 'admin', tier: 'premium' })).not.toContain('Page Editor');
	});

	it('offers Edit Profile to owners and admins only', () => {
		expect(labelsFor({ userRole: 'owner' })).toContain('Edit Profile');
		expect(labelsFor({ userRole: 'admin' })).toContain('Edit Profile');
		expect(labelsFor({ userRole: 'member' })).not.toContain('Edit Profile');
		expect(labelsFor({ userRole: 'staff', isStaff: true })).not.toContain('Edit Profile');
	});

	it('points Staff tools at the band id, not its slug', () => {
		const item = bandNavItems({
			slug: 'the-velvet-underground',
			bandId: 'band-1',
			tier: 'free',
			userRole: 'staff',
			isStaff: true,
			features: {}
		}).find((i) => i.key === 'staff-tools');

		expect(item?.href).toBe('/staff/bands/band-1');
	});
});
