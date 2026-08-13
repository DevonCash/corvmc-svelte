# Chores

Low-priority cleanup and tech-debt items. Not blocking, but worth doing.

## Open

- **Volunteer interest is no longer searchable across roles.** `/staff/volunteer/interest` was folded into `/staff/volunteer/roles` — per-role counts became a column and "who wants to do this" became the role detail page. What went with it was the ability to search any member by name/email and see every role they picked. That view belongs on the users table: add a role filter and an "interested in" column to `/staff/users`, backed by `listInterestedMembers` in `src/lib/server/volunteer/volunteer-interest-service.ts` (its role filter is an EXISTS, so a filtered member still comes back with all their roles).

- **Signup doesn't link an existing subscriber to the new account.** Nothing in `src/lib/server/auth.ts` attaches a `subscriber` row to a `userId` at registration. Linking only happens lazily — `findOrCreateForUser` when the member touches their account subscriptions, staff bulk-add, or `ensureSubscribersForUsers` when a built-in audience sends. So someone who joins the newsletter as `alice@x.com` and later registers with that address sees an empty list on their account page, because `getSubscriptionsForUser` looks up by `userId`. It self-heals on the first built-in send, but a better-auth `databaseHooks.user.create.after` calling `findOrCreateForUser` would close the window. Watch for the same address already linked to a different account.

- **A credited band can't ask for a fix to a listing it's on.** `event_band` lets an event's owner credit another platform band, and that band's only replies are `confirmLineupSlot` / `declineLineupSlot` (`src/lib/server/event/event-service.ts`, surfaced as the invite inbox on `src/routes/band/[slug]/events/+page.svelte`). There's no way to say "the date is wrong" or "that's not how we spell it" — the choice is accept a bad listing or decline and disappear from a bill you're actually playing. Community listings sharpen this: the listing may now be authored by someone with no connection to the band at all. Wants a third action, "Request a correction", carrying a note to whoever owns the event — plausibly as an inbox thread rather than new machinery. Granting credited bands direct edit rights is the wrong fix: it would let any act on a bill rewrite another party's listing.

- **`CreateEventModal` toggles use one-way binding.** In `src/routes/staff/events/CreateEventModal.svelte`, the `ticketingEnabled` and `reserveSpace` toggles pass `value={…}` instead of `bind:value`, so toggling them may not update the local state the conditional panels (`{#if ticketingEnabled}` etc.) depend on. Confirm the panels reveal correctly and switch to `bind:value` if not.

## Done

- **Dead membership checkout API routes.** Deleted `src/routes/api/me/membership/` (`checkout`, `update-amount`, and `resume`) — all three were unreferenced by any UI; the membership page uses the `createSubscription`/`updateAmount`/`resumeSubscription` remote forms.
- **Temporary `sentry-test` route.** Deleted `src/routes/sentry-test/+server.ts` (a publicly reachable route that threw on every GET, kept only to verify Sentry capture in production).
