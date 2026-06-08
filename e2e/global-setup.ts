/**
 * Playwright global setup: seed the local D1 with the e2e member + payable
 * reservation before the preview server handles any request.
 *
 * Runs once per `playwright test` invocation, after the webServer is reachable
 * is NOT guaranteed here — global setup runs before tests but the webServer may
 * still be booting. That's fine: the seed talks to the D1 SQLite file directly
 * (via getPlatformProxy), independently of the preview server process.
 */
import { execSync } from 'node:child_process';
import { seedPayReservation } from './fixtures/seed-pay-reservation';

export default async function globalSetup() {
	// CI starts from a fresh checkout with no local D1, so create + migrate it
	// before seeding. Locally we skip this: the dev D1 is already migrated and the
	// migration SQL uses plain CREATE TABLE (re-running it against an existing
	// database would error). `pnpm db:reset` is the local equivalent.
	if (process.env.CI) {
		execSync('pnpm db:migrate:local', { stdio: 'inherit' });
	}
	await seedPayReservation();
}
