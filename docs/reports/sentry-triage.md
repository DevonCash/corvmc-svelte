# Sentry Triage — 2026-07-10

All 14 unresolved issues in
[corvallis-music-collective/javascript-sveltekit](https://corvallis-music-collective.sentry.io/issues/?project=javascript-sveltekit&query=is%3Aunresolved)
collected via the Sentry MCP and traced to root cause. Environment: production
only. Short IDs below link to Sentry; timestamps UTC.

## Summary

| Sentry issue                                                                      | Title                                            | Events/Users | Last seen                | Classification                            | Action                                                 |
| --------------------------------------------------------------------------------- | ------------------------------------------------ | ------------ | ------------------------ | ----------------------------------------- | ------------------------------------------------------ |
| [18](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-18) | Postmark: Template 'Alias' not valid             | 10/5         | **2026-07-10 (ongoing)** | **Active ops bug**                        | Push templates to Postmark (see below)                 |
| [Q](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-Q)   | NotificationBell: `e is undefined`               | 1/1          | 2026-06-18               | Clear bug                                 | **Fixed** — teardown guard in `handleClickOutside`     |
| [1A](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1A) | NotificationBell: reading 'f' of undefined       | 1/1          | 2026-06-27               | Clear bug (same root as Q)                | **Fixed** — same guard                                 |
| [D](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-D)   | "x" — `{status:500, body}` captured as exception | 4/3          | 2026-07-01               | Clear telemetry bug                       | **Fixed** — `report-error.ts` drops HTTP-shaped errors |
| [1B](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1B) | Cannot book more than 14 days in advance (500)   | 1/1          | 2026-07-01               | Already fixed by #128                     | Resolve in Sentry                                      |
| [15](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-15) | Balance cannot be negative                       | 7/3          | 2026-06-28               | Already fixed by #130                     | Resolve in Sentry                                      |
| [11](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-11) | SubtleCryptoProvider in synchronous context      | 3/2          | 2026-06-24               | Already fixed (constructEventAsync)       | Resolve in Sentry                                      |
| [10](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-10) | bcrypt migration: Laravel returned 404           | 1/1          | 2026-06-22               | Already fixed by #99                      | Resolve in Sentry                                      |
| [12](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-12) | Expired Stripe API key                           | 1/1          | 2026-06-25               | Transient ops (key rotated)               | Resolve in Sentry                                      |
| [W](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-W)   | effect_update_depth_exceeded on /member/profile  | 12/4         | 2026-06-25               | Partially fixed (#102); remnant ambiguous | Monitor (quiet 15 days)                                |
| [19](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-19) | `t.b.error` null on tickets/success              | 2/2          | 2026-06-27               | Ambiguous (Svelte async internals)        | Report-only, see hypothesis                            |
| [1E](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1E) | auth.sign_in: user_not_found                     | 1/1          | 2026-07-07               | Working as intended (anomaly telemetry)   | Optional: downgrade to warning                         |
| [1D](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1D) | Blocking Operation (AI-detected perf)            | 1/0          | 2026-07-05               | Perf observation                          | Report-only                                            |
| [1C](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1C) | Degraded UI Performance (AI-detected perf)       | 1/0          | 2026-07-02               | Perf observation                          | Report-only                                            |

## Active — needs an ops action

### 18 — Postmark rejects the `ticket-confirmation` template alias (ongoing, customer-facing)

Every ticket purchase since 2026-06-26 has failed to send the confirmation
email with the ticket codes (10 events, 5 buyers; latest 2026-07-10 02:06 UTC).
The `ticket.purchased` listener
([notification-listeners.ts:53](src/lib/server/notification/notification-listeners.ts:53))
sends via `dispatchEmailOnly` with alias `ticket-confirmation`; Postmark
returns `ApiInputError: The Template's 'Alias' … not valid or was not found`.

The repo's template is correct
([postmark/templates/ticket-confirmation/meta.json](postmark/templates/ticket-confirmation/meta.json)
has `"Alias": "ticket-confirmation"`), so the template is missing on the
Postmark **server** — the push never ran (or ran against a different server
token) after #96 consolidated templates. The generic `notification` alias
predates that consolidation, which is why other transactional mail still works.

**Fix:** `pnpm email:push` with the production `POSTMARK_SERVER_TOKEN`
(not present in local `.env` — I could not run it). Verify with a test
purchase or Postmark's template preview.

**Follow-up:** the 5 affected buyers never got their ticket codes (codes are
still visible on the success page and in the DB). Consider re-triggering their
confirmation emails once the template exists.

## Fixed in this branch

### Q + 1A — NotificationBell crash when the click-outside handler outlives the component

Two generations of the same bug ([NotificationBell.svelte:100](src/lib/components/shared/NotificationBell.svelte:100)):
the `svelte:window` click handler can be invoked by the very click that
unmounts the component (navigation), after Svelte has torn down its reactive
state. Q (release 9f74d7d) crashed writing `open = false`; #102's guard
`if (!open) return` then crashed _reading_ `open` (1A, release 0954375,
`runtime.js: var flags = signal.f` with `signal === undefined`).

**Fix:** first-line guard on the existing plain (non-reactive) `destroyed`
boolean, which `onDestroy` already sets — safe to read at any lifecycle point.
Component test added
([NotificationBell.svelte.spec.ts](src/lib/components/shared/NotificationBell.svelte.spec.ts)):
click-outside behavior plus an unmount-mid-click-dispatch case. Honest caveat:
the production teardown race does not reproduce in the vitest browser harness
(listener removal is synchronous there), so the new test guards behavior
rather than failing before the fix.

### D — server 500s re-captured client-side as an unreadable "x" issue

Remote-function 500s surface in `Form.svelte`'s catch as a bare
`{ status: 500, body: { message: 'Internal Error' } }` object;
`reportError` forwarded it to Sentry, producing an issue titled "x" (minified
frame name) with no stack — duplicating the server-side capture that already
has full request context. (The 2026-07-01 event is literally the client echo
of 1B's server 500, same user and second.)

**Fix:** [report-error.ts](src/lib/report-error.ts) now drops _any_
HTTP-shaped error (numeric `status` ≥ 400): 4xx are expected outcomes, 5xx are
already captured by the server `handleError` hook. Non-HTTP client errors
(TypeErrors, network failures) still report. Regression test in
[report-error.spec.ts](src/lib/report-error.spec.ts) (failed before the fix).

## Already fixed — resolve in Sentry

- **1B** — `ReservationValidationError` thrown as a 500 from
  `bookAndPayReservation`. The event (2026-07-01 17:56 UTC) predates #128
  (merged 19:55 UTC the same day), which returns validation errors in-band
  ([reservations.remote.ts:1136](src/lib/remote/reservations.remote.ts:1136)).
- **15** — negative `freeHours` reached `setBalance` because the invoice
  contribution-line picker could select a negative proration line. #130
  excludes prorations and the fee product. Last event 2026-06-28 < fix 07-01.
- **11** — Stripe's sync `constructEvent` is unusable on Workers; the webhook
  now uses `await constructEventAsync`
  ([webhook/+server.ts:25](src/routes/api/stripe/webhook/+server.ts:25)).
  Last event 2026-06-24.
- **10** — Laravel verify-password 404 caused by a trailing slash in
  `LARAVEL_URL`. Fixed by #99 (`buildVerifyPasswordUrl`,
  [auth.ts:155](src/lib/server/auth.ts:155)) — merged ~50 minutes _after_ the
  single event, none since.
- **12** — a live Stripe key had expired on 2026-06-25; later successful
  purchases (tickets on 06-27 and 07-10) show the key was rotated. One-off.

## Report-only

- **W** — `effect_update_depth_exceeded` on /member/profile. #102 fixed the
  main loop (effect re-clobbering editor state) but 3 events on Chrome Mobile
  iOS occurred on the release _containing_ that fix (4c8bdac). The attached
  replay shows those events co-occurring with the issue-D server 500s in the
  same session, suggesting the remnant rides the error path that #128/#130
  eliminated. No events in 15 days. Recommendation: leave unresolved and
  monitor; if it recurs, pull the replay for the interaction sequence
  (suspects: `RichTextEditor`/`FreeformTagInput` write-back under iOS
  autocorrect).
- **19** — `TypeError: null is not an object (t.b.error)` inside Svelte's
  `error-handling.js` on the public tickets/success page: an async rejection
  (the page top-level-awaits `getTicketPurchaseSuccess`) reached
  `invoke_error_boundary` with a null boundary. Framework-internal crash path,
  2 events on one day, iOS Safari. Recommendation: bump Svelte 5.56.x when a
  fix lands, and/or wrap the public layout in the same error-boundary used in
  the member layout so async query failures render a fallback instead of dying
  in internals.
- **1E** — intentional sign-in anomaly telemetry (`deriveSignInAnomaly`,
  [auth.ts:304](src/lib/server/auth.ts:304)). Working as designed; if the
  error-level noise bothers, capture at `warning` level.
- **1D / 1C** — Sentry AI-detected long-animation-frame warnings on `/` and
  `/contribute` during page load, 1 event each, 0 users impacted. Nothing
  actionable yet; revisit if they recur with real user impact.

## Recommended Sentry actions (not performed)

1. Resolve 1B, 15, 11, 10, 12 (fixed/transient; all quiet since their fixes).
2. Resolve Q, 1A, D when this branch deploys (or use `Fixes JAVASCRIPT-…` in
   the merge commit).
3. Keep W, 19 unresolved to catch regressions; they auto-escalate on new
   events.
4. After `pnpm email:push`, resolve 18 and consider re-sending the 5 lost
   ticket confirmations.
