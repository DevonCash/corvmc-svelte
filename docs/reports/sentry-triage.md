# Sentry Triage — 2026-07-27

All 9 unresolved issues in
[corvallis-music-collective/javascript-sveltekit](https://corvallis-music-collective.sentry.io/issues/?project=javascript-sveltekit&query=is%3Aunresolved)
collected via the Sentry MCP and traced to root cause. Supersedes the
2026-07-10 pass (see git history of this file); the delta against that
report's conclusions is called out per issue. Environment: production only.
Short IDs below link to Sentry; timestamps UTC.

## Summary

| Sentry issue                                                                      | Title                                           | Events/Users | Last seen                | Classification                              | Action                                  |
| --------------------------------------------------------------------------------- | ----------------------------------------------- | ------------ | ------------------------ | ------------------------------------------- | --------------------------------------- |
| [18](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-18) | Postmark: Template 'Alias' not valid            | 14/6         | **2026-07-26 (ongoing)** | **Active ops bug** (unchanged since 07-10)  | Push templates to Postmark (see below)  |
| [W](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-W)   | effect_update_depth_exceeded on /member/profile | 17/6         | **2026-07-24**           | **Live client crash** — 07-10 verdict wrong | Fix in code (see below)                 |
| [10](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-10) | bcrypt migration: Laravel rejected credentials  | 3/3          | 2026-07-25               | New branch, not the fixed 404               | Investigate affected members            |
| [1F](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1F) | `window.webkit.messageHandlers` undefined       | 3/1          | 2026-07-15               | Third-party (Instagram webview bridge)      | Filter in `beforeSend`                  |
| [1E](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1E) | auth.sign_in: user_not_found                    | 4/4          | 2026-07-26               | Working as intended (anomaly telemetry)     | **Resolved in Sentry**; downgrade level |
| [1B](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1B) | Cannot book more than 14 days in advance (500)  | 1/1          | 2026-07-01               | Fixed by #128, quiet since                  | **Resolved in Sentry**                  |
| [15](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-15) | Balance cannot be negative                      | 7/3          | 2026-06-28               | Fixed by #130, quiet since                  | **Resolved in Sentry**                  |
| [1D](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1D) | Blocking Operation (AI-detected perf)           | 1/0          | 2026-07-05               | Perf observation                            | Report-only                             |
| [1C](https://corvallis-music-collective.sentry.io/issues/JAVASCRIPT-SVELTEKIT-1C) | Degraded UI Performance (AI-detected perf)      | 1/0          | 2026-07-02               | Perf observation                            | Report-only                             |

## Active — needs action

### 18 — Postmark template aliases still missing on the production server (ongoing, customer-facing)

Unchanged root cause from 07-10, still firing 16 days later — and the blast
radius has grown. The 07-10 events were all ticket confirmations
(`ticket-confirmation` alias); the latest event (2026-07-26 20:02 UTC) is a
**reservation-cancellation notice** failing on the generic `notification`
alias, thrown from `cancelReservation` via `sendEmailWithTemplate` (extra data:
`tag: reservation_cancelled`, `templateAlias: notification`, recipient
`dylanneuhaus@icloud.com`). So it is not just the post-#96 templates: the
production Postmark server token in use appears to have **no matching
templates at all** (or the token points at the wrong Postmark server).

**Fix (operator):** run `pnpm email:push` against the production
`POSTMARK_SERVER_TOKEN`, then verify in Postmark's template preview that both
`notification` and `ticket-confirmation` aliases exist on the same server the
runtime token targets. If they already exist on _a_ server, compare the
server ID against the deployed token — the mismatch theory fits the
`notification` alias failing despite predating #96.

**Follow-up:** 6 affected users never received transactional mail (ticket
codes, a cancellation notice). Codes are recoverable from the success page/DB;
consider re-sending once templates resolve.

### W — effect_update_depth_exceeded on /member/profile is NOT gone (07-10 verdict falsified)

The 07-10 report left this as "monitor; quiet 15 days, remnant probably rode
the error path #128/#130 eliminated." That hypothesis is now falsified: 5 new
events (2026-07-21 → 07-24, latest on **release `5b1a882` — the current
deploy**, Edge/Windows, Corvallis user). Total now 17 events / 6 users, with 9
attached replays.

The infinite loop guard trips inside Svelte's batch processing
(`batch.js #process` recursion) with no first-party frame, so the trigger is
reactive write-back, not an event handler. The page
([+page.svelte](src/routes/member/profile/+page.svelte)) still has the
suspect shape despite #102's seed-once fix:

- `let profile = $derived(await getMemberProfile())` (line 24) plus a second
  top-level `await getMemberProfile()` for `initial` (line 34), plus a
  `refresh()` of the same query after avatar upload (line 61).
- `bind:value` editors (`RichTextEditor`, `FreeformTagInput`,
  `LinkListEditor`) writing into `$state` seeded from that data.

A `refresh()` re-resolving the async `$derived` while an editor writes back is
the remaining candidate cycle. **Recommended next step (code change, separate
branch):** pull the replays for the exact interaction sequence
([replay d38ffcc1](https://corvallis-music-collective.sentry.io/explore/replays/d38ffcc10a714a2ea18f0bedffde7c5c/)),
reproduce locally, and restructure so editor state never participates in the
async-derived graph (e.g. snapshot the profile into a plain object once and
render entirely from `$state`).

### 10 — bcrypt migration rejections: different branch than the "fixed" 07-10 issue

The 07-10 report resolved this as the trailing-slash 404 fixed by #99. The 3
new events (2026-06-22 → 07-25) are a **different code path**: the deliberate
`captureException` at [auth.ts:242](src/lib/server/auth.ts:242) — Laravel was
reached, answered 200, and said the credentials are **invalid**. That capture
exists precisely because this used to fail silently.

Two readings:

1. **Noise** — legacy-bcrypt members simply typing a wrong password; Laravel
   correctly rejects, and each attempt emits an error-level Sentry event.
2. **Real bug** — a known-good password rejected (hash drift between the
   Laravel DB export and what members actually use), which would mean these 3
   members cannot log in at all.

One event is `hannah@corvmc.org` — a staff address, easy to check directly.
**Recommended:** ask/verify whether Hannah eventually logged in (a successful
scrypt login after the event would prove reading 1). If it's reading 1,
downgrade this capture to `warning` level so real migration faults still
surface without error-level noise per typo.

### 1F — Instagram in-app webview bridge crash (not our code)

New since 07-10. `TypeError: undefined is not an object (evaluating
'window.webkit.messageHandlers')` on `/contact`, 3 events from 1 user,
`browser: Instagram 438.0.0` on iOS. The frames (`sendDataToNative`,
`sendPageHideMessage`) are Instagram's injected native-bridge script running
in its webview — attributed to `https://corvmc.org/:1` because injected
scripts inherit the document URL. Nothing in this repo references
`webkit.messageHandlers`.

**Recommended (code change, separate branch):** add an
`isWebviewBridgeError` guard alongside `isStaleChunkError` /
`isNetworkAbortError` in [hooks.client.ts](src/hooks.client.ts:35) — drop
events whose top frame function is `sendDataToNative`/`sendPageHideMessage` or
whose message references `window.webkit.messageHandlers` when we never define
them. Quiet since 07-15; low urgency.

## Resolved in Sentry during this pass

- **1B** — `ReservationValidationError` surfaced as a 500 from
  `bookAndPayReservation`. Single event 2026-07-01 17:56 UTC, two hours before
  #128 merged (validation errors now returned in-band,
  [reservations.remote.ts:1136](src/lib/remote/reservations.remote.ts:1136)).
  26 days quiet → resolved.
- **15** — negative `freeHours` reached `setBalance` because the invoice
  contribution-line picker could select a negative proration line; #130
  excludes prorations and the fee product. Last event 2026-06-28, 29 days
  quiet → resolved.
- **1E** — `auth.sign_in: user_not_found` is the intentional sign-in anomaly
  telemetry (`deriveSignInAnomaly`, [auth.ts:304](src/lib/server/auth.ts:304))
  doing exactly its job: the 4 events are people typing addresses that have no
  account (e.g. `kevin@thenettles.com`, `hasCredentialAccount: false`).
  Resolved as working-as-intended; Sentry will auto-reopen on regression-style
  volume. **Recommended (code change):** capture this anomaly at `warning`
  level instead of `error` so future occurrences don't page as faults.

## Report-only

- **1D / 1C** — Sentry AI-detected long-animation-frame observations on
  `/(public)` and `/contribute`, 1 event each, 0 users impacted, none in 3+
  weeks. Nothing actionable; revisit only if they recur with real user impact.

## Resolved-issue watchlist (from the 07-10 pass)

Q, 1A (NotificationBell teardown), D (HTTP-shaped client echo), 11
(constructEventAsync), 12 (rotated Stripe key) — all remain quiet; no
regressions observed in this pass.

## Recommended follow-ups (in priority order)

1. **Ops:** `pnpm email:push` with the prod `POSTMARK_SERVER_TOKEN`; verify
   both aliases; re-send lost mail (issue 18).
2. **Code:** fix the `/member/profile` reactive loop (issue W) — replays are
   attached and it reproduces on the current release.
3. **Check:** confirm whether the bcrypt-rejected members (issue 10, incl.
   `hannah@corvmc.org`) can log in; downgrade capture level if they can.
4. **Code (low):** filter Instagram webview bridge errors in `beforeSend`
   (issue 1F); downgrade `user_not_found` anomaly to warning (issue 1E).
