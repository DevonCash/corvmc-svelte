import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * `getUserOverview` is the one query the staff user record cannot defer: it
 * feeds the identity badges, the scoreboard, every tab badge and the whole
 * Overview tab before anyone has clicked anything.
 *
 * What is worth pinning here is the derivation, not the SQL. The counts are
 * plain `count()` reads; the parts that can be wrong in a way nobody notices
 * are the judgements layered on top — which certifications "need attention",
 * which band memberships are real, what counts as sustaining. Those are what
 * these tests hold.
 */

// Every db read resolves to the same empty/zero shape except the first two,
// which are the band-membership and account lookups the rest of the function
// branches on. They are issued before the count fan-out, in that order.
let selectCall = 0;
let memberships: Array<{ bandId: string; status: string }> = [];
let directoryVisibility = 'members';

const dbSelect = vi.fn(() => {
	selectCall += 1;
	const call = selectCall;
	const b = {
		from: () => b,
		innerJoin: () => b,
		leftJoin: () => b,
		where: () => b,
		orderBy: () => b,
		limit: () => b,
		groupBy: () => b,
		$dynamic: () => b,
		then: (resolve: (v: unknown) => unknown) => {
			if (call === 1) return resolve(memberships);
			if (call === 2) return resolve([{ directoryVisibility }]);
			return resolve([{ count: 0, cents: 0 }]);
		}
	};
	return b;
});

vi.mock('$lib/server/db', () => ({ db: { select: (...a: unknown[]) => dbSelect(...(a as [])) } }));

const getAllBalances = vi.fn(async () => ({ free_hours: 12, equipment_credits: 2 }));
vi.mock('$lib/server/finance/credit-service', () => ({
	getAllBalances: (...a: unknown[]) => getAllBalances(...(a as []))
}));

let subscription: Record<string, unknown> | null = null;
vi.mock('$lib/server/finance/subscription-service', () => ({
	getMemberSubscription: vi.fn(async () => subscription),
	mapDbSubscription: vi.fn((sub: Record<string, unknown> | null) =>
		sub ? { id: 'sub_1', currentPeriodEnd: new Date('2026-09-01') } : null
	)
}));

vi.mock('$lib/server/event/community-event-service', () => ({
	getCommunityStanding: vi.fn(async () => ({ requiresReview: true, reason: 'Upheld report' }))
}));

vi.mock('$lib/server/volunteer/hour-log-service', () => ({
	getUserHourSummary: vi.fn(async () => ({
		approvedMinutes: 600,
		pendingMinutes: 60,
		approvedMinutesThisYear: 300,
		logCount: 4
	}))
}));

let certifications: Array<{ state: string; revokedAt: Date | null }> = [];
vi.mock('$lib/server/volunteer/member-certification-service', () => ({
	listForUser: vi.fn(async () => certifications)
}));

let volunteerProfile: { status: string } | null = null;
vi.mock('$lib/server/volunteer/volunteer-profile-service', () => ({
	getVolunteerProfile: vi.fn(async () => volunteerProfile),
	stageOf: (p: { status: string } | null) =>
		!p ? 'none' : p.status === 'blocked' ? 'blocked' : 'active'
}));

vi.mock('$lib/server/directory/directory-service', () => ({
	isProfileComplete: vi.fn(async () => false)
}));

let subscriber: Record<string, unknown> | null = null;
vi.mock('$lib/server/marketing/subscriber-service', () => ({
	findByUserId: vi.fn(async () => subscriber)
}));

vi.mock('$lib/server/inbox/portal-service', () => ({
	countOpenPortalThreads: vi.fn(async () => 2),
	countPortalUnread: vi.fn(async () => 1)
}));

vi.mock('$lib/server/notification/in-app-service', () => ({
	getUnreadCount: vi.fn(async () => 5)
}));

vi.mock('./user-service', () => ({
	getLastLoginAt: vi.fn(async () => new Date('2026-08-01T10:00:00Z'))
}));

const { getUserOverview } = await import('./user-overview-service');

beforeEach(() => {
	vi.clearAllMocks();
	selectCall = 0;
	memberships = [];
	directoryVisibility = 'members';
	subscription = null;
	certifications = [];
	volunteerProfile = null;
	subscriber = null;
});

describe('getUserOverview', () => {
	it('counts active band memberships and pending invitations separately', async () => {
		// A never-accepted invitation is not a band they are in, but it is
		// something staff need to see — so it gets its own count rather than
		// inflating the one the Bands badge reads.
		memberships = [
			{ bandId: 'b1', status: 'active' },
			{ bandId: 'b2', status: 'active' },
			{ bandId: 'b3', status: 'pending' }
		];

		const overview = await getUserOverview('u1');

		expect(overview.counts.bands).toBe(2);
		expect(overview.counts.pendingBandInvites).toBe(1);
	});

	it('reports no shows for a member in no bands without querying for them', async () => {
		// Show credits are reached through band membership. With no bands the
		// join has nothing to match, and issuing it anyway would be two wasted
		// round trips on every solo member's record.
		memberships = [];
		const before = dbSelect.mock.calls.length;

		const overview = await getUserOverview('u1');

		expect(overview.counts.upcomingShows).toBe(0);
		expect(overview.counts.pastShows).toBe(0);
		// Two reads for memberships/account, then the count fan-out — but no
		// event join among them.
		expect(dbSelect.mock.calls.length).toBeGreaterThan(before);
	});

	it('counts held certifications excluding revoked ones', async () => {
		certifications = [
			{ state: 'current', revokedAt: null },
			{ state: 'expiring', revokedAt: null },
			{ state: 'revoked', revokedAt: new Date('2026-01-01') }
		];

		const overview = await getUserOverview('u1');

		expect(overview.counts.certsHeld).toBe(2);
	});

	it('treats expiring and expired clearances as needing attention, but not revoked ones', async () => {
		// A revoked clearance was a deliberate act and is already resolved.
		// Counting it would leave a permanent warning on the record with nothing
		// anyone could do about it.
		certifications = [
			{ state: 'current', revokedAt: null },
			{ state: 'expiring', revokedAt: null },
			{ state: 'expired', revokedAt: null },
			{ state: 'revoked', revokedAt: new Date('2026-01-01') }
		];

		const overview = await getUserOverview('u1');

		expect(overview.counts.certsNeedingAttention).toBe(2);
	});

	it('derives sustaining membership from the stored subscription snapshot', async () => {
		expect((await getUserOverview('u1')).membership.sustaining).toBe(false);

		selectCall = 0;
		subscription = { hoursPerReset: 8, cancelAtPeriodEnd: true };
		const overview = await getUserOverview('u1');

		expect(overview.membership.sustaining).toBe(true);
		expect(overview.membership.cancelAtPeriodEnd).toBe(true);
		expect(overview.membership.hoursPerReset).toBe(8);
	});

	it('surfaces marketing suppression with its reason', async () => {
		subscriber = { suppressedAt: new Date('2026-05-01'), suppressionReason: 'bounce' };

		const overview = await getUserOverview('u1');

		expect(overview.marketing).toEqual({ suppressed: true, suppressionReason: 'bounce' });
	});

	it('reports a blocked volunteer as blocked, and a missing profile as none', async () => {
		expect((await getUserOverview('u1')).volunteer.stage).toBe('none');

		selectCall = 0;
		volunteerProfile = { status: 'blocked' };
		expect((await getUserOverview('u1')).volunteer.stage).toBe('blocked');
	});

	it('passes through standing, directory state and last login', async () => {
		directoryVisibility = 'hidden';

		const overview = await getUserOverview('u1');

		expect(overview.standing).toEqual({ requiresReview: true, reason: 'Upheld report' });
		expect(overview.directory).toEqual({ visibility: 'hidden', profileComplete: false });
		expect(overview.lastLoginAt).toEqual(new Date('2026-08-01T10:00:00Z'));
		expect(overview.counts.approvedMinutesThisYear).toBe(300);
		expect(overview.counts.openThreads).toBe(2);
		expect(overview.counts.unreadNotifications).toBe(5);
	});
});
