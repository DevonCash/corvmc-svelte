# Deployment Checklist

First-time production deployment for corvmc-svelte — a rewrite of corvmc-redux (Laravel/Postgres) on Cloudflare Workers + D1.

---

## Prerequisites

- [ ] Cloudflare account with Workers paid plan
- [ ] Wrangler CLI installed (`pnpm add -g wrangler`) and authenticated (`wrangler login`)
- [ ] Stripe account with live API keys
- [ ] `pg_dump -Fc` backup of the production Postgres database
- [ ] Local Postgres instance for restoring the dump (for the migration script)
- [ ] Node.js 20+ and pnpm installed

---

## 1. Cloudflare Resource Setup

### Create D1 Database

```bash
wrangler d1 create corvmc-db
```

Copy the returned `database_id` and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "corvmc-db"
database_id = "<paste-real-id-here>"
migrations_dir = "drizzle"
```

### Create R2 Bucket (if file uploads needed)

```bash
wrangler r2 bucket create corvmc-uploads
```

### Set Secrets

```bash
wrangler secret put BETTER_AUTH_SECRET
# Enter a 32+ character high-entropy string

wrangler secret put ORIGIN
# Enter the production URL, e.g. https://corvmc.com

wrangler secret put STRIPE_SECRET_KEY
# Enter sk_live_... key

# R2 bucket is configured as a binding in wrangler.toml (no credentials needed)
wrangler secret put R2_PUBLIC_URL
```

---

## 2. Apply D1 Migrations

```bash
wrangler d1 migrations apply corvmc-db --remote
```

This runs the migration files in `drizzle/` against the production D1 database.

---

## 3. Data Migration from Postgres

### Restore the dump to a local Postgres

```bash
createdb corvmc-migration
pg_restore -d corvmc-migration path/to/dump.Fc
```

### Run the migration script

```bash
# Dry run — shows what would be migrated without writing
DATABASE_URL="postgres://localhost/corvmc-migration" pnpm tsx scripts/migrate-from-postgres.ts

# Commit to local D1
DATABASE_URL="postgres://localhost/corvmc-migration" pnpm tsx scripts/migrate-from-postgres.ts --commit

# Commit to remote (production) D1
DATABASE_URL="postgres://localhost/corvmc-migration" pnpm tsx scripts/migrate-from-postgres.ts --commit --remote
```

The script:
- Maps Laravel integer IDs to UUIDs (maintains a stable mapping file at `scripts/.id-map.json`)
- Transforms snake_case columns to the D1 schema
- Splits array columns into junction tables (instruments, genres)
- Merges `member_profiles` data into the `user` table
- Creates `account` records for better-auth credential storage
- Processes tables in foreign-key order

### Verify migration

```bash
# Check row counts
wrangler d1 execute corvmc-db --remote --command "SELECT 'user' as t, count(*) as n FROM user UNION ALL SELECT 'band', count(*) FROM band UNION ALL SELECT 'reservation', count(*) FROM reservation UNION ALL SELECT 'event', count(*) FROM event"
```

---

## 4. Pre-deploy Checks

```bash
pnpm check        # svelte-check — no type errors
pnpm lint         # ESLint + Prettier
pnpm test         # Vitest + Playwright
pnpm build        # Production build for Cloudflare Workers
```

---

## 5. Deploy

```bash
wrangler deploy
```

---

## 6. Stripe Webhook Setup

Create the webhook endpoint pointing to the new domain:

```bash
APP_URL=https://corvmc.com STRIPE_SECRET_KEY=sk_live_xxx pnpm tsx scripts/sync-webhooks.ts
```

The script outputs:
- `STRIPE_WEBHOOK_SECRET` — the signing secret
- `STRIPE_WEBHOOK_ID` — for future updates

Set the secret in production:

```bash
wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste the secret from the script output
```

To update webhook events later:

```bash
STRIPE_WEBHOOK_ID=we_xxx STRIPE_SECRET_KEY=sk_live_xxx pnpm tsx scripts/sync-webhooks.ts
```

---

## 7. Custom Domain

In Cloudflare dashboard: Workers & Pages → corvmc → Settings → Domains & Routes → Add Custom Domain.

Or add to `wrangler.toml`:

```toml
routes = [
  { pattern = "corvmc.com", custom_domain = true }
]
```

Ensure the `ORIGIN` secret matches the domain exactly (including `https://`).

---

## 7a. Password Migration (bcrypt → scrypt)

bcrypt-ts silently fails on Cloudflare Workers (returns `false` in 0ms), so bcrypt passwords migrated from the Laravel app cannot be verified on the worker. A proxy flow handles this transparently:

1. SvelteKit detects a `$2y$` hash → calls `LARAVEL_URL/api/verify-password`
2. Laravel verifies bcrypt natively and returns `{ valid: true/false }`
3. On success, SvelteKit re-hashes with scrypt and updates D1
4. Future logins use scrypt directly — no more Laravel calls

**Secrets required on Cloudflare Pages:**
- `LARAVEL_URL` — base URL of the Laravel app (e.g. `https://corvmc.org`)
- `MIGRATION_SECRET` — shared secret matching `MIGRATION_SECRET` in Laravel's `.env`

**When cutting the domain to SvelteKit:**

1. Move the Laravel app to a subdomain (e.g. `legacy.corvmc.org`)
2. Update the Pages secret:
   ```bash
   npx wrangler pages secret put LARAVEL_URL --project-name corvmc <<< "https://legacy.corvmc.org"
   ```
3. Monitor logs for `[auth] bcrypt→scrypt migration complete` messages
4. Once no bcrypt hashes remain in D1, remove:
   - `LARAVEL_URL` and `MIGRATION_SECRET` secrets from Cloudflare Pages
   - The `verifyBcryptViaLaravel()` function and bcrypt branch in `src/lib/server/auth.ts`
   - The `/api/verify-password` route from the Laravel app
   - The Laravel app itself (if no longer needed)

**Check remaining bcrypt hashes:**
```sql
SELECT count(*) FROM account WHERE provider_id = 'credential' AND password LIKE '$2%';
```

---

## 8. Post-deploy Verification

- [ ] Site loads at production URL
- [ ] Sign in works for a migrated user
- [ ] Member dashboard shows correct data (reservations, bands, credits)
- [ ] Staff panel loads with correct permissions
- [ ] Create a test reservation (then cancel it)
- [ ] Trigger a Stripe test event: `stripe trigger payment_intent.succeeded --api-key sk_live_xxx`
- [ ] Check Cloudflare dashboard for worker errors

---

## 9. Subsequent Deploys

```bash
# If schema changed:
pnpm db:generate
wrangler d1 migrations apply corvmc-db --remote

# Always:
pnpm check && pnpm lint && pnpm test
pnpm build
wrangler deploy
```

---

## 10. Rollback

```bash
# Revert to previous Worker version
wrangler rollback
```

D1 migrations cannot be auto-reversed. If a migration needs to be undone:
1. Write a new migration that reverses the changes
2. `pnpm db:generate` won't help here — manually create a SQL file in `drizzle/`
3. Apply: `wrangler d1 migrations apply corvmc-db --remote`

For emergency data fixes:

```bash
wrangler d1 execute corvmc-db --remote --command "UPDATE user SET ..."
```

---

## Drizzle Kit Remote Access

For running `drizzle-kit studio` or other Drizzle Kit commands against production:

```bash
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
export CLOUDFLARE_DATABASE_ID="your-d1-database-id"
export CLOUDFLARE_D1_TOKEN="your-api-token-with-d1-edit"

pnpm drizzle-kit studio
```

Create the API token at: Cloudflare dashboard → My Profile → API Tokens → Create Token → Custom → Permissions: Account / D1 / Edit.
