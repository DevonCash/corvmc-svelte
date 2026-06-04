#!/usr/bin/env bash
#
# sync-d1.sh — refresh the remote D1 database's DATA from the live Postgres source.
#
# Reloads all application data from Postgres into prod D1 while leaving the schema and
# migration history (__drizzle_migrations) intact. Used by .github/workflows/sync-d1.yml
# (nightly + manual) and runnable locally for a one-off resync.
#
# This is for the PRE-CUTOVER window only: Postgres is canonical, D1 is staging.
#
# Required env:
#   DATABASE_URL            Postgres connection string (DigitalOcean, append ?sslmode=require)
#   CLOUDFLARE_API_TOKEN    for `wrangler ... --remote` (or be `wrangler login`-ed locally)
#   CLOUDFLARE_ACCOUNT_ID   for wrangler
#
# Usage:
#   DATABASE_URL="postgres://…?sslmode=require" bash scripts/sync-d1.sh
set -euo pipefail

DB=corvmc-db
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?DATABASE_URL must be set (Postgres source)}"

echo "▸ 1/6  Rebuild local D1 schema from migration files"
rm -rf .wrangler/state/v3/d1
pnpm db:migrate:local

echo "▸ 2/6  ETL Postgres → local D1"
pnpm tsx scripts/migrate-from-postgres.ts --commit

echo "▸ 3/6  Export local data (data only)"
wrangler d1 export "$DB" --local --no-schema --output d1-seed.sql

echo "▸ 4/6  Order INSERTs parent-first / DELETEs child-first"
node scripts/reorder-seed.mjs
node scripts/gen-d1-delete.mjs

echo "▸ 5/6  Clear remote data (child-first)"
wrangler d1 execute "$DB" --remote --yes --file d1-delete.sql

echo "▸ 6/6  Import fresh data into remote (parent-first)"
wrangler d1 execute "$DB" --remote --yes --file d1-seed-ordered.sql

echo "✓ D1 data sync complete."
