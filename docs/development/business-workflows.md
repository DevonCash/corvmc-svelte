# Business Workflows, Traced Through Code

This guide walks through the eight core workflows of the app in plain language, with the
actual code path for each. Read the [architecture overview](../architecture/overview.md)
first — it explains the building blocks these workflows are made of (remote functions,
guards, the event bus, `db.batch`, site config).

Each section follows the same shape: **the story** (what happens, in plain English), **the
code path** (file → function for every step), **data touched**, and **where it breaks**
(what to check when this workflow misbehaves). The matching design spec in `docs/specs/` is
linked as the statement of intent — when code and spec disagree, treat the spec as intent
and reconcile deliberately.

---

## 1. Reservation booking, confirmation, and payment

Spec: [specs/reservation-system-spec.md](../specs/reservation-system-spec.md) ·
[specs/reservation-confirmation-window.md](../specs/reservation-confirmation-window.md)

### The story

A member books a practice-room slot. Booking alone doesn't commit them — the reservation
sits in `scheduled` status until they **confirm** it (which spends any free-hour credits
and leaves cash due at the door) or **pay online** via Stripe. Members can only confirm
within the **confirmation window — 3 days before the start time** — but paying with a real
Stripe charge commits it any time. Anything still `scheduled` when its start time arrives
was never committed, so a cron job cancels it and frees the slot.

### Code path

**Booking.** The wizard on `/member/reservations` submits the `bookAndPayReservation` form
in `src/lib/remote/reservations.remote.ts`, which calls `create()` in
`src/lib/server/reservation/reservation-service.ts`. `create()`:

1. Validates the time range against operating hours and advance-booking limits —
   `validateBooking()` in `conflict-service.ts`, driven by KV site config
   (`reservation.operatingHoursStart`, `reservation.maxAdvanceDaysOneoff`, ...).
2. Checks for overlapping reservations, inserts the row with `status: 'scheduled'`, then
   **re-checks** for a race and deletes its own row if another booking landed concurrently
   (D1 has no transactions — this compensating-delete pattern is commented in the source at
   `reservation-service.ts:110`).

**Confirm (no online payment).** Submitting with `skipPayment` on: the remote checks
`withinConfirmationWindow(startsAt)` from `src/lib/config.ts`
(`CONFIRMATION_WINDOW_DAYS = 3`), then calls `commitCreditsAndSettleIfCovered()` (a helper
inside `reservations.remote.ts`). That commits free-hour credits via
`commitReservationCredits()` in `reservation-credit-service.ts`; if credits fully cover the
price, the reservation is settled and confirmed with `cashDueCents: 0`; otherwise it's
confirmed with the cash remainder recorded in `cashDueCents` for staff to collect at the
door.

**Pay online.** The remote commits credits the same way, then creates a Stripe Checkout
Session via `checkout()` in `src/lib/server/finance/payment-service.ts` with
`metadata: { reservation_id: res.id }`, and redirects the member to Stripe. Payment
completion comes back asynchronously:

```
Stripe → POST /api/stripe/webhook            src/routes/api/stripe/webhook/+server.ts
       → handleCheckoutCompleted()           src/lib/server/finance/webhook-handlers.ts
       → domainEvents.emit('checkout.completed', ...)
       → handleReservationCheckout(session)  src/lib/server/reservation/checkout-listener.ts
       → reservation status → 'confirmed', paidAt set, cashDueCents 0
```

The listener is idempotent (only transitions `scheduled`/`confirmed` rows), and the webhook
route returns 500 on handler failure so Stripe re-delivers.

**The other half of the lifecycle — cron.** Four endpoints under `src/routes/api/cron/`
(all `POST` with `Authorization: Bearer <CRON_SECRET>`, invoked by the Worker's own
`scheduled` handler on native Cloudflare cron triggers — see the operations manual):

- `cancel-unconfirmed` → `cancelUnconfirmedReservations()` in `reservation-service.ts` —
  cancels every reservation still `scheduled` at its start time.
- `auto-complete` → `autoCompleteExpired()` — marks confirmed, fully-paid reservations
  past their end time as `completed` (cash-owed ones are left for staff).
- `confirmation-reminders` / `reservation-reminders` — emit reminder events for
  reservations starting within 24 hours (notification listeners send the emails).

**Cancellation.** `cancel()` in `reservation-service.ts`: authorization (owner or staff
override), atomic conditional status update, Stripe refund if a payment record exists
(`refund()` in `payment-service.ts`), credit reversal
(`reverseReservationCredits()`), and finally emits `reservation.cancelled` — which the
waitlist listener uses to promote the next person (workflow 2).

**Staff resolution.** Unresolved reservations (past end, still `scheduled` or cash owed)
surface via `getUnresolvedReservations` in `reservations.remote.ts`; staff resolve with the
`completeReservation` / `noShowReservation` / `cashReceivedReservation` /
`compReservation` / `refundReservation` forms in the same file.

### Data touched

`reservation` table (status machine: `scheduled → confirmed → completed`, or `cancelled` /
`no_show` / `waitlisted`), `creditTransaction` ledger (free-hour commits and reversals),
`paymentCache`, plus Stripe objects (Checkout Session, PaymentIntent, Refund).

### Where it breaks

- **Member paid but reservation still `scheduled`** → the webhook didn't arrive or the
  listener failed. Check Stripe dashboard → webhook delivery attempts, and Sentry for
  `stage: 'handler'` captures from the webhook route.
- **"Time slot is not available" that looks wrong** → check the `waitlisted`/`cancelled`
  exclusions in the conflict query, and whether a `bookerType: 'event'` reservation
  (created by an event) is holding the slot.
- **Confirm button rejected with the window message** → expected outside 3 days before
  start; only a Stripe charge (or staff) commits earlier.
- **Double-deducted credits** → shouldn't happen: `commitReservationCredits` is idempotent
  (keyed on the reservation). If suspected, read the `creditTransaction` ledger for the
  reservation id.

---

## 2. Recurring reservations and the waitlist

Spec: [specs/recurring-reservations-spec.md](../specs/recurring-reservations-spec.md)

### The story

Sustaining members can make a booking repeat (weekly, biweekly, monthly). The first
occurrence is a normal reservation that acts as the **prototype**; a nightly job clones it
forward into concrete rows. If an occurrence collides with an existing booking, it's
created as **waitlisted** instead; when the blocking reservation cancels, the waitlisted
one is offered the slot with a 24-hour window to confirm.

### Code path

- **Creating a series:** the booking forms in `reservations.remote.ts` (member and band
  variants) require a sustaining membership (a live `user.subscription`), then call
  `create()` in `src/lib/server/reservation/recurring-series-service.ts` with the prototype
  reservation id and an RRULE built by `buildRRule()` in `rrule-helpers.ts`. If the first
  slot itself conflicts, the booking is created via `createWaitlisted()` instead of failing.
- **Daily generation:** cron `generate-recurring-reservations` → `generateRecurring()` in
  `src/lib/server/reservation/generation-job.ts`. Events are expanded **before**
  reservations (recurring events book their own space reservations, which the reservation
  pass must treat as hard blocks — see the doc comment in that file). Occurrences that
  can't be booked emit `reservation.recurring_skipped` / `reservation.recurring_waitlisted`
  events so the member hears about it. The generation window is ~2.5 weeks
  (`reservation.maxAdvanceDaysRecurring` config, default 17.5).
- **Waitlist promotion:** `cancel()` emits `reservation.cancelled`; the listener in
  `src/lib/server/events/register-listeners.ts` calls `promoteNextWaitlisted()` in
  `waitlist-service.ts` — oldest overlapping waitlisted reservation wins, gets
  `waitlistNotifiedAt`/`waitlistExpiresAt` set, and a `waitlist_slot_available`
  notification with a confirm link.
- **Member confirms the offered slot:** `confirmWaitlisted` form in
  `reservations.remote.ts` — checks the offer hasn't expired, re-checks the slot is free,
  flips to `scheduled`, then re-checks again and backs out if a competing booking raced in.
- **Expiry:** cron `expire-waitlisted` → `expireWaitlisted()` in `waitlist-service.ts` —
  cancels offers past their 24h window and promotes the next in line.

### Data touched

`recurringSeries` (RRULE, prototype pointer, `supersededBy` chain), `reservation` rows
(status `waitlisted`, `waitlistNotifiedAt`, `waitlistExpiresAt`).

### Where it breaks

- **No new occurrences appearing** → the daily cron isn't firing. Hit the endpoint
  manually (see the [operations manual](../architecture/operations-manual.md#5-cron)) and
  check its JSON result — it reports per-series errors without aborting the batch.
- **Series stopped after subscription cancelled** → intentional:
  `handleSubscriptionDeleted` in `finance/webhook-handlers.ts` calls `cancelAllForUser()`.
- **Waitlisted member never notified** → check that the cancellation actually went through
  `cancel()` (a raw status update in the DB bypasses the event emit).

---

## 3. Membership: signup, subscription, monthly credits

Spec: [specs/membership-page-spec.md](../specs/membership-page-spec.md) ·
[specs/finance-spec.md](../specs/finance-spec.md)

### The story

Membership is free. A **sustaining membership** is a monthly Stripe subscription at a
member-chosen amount in $5 units. Each $5/month grants 1 free practice-room hour
(= 2 credits, since credits are 30-minute blocks) per billing cycle, plus
equipment-loan credit at $1 = $1. Credits arrive when Stripe collects each invoice, not
when the member signs up.

### Code path

1. **Signup:** `/membership` (public) or `/member/membership` → `createSubscription` form
   in `src/lib/remote/membership.remote.ts`. It guards against a duplicate live
   subscription, creates a Stripe customer on demand (`ensureStripeCustomer()` in
   `finance/stripe-customer-service.ts`), and redirects to Stripe Checkout built by
   `createCheckoutSession()` in `finance/subscription-service.ts` (`quantity` = dollars/5).
2. **Money arrives:** Stripe fires `invoice.paid` → `handleInvoicePaid()` in
   `finance/webhook-handlers.ts`:
   - finds the member by Stripe customer id;
   - finds the **contribution line** on the invoice (`findContributionLine()` — carefully
     excludes the fee-coverage line and prorations; read its doc comment before touching);
   - allocates credits via `allocateCreditsFromInvoice()` → `credit-service.ts`
     `allocateMonthlyCredits()` (free hours) and `allocateEquipmentCredits()` — **idempotent
     by invoice id**, so webhook re-delivery can't double-grant;
   - snapshots the subscription state onto the `user.subscription` JSON column
     (`hoursPerReset`, `creditsResetAt`, `coveringFees`, `cancelAtPeriodEnd`).
3. **Changes:** `updateAmount` / `resumeSubscription` forms in `membership.remote.ts` call
   `updateQuantity()` / `resume()` in `subscription-service.ts` and write-through to
   `user.subscription` so the page updates before the webhook lands. Cancel goes through
   the Stripe **billing portal** (`createBillingPortalUrl()`).
4. **Cancellation lands:** `customer.subscription.deleted` → `handleSubscriptionDeleted()`
   — zeroes both credit balances, cancels the member's recurring series, and clears
   `user.subscription`.

Note: "is this member sustaining?" is answered by `user.subscription != null` (see
`isSustainingMember` in `subscription-service.ts`), not by the `sustaining` role.

### Data touched

`user.stripeId`, `user.subscription` (JSON snapshot), `creditTransaction` ledger, Stripe
Subscription/Invoice objects.

### Where it breaks

- **Member paid but has no credits** → check Stripe webhook deliveries for `invoice.paid`,
  then the `creditTransaction` ledger for a `monthly_allocation` row with the invoice id.
  Staff can reconcile via the subscription sync (`finance/subscription-sync-service.ts`),
  which reuses `allocateCreditsFromInvoice` so both paths compute identically.
- **Credits doubled** → shouldn't be possible (idempotency by invoice id); if seen, look
  for two different invoice ids.
- **Wrong credit amount when member covers fees** → the fee line was mistaken for the
  contribution line; that's exactly what `findContributionLine()` guards against.

---

## 4. Bands: creation, invitations, premium pages

Spec: [specs/bands-spec.md](../specs/bands-spec.md) ·
[specs/staff-bands-spec.md](../specs/staff-bands-spec.md)

### The story

Any member can create a band and invite others. Invitees who already have accounts get an
in-app invitation; people without accounts get a **platform invite** by email, which is
automatically resolved into a band membership the first time they log in after signing up.
Bands have their own role ladder (`owner > admin > member`) and can optionally buy a
premium subscription that unlocks a public band microsite.

### Code path

- **Create:** `member/bands` UI → `bands.remote.ts` / `band-page-editor` remotes →
  `create()` in `src/lib/server/band/band-service.ts` — a `db.batch` inserts the `band` row
  and the owner's `bandMember` row atomically; the slug is uniquified by
  `ensureUniqueSlug()`.
- **Invite:** `invite()` in `band-service.ts`. Existing users get a pending `bandMember`
  row + a `band.invitation_sent` event (email/in-app notification). Unknown emails go
  through `createInvite()` in `platform-invite-service.ts` (a `platformInvite` row with a
  token) and a `platform_invite.created` event that emails a signup link.
- **Invite resolution at login:** `src/hooks.server.ts` calls
  `resolvePendingInvites(userId, email)` once per session (tracked in the in-memory
  `resolvedSessions` set) — any `platformInvite` rows matching the user's email become real
  band memberships. This is why "invite someone with no account" just works after they
  register.
- **Accept/decline:** `acceptInvitation()` / `declineInvitation()` in `band-service.ts`
  (accept emits `band.invitation_accepted`, which notifies band admins).
- **Roles/ownership:** `transferOwnership()` (another `db.batch` — demote old owner,
  promote new), `leaveBand()` (owners must transfer first — `OwnerCannotLeaveError`).
- **Premium:** `band-subscription.remote.ts` → `createBandPremiumCheckout()` in
  `band-subscription-service.ts`. Fulfillment mirrors reservations: the
  `checkout.completed` bus event → `handleBandPremiumCheckout()` in
  `band-checkout-listener.ts`; ongoing state syncs from
  `customer.subscription.updated/deleted` webhooks via `syncFromWebhook()` (dispatched by
  `metadata.subscription_type === 'band_premium'`). The public microsite lives under
  `src/routes/band-site/[slug]/` (feature flag `bandPremium`), with member-editable page
  config in `bandPageConfig` — custom CSS passes through `css-sanitizer.ts`.
- **Staff moderation:** `staff/bands` pages → the staff forms in `bands.remote.ts`
  (`deactivateBand`, `reactivateBand`, `updateStaffBand`, ...), all `requireStaff()`-guarded.

### Data touched

`band`, `bandMember`, `platformInvite`, `bandPageConfig`, `bandMedia`, Stripe subscription
(band premium).

### Where it breaks

- **Invite email never became a membership** → the email on the invite must match the
  login email exactly; check `platformInvite` rows and whether `resolvePendingInvites`
  errored (it's fire-and-forget in hooks with `captureException` — look in Sentry).
- **Premium page not appearing** → feature flag `bandPremium` off, or subscription state
  didn't sync — check the `customer.subscription.*` webhook deliveries and
  `syncFromWebhook`.

---

## 5. Events and tickets

Spec: [specs/tickets-spec.md](../specs/tickets-spec.md)

### The story

Staff (and bands, behind the `bandEvents` flag) create events. Publishing makes an event
visible on the public site. Ticketed events sell through Stripe — guests can buy without an
account — and each ticket gets a unique code rendered as a QR for door check-in. Free
events use RSVP instead.

### Code path

- **Create/publish:** `staff/events` UI → `createEvent` / `publishEvent` / `updateEvent`
  forms in `src/lib/remote/events.remote.ts` → `create()` / `publish()` / `update()` in
  `src/lib/server/event/event-service.ts`. Events that reserve practice space create a
  linked `bookerType: 'event'` reservation; `checkRebookNeeded()` handles time changes.
  Recurring events expand nightly via the same generation job as reservations (workflow 2).
- **Purchase:** public event page → `purchaseTickets` form in `events.remote.ts` — creates
  `pending` tickets via `createTickets()` in `ticket/ticket-service.ts` under a fresh
  `purchaseId`, then opens Stripe Checkout with
  `metadata: { type: 'ticket', purchase_id }`. Fulfillment:
  `checkout.completed` bus event → `handleTicketCheckout()` in
  `ticket/checkout-listener.ts` → `fulfillPurchase(purchaseId)` flips the purchase's
  tickets `pending → valid` and emits `ticket.purchased` (confirmation email with codes).
- **Check-in:** `staff/events/[id]/check-in` → `checkInTicket` form → `checkIn()` in
  `ticket-service.ts` (records who checked in and when; rejects reused codes).
- **Cancellation:** `cancelEvent` → `event-service.cancel()` — collects ticket holders and
  emits `event.cancelled` so every holder is notified with the refund note.
- **RSVP / comps:** `event/rsvp-service.ts`; staff `compTickets` form creates valid
  tickets with no charge.

### Data touched

`event`, `ticket` (status: `pending → valid → checked_in`, or `cancelled`), `eventRsvp`,
linked `reservation` rows for space-holding events.

### Where it breaks

- **Buyer charged but tickets still `pending`** → same webhook triage as reservations
  (workflow 1). `fulfillPurchase` is idempotent per purchase.
- **Ticket count oversold** → `getTicketsRemaining()` is checked at purchase time; look
  for concurrent purchases racing the check (same D1 no-transaction caveat).
- **QR won't scan at the door** → the code is also printed as text; `checkIn` can be
  driven from the search box on the check-in page.

---

## 6. Equipment loans

### The story

Members request to borrow gear (amps, PAs, etc.). Staff schedule a pickup date, hand the
item over (checkout), and take it back (return). Charges are computed at return time from
days borrowed × a per-tier daily rate, discounted for sustaining members, payable from
equipment credits first and cash for the rest. The whole feature sits behind the
`equipment` feature flag.

### Code path

The lifecycle lives in `src/lib/server/equipment/loan-service.ts`, driven by
`equipment.remote.ts`:

```
requestLoan()  member asks; emits equipment.loan_requested (staff notified)
   ↓ scheduleLoan()   staff sets pickup date; emits equipment.loan_scheduled
   ↓ checkoutLoan()   staff hands over; emits equipment.checked_out
   ↓ returnLoan()     staff takes back; computes charge, settles credits/cash,
                      emits equipment.returned
   (cancelLoan() from the pre-checkout states)
```

Pricing helpers `calculateDailyRate()` / `calculateLoanCharge()` are pure functions at the
top of the service; rates come from `$lib/config.ts` (`DAILY_RATE_MAJOR`,
`DAILY_RATE_ACCESSORY`). Invalid transitions throw `InvalidLoanTransitionError`. Equipment
credits are the same ledger as free hours (`credit-service.ts`, type
`equipment_credits`), allocated monthly from the subscription invoice (workflow 3).

### Data touched

`equipment`, `equipmentCategory`, `equipmentLoan` (status machine above),
`creditTransaction` (equipment credit spends).

### Where it breaks

- **"Insufficient quantity"** → another live loan holds the last unit; check
  `equipmentLoan` rows in non-terminal states for that equipment id.
- **Charge looks wrong** → recompute with `calculateLoanCharge()`'s inputs: days borrowed,
  tier, sustaining status at return time.

---

## 7. Marketing campaigns

Spec: [specs/email-marketing-spec.md](../specs/email-marketing-spec.md)

### The story

Staff compose email campaigns, pick audiences (rule-based or manual lists of subscribers),
and either send immediately or schedule. A frequent cron sweeps for due campaigns and sends
them through Postmark's **broadcast** message stream (separate from transactional mail, so
newsletter complaints can't hurt receipt deliverability). Every recipient gets a signed
unsubscribe link. Behind the `emailMarketing` feature flag.

### Code path

- **Compose/schedule:** `staff/marketing` UI → `marketing.remote.ts` →
  `campaign-service.ts`: `createCampaign()`, `scheduleCampaign(id, when)`, `sendNow(id)`.
  Status is derived, not stored: `deriveCampaignStatus()` maps
  (`scheduledFor`, `sentAt`) → `draft | scheduled | sending | sent`.
- **Audiences:** `audience-service.ts` + `subscriber-service.ts`;
  `getRecipientsForCampaign()` resolves and dedupes recipients at send time.
- **The send:** cron `send-campaigns` (`src/routes/api/cron/send-campaigns/+server.ts`,
  gated by `requireFeature('emailMarketing')` semantics via the flag check) →
  `processDueCampaigns()` → `executeSend(campaignId)` — renders per-recipient HTML with the
  layout compiled from MJML at build time (`scripts/compile-email-layouts.ts` →
  `src/lib/server/generated/`) and sends via the Postmark client
  (`notification/email/postmark-client.ts`, broadcast stream).
- **Unsubscribe:** `/unsubscribe` route under `(public)`, links signed with
  `MARKETING_UNSUBSCRIBE_SECRET` (see `marketing/unsubscribe` service code).

### Where it breaks

- **Scheduled campaign never sent** → the cron isn't running or the `emailMarketing` flag
  is off. `processDueCampaigns()` picks up anything with `scheduledFor <= now` and
  `sentAt IS NULL`, so a late cron still sends (late).
- **Broken layout** → the MJML compile happens at build; check the build log and the
  generated file, not the runtime.

---

## 8. Support inbox

### The story

Inbound email (to the support address), contact-form submissions, and SMS all land in a
unified staff inbox as threaded conversations. Staff reply from the app; replies go out
through Postmark (email) or Twilio (SMS). Every inbound message notifies all staff. Behind
the `staffInbox` feature flag. (A Meta/Messenger handler exists but the Meta integration is
not provisioned.)

Contact-form ('web') threads reply **by email** — the submitter gave us their address, and
the reply carries a plus-addressed `Reply-To` so their response threads back into the same
conversation. The thread stays `channel: 'web'`; that provenance is what the staff UI shows,
and re-labelling it `email` would let unrelated mail from the same address merge into it.

### Code path

- **Inbound email:** Postmark inbound webhook → `src/routes/api/inbox/postmark/+server.ts`
  (authenticated with `POSTMARK_INBOUND_TOKEN`) → `handlePostmarkInbound()` in
  `src/lib/server/inbox/inbound-handlers.ts`.
- **Inbound SMS:** Twilio webhook → `src/routes/api/inbox/twilio/+server.ts` →
  `handleTwilioInbound()`.
- **Contact form:** the public `/contact` page also funnels in via `handleContactForm()`,
  which additionally emits `contact.form_submitted` → an alert email to `STAFF_CONTACT_EMAIL`.
- All three thread the message via `thread-service.ts` / `message-service.ts` (match on
  sender address/number, else create a thread) and emit `inbox.message_received` — the
  listener in `events/register-listeners.ts` notifies every staff user, linking to
  `/staff/inbox/<threadId>`.
- **Replies:** `staff/inbox` UI → `inbox.remote.ts` → outbound via the channel's client
  (`notification/email/postmark-client.ts` or `inbox/twilio-client.ts`), recorded with an
  `inbox.message_sent` event.
- **Reply round trip (email + web):** `channel-dispatcher.ts` attaches a `Reply-To` built by
  `inbox/reply-address.ts` (`reply+<threadId>.<hmac>@…`). The contact's response reaches
  Postmark Inbound, which parses the part after the `+` into `MailboxHash`;
  `handlePostmarkInbound()` verifies the signature and appends to that exact thread,
  reopening it if it was resolved. No hash → find-or-create by sender address, but only when
  the `email` channel is enabled.

### Where it breaks

- **Inbound mail not appearing** → check the Postmark server's inbound webhook URL and
  token, then Sentry. Same for Twilio's messaging webhook config.
- **Staff not notified** → the notification dispatcher respects per-user preferences
  (`notification/preference-service.ts`); check the staff user's settings before suspecting
  the listener.
- **Outbound SMS failing** → `TWILIO_PHONE_NUMBER` is intentionally unset until
  provisioned (see the comment in `wrangler.toml`).
- **A contact's reply started a new thread instead of continuing theirs** → check the
  message's `channelMetadata.unresolvedMailboxHash`. Present means the address survived but
  the signature failed (usually `INBOX_REPLY_SECRET` / `POSTMARK_SERVER_TOKEN` changed since
  the reply went out); absent means the `+hash` never made it back, so check the MX record
  and Postmark's inbound activity view.
- **Replies going to the wrong place** → `INBOX_REPLY_ADDRESS` unset silently degrades to
  `Reply-To: STAFF_CONTACT_EMAIL`. That's the intended pre-MX state, not a bug.

---

## Cross-cutting patterns worth internalizing

- **Everything money-related converges on two Stripe entry points:** `checkout()` in
  `finance/payment-service.ts` (one-off) and `createCheckoutSession()` in
  `finance/subscription-service.ts` (recurring) — and one webhook route that fans out via
  `webhookHandlerMap`. New paid features should reuse these, put a discriminator in the
  Checkout Session `metadata`, and fulfill from a `checkout.completed` listener.
- **Status transitions are atomic conditional updates** (`UPDATE ... WHERE status IN
(...)` + row-count check — see `updateStatus()` in `reservation-service.ts`), because
  D1 has no transactions. Follow the same pattern for any new state machine.
- **Side effects ride the event bus** and must stay idempotent — Stripe re-delivery and
  cron overlap both re-run them.
- **Feature flags gate whole workflows** (`requireFeature()`); when something "doesn't
  exist" in production but works locally, check the flag first
  (`site-config` KV, `feature.*` keys).
