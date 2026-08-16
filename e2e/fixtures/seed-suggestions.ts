/**
 * Seed the suggestion board for the e2e suite.
 *
 * Why this exists: the things that would hurt most if they broke are all
 * client-server round trips over state that has to move in the right direction,
 * and none of them are reachable from a unit test —
 *
 *   - a report has to actually pull a suggestion off the board, for everyone
 *     except its author. Two facts that only a round trip proves together, and
 *     the failure mode (a member's post staying up, or vanishing for its author
 *     too) is invisible to the service specs.
 *   - dismissing a report has to put it back. This is the asymmetry with event
 *     listings, and getting it wrong hands every member a permanent takedown
 *     button — the single highest-consequence bug in the feature.
 *   - upholding one has to reach the author's next post, through standing, and
 *     the approval has to release it onto the board.
 *   - the vote count on a merged pair has to be the union of both voter sets,
 *     read back through the real board query rather than a mocked select.
 *
 * Three members, deliberately: an author, a reporter, and a bystander whose
 * only job is to make "the post is gone for everyone, not just the reporter"
 * assertable.
 *
 * Idempotent: deletes and recreates its own rows on every run.
 */
import { eq, inArray } from 'drizzle-orm';
import { withPlatformDb, withPlatformEnv } from './platform-db';
import { user, account } from '../../src/lib/server/db/schema/authentication';
import { contentFlag } from '../../src/lib/server/db/schema/flag';
import {
	suggestion,
	suggestionVote,
	suggestionStanding
} from '../../src/lib/server/db/schema/suggestion';
import { scryptHash } from './seed-pay-reservation';

export const SEED_SG_PASSWORD = 'e2e-password-123';

/** Writes the suggestions that get reported. */
export const SEED_SG_AUTHOR_ID = 'e2e-sg-author';
export const SEED_SG_AUTHOR_EMAIL = 'e2e.suggest.author@example.com';
export const SEED_SG_AUTHOR_NAME = 'E2E Suggestion Author';

/** Files the reports. */
export const SEED_SG_REPORTER_ID = 'e2e-sg-reporter';
export const SEED_SG_REPORTER_EMAIL = 'e2e.suggest.reporter@example.com';
export const SEED_SG_REPORTER_NAME = 'E2E Suggestion Reporter';

/** Neither reports nor authors — proves a withheld post is gone for everyone. */
export const SEED_SG_BYSTANDER_ID = 'e2e-sg-bystander';
export const SEED_SG_BYSTANDER_EMAIL = 'e2e.suggest.bystander@example.com';
export const SEED_SG_BYSTANDER_NAME = 'E2E Suggestion Bystander';

/** Reported, then dismissed — must come back onto the board. */
export const SEED_SG_DISMISS_ID = 'e2e-sg-dismiss';
export const SEED_SG_DISMISS_TITLE = 'E2E Restore Me After Dismissal';

/** Reported, then upheld — must stay down and cost the author their trust. */
export const SEED_SG_UPHOLD_ID = 'e2e-sg-uphold';
export const SEED_SG_UPHOLD_TITLE = 'E2E Keep Me Down After Upholding';

/** Plain and visible, so the board always has something to match on. */
export const SEED_SG_VISIBLE_ID = 'e2e-sg-visible';
export const SEED_SG_VISIBLE_TITLE = 'E2E Ordinary Visible Suggestion';

/**
 * A merge pair with OVERLAPPING voters.
 *
 * Target: author, reporter, bystander (3). Source: reporter, staff (2). The
 * reporter voted for both, so a correct merge leaves the target holding the
 * union — 4 — while the tempting-but-wrong implementation double-counts them
 * and lands on 5. Without the deliberate overlap the two are indistinguishable.
 */
export const SEED_SG_MERGE_TARGET_ID = 'e2e-sg-merge-target';
export const SEED_SG_MERGE_TARGET_TITLE = 'E2E Merge Target Suggestion';
export const SEED_SG_MERGE_SOURCE_ID = 'e2e-sg-merge-source';
export const SEED_SG_MERGE_SOURCE_TITLE = 'E2E Merge Source Duplicate';
export const SEED_SG_MERGE_UNION_VOTES = 4;

const MEMBER_IDS = [SEED_SG_AUTHOR_ID, SEED_SG_REPORTER_ID, SEED_SG_BYSTANDER_ID];
const SUGGESTION_IDS = [
	SEED_SG_DISMISS_ID,
	SEED_SG_UPHOLD_ID,
	SEED_SG_VISIBLE_ID,
	SEED_SG_MERGE_TARGET_ID,
	SEED_SG_MERGE_SOURCE_ID
];

export async function seedSuggestions(): Promise<void> {
	await resetReportRateLimit();
	await withPlatformDb(async (db) => {
		// Standing before user, votes before suggestion: each points at the next.
		await db.delete(suggestionStanding).where(inArray(suggestionStanding.userId, MEMBER_IDS));
		await db.delete(suggestionVote).where(inArray(suggestionVote.suggestionId, SUGGESTION_IDS));
		await db.delete(contentFlag).where(inArray(contentFlag.entityId, SUGGESTION_IDS));
		await db.delete(suggestion).where(inArray(suggestion.id, SUGGESTION_IDS));
		await db.delete(suggestion).where(inArray(suggestion.authorUserId, MEMBER_IDS));
		await db.delete(account).where(inArray(account.userId, MEMBER_IDS));
		await db.delete(user).where(inArray(user.id, MEMBER_IDS));

		const now = new Date();
		const passwordHash = await scryptHash(SEED_SG_PASSWORD);

		for (const [id, email, name] of [
			[SEED_SG_AUTHOR_ID, SEED_SG_AUTHOR_EMAIL, SEED_SG_AUTHOR_NAME],
			[SEED_SG_REPORTER_ID, SEED_SG_REPORTER_EMAIL, SEED_SG_REPORTER_NAME],
			[SEED_SG_BYSTANDER_ID, SEED_SG_BYSTANDER_EMAIL, SEED_SG_BYSTANDER_NAME]
		] as const) {
			await db.insert(user).values({
				id,
				name,
				email,
				emailVerified: true,
				createdAt: now,
				updatedAt: now
			});
			await db.insert(account).values({
				id: `${id}-account`,
				accountId: id,
				providerId: 'credential',
				userId: id,
				password: passwordHash,
				createdAt: now,
				updatedAt: now
			});
		}

		for (const [id, title] of [
			[SEED_SG_DISMISS_ID, SEED_SG_DISMISS_TITLE],
			[SEED_SG_UPHOLD_ID, SEED_SG_UPHOLD_TITLE],
			[SEED_SG_VISIBLE_ID, SEED_SG_VISIBLE_TITLE],
			[SEED_SG_MERGE_TARGET_ID, SEED_SG_MERGE_TARGET_TITLE],
			[SEED_SG_MERGE_SOURCE_ID, SEED_SG_MERGE_SOURCE_TITLE]
		] as const) {
			await db.insert(suggestion).values({
				id,
				authorUserId: SEED_SG_AUTHOR_ID,
				title,
				body: `Seeded for the e2e suite: ${title}.`,
				category: 'other',
				status: 'open',
				visibility: 'visible',
				createdAt: now,
				updatedAt: now
			});
		}

		// Overlapping voter sets. The reporter votes on both, so the union is 4
		// where the sum would be 5 — that gap is the whole point of the fixture.
		const votes: Array<[string, string]> = [
			[SEED_SG_MERGE_TARGET_ID, SEED_SG_AUTHOR_ID],
			[SEED_SG_MERGE_TARGET_ID, SEED_SG_REPORTER_ID],
			[SEED_SG_MERGE_TARGET_ID, SEED_SG_BYSTANDER_ID],
			[SEED_SG_MERGE_SOURCE_ID, SEED_SG_REPORTER_ID],
			[SEED_SG_MERGE_SOURCE_ID, 'e2e-staff-user']
		];
		for (const [suggestionId, userId] of votes) {
			await db
				.insert(suggestionVote)
				.values({ id: `${suggestionId}-${userId}`, suggestionId, userId, createdAt: now })
				// The staff user is seeded by a sibling fixture; skip the row rather
				// than failing the whole suite if the ordering ever changes.
				.onConflictDoNothing();
		}
	});
}

/**
 * Clear the reporters' KV rate-limit counters.
 *
 * `flagSuggestion` allows 5 reports per member per hour, and KV survives
 * between runs in `.wrangler/state`. Each pass through this suite files two
 * reports, so by the third run the reporter is throttled and the report simply
 * doesn't land — which surfaces as a suggestion mysteriously staying visible,
 * several assertions away from the actual cause. Resetting here keeps the
 * fixture's "idempotent on every run" promise true of KV as well as of rows.
 */
async function resetReportRateLimit(): Promise<void> {
	await withPlatformEnv(async ({ env }) => {
		const kv = env.KV as KVNamespace | undefined;
		if (!kv) return;
		for (const id of MEMBER_IDS) {
			await kv.delete(`rate-limit:suggestion-flag:${id}`);
		}
	});
}

/** Read a suggestion's moderation state straight from the database. */
export async function readSuggestionState(suggestionId: string): Promise<{
	visibility: string | null;
	mergedIntoId: string | null;
	voteCount: number;
}> {
	return withPlatformDb(async (db) => {
		const [row] = await db
			.select({ visibility: suggestion.visibility, mergedIntoId: suggestion.mergedIntoId })
			.from(suggestion)
			.where(eq(suggestion.id, suggestionId))
			.limit(1);
		const votes = await db
			.select({ id: suggestionVote.id })
			.from(suggestionVote)
			.where(eq(suggestionVote.suggestionId, suggestionId));
		return {
			visibility: row?.visibility ?? null,
			mergedIntoId: row?.mergedIntoId ?? null,
			voteCount: votes.length
		};
	});
}

/** Whether this member is currently posting under review. */
export async function readSuggestionStanding(userId: string): Promise<boolean> {
	return withPlatformDb(async (db) => {
		const [row] = await db
			.select({ requiresReview: suggestionStanding.requiresReview })
			.from(suggestionStanding)
			.where(eq(suggestionStanding.userId, userId))
			.limit(1);
		return row?.requiresReview ?? false;
	});
}
