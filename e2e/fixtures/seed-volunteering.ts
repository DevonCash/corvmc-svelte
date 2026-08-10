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
import { volunteerRole, volunteerHourLog } from '../../src/lib/server/db/schema/volunteer';
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

		// Child before parent: the role FK is ON DELETE RESTRICT.
		await db.delete(volunteerHourLog).where(inArray(volunteerHourLog.id, LOG_IDS));
		await db.delete(volunteerHourLog).where(eq(volunteerHourLog.userId, SEED_VOL_MEMBER_ID));
		await db.delete(volunteerRole).where(inArray(volunteerRole.id, ROLE_IDS));
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
