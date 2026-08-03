# Reactivation & Restore — Spec

## Purpose

Deactivation is destructive in ways reactivation does not undo, and the two
operations are presented as a matched pair.

`deactivateUser` (`src/lib/server/user/user-service.ts:52`) does four things:

1. sets `user.deletedAt`;
2. deletes every `session` row for the user;
3. **cancels every future personal reservation** (`bookerType = 'user'`, not yet
   started, not already cancelled) via `cancelReservation(..., { staffOverride: true })`;
4. **cancels the Stripe subscription** if `user.stripeId` is set (failures
   swallowed).

`reactivateUser` (line 134) does exactly one thing: clears `deletedAt`.

Verified during the audit: a member with three confirmed future bookings had all
three cancelled on deactivation and they were **still cancelled** after
reactivation. #162 made the UI copy honest about this ("reactivating will not
bring them back"), which stops the surprise but does not answer the product
question.

The question this spec exists to settle: **should reactivation restore what
deactivation destroyed, offer to, or stay destructive?**

## Why this is a real decision and not an obvious bug

Deactivation serves at least three different situations that look identical in
the data:

| Situation                              | Who initiates               | Should bookings come back?           |
| -------------------------------------- | --------------------------- | ------------------------------------ |
| Member is leaving the collective       | Member, or staff on request | No — they meant to give up the slots |
| Member is suspended for a while        | Staff                       | Probably not automatically           |
| **Deactivated by mistake**             | Staff (misclick, wrong row) | Yes, and urgently                    |
| Member left and came back months later | Staff                       | No — the dates are long past         |

Only the third case wants an automatic restore, and it is the rarest. Silently
re-creating months-old cancelled bookings for a returning member would be worse
than the current behaviour: it would re-book a practice room the member no
longer wants and that someone else may now be using.

That asymmetry is what rules out "just make reactivation symmetric."

## Recommendation

**Offer, don't automate.** Reactivation stays non-destructive by default, and
gains an explicit, previewed restore step for the cases that want it.

Concretely:

- `reactivateUser` continues to only clear `deletedAt`. Restoring is a separate,
  explicitly-chosen operation.
- The reactivate confirm dialog gains a **preview** of what could be restored:
  "3 cancelled reservations from this deactivation are still in the future.
  Review them?" — with a checkbox to open the restore step rather than a
  checkbox that restores blind.
- The restore step is a per-reservation list with a **conflict indicator** on
  each row and per-row checkboxes. Staff restore some, all, or none.
- The subscription is **never** re-created automatically. It is a payment
  instrument; re-charging someone's card as a side effect of an account status
  change is not acceptable under any framing. The dialog shows "Membership
  subscription was cancelled — the member must resubscribe" with a link to send
  them the membership page.

This keeps the destructive path honest, makes the misclick recoverable, and
never charges anybody by accident.

## What "restorable" means

A cancelled reservation is offered for restore only if **all** of:

- it was cancelled by this deactivation — requires knowing that, see Schema
  delta;
- `startsAt` is still in the future at the time of reactivation;
- its slot does not conflict with a currently-live reservation;
- the space/closure rules still permit it (an intervening closure blocks it).

Anything failing the last two is listed but **disabled**, with the reason shown
("conflicts with Riverside Practice, 2–4pm"). Showing them greyed out is better
than hiding them: staff need to know the slot is gone so they can tell the
member.

## Schema delta

Today there is no way to tell a deactivation-cancellation apart from a
member-initiated one. `cancelReservation` is called with the reason string
`'Account deactivated'`, and matching on that string is not a foundation to
build on.

Two options:

**(a) Link the cancellation to the deactivation.** Add to `reservation`:

```
cancelled_by_deactivation_at   integer timestamp null
```

set alongside the existing cancellation fields when `deactivateUser` cancels.
Restorable set = rows where this is non-null and equals the user's most recent
`deletedAt`. Cheap, no new table, and self-cleaning (a later member-initiated
cancel overwrites nothing because it does not set the column).

**(b) A `deactivation_event` table** recording each deactivation with its
cancelled reservation ids. More faithful across repeated
deactivate/reactivate cycles, but a whole table for one relationship.

Recommend (a). If the audit-log spec lands first, its `user.deactivated` entry
already carries a count, and the `details` payload could carry the ids —
but the audit log is explicitly best-effort and prunable, so it must not be load-bearing
for a functional restore. Keep the column.

> **Migration:** schema only. Generated by the maintainer with `pnpm db:generate`.
> Adding a nullable column to `reservation` is a D1 table rebuild — see
> `scripts/db/d1-safe-rebuild.mjs`.

## Service surface

`src/lib/server/user/user-service.ts`:

```ts
// query
listRestorableReservations(userId): Promise<RestorableReservation[]>
//   → { id, startsAt, endsAt, conflict: null | { reservationId, label }, blockedBy: null | 'closure' }
// mutation
restoreReservations(userId, reservationIds, actor): Promise<{ restored: string[], skipped: RestoreSkip[] }>
```

`restoreReservations` re-validates every conflict at write time — the preview is
advisory and the list may be minutes stale. Skips are returned rather than
thrown so a partial restore reports honestly, matching the `deactivated` /
`skipped` shape `deactivateUsers` already uses.

Restoring moves the reservation back to `scheduled`, **not** `confirmed`: the
member should re-confirm, and confirmation has its own window logic
(`docs/specs/reservation-confirmation-window.md`). It does not re-run payment.

## UI

On `/staff/users/[id]`, Danger Zone, deactivated state:

- The Reactivate `Action`'s form snippet gains the preview line and a "Review
  cancelled reservations" checkbox.
- When checked, `onsuccess` routes to a restore step rendered as a second
  `Action` modal listing the restorable rows with `FormField` checkboxes.
- Copy in the non-restorable case stays as #162 left it.

All standard components per CLAUDE.md — no raw inputs.

## Open questions

1. **How far into the future is worth restoring?** A member deactivated in error
   and reactivated four months later may have bookings that were future-dated at
   cancellation and still are. Restoring a booking the member has long since
   mentally written off is its own kind of surprise. Cap the offer at, say,
   deactivations within the last 30 days?
2. **Does restore notify the member?** Re-creating a booking without telling them
   is how someone no-shows. Probably a `reservation.confirmed`-style
   notification, but it is a restore, not a new booking — new template or reuse?
3. **Credits.** Cancelling a reservation may have refunded credits
   (`credit-service`). Restoring it should re-deduct them, but the member may no
   longer have the balance. Does a restore that would overdraw get blocked, or
   does it go through and leave a negative-ish state for staff to sort out?
   `InsufficientCreditsError` already exists and is mapped to a 409 in
   `adjustCredits` — the same treatment probably applies.
4. **Repeated cycles.** Deactivate → reactivate → deactivate. Option (a)'s single
   column handles this by being overwritten, but the semantics of "the most
   recent deactivation" need pinning down when `deletedAt` has already been
   cleared and re-set.
5. **Should band/event reservations be in scope?** `deactivateUser` deliberately
   only cancels `bookerType = 'user'`. That looks right, but it means a
   deactivated member who was the only active admin of a band leaves that band's
   bookings live with nobody able to manage them. Separate problem, worth
   confirming it is a separate problem.
6. **Is "suspension" a distinct status?** Several of the situations above are
   really suspensions, not departures. A first-class suspended state (no login,
   bookings preserved, no Stripe cancellation) might serve staff better than
   overloading deactivation — and would shrink this spec considerably.
