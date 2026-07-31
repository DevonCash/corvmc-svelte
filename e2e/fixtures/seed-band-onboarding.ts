/**
 * Seed a band owner + three bands (public, hidden, members-only) into the LOCAL
 * D1 database used by `vite preview`, for the band directory onboarding e2e
 * tests: the band profile edit page regression (effect_update_depth_exceeded),
 * the hometown/foundedYear save round-trip, and the directoryVisibility gate on
 * public band detail pages.
 *
 * Run by the Playwright global setup (see playwright.config.ts → globalSetup).
 *
 * Idempotent: deletes and recreates the seeded user and bands on every run.
 * Mirrors the D1 access pattern in seed-pay-reservation.ts.
 */
import 'dotenv/config';
import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { user, account } from '../../src/lib/server/db/schema/authentication';
import { band, bandMember } from '../../src/lib/server/db/schema/band';
import { scryptHash } from './seed-pay-reservation';

export const SEED_OWNER_EMAIL = 'e2e.band.owner@example.com';
export const SEED_OWNER_PASSWORD = 'e2e-password-123';
export const SEED_OWNER_ID = 'e2e-band-owner';

export const SEED_PUBLIC_BAND_ID = 'e2e-band-public';
export const SEED_PUBLIC_BAND_SLUG = 'e2e-public-band';
export const SEED_PUBLIC_BAND_NAME = 'E2E Public Band';
export const SEED_PUBLIC_BAND_HOMETOWN = 'Corvallis, OR';
export const SEED_PUBLIC_BAND_FOUNDED = '2019';

export const SEED_HIDDEN_BAND_ID = 'e2e-band-hidden';
export const SEED_HIDDEN_BAND_SLUG = 'e2e-hidden-band';

export const SEED_MEMBERS_BAND_ID = 'e2e-band-members';
export const SEED_MEMBERS_BAND_SLUG = 'e2e-members-band';
export const SEED_MEMBERS_BAND_NAME = 'E2E Members Band';

const BAND_IDS = [SEED_PUBLIC_BAND_ID, SEED_HIDDEN_BAND_ID, SEED_MEMBERS_BAND_ID];

export async function seedBandOnboarding(): Promise<void> {
	const { env, dispose } = await getPlatformProxy();
	const db = drizzle((env as { DB: D1Database }).DB);

	try {
		// Clean slate. Delete explicitly (FKs may be disabled on local D1).
		for (const bandId of BAND_IDS) {
			await db.delete(bandMember).where(eq(bandMember.bandId, bandId));
			await db.delete(band).where(eq(band.id, bandId));
		}
		await db.delete(account).where(eq(account.userId, SEED_OWNER_ID));
		await db.delete(user).where(eq(user.id, SEED_OWNER_ID));

		const now = new Date();
		const passwordHash = await scryptHash(SEED_OWNER_PASSWORD);

		await db.insert(user).values({
			id: SEED_OWNER_ID,
			name: 'E2E Band Owner',
			email: SEED_OWNER_EMAIL,
			emailVerified: true,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(account).values({
			id: 'e2e-band-owner-account',
			accountId: SEED_OWNER_ID,
			providerId: 'credential',
			userId: SEED_OWNER_ID,
			password: passwordHash,
			createdAt: now,
			updatedAt: now
		});

		await db.insert(band).values([
			{
				id: SEED_PUBLIC_BAND_ID,
				name: SEED_PUBLIC_BAND_NAME,
				slug: SEED_PUBLIC_BAND_SLUG,
				// Plain-text (non-HTML) bio: the shape every band created through the
				// create-band modal has, and the shape that fed the RichTextEditor
				// reconcile churn in the edit-page crash.
				bio: 'Plain text bio seeded for the edit page regression test.',
				ownerId: SEED_OWNER_ID,
				hometown: SEED_PUBLIC_BAND_HOMETOWN,
				foundedYear: SEED_PUBLIC_BAND_FOUNDED,
				directoryVisibility: 'public',
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_HIDDEN_BAND_ID,
				name: 'E2E Hidden Band',
				slug: SEED_HIDDEN_BAND_SLUG,
				bio: 'This band opted out of the directory entirely.',
				ownerId: SEED_OWNER_ID,
				directoryVisibility: 'hidden',
				createdAt: now,
				updatedAt: now
			},
			{
				id: SEED_MEMBERS_BAND_ID,
				name: SEED_MEMBERS_BAND_NAME,
				slug: SEED_MEMBERS_BAND_SLUG,
				bio: 'Visible to logged-in members only.',
				ownerId: SEED_OWNER_ID,
				directoryVisibility: 'members',
				createdAt: now,
				updatedAt: now
			}
		]);

		await db.insert(bandMember).values(
			BAND_IDS.map((bandId) => ({
				id: `${bandId}-owner`,
				bandId,
				userId: SEED_OWNER_ID,
				role: 'owner' as const,
				status: 'active' as const,
				createdAt: now
			}))
		);
	} finally {
		await dispose();
	}
}
