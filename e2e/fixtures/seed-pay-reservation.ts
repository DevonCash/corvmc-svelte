/**
 * Seed a known member + a payable (scheduled, balance-due) reservation into the
 * LOCAL D1 database used by `vite preview`, plus a credential account whose
 * password verifies against the app's scrypt path so the e2e test can log in
 * through the real better-auth UI flow.
 *
 * Run by the Playwright global setup (see playwright.config.ts → globalSetup).
 *
 * Idempotent: deletes and recreates the seeded user (and its cascade-owned
 * reservation/account/session rows) on every run, so reruns start clean.
 *
 * Mirrors the D1 access pattern in scripts/seed-dev.ts (getPlatformProxy → drizzle/d1)
 * so it talks to the same `.wrangler/state/v3/d1` SQLite file that the adapter's
 * emulated platform bindings expose to the preview server.
 */
import 'dotenv/config';
import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { user, account } from '../../src/lib/server/db/schema/authentication';
import { reservation } from '../../src/lib/server/db/schema/reservation';
import { scryptHash } from '../../src/lib/server/auth';

export const SEED_MEMBER_EMAIL = 'e2e.payer@example.com';
export const SEED_MEMBER_PASSWORD = 'e2e-password-123';
export const SEED_USER_ID = 'e2e-pay-user';
export const SEED_RESERVATION_ID = 'e2e-pay-reservation';

export async function seedPayReservation(): Promise<void> {
	const { env, dispose } = await getPlatformProxy();
	const db = drizzle((env as { DB: D1Database }).DB);

	try {
		// Clean slate. Deleting the user cascades to its account/session/reservation rows,
		// but delete explicitly to be safe across FK-disabled local D1.
		await db.delete(reservation).where(eq(reservation.id, SEED_RESERVATION_ID));
		await db.delete(account).where(eq(account.userId, SEED_USER_ID));
		await db.delete(user).where(eq(user.id, SEED_USER_ID));

		const now = new Date();
		const passwordHash = await scryptHash(SEED_MEMBER_PASSWORD);

		await db.insert(user).values({
			id: SEED_USER_ID,
			name: 'E2E Payer',
			email: SEED_MEMBER_EMAIL,
			emailVerified: true,
			// No free-hour credits: keeps remainingCents > 0 so the pay page renders
			// the "cover processing fees" checkbox (it's hidden when credits cover it).
			creditFreeHours: 0,
			creditEquipment: 0,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(account).values({
			id: 'e2e-pay-account',
			accountId: SEED_USER_ID,
			providerId: 'credential',
			userId: SEED_USER_ID,
			password: passwordHash,
			createdAt: now,
			updatedAt: now
		});

		// A 1-hour scheduled, uncommitted reservation. At the default $15/hr rate this
		// is $15.00 due → remainingCents > 0 → checkbox visible, submit says "Pay $X".
		// cashDueCents = null ⇒ credits not yet committed (plain scheduled).
		const startsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
		startsAt.setUTCHours(20, 0, 0, 0); // ~1pm Pacific
		const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);

		await db.insert(reservation).values({
			id: SEED_RESERVATION_ID,
			bookerType: 'user',
			bookerId: SEED_USER_ID,
			createdByUserId: SEED_USER_ID,
			status: 'scheduled',
			startsAt,
			endsAt,
			notes: 'E2E cover-fees payment flow',
			cashDueCents: null,
			createdAt: now,
			updatedAt: now
		});
	} finally {
		await dispose();
	}
}
