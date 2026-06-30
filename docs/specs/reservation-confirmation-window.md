# Reservation confirmation window

## Problem

Members book the practice room as `scheduled` and confirm later. Confirmation had no time
limit, so reservations could sit `confirmed` far in advance — which (a) loads the single smart
lock's finite user table when door codes are provisioned, and (b) lets no-show-prone bookings hold
slots indefinitely. We want door codes to exist only when a reservation is `confirmed` **and** within
3 days of start, and we want unconfirmed slots to free up.

## Policy

- **Stripe prepayment is the only way to commit early.** A real Stripe charge (sets `paidAt`) — or a
  staff member — may confirm a reservation at any time.
- **Everything else (cash-at-door, free-hour credits) must be confirmed within
  `CONFIRMATION_WINDOW_DAYS = 3`** of the reservation start. Outside the window the member sees when
  confirmation opens and may pay to lock the slot in early.
- **Recurring** instances follow the same rules (no special-casing).
- **Unconfirmed by start → auto-cancelled** and the slot released (Phase 2).

The invariant: a reservation may become `confirmed` more than 3 days before start _only_ via a real
Stripe charge or staff action.

## Phases

1. **Confirmation window (this doc / first PR).** `CONFIRMATION_WINDOW_DAYS` + `withinConfirmationWindow`
   / `confirmWindowOpensAt` in `src/lib/config.ts`. Server gates in `src/lib/remote/reservations.remote.ts`
   on the non-Stripe confirm paths (`confirmReservation`, `payForReservation`/`bookAndPayReservation`
   skip branches, and credit-only pay settlements via `isFullyCreditCovered`); staff bypass; Stripe
   charges allowed anytime. Member card (`ReservationCard.svelte`) shows "Confirm from {date}" + a
   "Pay to reserve" option outside the window. `visibleActions` is staff-only and unchanged.
2. **Auto-cancel unconfirmed.** A cron sweeps `scheduled` reservations past their start and cancels
   them, mirroring the waitlist-expiry job.
3. **Door-code timing.** Mint the code on confirm (best-effort) and widen the daily lock provisioning
   window from "today" to "within 3 days"; the daily cron remains the backstop.

## Notes

- No schema changes — `status`, `paidAt`, `cashDueCents`, `creditsUsed`, `lockCode` already exist.
- The auto-cancel + lock crons need an external scheduler calling `/api/cron/*` daily (no Cloudflare
  `[triggers]` are configured).
