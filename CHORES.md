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
