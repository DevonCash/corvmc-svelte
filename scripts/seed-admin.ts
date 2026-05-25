/**
 * Seed the admin role and assign it to a user.
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts <user-email>
 *
 * Prerequisites:
 *   - DATABASE_URL env var set
 *   - Migrations already applied (npx drizzle-kit migrate)
 *   - The user already exists (signed up via the app)
 */
import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { user } from '../src/lib/server/db/schema/authentication';
import { role, modelHasRole } from '../src/lib/server/db/schema/authorization';

const email = process.argv[2];
if (!email) {
	console.error('Usage: npx tsx scripts/seed-admin.ts <user-email>');
	process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

async function main() {
	// Upsert the admin role
	const [adminRole] = await db
		.insert(role)
		.values({ name: 'admin', guardName: 'web' })
		.onConflictDoNothing()
		.returning();

	const roleId =
		adminRole?.id ??
		(await db.select({ id: role.id }).from(role).where(eq(role.name, 'admin')))[0].id;

	// Find the user
	const [found] = await db
		.select({ id: user.id, name: user.name })
		.from(user)
		.where(eq(user.email, email));

	if (!found) {
		console.error(`No user found with email: ${email}`);
		process.exit(1);
	}

	// Assign admin role
	await db
		.insert(modelHasRole)
		.values({ roleId, userId: found.id })
		.onConflictDoNothing();

	console.log(`Assigned admin role to ${found.name} (${email})`);
	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
