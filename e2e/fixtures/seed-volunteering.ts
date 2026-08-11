/**
 * Seed the volunteering module for the e2e suite: turn the feature flag on,
 * create two roles (one archived) and a member with pending hour logs.
 *
 * The staff operator comes from seed-staff-user.ts — this fixture only adds the
 * volunteering data that operator reviews, plus a plain member who can log
 * hours through the real UI.
 *
 * Why this exists: the volunteering flows that unit tests cannot reach are all
 * client-server round trips — a review has to drop the row out of the Pending
 * table (SvelteKit's `refresh()` is keyed by argument, and getting that wrong
 * left the approved row visibly stuck in the queue), and a rejection with no
 * reason has to surface a written message rather than raw Zod text.
 *
 * Idempotent: deletes and recreates its own rows on every run.
 *
 * Mirrors the D1 access pattern in seed-staff-user.ts.
 */
import 'dotenv/config';
import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import { eq, inArray } from 'drizzle-orm';
import { user, account } from '../../src/lib/server/db/schema/authentication';
import { role, modelHasRole } from '../../src/lib/server/db/schema/authorization';
import {
	volunteerRole,
	volunteerHourLog,
	volunteerCertification,
	memberCertification,
	volunteerRoleCertification,
	volunteerShift,
	volunteerSignup
} from '../../src/lib/server/db/schema/volunteer';
import { scryptHash } from './seed-pay-reservation';

export const SEED_VOL_MEMBER_ID = 'e2e-vol-member';
export const SEED_VOL_MEMBER_EMAIL = 'e2e.volunteer@example.com';
export const SEED_VOL_MEMBER_PASSWORD = 'e2e-password-123';
export const SEED_VOL_MEMBER_NAME = 'E2E Volunteer';

export const SEED_VOL_ROLE_ID = 'e2e-vol-role-active';
export const SEED_VOL_ROLE_NAME = 'E2E Front Desk';
/**
 * Markdown, so the member page's rendering is exercised rather than assumed.
 * The bolded phrase is deliberately unlike anything in the dev seed — several
 * seeded roles say "No experience needed", and a shared phrase makes the
 * assertion match two cards and trip strict mode.
 */
export const SEED_VOL_ROLE_BOLD_PHRASE = 'E2E training provided on site';
export const SEED_VOL_ROLE_DESCRIPTION = `Cover the door during open hours.\n\n**${SEED_VOL_ROLE_BOLD_PHRASE}** — we will show you the ropes.`;

/** A already-reviewed rejection, so the member-side rendering of the reason can
 * be asserted without juggling two logins in one browser context. */
export const SEED_VOL_REJECTED_REASON = 'E2E: this looks like a duplicate of the same shift.';

export const SEED_VOL_ARCHIVED_ROLE_ID = 'e2e-vol-role-archived';
export const SEED_VOL_ARCHIVED_ROLE_NAME = 'E2E Retired Role';

/** Two pending logs: one to approve, one to reject. */
export const SEED_VOL_LOG_APPROVE_ID = 'e2e-vol-log-approve';
export const SEED_VOL_LOG_REJECT_ID = 'e2e-vol-log-reject';
export const SEED_VOL_LOG_APPROVE_DESC = 'E2E ran sound for the open mic';
export const SEED_VOL_LOG_REJECT_DESC = 'E2E duplicate of the same shift';

/** Filed against the archived role, so reports must still resolve it. */
export const SEED_VOL_LOG_ARCHIVED_ID = 'e2e-vol-log-archived';

export const SEED_VOL_LOG_REJECTED_ID = 'e2e-vol-log-already-rejected';
export const SEED_VOL_LOG_REJECTED_DESC = 'E2E already-rejected entry';

// --- Phase 2: certifications and shifts -----------------------------------

export const SEED_VOL_CERT_ID = 'e2e-vol-cert';
export const SEED_VOL_CERT_NAME = 'E2E Sound Desk Clearance';

/** Requires the clearance above; the seeded member does NOT hold it. */
export const SEED_VOL_GATED_ROLE_ID = 'e2e-vol-role-gated';
export const SEED_VOL_GATED_ROLE_NAME = 'E2E Sound Desk';

/** Open, ungated, one place — the happy-path claim. */
export const SEED_VOL_SHIFT_OPEN_ID = 'e2e-vol-shift-open';
export const SEED_VOL_SHIFT_OPEN_NOTE = 'E2E meet at the side door';

/** Gated by the clearance the member lacks — the refusal must say why. */
export const SEED_VOL_SHIFT_GATED_ID = 'e2e-vol-shift-gated';

/** Capacity 1, already taken by somebody else. */
export const SEED_VOL_SHIFT_FULL_ID = 'e2e-vol-shift-full';
export const SEED_VOL_SHIFT_FULL_NOTE = 'E2E already spoken for';
export const SEED_VOL_OTHER_MEMBER_ID = 'e2e-vol-other-member';

const SHIFT_IDS = [SEED_VOL_SHIFT_OPEN_ID, SEED_VOL_SHIFT_GATED_ID, SEED_VOL_SHIFT_FULL_ID];

/** Days out, at a fixed hour, so the board always has a future shift to claim. */
function daysFromNow(days: number, hourUtc: number): Date {
	const d = new Date();
	d.setDate(d.getDate() + days);
	d.setUTCHours(hourUtc, 0, 0, 0);
	return d;
}

const LOG_IDS = [
	SEED_VOL_LOG_APPROVE_ID,
	SEED_VOL_LOG_REJECT_ID,
	SEED_VOL_LOG_ARCHIVED_ID,
	SEED_VOL_LOG_REJECTED_ID
];
const ROLE_IDS = [SEED_VOL_ROLE_ID, SEED_VOL_ARCHIVED_ROLE_ID];

/** Noon club time, N days back — matches how the service anchors workedOn. */
function workedOnDaysAgo(days: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - days);
	d.setUTCHours(19, 0, 0, 0);
	return d;
}

export async function seedVolunteering(): Promise<void> {
	const { env, dispose } = await getPlatformProxy();
	const db = drizzle((env as { DB: D1Database }).DB);
	const kv = (env as { KV: KVNamespace }).KV;

	try {
		// The flag lives in KV, not D1 — without this every volunteer route 404s.
		await kv.put('site-config:feature.volunteering', JSON.stringify(true));

		// Child before parent: the role FK is ON DELETE RESTRICT, and signups and
		// held certifications both point at rows recreated below.
		await db.delete(volunteerSignup).where(inArray(volunteerSignup.shiftId, SHIFT_IDS));
		await db.delete(volunteerShift).where(inArray(volunteerShift.id, SHIFT_IDS));
		await db
			.delete(volunteerRoleCertification)
			.where(eq(volunteerRoleCertification.certificationId, SEED_VOL_CERT_ID));
		await db
			.delete(memberCertification)
			.where(eq(memberCertification.certificationId, SEED_VOL_CERT_ID));
		await db.delete(volunteerCertification).where(eq(volunteerCertification.id, SEED_VOL_CERT_ID));
		await db.delete(user).where(eq(user.id, SEED_VOL_OTHER_MEMBER_ID));
		await db.delete(volunteerHourLog).where(inArray(volunteerHourLog.id, LOG_IDS));
		await db.delete(volunteerHourLog).where(eq(volunteerHourLog.userId, SEED_VOL_MEMBER_ID));
		await db.delete(volunteerRole).where(inArray(volunteerRole.id, ROLE_IDS));
		await db.delete(volunteerRole).where(eq(volunteerRole.id, SEED_VOL_GATED_ROLE_ID));
		await db.delete(modelHasRole).where(eq(modelHasRole.userId, SEED_VOL_MEMBER_ID));
		await db.delete(account).where(eq(account.userId, SEED_VOL_MEMBER_ID));
		await db.delete(user).where(eq(user.id, SEED_VOL_MEMBER_ID));

		const now = new Date();

		const [memberRole] = await db
			.select({ id: role.id })
			.from(role)
			.where(eq(role.name, 'member'))
			.limit(1);

		await db.insert(user).values({
			id: SEED_VOL_MEMBER_ID,
			name: SEED_VOL_MEMBER_NAME,
			email: SEED_VOL_MEMBER_EMAIL,
			emailVerified: true,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(account).values({
			id: 'e2e-vol-account',
			accountId: SEED_VOL_MEMBER_ID,
			providerId: 'credential',
			userId: SEED_VOL_MEMBER_ID,
			password: await scryptHash(SEED_VOL_MEMBER_PASSWORD),
			createdAt: now,
			updatedAt: now
		});

		if (memberRole) {
			await db.insert(modelHasRole).values({ roleId: memberRole.id, userId: SEED_VOL_MEMBER_ID });
		}

		await db.insert(volunteerRole).values([
			{
				id: SEED_VOL_ROLE_ID,
				name: SEED_VOL_ROLE_NAME,
				description: SEED_VOL_ROLE_DESCRIPTION,
				displayOrder: 0,
				isActive: true,
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_VOL_ARCHIVED_ROLE_ID,
				name: SEED_VOL_ARCHIVED_ROLE_NAME,
				description: 'On hiatus.',
				displayOrder: 1,
				isActive: false,
				createdAt: now,
				updatedAt: now
			}
		]);

		// --- Phase 2 -------------------------------------------------------
		// A second member, so the "full" shift is taken by somebody who isn't the
		// member under test.
		await db.insert(user).values({
			id: SEED_VOL_OTHER_MEMBER_ID,
			name: 'E2E Other Volunteer',
			email: 'e2e.other.volunteer@example.com',
			emailVerified: true,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(volunteerCertification).values({
			id: SEED_VOL_CERT_ID,
			name: SEED_VOL_CERT_NAME,
			description: 'Ask a staff engineer to sign you off.',
			displayOrder: 0,
			isActive: true,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(volunteerRole).values({
			id: SEED_VOL_GATED_ROLE_ID,
			name: SEED_VOL_GATED_ROLE_NAME,
			description: 'Run the desk.',
			displayOrder: 2,
			isActive: true,
			createdAt: now,
			updatedAt: now
		});

		// The gate itself. The member under test deliberately holds nothing, so
		// the refusal path is the default rather than something a test sets up.
		await db.insert(volunteerRoleCertification).values({
			volunteerRoleId: SEED_VOL_GATED_ROLE_ID,
			certificationId: SEED_VOL_CERT_ID
		});

		await db.insert(volunteerShift).values([
			{
				id: SEED_VOL_SHIFT_OPEN_ID,
				volunteerRoleId: SEED_VOL_ROLE_ID,
				startsAt: daysFromNow(3, 2),
				endsAt: daysFromNow(3, 6),
				capacity: 1,
				notes: SEED_VOL_SHIFT_OPEN_NOTE,
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_VOL_SHIFT_GATED_ID,
				volunteerRoleId: SEED_VOL_GATED_ROLE_ID,
				startsAt: daysFromNow(4, 2),
				endsAt: daysFromNow(4, 6),
				capacity: 1,
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_VOL_SHIFT_FULL_ID,
				volunteerRoleId: SEED_VOL_ROLE_ID,
				startsAt: daysFromNow(5, 2),
				endsAt: daysFromNow(5, 6),
				capacity: 1,
				notes: SEED_VOL_SHIFT_FULL_NOTE,
				createdAt: now,
				updatedAt: now
			}
		]);

		await db.insert(volunteerSignup).values({
			id: 'e2e-vol-signup-other',
			shiftId: SEED_VOL_SHIFT_FULL_ID,
			userId: SEED_VOL_OTHER_MEMBER_ID,
			status: 'confirmed',
			claimedAt: now,
			confirmedAt: now,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(volunteerHourLog).values([
			{
				id: SEED_VOL_LOG_APPROVE_ID,
				userId: SEED_VOL_MEMBER_ID,
				volunteerRoleId: SEED_VOL_ROLE_ID,
				workedOn: workedOnDaysAgo(2),
				minutes: 120,
				description: SEED_VOL_LOG_APPROVE_DESC,
				status: 'pending',
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_VOL_LOG_REJECT_ID,
				userId: SEED_VOL_MEMBER_ID,
				volunteerRoleId: SEED_VOL_ROLE_ID,
				workedOn: workedOnDaysAgo(3),
				minutes: 90,
				description: SEED_VOL_LOG_REJECT_DESC,
				status: 'pending',
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_VOL_LOG_ARCHIVED_ID,
				userId: SEED_VOL_MEMBER_ID,
				volunteerRoleId: SEED_VOL_ARCHIVED_ROLE_ID,
				workedOn: workedOnDaysAgo(10),
				minutes: 60,
				description: 'E2E work under a since-retired role',
				status: 'approved',
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_VOL_LOG_REJECTED_ID,
				userId: SEED_VOL_MEMBER_ID,
				volunteerRoleId: SEED_VOL_ROLE_ID,
				workedOn: workedOnDaysAgo(5),
				minutes: 60,
				description: SEED_VOL_LOG_REJECTED_DESC,
				status: 'rejected',
				reviewNotes: SEED_VOL_REJECTED_REASON,
				reviewedAt: now,
				createdAt: now,
				updatedAt: now
			}
		]);
	} finally {
		await dispose();
	}
}

/** The member's signup status on a shift, for assertions the UI cannot make. */
export async function readSignupStatus(shiftId: string): Promise<string | null> {
	const { env, dispose } = await getPlatformProxy();
	const db = drizzle((env as { DB: D1Database }).DB);

	try {
		const [row] = await db
			.select({ status: volunteerSignup.status })
			.from(volunteerSignup)
			.where(eq(volunteerSignup.shiftId, shiftId))
			.limit(1);
		return row?.status ?? null;
	} finally {
		await dispose();
	}
}

/** Read back what the app wrote, for assertions the UI cannot make. */
export async function readVolunteerState(): Promise<{
	approveLogStatus: string | null;
	creditRowCount: number;
}> {
	const { env, dispose } = await getPlatformProxy();
	const db = drizzle((env as { DB: D1Database }).DB);

	try {
		const [log] = await db
			.select({ status: volunteerHourLog.status })
			.from(volunteerHourLog)
			.where(eq(volunteerHourLog.id, SEED_VOL_LOG_APPROVE_ID))
			.limit(1);

		const { creditTransaction } = await import('../../src/lib/server/db/schema/finance');
		const rows = await db
			.select({ id: creditTransaction.id })
			.from(creditTransaction)
			.where(eq(creditTransaction.userId, SEED_VOL_MEMBER_ID));

		return { approveLogStatus: log?.status ?? null, creditRowCount: rows.length };
	} finally {
		await dispose();
	}
}
