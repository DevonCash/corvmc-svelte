# Chores

Low-priority cleanup and tech-debt items. Not blocking, but worth doing.

## Open

- **Audit Stripe webhook handler idempotency, then enable Stripe retries.**
  `src/routes/api/stripe/webhook/+server.ts` now captures handler failures to Sentry but still
  returns `200`, so Stripe never re-delivers a failed event (the work is silently dropped). To
  flip the failure path to `500` (so Stripe retries), every handler in
  `src/lib/server/finance/webhook-handlers.ts` must be idempotent. Initial read:
  `handleInvoicePaid` looks safe (keys credit allocation on `invoice.id`); `handleSubscriptionUpdated`/
  `handleSubscriptionDeleted` likely safe (overwrites) but confirm `syncFromWebhook` and
  `cancelAllForUser` re-run cleanly; `handleCheckoutCompleted` is highest risk — its
  `checkout.completed` domain-event listeners (`src/lib/server/*/checkout-listener.ts`) must
  dedupe on `session.id` or a redelivered checkout could double-fulfill. Remove the
  `TODO(stripe-retry)` comment in the webhook route once done.

- **Remove orphaned SvelteKit tracing/instrumentation flags from `svelte.config.js`.**
  `kit.experimental.tracing.server: true` and `kit.experimental.instrumentation.server: true`
  were added in the Jun 3 Sentry integration commit (`769a6f5`) alongside a
  `src/instrumentation.server.ts` file. The follow-up `6a94b27` removed that
  instrumentation file and switched to `Sentry.initCloudflareSentryHandle`, but
  left the two flags behind. There is now no instrumentation file and
  `@opentelemetry/api` is not installed. The build/worker tolerate it today, but
  the flags are dead config — remove both (keep `remoteFunctions: true`).

- **Delete dead ticket-email stub functions.**
  `src/lib/server/ticket/emails/index.ts` exports `sendTicketConfirmation`,
  `sendEventCancellation`, and `sendCheckInReminder` as empty `console.log` stubs.
  They were superseded by the notification system (domain events → dispatcher → email
  templates) and the file's own comments say they "can be deleted." Nothing in
  production sends through them. Delete the file and any remaining imports.

- **Confirm + document the unset prod env vars in `wrangler.toml`.**
  `EMAIL_FROM_ADDRESS`, `STAFF_CONTACT_EMAIL`, `TWILIO_PHONE_NUMBER`, `LARAVEL_URL`,
  and `R2_TRANSFORM_URL` are marked TODO in both the default and `[env.production.vars]`
  blocks. `TWILIO_PHONE_NUMBER` throws at runtime if an SMS sends while unset. Verify each
  is set as a Cloudflare secret/var in prod and turn the TODO comments into a documented
  deploy checklist (cross-link `docs/deployment-checklist.md`).

- **Extract a `safeJsonParse<T>(json, fallback)` helper.**
  `JSON.parse(s) as T` is repeated without try/catch ~8× in
  `src/lib/remote/directory.remote.ts` (lines 49, 60, 130, 141, 417, 424, 447, 511) and
  once in `src/lib/remote/users.remote.ts:215` — malformed stored data throws uncaught.
  Add a typed helper under `src/lib/utils/` and route these call sites through it.

- **Remove Stripe type-safety bypasses.**
  `src/lib/server/finance/payment-service.ts:282` casts `sessionParams as any`;
  `src/lib/server/finance/subscription-service.ts:198` uses `@ts-expect-error`; and
  `src/lib/server/stripe.ts:15` exports a double-asserted `Proxy` that erases types and
  breaks autocomplete. Payment code is where lost type-safety hurts most — type the param
  builders and replace the Proxy with an explicit `getStripe()` call.

- **Rewrite `db:migrate:local` as a fail-fast script.**
  `package.json` runs `for f in migrations/*/migration.sql; do wrangler d1 execute ...
  --file="$f"; done` — implicit glob ordering, no `set -e`, silent about which file
  failed. Replace with a small `tsx` script (mirrors the existing `scripts/` pattern) that
  applies migrations in explicit order and fails loudly on the first error.

- **Remove the deprecated `getSiteConfig` / `requireMember` aliases.**
  `src/lib/server/site-config/site-config-service.ts:58` aliases `getSiteConfig()` →
  `config()` and `src/lib/server/authorization.ts:80` aliases `requireMember` →
  `requireUser()`, both `@deprecated`. Migrate the remaining call sites to the canonical
  names, then delete the aliases.

- **Replace the stub README.**
  `README.md` is still the generic `sv create` template. Add a CorvMC overview, dev setup
  (pnpm install, env vars, local D1 + seed), architecture (SvelteKit + Drizzle + Workers,
  universal data layer via `.remote.ts`), deploy, and test sections.

- **Convert raw `<form>` / `<select>` elements to the shared Form components.**
  9 raw `<form>` and 28 raw `<select>` elements remain in route `.svelte` files (e.g.
  `src/routes/(public)/contact/+page.svelte:36,59`, `src/routes/staff/settings/+page.svelte`,
  `src/routes/band/[slug]/subscription/+page.svelte`), bypassing the mandated
  `Form`/`FormField`/`SubmitButton` from `$lib/components/shared/Form/`. Wiring is mostly
  correct (`rf.fields`) but loses built-in validation/dirty/loading/toast UX. Convert
  opportunistically when touching each page rather than in one sweep.
