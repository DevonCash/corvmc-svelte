# Staff Panel — User Management Audit

**Date:** 2026-08-02
**Scope:** `/staff/users`, `/staff/users/[id]`, `src/lib/remote/users.remote.ts`, `src/lib/server/user/user-service.ts`
**Method:** Played a practice space manager through the user-management workflows against a
worktree-local dev server (seeded D1, dummy Stripe key), plus direct calls to the remote
endpoints to check what the UI doesn't reach.

Two defects here caused **silent data loss or privilege escalation** and are fixed in this
change. The rest are recorded as follow-ups.

---

## Fixed in this change

### 1. Unauthenticated privilege escalation and PII disclosure — _critical_

`getUser`, `getAllRoles`, `getUserPayments`, `getUserCredits` and `updateUser` had no
authorization check. Remote functions are directly addressable endpoints, and SvelteKit
dispatches them **before** any route or layout load runs (`respond.js` reaches
`handle_remote_call` with the page's load functions skipped). There is no `+layout.server.ts`
under `/staff`, so nothing else stood in front of them.

`updateUser` also took its target from `params.id`. For a remote call SvelteKit derives params
from the caller-supplied `x-sveltekit-pathname` header, so the target was fully attacker-chosen
— and since the handler rewrites `model_has_roles` wholesale, **any caller could grant
themselves `admin`**.

Reproduced live against the pre-fix code with no session at all:

```
GET /_app/remote/<hash>/getUser?payload=…
→ 200  {"id":…,"name":"…","email":"…","phone":…,"stripeId":…}

GET /_app/remote/<hash>/getUserPayments?payload=…
→ 200  [{"userEmail":"…","amountCents":…,"paymentMethod":…}, …]
```

**Fix:** `await requireStaff()` on all five; `updateUser` now takes a validated `id` field
(matching `deactivateUser`/`reactivateUser`/`purgeUser`) instead of trusting `params`.
Verified post-fix: all five return 401 anonymous, 403 for a signed-in non-staff member, and a
member posting `roles=["admin"]` at their own id is rejected.

Regression tests: `src/lib/remote/users.remote.spec.ts`.

**Rule this establishes:** a remote function is only as guarded as its own first line. Route
and layout guards do not protect it.

### 2. Every profile save silently deleted the user's roles — _critical_

`FormField` destructures `value` into its own prop, so it was not part of `...rest`, and the
`type="tags"` branch never forwarded it to `TagInput`. The Roles field therefore always
rendered empty and its hidden input always serialised `[]` — regardless of the user's actual
roles. Because `updateUser` replaces the whole role set, **correcting a phone number stripped
every role from that member**, including `staff` and `admin`.

Reproduced end to end: a member holding `member` had a phone edit saved through the real form
payload; afterwards `phone` was updated and their role count had gone 1 → 0.

**Fix:** forward `value` in the tags branch of `FormField.svelte`. Verified the field now
pre-fills (`member`, `staff` chips render) and a save preserves roles.
Regression tests in `FormField.svelte.spec.ts`. This was the only `type="tags"` call site, so
the blast radius was exactly this page — which is why it went unnoticed.

_Note:_ this is the second instance of this bug shape in this component — an existing test
covers "`field` + `value` both provided, value dropped". Worth a look at whether `FormField`
should forward `value` uniformly rather than per-branch.

### 3. Nothing prevented locking yourself (or everyone) out of the panel

Role editing let a staff member remove their own `staff`/`admin` role, and let the last `admin`
be demoted — unrecoverable from the UI in both cases.

**Fix:** `updateUser` refuses both, with specific messages. Verified live: self-demotion → 400
"You cannot remove your own staff access"; a staff user demoting the sole remaining admin → 409
"This is the last admin — assign another admin before removing this role."

### 4. "This is reversible" was false — _high_

The Danger Zone said deactivation "is reversible". It is not: `deactivateUser` cancels every
future personal reservation and the Stripe subscription, and `reactivateUser` only clears
`deletedAt`. Verified — a member with 3 confirmed future bookings had all 3 cancelled on
deactivation, and they were **still cancelled** after reactivation.

**Fix:** copy on the detail page, the confirm dialog, and the bulk dialog now state what is
permanent. Restoring the cancelled records is a product decision, left as a follow-up.

### 5. Malformed input returned 500 instead of a validation error

`roles` / `ids` used `.transform((s) => JSON.parse(s))`; a throw inside a zod transform escapes
validation as a 500. Posting `roles=notjson` crashed the endpoint.

**Fix:** new `jsonArrayField()` helper (`src/lib/utils/zod-json.ts`) reports a field issue
instead. Deliberately **no** `.catch([])` — silently coercing malformed roles to `[]` would
recreate defect #2. The same `JSON.parse`-in-transform pattern appears ~10 more times in
`directory.remote.ts` and twice in `band-page-editor.remote.ts`; those are untouched here and
should adopt the helper.

### 6. Over-deducting credits returned 500

`credit-service` correctly throws a typed `InsufficientCreditsError`, but `adjustCredits`
didn't catch it, so a staff member deducting more than the balance got a bare "Internal Error".

**Fix:** mapped to 409 with the real numbers — "Insufficient free_hours: requested 99999,
available 60" — plus a 400 for a non-numeric amount.

### 7. Impersonate was a dead link

The row menu linked to `/staff/users/[id]/impersonate`, which does not exist (verified 404).
Impersonation is explicitly deferred in `docs/specs/staff-bands-spec.md:206`.

**Fix:** menu item removed. **Still outstanding:** `src/content/help/staff-guide/` documents
impersonation as a working feature (`staff-impersonate.md`, referenced from
`staff-users-overview.md` and `staff-edit-user.md`), and `docs/manual/README.md:133` ticks it
off. That content should be removed or reworded — left alone here because deleting user-facing
help is your call.

---

## Guard sweep across all remote files

All 22 `src/lib/remote/*.remote.ts` were scanned for exports with no authorization call
anywhere in the body, then each hit was read.

**`users.remote.ts` was the only file with genuinely missing guards.** The other 28 unguarded
exports are intentionally public and were left alone:

| Group                                                                        | Why it's fine                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `getPublic*`, gig guide, public calendar, directory profiles, band microsite | Public pages; profile serialisers already scope to public fields                                       |
| `submitContactForm`, `submitBandContactForm`, `subscribeToAudience`          | Turnstile-verified                                                                                     |
| `getUnsubscribeInfo`                                                         | Signed-token verified                                                                                  |
| `getTicketPurchaseSuccess`                                                   | Guest checkout can't require login; `purchaseId` is a `randomUUID` capability token                    |
| `getMemberEvents`, `getMemberSlots`, `previewRecurringInstances`             | Names imply private data but return only public event fields / free-slot availability / pure date math |
| `getSocialLinks`, `getOrgAddress`                                            | Already pinned public by `settings.remote.spec.ts`                                                     |

The four whose names don't self-document now carry a comment saying why they're unguarded, so
the next sweep is cheap.

**Drive-by, outside this scope:** `getUnsubscribeInfo` performs the unsubscribe as a side
effect inside a `query` (a GET). Link-prefetching email clients and security scanners can
unsubscribe someone who never clicked. It should be a `form`/`command`.

---

## Behaviour verified as correct

- Search by partial name, partial email, and mixed case; 300 ms debounce; paging resets; "No
  users found" empty state; clearing restores the list.
- Status filter Active / Deactivated / All; deactivated rows show the badge and their
  checkboxes (and the header checkbox) are disabled.
- Pagination at 21 users across 2 pages.
- Row click navigates to the detail page; checkbox and row-menu clicks do not.
- Bulk deactivate: confirm dialog, **acting staff member correctly skipped** ("2 deactivated,
  1 skipped"), list refreshed, selection cleared.
- Deactivation clears sessions, soft-deletes, cancels future personal reservations.
- Purge refuses an active user (409) and a deactivated band owner (409) with clear messages;
  succeeds on a clean deactivated user.
- Field validation for empty/over-long name, pronouns, phone, and bad role ids.
- Email is read-only and cannot be changed by adding an `email` field to the POST.
- Credit adjustments: add, deduct, zero rejected, both credit types, description required.
- Access control at the page level: non-staff member → `/`, anonymous → `/login`.
- Long (190-char) and emoji/accented names don't break layout; mobile viewport scrolls the
  table inside its own container, not the page body.

---

## Follow-ups (not addressed)

1. **No audit trail.** Role grants, credit adjustments, deactivations and purges leave no
   record of who did them. For a panel where staff can grant `admin` and move credit balances,
   this is the highest-value gap now that the escalation hole is closed. Needs schema design.
2. **Email is uneditable.** A typo'd signup email cannot be corrected from the panel — the most
   common front-desk fix. Needs a staff email-change path with re-verification.
3. **Reactivation doesn't restore what deactivation destroyed.** Copy is now honest; whether to
   actually restore reservations/subscription is a product call.
4. **User detail lacks the manager's context** — no reservations, no bands, no
   subscription/membership state. Fielding "why was my booking cancelled?" means
   cross-referencing `/staff/reservations` by hand. There is no user → bands navigation at all
   (only band → members).
5. **Selection persists across pages invisibly.** Selecting all on page 1, then paging to
   page 2, leaves "20 selected" acting on rows you can't see. Consider scoping selection to the
   page or listing the affected names in the dialog.
6. **Dashboard "Permissions" stat is always 0.** It counts the `permissions` table, which the
   spatie-style schema declares but nothing reads or writes. Drop the stat, or drop the unused
   `permissions` / `model_has_permissions` / `role_has_permissions` tables.
7. **"Deleted" vs "Deactivated" terminology.** The detail page badge says _Deleted_ for a
   soft-deleted account while the list and body copy say _Deactivated_. A manager may think the
   record is gone.
8. **Payment Records card disappears when empty** — no empty state, so "no payments" and
   "failed to load" look identical.
9. **Detail page grid is half empty.** `lg:grid-cols-2` holds a single Account Info card, so
   the right column is blank on wide screens.
10. **No staff/admin e2e fixture.** Every Playwright fixture seeds a plain member, so no staff
    route has e2e coverage. Worth adding alongside these unit tests.
11. **`admin` and `staff` are interchangeable everywhere.** `requireStaff` accepts either and
    nothing distinguishes them, so the `admin` role currently conveys no additional authority.

---

## Notes on the test environment

- The shared dev server on `:5173` runs a **different worktree** and was 500ing throughout;
  this audit used a worktree-local server on `:5199`.
- The worktree's `.env` was a **symlink to the main repo's `.env`** — editing it in place would
  have changed the main setup. It was replaced with a local copy (`ORIGIN` → `:5199`, Stripe
  key → a dummy `sk_test`) and **the symlink is restored**; the main `.env` still has its
  original `ORIGIN` and live `rk_live` key.
- `better-auth` requires `ORIGIN` and does _not_ auto-detect it from the request, so a worktree
  server needs its own `ORIGIN`.
- Browser-console errors captured during the run include entries from the audit's own
  deliberate 401/403 probes and from mid-session HMR reloads. A cold-start server serves
  `/staff` and `/staff/users` as 200 and renders clean.
