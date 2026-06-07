# Reservation credits + cash-payment rework — progress checklist

Design: `~/.claude/plans/is-there-a-more-peaceful-acorn.md` (approved).
Branch: `feat/reservation-credits-cash` (off `fix/confirm-step-credit-breakdown`).

## Model recap

- Free-hour credits committed **once at Confirm**, ledger-tagged
  (`source:'reservation'`, `sourceId:reservationId`), reversible on cancel.
- Cash remainder (`total − appliedCredit`) settled online (Pay Ahead) or cash at
  door (staff). Member sees net cash due.
- `reservation.cashDueCents` (nullable): `null`=not committed; `0`=settled/comped;
  `>0`=cash owed. With `paidAt`: paidAt⇒paid; null&>0⇒cash owed; null&0⇒comped.

## Step 1 — Schema + ledger plumbing

- [x] Add `cashDueCents` (nullable int) to `reservation` schema
- [x] `hasTransaction(source, sourceId, creditType)` already exists — reuse
- [ ] (user generates drizzle migration)
- NOTE: dropped the `metadata` arg — cashDueCents column makes it unnecessary;
  cancel reads committed UNITS from the ledger sum.

## Step 2 — reservation-credit-service + finance

- [x] New `reservation-credit-service.ts`: `commitReservationCredits` (idempotent
      via cashDueCents) + `computeReservationCredit` pure pricing + `reverseReservationCredits`
- NOTE: dropped the `reverseCredits?` flag — new reservation payment records carry
  NO credits_breakdown, so the existing record-refund reverses nothing for them;
  cancel reverses via the ledger. Legacy records still reverse via their breakdown.
  No overlap, so calling both is safe.
- [ ] generalize `recordCashPayment` to accept a display label (for the $0 'Credits' record)

## Step 3 — Service layer

- [x] `recordCashAndComplete` accepts `scheduled`|`confirmed`, sets cashDueCents=0
- [x] `cancel()` reverses reservation credits (ledger) + refunds record if any
- [x] `autoCompleteExpired` completes comps/credit-settled (cashDueCents=0), excludes cash-owed

## Step 4 — Remotes (5 flows)

- [x] Confirm (bookAndPay skip, payFor skip, confirmReservation) → commit + settle/owe
- [x] Pay Ahead (paid branches, payReservation) → commit + checkout remainder (eligibleCredits:[])
- [x] cashReceivedReservation → commit + recordCashPayment(remainder) + complete
- [x] compReservation → set cashDueCents=0, no commit
- [x] cancelReservation/refundReservation → reverse once
- [x] set `cashDueCents` at each settle point (commit helper + checkout-listener)
- [x] broaden `getUnresolvedReservations`; net due in staff list DTO

## Step 5 — UI

- [x] `ReservationCard.svelte`: remove Pay-Ahead branch; Paid / $X due / Comped
- [x] `reservation-actions.ts`: cashReceived for confirmed & !paidAt & cashDueCents>0
- [x] staff list/detail + `ResolveModal`: net cash due
- [x] autofixer on changed Svelte files (clean)

## Verify

- [x] svelte-check clean (0 errors on touched files)
- [x] reservation-credit-service.spec.ts (new, pure pricing) — 5 pass
- [x] reservation-service + finance + utils specs — 249 pass; fixed 1 outdated assertion
- [ ] full suite green before commit

## MIGRATION (user action)

- [ ] **User must run `pnpm drizzle-kit generate`** for the new `cash_due_cents`
      column before this runs against a real D1 DB. (Per project convention I did
      not write the migration.)

## Open items / follow-ups

- [ ] Confirm-window/lead-time guard (anti-banking) — verify booking restricts Confirm to ~3 days
- [x] Staff Refund after completion: re-credits free hours (reverseReservationCredits added)
- [ ] Tests for commit idempotency / cancel-reversal with db mocks (pure math covered;
      mocked-db flow tests deferred)
