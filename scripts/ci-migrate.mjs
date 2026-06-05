// Apply pending D1 migrations to remote, but ONLY on the production branch.
// Runs inside the Cloudflare Workers Builds build command (`pnpm ci:migrate && pnpm build`)
// so the schema is applied before the new Worker is published — and so preview/PR builds
// never touch the production database.
//
// Requires CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_D1_TOKEN in the
// build environment (used by drizzle.config.ts's d1-http driver).
import { execFileSync } from 'node:child_process';

const PROD_BRANCH = 'main';
// Workers Builds exposes the branch as WORKERS_CI_BRANCH; older Pages builds use CF_PAGES_BRANCH.
const branch = process.env.WORKERS_CI_BRANCH ?? process.env.CF_PAGES_BRANCH ?? '';

if (branch !== PROD_BRANCH) {
	console.log(
		`ci:migrate — branch "${branch || '(unknown)'}" is not "${PROD_BRANCH}", skipping remote migrate.`
	);
	process.exit(0);
}

console.log(`ci:migrate — applying D1 migrations to remote (branch "${branch}")…`);
execFileSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], { stdio: 'inherit' });
