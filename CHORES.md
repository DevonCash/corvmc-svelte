# Chores

Low-priority cleanup and tech-debt items. Not blocking, but worth doing.

## Open

- **Signup doesn't link an existing subscriber to the new account.** Nothing in `src/lib/server/auth.ts` attaches a `subscriber` row to a `userId` at registration. Linking only happens lazily — `findOrCreateForUser` when the member touches their account subscriptions, staff bulk-add, or `ensureSubscribersForUsers` when a built-in audience sends. So someone who joins the newsletter as `alice@x.com` and later registers with that address sees an empty list on their account page, because `getSubscriptionsForUser` looks up by `userId`. It self-heals on the first built-in send, but a better-auth `databaseHooks.user.create.after` calling `findOrCreateForUser` would close the window. Watch for the same address already linked to a different account.

- **`CreateEventModal` toggles use one-way binding.** In `src/routes/staff/events/CreateEventModal.svelte`, the `ticketingEnabled` and `reserveSpace` toggles pass `value={…}` instead of `bind:value`, so toggling them may not update the local state the conditional panels (`{#if ticketingEnabled}` etc.) depend on. Confirm the panels reveal correctly and switch to `bind:value` if not.

## Done

- **Dead membership checkout API routes.** Deleted `src/routes/api/me/membership/` (`checkout`, `update-amount`, and `resume`) — all three were unreferenced by any UI; the membership page uses the `createSubscription`/`updateAmount`/`resumeSubscription` remote forms.
- **Temporary `sentry-test` route.** Deleted `src/routes/sentry-test/+server.ts` (a publicly reachable route that threw on every GET, kept only to verify Sentry capture in production).
