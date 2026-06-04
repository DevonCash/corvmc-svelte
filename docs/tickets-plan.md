# Tickets — Implementation Plan

Sequenced for a solo developer working through it PR by PR.

---

## Epic 1: Schema and service

Foundation layer. Everything else depends on the table and service existing.

### 1.1 Create ticket schema

Create `src/lib/server/db/schema/ticket.ts` with one table:

**`ticket`** — `id` (uuid, PK, defaultRandom), `eventId` (uuid, not null, FK → event on delete cascade), `purchaseId` (uuid, not null), `userId` (uuid, nullable, FK → user on delete set null), `attendeeName` (text, not null), `attendeeEmail` (text, not null), `code` (text, not null, unique), `status` (text, not null, default `'pending'`), `checkedInAt` (timestamp w/ tz, nullable), `checkedInByUserId` (uuid, nullable, FK → user on delete set null), `createdAt` (timestamp w/ tz, not null, defaultNow), `updatedAt` (timestamp w/ tz, not null, defaultNow).

Indexes: `(eventId)`, `(purchaseId)`, `(userId)`, `(eventId, status)`.

Follow the pattern in `event.ts` for column types and constraint style. Export the table from `src/lib/server/db/schema/index.ts`.

### 1.2 Add ticketing columns to event schema

Modify `src/lib/server/db/schema/event.ts` to add three columns:

- `ticketingEnabled` (boolean, not null, default false)
- `ticketPrice` (integer, nullable) — cents
- `ticketQuantity` (integer, nullable) — null means unlimited

### 1.3 Create ticket service

Create `src/lib/server/ticket/ticket-service.ts` with these functions:

- `generateCode()` — Generate a unique 8-character alphanumeric code. Use uppercase letters + digits, excluding ambiguous characters (0, O, I, L, 1). Retry on collision (check DB for uniqueness).

- `createTickets(options)` — Create N ticket rows in a single insert. Accepts `{ eventId, purchaseId, quantity, userId?, attendeeName, attendeeEmail, status? }`. Generates a unique code for each ticket. Default status is `'pending'`. Returns the created ticket rows.

- `fulfillPurchase(purchaseId)` — Transition all tickets with the given `purchaseId` from `pending` → `valid`. Used by the checkout listener on payment confirmation.

- `getTicketsByPurchase(purchaseId)` — Return all tickets with the given `purchaseId`, ordered by code.

- `cancelPurchase(purchaseId)` — Set all `valid` or `pending` tickets with the given `purchaseId` to `cancelled`.

- `checkIn(ticketId, staffUserId)` — Set a ticket's status to `checked_in`, record `checkedInAt` and `checkedInByUserId`. Throw if the ticket is not `valid`.

- `getEventTickets(eventId, options?)` — Return all tickets for an event, optionally filtered by status. Join user table for `checkedInByUserId` display name.

- `getTicketsSold(eventId)` — Count of tickets with status `valid` or `checked_in` for the event.

- `getTicketsRemaining(eventId)` — Fetch the event's `ticketQuantity`, subtract `getTicketsSold()`. Return null if quantity is unlimited.

- `getUserTickets(userId)` — Return tickets for a user, joined with event data, ordered by event `startsAt` descending. Used for "My Tickets" page.

**Tests** (`src/lib/server/ticket/ticket-service.spec.ts`):

- `generateCode` returns 8-char string, excludes ambiguous chars (0, O, I, L, 1).
- `createTickets` inserts N rows with unique codes, correct purchaseId and status.
- `fulfillPurchase` transitions pending → valid, no-ops on already-valid.
- `cancelPurchase` sets valid tickets to cancelled, leaves checked_in alone.
- `checkIn` sets status to checked_in with timestamp and staff user, rejects non-valid tickets.
- `getTicketsSold` counts valid + checked_in, excludes pending and cancelled.
- `getTicketsRemaining` returns null for unlimited, correct count for limited.

### 1.4 Register ticket checkout listener

Create `src/lib/server/ticket/checkout-listener.ts` following the pattern in `src/lib/server/reservation/checkout-listener.ts`:

- Export `registerTicketCheckoutListener()` that calls `onCheckoutComplete()`.
- The listener checks session metadata for `type === 'ticket'` and a `purchase_id` key.
- Calls `fulfillPurchase(purchaseId)` to transition pending → valid.
- Guard against double-fulfillment (if tickets are already `valid`, no-op).

Register this listener in the app's startup. Check where `registerReservationCheckoutListener()` is called and add the ticket listener alongside it.

**Tests** (add to `ticket-service.spec.ts` or a separate `checkout-listener.spec.ts`):

- Listener calls fulfillPurchase when session metadata has `type: 'ticket'` and `purchase_id`.
- Listener ignores sessions without ticket metadata.
- Listener is idempotent — calling twice doesn't error.

---

## Epic 2: Event form updates

Depends on: Epic 1. Adds ticketing fields to the staff event create/edit forms.

### 2.1 Update event service for ticketing fields

Modify `src/lib/server/event/event-service.ts`:

- Add `ticketingEnabled`, `ticketPrice`, `ticketQuantity` to the create and update functions.
- When `ticketingEnabled` is true, validate that `ticketPrice` is a positive integer.
- When `ticketingEnabled` is false, clear `ticketPrice` and `ticketQuantity` (set to null).

**Tests** (add to existing `event-service.spec.ts`):

- Create event with ticketing enabled — stores price and quantity.
- Create event with ticketing disabled — ticketPrice and ticketQuantity are null.
- Update event to enable ticketing — requires price.
- Update event to disable ticketing — clears price and quantity.

### 2.2 Update staff event create form

Modify `src/routes/staff/events/CreateEventModal.svelte` and its `data.remote.ts`:

- Add a "Ticketing" toggle (checkbox or switch).
- When enabled, show price input (dollars, converted to cents on submit) and optional quantity input.
- Update the create remote handler schema to accept `ticketingEnabled`, `ticketPrice`, `ticketQuantity`.

### 2.3 Update staff event detail/edit form

Modify `src/routes/staff/events/[id]/+page.svelte` and its `data.remote.ts`:

- Add the same ticketing fields to the edit form.
- Update the `updateEvent` remote handler schema.
- Show current ticketing config in the detail view (price, quantity, tickets sold count).

---

## Epic 3: Public purchase page

Depends on: Epic 1, Epic 2. The public-facing ticket purchase flow.

### 3.1 Create ticket purchase page

Create `src/routes/events/[id]/tickets/+page.server.ts` and `+page.svelte`:

**Load function:**

- Fetch the event by ID. Throw 404 if not found, 400 if ticketing not enabled.
- Get tickets remaining via `getTicketsRemaining()`.
- If the user is logged in, check sustaining member status via `getSubscription()` from the subscription service. Calculate discounted price (50% off) if sustaining.
- Return event info, price, discounted price (if applicable), remaining count, and whether the user is a sustaining member.

**Page UI:**

- Event name, date, venue info at the top.
- Price display: base price, and discounted price with "Sustaining member discount" label if applicable.
- Quantity selector (1–10, capped by remaining capacity). If sold out, show "Sold Out" message and disable the form.
- "Cover processing fees" checkbox.
- **Guest fields** (visible when not logged in): name and email inputs.
- Order summary: quantity × unit price, discount, fee coverage, total.
- "Get Tickets" button.
- Note about login: "Log in for sustaining member pricing" if not authenticated.

### 3.2 Create ticket checkout handler

Create `src/routes/events/[id]/tickets/data.remote.ts` with a `purchaseTickets` form handler:

**Schema:** `{ quantity: number (1–10), coverFees: boolean, attendeeName?: string, attendeeEmail?: string }`

**Handler logic:**

1. Fetch the event, validate ticketing is enabled.
2. Check capacity — if limited, verify `quantity ≤ remaining`.
3. Generate a `purchaseId` UUID (`crypto.randomUUID()`).
4. Determine the unit price: if authenticated user has an active subscription, apply 50% discount. Otherwise use `event.ticketPrice`.
5. Resolve attendee info: if logged in, use `locals.user.name` and `locals.user.email`. If guest, use form fields (required).
6. Build a Stripe line item with `price_data` (product from `getStripeProductId('ticket')` — add `ticket` to product_config, unit_amount = unit price, quantity).
7. Call `paymentService.checkout()` with metadata `{ type: 'ticket', purchase_id: purchaseId, event_id: eventId, ticket_quantity: String(quantity) }`.
8. If `result.paid` (free via discount — unlikely for tickets but possible): create tickets with status `valid` immediately. Redirect to success page.
9. If not paid: create tickets with status `pending`. Return `checkoutUrl` for redirect.

**Note:** This handler needs to support both authenticated and guest callers. For guests, skip `userId`, `stripeCustomerId`, and credit application.

**Tests** (`src/routes/events/[id]/tickets/tickets.spec.ts`):

- Purchase handler creates pending tickets with correct purchaseId and attendee info.
- Purchase handler rejects when ticketing not enabled on event.
- Purchase handler rejects when quantity exceeds remaining capacity.
- Purchase handler applies 50% sustaining member discount to unit price.
- Guest purchase creates tickets with null userId, attendee info from form fields.
- Checkout listener fulfills purchase — pending → valid on webhook.

### 3.3 Create checkout success/cancel pages

**Success page** at `src/routes/events/[id]/tickets/success/+page.server.ts` and `+page.svelte`:

- Accept `purchaseId` as a query parameter.
- Load tickets by `purchaseId`. Show event name, ticket codes, attendee info.
- If no valid tickets found (pending still), show a "Payment processing" message.

**Cancel handling:**

- The cancel URL passed to Stripe points back to the purchase page.
- Pending tickets from the abandoned checkout remain in the database (stale cleanup is deferred).

### 3.4 Add ticket product config

Insert a `ticket` row into the `product_config` table (via seed script or migration). This row provides the Stripe product ID for ticket line items. The `unitAmountCents` on this config row is not used (price comes from the event), but the Stripe product ID is needed for `price_data.product`.

---

## Epic 4: Staff ticket management

Depends on: Epic 1, Epic 3. Staff views for ticket purchases and check-in.

### 4.1 Add ticket purchases to event detail page

Modify `src/routes/staff/events/[id]/+page.server.ts` and `+page.svelte`:

**Data loading:**

- Query tickets for the event, grouped by `purchaseId`. For each group, return: `purchaseId`, `attendeeName`, `attendeeEmail`, `quantity` (count), ticket statuses, `userId`, `createdAt`.
- Include summary stats: total sold, total checked in, remaining.

**UI additions:**

- Stats row: "X sold · Y checked in · Z remaining" (or "unlimited").
- Ticket purchases section: list of purchases grouped by `purchaseId`. Each card shows attendee name/email, quantity, status badges for each ticket, and created date.
- "Refund" button on each purchase group (only for groups with valid/checked_in tickets).

### 4.2 Create refund handler

Add a `refundPurchase` form handler to `src/routes/staff/events/[id]/data.remote.ts`:

**Schema:** `{ purchaseId: string }`

**Handler logic:**

1. Require staff auth.
2. Load tickets by `purchaseId`. Verify they exist and belong to this event.
3. Find the Stripe checkout session for this purchase. Search Stripe sessions by metadata `purchase_id`. Get the payment intent or payment record from the session.
4. Call `paymentService.refund()` with the payment record ID and the ticket holder's userId (for credit reversal).
5. Call `ticketService.cancelPurchase(purchaseId)`.

**Implementation note:** Finding the Stripe session by metadata requires `stripe.checkout.sessions.list()` with a metadata filter, or storing the Stripe session ID on the tickets. Consider adding a `stripeSessionId` column to the ticket table if Stripe metadata search proves unreliable. Evaluate during implementation.

**Tests** (add to refund handler or `check-in.spec.ts`):

- Refund handler cancels all tickets in purchase group.
- Refund handler rejects when purchaseId doesn't belong to event.

### 4.3 Create check-in page

Create `src/routes/staff/events/[id]/check-in/+page.server.ts` and `+page.svelte`:

**Load function:**

- Fetch event by ID.
- Fetch all tickets with status `valid` or `checked_in`, joined with user for checked-in-by name.

**Page UI:**

- Event name and date at top.
- Stats: "X of Y checked in."
- Search/filter input (filters by code or attendee name, client-side).
- Ticket list: each row shows code, attendee name, status. Valid tickets have a "Check In" button.
- Checked-in tickets show a checkmark with timestamp and who checked them in.

### 4.4 Create check-in handler

Add a `checkInTicket` form handler (in check-in page's `data.remote.ts` or the event detail's):

**Schema:** `{ ticketId: string }`

**Handler logic:**

1. Require staff auth.
2. Call `ticketService.checkIn(ticketId, locals.user.id)`.

**Tests** (`src/routes/staff/events/[id]/check-in/check-in.spec.ts`):

- Check-in handler transitions valid ticket to checked_in with staff user and timestamp.
- Check-in handler rejects non-valid ticket (pending, cancelled, already checked_in).
- Check-in page load returns tickets for the event with correct statuses.

---

## Epic 5: Member "My Tickets" page

Depends on: Epic 1. The member-facing ticket history.

### 5.1 Create My Tickets page

Create `src/routes/member/tickets/+page.server.ts` and `+page.svelte`:

**Load function:**

- Require auth.
- Call `ticketService.getUserTickets(userId)`. Join with event table for event name, date, status.
- Split into upcoming (event `startsAt` > now) and past.

**Page UI:**

- TabBar with "Upcoming" and "Past" tabs.
- Group tickets by event. Each event group shows: event name, date, and a list of ticket codes with status badges.
- EmptyState when no tickets.

**Tests** (`src/routes/member/tickets/tickets.spec.ts`):

- Page load returns user's tickets joined with event info.
- Page load excludes other users' tickets.
- Tickets are split into upcoming vs past by event startsAt.

### 5.2 Add My Tickets to member nav

Modify `src/routes/member/+layout.svelte`:

- Add `IconTicket` import from `@tabler/icons-svelte`.
- Add nav item: `{ href: '/member/tickets', label: 'My Tickets', icon: IconTicket }`.
- Place between Reservations and My Bands.

---

## Epic 6: Public event page integration

Depends on: Epic 3. Add ticket info to the public events listing.

### 6.1 Update public events listing

Modify `src/routes/events/+page.server.ts` and `+page.svelte`:

- Include `ticketingEnabled` and `ticketPrice` in the event query.
- On each event card, if ticketing is enabled, show the price and a "Get Tickets" link to `/events/[id]/tickets`.
- If sold out, show "Sold Out" instead of the link.

### 6.2 Link from event detail to tickets

If there's an event detail page for the public, add a prominent "Get Tickets" CTA linking to the purchase page. If the public events page is currently just a listing grid, this task is a no-op — the purchase page at `/events/[id]/tickets` serves as the detail + purchase page.

---

## Epic 7: Email template stubs

Depends on: none (independent).

### 7.1 Create email template stubs

Create `src/lib/server/ticket/email-templates.ts` with three stub functions:

- `purchaseConfirmationTemplate(data)` — Returns `{ subject, body }` placeholder for purchase confirmation. Accepts event name, date, ticket codes.
- `refundNoticeTemplate(data)` — Returns `{ subject, body }` placeholder for refund notice.
- `eventCancelledTemplate(data)` — Returns `{ subject, body }` placeholder for event cancellation.

Each function returns a structured object with subject line and HTML body placeholder. These are not wired to any email sending — they define the shape of what will be sent when email infrastructure is added.

---

## Dependency graph

```
Epic 1 (schema + service)
  ├─▶ Epic 2 (event form updates)
  │     └─▶ Epic 3 (public purchase page)
  │           ├─▶ Epic 4 (staff ticket mgmt + check-in)
  │           └─▶ Epic 6 (public event page integration)
  └─▶ Epic 5 (member My Tickets)

Epic 7 (email stubs) ── independent
```

---

## Smoke tests

1. **Full purchase lifecycle:** Staff creates event with ticketing enabled ($10, 50 capacity) → visitor loads purchase page, sees price and availability → selects 2 tickets, completes Stripe checkout → webhook fires, tickets become valid → visitor sees ticket codes on success page → staff views event, sees 2 tickets sold → staff checks in one ticket → stats show "1 of 2 checked in."

2. **Guest + sustaining member:** Guest buys 1 ticket at full price → sustaining member buys 1 ticket at 50% off → both show up in the staff view → staff refunds the guest purchase → guest's ticket is cancelled, sustaining member's is unaffected.

---

## Out of scope for this plan

- Door sales (staff selling in person via cash/card/comp)
- Partial refunds (individual tickets within a purchase)
- Email delivery (templates are stubbed, not sent)
- Stale pending ticket cleanup (abandoned checkouts)
- Ticket transfer (changing attendee)
- QR codes for check-in
- Event cancellation cascade (auto-refund all tickets)
- External ticket URL field on events
