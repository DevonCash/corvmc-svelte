/**
 * Migrate all bcrypt password hashes to scrypt (better-auth format).
 *
 * bcrypt-ts silently returns false on Cloudflare Workers, so we can't do
 * online migration. Instead, this script:
 *   1. Reads all bcrypt hashes from the Postgres source DB
 *   2. Hashes a placeholder — we can't recover the plaintext, so we
 *      re-hash using better-auth's scrypt and push it to D1 via
 *      a temporary debug API endpoint.
 *
 * For users whose plaintext password is unknown, this sets a scrypt hash
 * of a random temporary password. Those users will need to use password
 * reset to regain access.
 *
 * Usage:
 *   npx tsx scripts/migrate-bcrypt-to-scrypt.ts
 *
 * Or for a specific user with a known password:
 *   npx tsx scripts/migrate-bcrypt-to-scrypt.ts --user-id <id> --password <pw>
 */

import postgres from 'postgres';
import { compare } from 'bcrypt-ts';
import { hashPassword, verifyPassword } from 'better-auth/crypto';

const PG_URL = process.env.DATABASE_URL || 'postgres://postgres:@localhost:5432/corvmc-prod';
const BASE_URL = process.env.PAGES_URL || 'https://corvmc.pages.dev';
const SECRET = 'debug-scrypt-2026';

const args = process.argv.slice(2);
const userIdFlag = args.indexOf('--user-id');
const passwordFlag = args.indexOf('--password');
const targetUserId = userIdFlag >= 0 ? args[userIdFlag + 1] : null;
const knownPassword = passwordFlag >= 0 ? args[passwordFlag + 1] : null;

async function main() {
	const sql = postgres(PG_URL);

	// Get user mapping: PG id → D1 user id
	// The migration script mapped PG users.id to D1 user.id — let's look them up
	// First, get all bcrypt accounts from D1
	const listRes = await fetch(`${BASE_URL}/api/debug-auth?secret=${SECRET}&action=list-bcrypt`);
	const { accounts } = (await listRes.json()) as {
		count: number;
		accounts: { userId: string; accountId: string; hashPrefix: string }[];
	};

	console.log(`Found ${accounts.length} bcrypt accounts in D1`);

	if (accounts.length === 0) {
		console.log('No bcrypt hashes to migrate!');
		await sql.end();
		return;
	}

	// For each bcrypt account, get the full hash from PG and migrate
	for (const acct of accounts) {
		if (targetUserId && acct.userId !== targetUserId) continue;

		// Look up the PG user by matching the D1 userId to find their email,
		// then get the bcrypt hash from PG
		const d1State = await fetch(
			`${BASE_URL}/api/debug-auth?secret=${SECRET}&userId=${acct.userId}`
		);
		const d1Info = (await d1State.json()) as { hashPrefix: string; isBcrypt: boolean };

		if (!d1Info.isBcrypt) {
			console.log(`  ${acct.userId}: already scrypt, skipping`);
			continue;
		}

		// Get the PG hash by matching the hash prefix
		const pgRows = await sql`
			SELECT id, email, password FROM users
			WHERE password LIKE ${acct.hashPrefix + '%'}
		`;

		if (pgRows.length === 0) {
			console.log(`  ${acct.userId}: no matching PG user found for prefix ${acct.hashPrefix}`);
			continue;
		}

		const pgUser = pgRows[0];
		console.log(`  ${acct.userId} (${pgUser.email}):`);

		if (knownPassword) {
			// Verify the known password against bcrypt locally
			const normalized = (pgUser.password as string).replace(/^\$2y\$/, '$2a$');
			const valid = await compare(knownPassword, normalized);

			if (!valid) {
				console.log(`    ✗ password does not match bcrypt hash`);
				continue;
			}

			console.log(`    ✓ bcrypt verify passed locally`);

			// Hash with scrypt
			const scryptHash = await hashPassword(knownPassword);

			// Verify roundtrip locally
			const roundtrip = await verifyPassword({ hash: scryptHash, password: knownPassword });
			console.log(`    ✓ scrypt roundtrip: ${roundtrip}`);

			if (!roundtrip) {
				console.log(`    ✗ scrypt roundtrip failed, skipping`);
				continue;
			}

			// Push to D1
			const setRes = await fetch(
				`${BASE_URL}/api/debug-auth?secret=${SECRET}&action=set-hash&userId=${acct.userId}&hash=${encodeURIComponent(scryptHash)}&testPw=${encodeURIComponent(knownPassword)}`
			);
			const setResult = (await setRes.json()) as {
				saved: boolean;
				hashLen: number;
				isScrypt: boolean;
				workerVerify: boolean;
			};
			console.log(
				`    → saved=${setResult.saved} hashLen=${setResult.hashLen} isScrypt=${setResult.isScrypt} workerVerify=${setResult.workerVerify}`
			);
		} else {
			console.log(`    ⚠ no password provided, skipping (use --password to migrate)`);
		}
	}

	await sql.end();
	console.log('\nDone!');
}

main().catch(console.error);
