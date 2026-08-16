/**
 * Prepare the local D1 for the e2e suite — migrate (CI) and seed — *before*
 * Playwright starts the preview server.
 *
 * This has to happen before the server boots, not from `globalSetup`. Playwright
 * orders its startup tasks as [remove output dirs, plugin setup, global setup],
 * and `webServer` is a plugin, so `globalSetup` only runs once the preview server
 * is already up and serving. Migrating and seeding from there meant a second
 * miniflare (every `wrangler d1 execute` in the migrate loop, then each fixture's
 * `getPlatformProxy()`) opening `.wrangler/state` while the server held it.
 *
 * SQLite tolerates that right up until the file needs recovery, at which point
 * the exclusive lock can't be taken and workerd dies outright:
 *
 *   *** Fatal uncaught kj::Exception: SENTRY_DO SQLite failed;
 *       database is locked: SQLITE_BUSY (extended: SQLITE_BUSY_RECOVERY)
 *   MiniflareCoreError [ERR_RUNTIME_FAILURE]: The Workers runtime failed to start.
 *
 * — which fails the whole suite, not one test. Running here means every one of
 * those processes has exited before the server opens the file.
 */
import { execSync } from 'node:child_process';
import { seedPayReservation } from './fixtures/seed-pay-reservation';
import { seedBandOnboarding } from './fixtures/seed-band-onboarding';
import { seedStaffUser } from './fixtures/seed-staff-user';
import { seedStaffEvent } from './fixtures/seed-staff-event';
import { seedVolunteering } from './fixtures/seed-volunteering';
import { seedFeatureFlags } from './fixtures/seed-feature-flags';
import { seedCommunityEvents } from './fixtures/seed-community-events';
import { seedSuggestions } from './fixtures/seed-suggestions';

// CI starts from a fresh checkout with no local D1, so create + migrate it before
// seeding. Locally we skip this: the dev D1 is already migrated and the migration
// SQL uses plain CREATE TABLE (re-running it against an existing database would
// error). `pnpm db:reset` is the local equivalent.
if (process.env.CI) {
	execSync('pnpm db:migrate:local', { stdio: 'inherit' });
}

await seedPayReservation();
await seedBandOnboarding();
await seedStaffUser();
await seedStaffEvent();
await seedVolunteering();
await seedCommunityEvents();
// After the staff fixture: one seeded vote belongs to the staff user.
await seedSuggestions();
await seedFeatureFlags();
