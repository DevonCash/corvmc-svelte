/**
 * backfill-charge-payment-intents.ts
 *
 * One-off source-DB backfill. Legacy `charges` rows for online payments carry a
 * Stripe Checkout Session id (`stripe_session_id`, `cs_…`) but no PaymentIntent
 * id. The migrator prefers `stripe_payment_intent_id` when linking a reservation's
 * Stripe payment record, and only a real `pi_…` is refundable through the app's
 * refund() path. This script resolves each session's PaymentIntent via the Stripe
 * API (read-only) and writes it back to `charges.stripe_payment_intent_id`, so the
 * migrator can pick it up on subsequent runs with no per-run Stripe calls.
 *
 * Usage:
 *   DATABASE_URL=… STRIPE_SECRET_KEY=sk_live_… pnpm tsx scripts/backfill-charge-payment-intents.ts [--commit]
 *
 * Flags:
 *   --commit   Write resolved PaymentIntent ids back to Postgres (default: dry-run)
 *
 * Notes:
 *   - The STRIPE_SECRET_KEY must match the environment the charges were taken in
 *     (live vs test); a mismatched key returns "No such session".
 *   - Idempotent: only fills rows where stripe_payment_intent_id is null/empty.
 *   - Sessions that 404 (purged) or have no PaymentIntent are left untouched; the
 *     migrator falls back to the session id / a synthetic id for those.
 */

import 'dotenv/config';
import postgres from 'postgres';
import Stripe from 'stripe';

const COMMIT = process.argv.slice(2).includes('--commit');

if (!process.env.DATABASE_URL) {
	console.error('Error: DATABASE_URL is not set');
	process.exit(1);
}
if (!process.env.STRIPE_SECRET_KEY) {
	console.error('Error: STRIPE_SECRET_KEY is not set');
	process.exit(1);
}

const key = process.env.STRIPE_SECRET_KEY;
const mode = key.includes('_live_') ? 'LIVE' : key.includes('_test_') ? 'TEST' : 'UNKNOWN';
console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY RUN'} | Stripe: ${mode}`);
console.log();

const pg = postgres(process.env.DATABASE_URL);
const stripe = new Stripe(key);

async function main() {
	const charges = await pg<{ id: number | string; stripe_session_id: string }[]>`
		SELECT id, stripe_session_id
		FROM charges
		WHERE stripe_session_id IS NOT NULL
		  AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = '')
		ORDER BY id
	`;
	console.log(`Source: ${charges.length} charges with a session id and no PaymentIntent`);

	let resolved = 0;
	let noIntent = 0;
	let notFound = 0;

	for (const c of charges) {
		let pi: string | null;
		try {
			const session = await stripe.checkout.sessions.retrieve(c.stripe_session_id);
			pi =
				typeof session.payment_intent === 'string'
					? session.payment_intent
					: (session.payment_intent?.id ?? null);
		} catch (err) {
			notFound++;
			console.warn(
				`  charge ${c.id}: session ${c.stripe_session_id} not retrievable — ${(err as Error).message}`
			);
			continue;
		}

		if (!pi) {
			noIntent++;
			continue;
		}

		resolved++;
		if (COMMIT) {
			await pg`UPDATE charges SET stripe_payment_intent_id = ${pi} WHERE id = ${c.id}`;
		}
	}

	console.log();
	console.log(
		`  ✓ Resolved PaymentIntent for ${resolved} charges${COMMIT ? ' (written)' : ' (dry run — not written)'}`
	);
	if (noIntent) console.log(`  • ${noIntent} sessions had no PaymentIntent (left as-is)`);
	if (notFound) console.log(`  • ${notFound} sessions not retrievable (left as-is)`);
}

main()
	.catch((err) => {
		console.error('Fatal:', err);
		process.exit(1);
	})
	.finally(async () => {
		await pg.end();
	});
