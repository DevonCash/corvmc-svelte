# Practice Room Reservations — Implementation Plan

Sequenced for a solo developer working through it PR by PR.

---

## Epic 1: Schema and configuration

Foundation — everything else depends on the tables and config existing.

### 1.1 Create reservation and closure Drizzle schemas

**Create** `src/lib/server/db/schema/reservation.ts`

Define two tables using Drizzle's `pgTable`:

**`reservation`:**
- `id` — uuid PK, `gen_random_uuid()` default
- `bookerType` — text, NOT NULL, maps to `booker_type`
- `bookerId` — text, NOT NULL, maps to `booker_id`
- `createdByUserId` — text, NOT NULL, FK → `user.id` with `onDelete: 'cascade'`
- `status` — text, NOT NULL, default `'scheduled'`
- `startsAt` — timestamp with timezone, NOT NULL
- `endsAt` — timestamp with timezone, NOT NULL
- `notes` — text, nullable
- `cancellationReason` — text, nullable, maps to `cancellation_reason`
- `stripePaymentRecordId` — text, nullable, maps to `stripe_payment_record_id`
- `lockAccessId` — text, nullable, maps to `lock_access_id`
- `createdAt` — timestamp with timezone, NOT NULL, defaultNow()
- `updatedAt` — timestamp with timezone, NOT NULL, defaultNow()

Indexes:
- `idx_reservation_conflict` on `(startsAt, endsAt)` — filtered where status != 'cancelled' (use `.where()` if Drizzle supports partial indexes, otherwise standard composite)
- `idx_reservation_user` on `(createdByUserId, status)`
- `idx_reservation_booker` on `(bookerType, bookerId)`

**`closure`:**
- `id` — uuid PK, `gen_random_uuid()` default
- `reason` — text, NOT NULL
- `startsAt` — timestamp with timezone, NOT NULL
- `endsAt` — timestamp with timezone, NOT NULL
- `createdAt` — timestamp with timezone, NOT NULL, defaultNow()

Indexes:
- `idx_closure_time` on `(startsAt, endsAt)`

Check constraints (`ends_at > starts_at`) added via raw SQL in the migration or a custom Drizzle check if supported.

**Modify** `src/lib/server/db/schema/index.ts` — add `export * from './reservation'`

**Test:** Run `pnpm drizzle-kit generate` to produce the migration. Verify it compiles and the SQL looks correct.

### 1.2 Create reservation configuration

**Create** `src/lib/server/reservation/config.ts`

Export constants:

```typescript
export const HOURLY_RATE_CENTS = 1500;
export const TIME_SLOT_MINUTES = 30;
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 8;
export const OPERATING_HOURS_START = '09:00';
export const OPERATING_HOURS_END = '22:00';
export const BUFFER_MINUTES = 0;
```

These are app-level constants, not database config. They can move to env vars or a settings table later if needed.

---

## Epic 2: Conflict detection and availability

Core logic that the booking flow depends on. No UI yet — just the query layer.

### 2.1 Create ConflictService

**Create** `src/lib/server/reservation/conflict-service.ts`

Functions:

**`hasConflict(startsAt: Date, endsAt: Date, excludeReservationId?: string): Promise<boolean>`**
- Queries `reservation` table for any row where:
  - `status != 'cancelled'`
  - `startsAt < endsAt + buffer` AND `endsAt + buffer > startsAt` (with buffer from config)
  - Optionally excludes a reservation ID (for edits)
- Also queries `closure` table for overlapping rows (no buffer)
- Returns true if any conflict found

**`getAvailableSlots(date: Date): Promise<TimeSlot[]>`**
- Generates all possible 30-min slots between operating hours for the given date
- Queries all non-cancelled reservations and closures for that day
- Marks each slot as available or unavailable
- Returns the slot list (used by the booking UI)

Type: `TimeSlot = { startTime: string; endTime: string; available: boolean }`

**`validateBooking(startsAt: Date, endsAt: Date): { valid: boolean; error?: string }`**
- Checks: within operating hours, on 30-min boundaries, duration within 1–8hr limits
- Synchronous validation (no DB hit — just time math)

**Test:** Unit tests for `validateBooking` (pure function). Integration tests for `hasConflict` and `getAvailableSlots` using the test factory to seed reservations and closures.

### 2.2 Add reservation Zod schemas for validation

**Modify** or create `src/lib/server/reservation/types.ts`

Zod schemas for:
- `createReservationSchema` — validates form input (date, startTime, endTime, notes)
- `bookerTypes` const array and type
- `reservationStatuses` const array and type

---

## Epic 3: Reservation service (create and cancel)

Business logic for the two member-initiated actions.

### 3.1 Create ReservationService — create

**Create** `src/lib/server/reservation/reservation-service.ts`

**`create(params): Promise<Reservation>`**
- Params: `{ userId, bookerType, bookerId, startsAt, endsAt, notes? }`
- Validates via `validateBooking()`
- Checks `hasConflict()`
- Inserts row with status `scheduled`
- Returns the created reservation

### 3.2 Create ReservationService — cancel

**`cancel(reservationId: string, userId: string, reason?: string): Promise<void>`**
- Loads reservation, verifies `createdByUserId === userId`
- If status is `scheduled`: set status to `cancelled`, store reason
- If status is `confirmed`: set status to `cancelled`, store reason, call `paymentService.refund()` using stored `stripePaymentRecordId`
- If already cancelled/completed/no_show: throw error

### 3.3 Write ReservationService tests

- Test: creating a reservation succeeds, returns correct fields
- Test: creating a conflicting reservation fails
- Test: creating a reservation outside operating hours fails
- Test: cancelling a scheduled reservation updates status, no refund triggered
- Test: cancelling a confirmed reservation updates status and calls refund
- Test: cancelling someone else's reservation fails

---

## Epic 4: Payment integration

Wire reservations into the existing checkout flow.

### 4.1 Create reservation checkout handler

**Create** `src/lib/server/reservation/checkout-listener.ts`

Register a listener via `onCheckoutComplete()` that:
- Checks session metadata for `reservation_id`
- If present, loads the reservation
- If status is `scheduled`, transitions to `confirmed`
- Stores the `stripePaymentRecordId` from the session

**Modify** somewhere in app startup (e.g., a `src/lib/server/reservation/index.ts` barrel that runs the registration) to call `onCheckoutComplete(handleReservationCheckout)`.

### 4.2 Create reservation payment page server

**Create** `src/routes/member/reservations/[id]/pay/+page.server.ts`

Load function:
- Fetch the reservation, verify ownership
- Calculate cost: `(duration in hours) × HOURLY_RATE_CENTS`
- Fetch user's `free_hours` balance

Form action `pay`:
- Build line item with `price_data` for the reservation cost
- Call `checkout()` with:
  - `eligibleCredits: [{ type: 'free_hours', unitValueCents: 1500 }]`
  - `metadata: { reservation_id: reservation.id }`
  - `successUrl` / `cancelUrl` pointing back to the reservations list
- If result is `{ paid: true }` (credits covered it): update reservation to confirmed, store payment record ID
- If result has `checkoutUrl`: redirect to Stripe

### 4.3 Write payment integration tests

- Test: checkout listener transitions scheduled → confirmed when metadata matches
- Test: checkout listener ignores sessions without reservation_id
- Test: full-credit payment confirms immediately without Stripe redirect
- Test: cancelling a confirmed reservation calls refund with correct payment record ID

---

## Epic 5: Member UI — booking flow

The pages members interact with to create and manage reservations.

### 5.1 Create booking page

**Create** `src/routes/member/reservations/new/+page.server.ts`
- Load: call `getAvailableSlots(date)` for the requested date (defaults to today)
- Action `book`: validate input, call `reservationService.create()`, redirect to reservations list

**Create** `src/routes/member/reservations/new/+page.svelte`
- Date picker (input type=date or a calendar component)
- Day view grid showing 30-min slots, colored by availability
- Start/end time selection (click start slot, click end slot)
- Duration shown inline, validation errors shown if invalid
- Notes textarea
- Submit button

### 5.2 Create reservations list page

**Create** `src/routes/member/reservations/+page.server.ts`
- Load: query user's reservations, ordered by `startsAt` desc
- Split into upcoming (startsAt > now, non-cancelled) and past

**Create** `src/routes/member/reservations/+page.svelte`
- Tabbed view: Upcoming / Past
- Each reservation card shows: date, time range, duration, status badge
- Actions: "Pay Now" link (if scheduled), "Cancel" button
- Cancel action calls the server, which calls `reservationService.cancel()`

### 5.3 Create payment page UI

**Create** `src/routes/member/reservations/[id]/pay/+page.svelte`
- Shows reservation details (date, time, duration)
- Cost breakdown: total, credits applied, amount due
- Cover fees checkbox
- Pay button

### 5.4 Add reservations to member nav

**Modify** `src/routes/member/+layout.svelte` — add "Reservations" nav link pointing to `/member/reservations`

---

## Epic 6: Staff UI — resolution queue and closures

### 6.1 Create resolution queue page

**Create** `src/routes/staff/reservations/resolve/+page.server.ts`

Load:
- Query reservations where `endsAt < now()` AND status IN (`scheduled`, `confirmed`)
- Order by `endsAt` desc (most recent first)

Actions:
- `markComplete`: set status to `completed`
- `markNoShow`: set status to `no_show`
- `recordCash`: call `paymentService.recordCashPayment()`, store payment record ID, set status to `confirmed` then `completed`

**Create** `src/routes/staff/reservations/resolve/+page.svelte`
- List of unresolved reservations
- Each shows: member name, date/time, current status (scheduled vs confirmed)
- Buttons per item: Complete, No-Show, Cash Received (only for scheduled)

### 6.2 Create closures management page

**Create** `src/routes/staff/closures/+page.server.ts`

Load: query all closures ordered by `startsAt` desc

Actions:
- `create`: insert new closure (validate no end < start)
- `delete`: remove a closure (only if `startsAt` > now)

**Create** `src/routes/staff/closures/+page.svelte`
- List of closures with reason, time range
- Create form: start datetime, end datetime, reason
- Delete button on future closures

### 6.3 Add staff nav items

**Modify** staff layout — add "Resolution Queue" and "Closures" nav links

---

## Epic 7: Lock integration

Side-effect layer. No reservation logic depends on this — it's additive.

### 7.1 Create Ultraloc API client

**Create** `src/lib/server/lock/ultraloc-client.ts`

Handles OAuth2 token management (client credentials or stored refresh token) and exposes:
- `createTemporaryUser(params: { name: string; startTime: Date; endTime: Date }): Promise<string>` — returns the temp user ID
- `removeTemporaryUser(tempUserId: string): Promise<void>`

Reads credentials from env vars: `ULTRALOC_CLIENT_ID`, `ULTRALOC_CLIENT_SECRET`, `ULTRALOC_DEVICE_ID`

### 7.2 Create LockService

**Create** `src/lib/server/lock/lock-service.ts`

**`provisionDailyAccess(): Promise<void>`**
- Query confirmed reservations for today without a `lockAccessId`
- For each, call `createTemporaryUser()` with the member's name and reservation time window
- Store returned ID as `lockAccessId`
- Log failures, continue to next reservation

**`cleanupPreviousDayAccess(): Promise<void>`**
- Query reservations from yesterday with non-null `lockAccessId`
- For each, call `removeTemporaryUser()`
- Clear `lockAccessId`
- Log failures, continue to next

**`runDailyLockJob(): Promise<void>`**
- Calls `cleanupPreviousDayAccess()` then `provisionDailyAccess()`

### 7.3 Create lock job API route

**Create** `src/routes/api/cron/lock-access/+server.ts`

A GET or POST endpoint protected by a secret (`CRON_SECRET` env var) that calls `runDailyLockJob()`. This is invoked by an external cron scheduler (e.g., cron-job.org, Railway cron, or a platform scheduler).

### 7.4 Write LockService tests

- Test: `provisionDailyAccess` calls Ultraloc for each confirmed reservation today
- Test: skips reservations that already have a `lockAccessId`
- Test: `cleanupPreviousDayAccess` calls remove for each reservation from yesterday with `lockAccessId`
- Test: failures in one reservation don't prevent processing others

Mock the Ultraloc client for these tests.

---

## Dependency graph

```
Epic 1 (schema + config)
  └─▶ Epic 2 (conflict detection)
        └─▶ Epic 3 (reservation service)
              ├─▶ Epic 4 (payment integration)
              │     └─▶ Epic 5 (member UI)
              └─▶ Epic 6 (staff UI)

Epic 1 ──▶ Epic 7 (lock integration) ── independent after schema exists
```

Epics 5 and 6 can be worked in parallel once Epic 4 is done (or even in parallel with Epic 4 if you stub the payment flow). Epic 7 is independent — it only needs the schema and can be built anytime after Epic 1.

---

## Smoke tests

**Full booking lifecycle:**
Create reservation → pay online (credits + Stripe) → verify status is confirmed → morning job provisions lock access → staff marks complete → lock access cleaned up next day.

**Cash payment lifecycle:**
Create reservation → don't pay → reservation end time passes → appears in staff resolution queue → staff marks cash received → verify Stripe payment record created → status is completed.

**Cancellation with refund:**
Create reservation → pay online → cancel → verify status is cancelled, credits restored, Stripe refund issued, slot is available again.

---

## Out of scope for this plan

- Recurring reservations (RRULE series, generation job)
- Band bookings (bands module doesn't exist yet)
- Events and lessons (future booker types)
- Notifications (email confirmations, reminders)
- Cancellation policy (time-based restrictions)
- Auto-complete (staff resolves manually for now)
- Multiple rooms (single room, config is app-level)
- Calendar sync
