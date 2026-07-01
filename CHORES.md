# Chores

Low-priority cleanup and tech-debt items. Not blocking, but worth doing.

## Open

- **`CreateEventModal` toggles use one-way binding.** In `src/routes/staff/events/CreateEventModal.svelte`, the `ticketingEnabled` and `reserveSpace` toggles pass `value={…}` instead of `bind:value`, so toggling them may not update the local state the conditional panels (`{#if ticketingEnabled}` etc.) depend on. Confirm the panels reveal correctly and switch to `bind:value` if not.

## Done

- **Dead membership checkout API routes.** Deleted `src/routes/api/me/membership/` (`checkout`, `update-amount`, and `resume`) — all three were unreferenced by any UI; the membership page uses the `createSubscription`/`updateAmount`/`resumeSubscription` remote forms.
- **Temporary `sentry-test` route.** Deleted `src/routes/sentry-test/+server.ts` (a publicly reachable route that threw on every GET, kept only to verify Sentry capture in production).
