# Finance Module — Stripe-First Design

The finance module handles payments, refunds, and member credits for the Corvallis Music Collective's SvelteKit app. The central idea: Stripe is the payment ledger, not the application. There are no local Order, Transaction, or LineItem tables. Instead, each purchasable item links directly to a Stripe Payment Record, and the Stripe dashboard is the single view of all revenue.

The module owns only what Stripe can't do: member credit wallets with double-entry bookkeeping and the logic to apply credits as Stripe coupon discounts at checkout time.

---

## Why this design

The Laravel app's finance module maintains a full local ledger — Orders, Transactions, LineItems — that mirrors what Stripe already tracks. This creates reconciliation complexity, state machine overhead (Order and Transaction each have their own state machines with hooks), and a large surface area for bugs. The local ledger exists because the original design predated Stripe's Payment Records API and needed to handle cash transactions locally.

With Payment Records, Stripe can track both card and cash payments in a unified history. The local ledger becomes redundant. Removing it eliminates ~6 models, 2 state machines, and the entire commit/settle/sweep/reconcile lifecycle.

---

## Stripe as the ledger

Every payment — card or cash — is represented in Stripe.

**Card payments** use Stripe Checkout Sessions. The app creates a session with line items (referencing Stripe Products/Prices) and a coupon if credits apply. Stripe collects payment and fires webhooks on completion.

**Cash payments** use the Payment Records API. When staff confirms cash received, the app calls `report_payment` with the amount and `processor_details.type: "custom"`. Stripe records it alongside card payments.

Both paths produce a Stripe Payment Record. The purchasable stores the Payment Record ID locally as its proof of payment.

**Products and prices live in Stripe.** Each purchasable type (rehearsal reservation, event ticket, equipment loan) has a corresponding Stripe Product. Prices are configured in Stripe — hourly rates, ticket prices, loan fees. The app references Stripe Price IDs when creating Checkout Sessions.

**Credit eligibility lives in Stripe Product metadata.** Each Stripe Product has an `eligible_wallets` metadata field (comma-separated wallet type keys, e.g., `"free_hours"` or `"free_hours,equipment_credits"`). The payment service reads this when calculating discounts, so it doesn't need to know about specific product types.

---

## Credits

Credits are the one thing Stripe doesn't handle. The app tracks them with a JSON column on the user table for current balances and a single audit log table for history.

### Credit balances (user.credits column)

A JSONB column on the `user` table holds the running total per credit type:

```json
{
	"free_hours": { "balance": 4, "maxBalance": null },
	"equipment_credits": { "balance": 12, "maxBalance": 250 }
}
```

Defaults to `{}` for users with no credits. The CreditService reads and writes this column. For atomic deductions, use Postgres `jsonb_set` with a balance check in the `WHERE` clause to prevent concurrent checkouts from over-spending:

```sql
UPDATE "user"
SET credits = jsonb_set(credits, '{free_hours,balance}', to_jsonb((credits->'free_hours'->>'balance')::int - $1))
WHERE id = $2
AND (credits->'free_hours'->>'balance')::int >= $1
```

### CreditTransaction

Immutable audit log. Every credit change — allocation, deduction, reversal, admin adjustment — creates a row.

```
credit_transaction
  id                  serial primary key
  user_id             text, FK → user.id
  credit_type         text
  amount              integer (positive = add, negative = deduct)
  balance_after       integer (snapshot of user.credits balance after this entry)
  source              text ('monthly_allocation' | 'monthly_reset' | 'checkout' | 'refund' | 'admin_adjustment' | ...)
  source_id           text, nullable (Stripe Payment Record ID, admin user ID, etc.)
  description         text
  metadata            jsonb, default '{}'
  created_at          timestamptz
```

### Credit allocation logic

Credits are allocated in response to Stripe subscription webhooks — no local scheduling table. When `invoice.paid` fires, the handler calculates the credit amount from the subscription and calls `CreditService.allocateMonthlyCredits()`. The CreditTransaction audit log records each allocation with `source: 'monthly_allocation'` and `source_id` set to the Stripe subscription ID, providing full history without a separate table.

**Free hours** reset each month to the subscription-derived amount (1 hour per $5). No rollover — the balance is set directly.

**Equipment credits** roll over with a cap (`max_balance`). Allocation adds to the current balance up to the cap.

---

## Purchasable fields

Each domain model that can be purchased (reservations, tickets, equipment loans) adds one column:

```
stripe_payment_record_id    text, nullable
```

A purchasable is **paid** when `stripe_payment_record_id` is not null. Every payment path — card, cash, or fully covered by credits — produces a Stripe Payment Record. For credits-only payments, the app calls `report_payment` with a $0 amount and `credits_applied` in metadata. This means "has a Payment Record" is the single check for payment status.

Credit amounts applied are stored in the Payment Record's metadata (`credits_applied_cents`), not locally. To find out how much credit was used, read it from Stripe.

A purchasable is **locked** (immutable except for status) when `stripe_payment_record_id` is not null. The only way to change a locked purchasable is cancel-and-rebook.

---

## Payment service

A single service handles all payment operations. It's generic — it doesn't know about reservations, tickets, or equipment. Callers pass a Stripe Price ID, quantity, and a reference to the purchasable.

### checkout(options)

```ts
checkout(options: {
  userId: string;
  stripePriceId: string;
  quantity: number;
  purchasableType: string;    // e.g., 'reservation', 'ticket'
  purchasableId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ paid: boolean; checkoutUrl?: string }>
```

1. Fetch the Stripe Product (via the Price) to read `eligible_wallets` from metadata.
2. For each eligible wallet, check the user's credit balance and calculate the discount in cents.
3. If credits fully cover the price:
   - Deduct credits (creates CreditTransaction entries).
   - Call Stripe `report_payment` with $0 amount and metadata `{ credits_applied_cents, purchasable_type, purchasable_id }`.
   - Set `stripe_payment_record_id` on the purchasable.
   - Return `{ paid: true }`.
4. If partially or not covered:
   - Deduct whatever credits apply (creates CreditTransaction entries).
   - Create a one-time Stripe Coupon for the credit discount amount (if any).
   - Create a Stripe Checkout Session with the Price, quantity, coupon, and metadata `{ credits_applied_cents, purchasable_type, purchasable_id }`.
   - Return `{ paid: false, checkoutUrl: session.url }`.

Credits are deducted when the Checkout Session is created (not on completion). If the session is abandoned, `cancelAbandoned()` reverses them.

### onCheckoutComplete(sessionId)

Called by the Stripe webhook handler when `checkout.session.completed` fires.

1. Read `purchasable_type` and `purchasable_id` from session metadata.
2. Retrieve the Payment Intent ID from the session.
3. Look up or wait for the Payment Record associated with the Payment Intent.
4. Set `stripe_payment_record_id` on the purchasable.
5. Fire `PaymentCompleted` event.

### recordCashPayment(options)

```ts
recordCashPayment(options: {
  userId: string;
  amountCents: number;
  purchasableType: string;
  purchasableId: string;
}): Promise<void>
```

1. Call Stripe Payment Records API (`report_payment`) with amount, `processor_details.type: "custom"`, and metadata linking to the purchasable.
2. Set `stripe_payment_record_id` on the purchasable.
3. Fire `PaymentCompleted` event.

### refund(purchasable)

1. Fetch the Payment Record from Stripe. Read `credits_applied_cents` from metadata.
2. If the Payment Record has a non-zero payment amount:
   - Call Stripe Payment Records API (`report_refund`) for the full amount.
3. If credits were applied (`credits_applied_cents > 0`):
   - Reverse credit deductions (add back to UserCredit, create CreditTransaction with source `'refund'`).
4. Clear `stripe_payment_record_id` on the purchasable.
5. Fire `PaymentRefunded` event.

### cancel(purchasable)

For unpaid/abandoned items (e.g., checkout session expired before payment).

1. If credits were deducted for a pending Checkout Session:
   - Reverse credit deductions.
2. Clear `stripe_payment_record_id` on the purchasable (if set).
3. Fire `PaymentCancelled` event.

---

## Checkout flow — step by step

### Card payment (with partial credits)

1. Member clicks "Confirm & Pay" on a reservation.
2. Domain module calls `paymentService.checkout()` with the Stripe Price ID and reservation details.
3. Payment service fetches the Stripe Product, sees `eligible_wallets: "free_hours"`.
4. User has 2 hours of free_hours credits. Reservation is 3 hours at $10/hr = $30. Credits cover $20.
5. Service deducts 2 hours from UserCredit, records CreditTransaction.
6. Service creates a Stripe Coupon for $20 off (`amount_off: 2000, currency: 'usd', max_redemptions: 1`).
7. Service creates a Checkout Session: 3 hours × $10 price, $20 coupon, metadata `{ purchasable_type: 'reservation', purchasable_id: '...' }`.
8. Member is redirected to Stripe Checkout, pays $10.
9. Stripe fires `checkout.session.completed` webhook.
10. `onCheckoutComplete()` sets `stripe_payment_record_id` on the reservation.
11. `PaymentCompleted` event fires. SpaceManagement confirms the reservation.

### Fully covered by credits

1. Member clicks "Confirm" on a 1-hour reservation ($10).
2. Payment service sees user has 3 hours of free_hours credits. Fully covered.
3. Service deducts 1 hour, calls Stripe `report_payment` with $0 amount and metadata `{ credits_applied_cents: 1000 }`.
4. Sets `stripe_payment_record_id` on the reservation.
5. Returns `{ paid: true }`. No Stripe redirect.
6. `PaymentCompleted` event fires.

### Cash payment

1. Staff marks a walk-in reservation as paid with cash.
2. Domain module calls `paymentService.recordCashPayment()`.
3. Service calls Stripe `report_payment` with amount and custom processor type.
4. Sets `stripe_payment_record_id` on the reservation.
5. `PaymentCompleted` event fires.

---

## Refund flow

1. Staff clicks "Refund" on a paid reservation.
2. Domain module calls `paymentService.refund(reservation)`.
3. Service reads `credits_applied_cents` from Payment Record metadata.
4. If the Payment Record has a non-zero payment: calls Stripe `report_refund`.
5. If credits were applied: reverses them (adds back to UserCredit).
6. Clears `stripe_payment_record_id`.
7. `PaymentRefunded` event fires. SpaceManagement handles reservation status.

---

## Subscriptions

Subscriptions use Stripe Billing directly. The app creates Stripe Checkout Sessions in subscription mode. Stripe manages billing cycles, invoicing, and payment collection.

**Local state:** The `user` table already has `stripe_id`, `pm_type`, `pm_last_four`, and `trial_ends_at`. Subscription status is read from Stripe via the API (or cached locally if performance demands it).

**Credit allocation:** When a subscription webhook fires (`invoice.paid`), the app calculates monthly free hours based on the contribution amount (1 hour per $5) and calls `CreditService.allocateMonthlyCredits()`.

**Sliding-scale membership:** A single Stripe Price at $5/unit/month. The member's chosen contribution is the quantity — a $25/month member has quantity 5, which also equals their monthly free hours. Changing contributions is a quantity update; Stripe handles proration.

**Fee coverage:** If the member opts to cover Stripe's processing fee, a second line item is added to the subscription for the fee amount (a separate Stripe Price). This keeps the contribution line item clean — the webhook handler reads the contribution quantity directly to determine free hours, without needing to back out fees.

---

## No event system

The app doesn't use a domain event bus. The payment service returns results to its caller, and the calling code (in the domain module) handles what comes next — confirming a reservation, activating a ticket, etc. This keeps the flow explicit and easy to follow. If cross-cutting concerns grow, an event system can be added later.

---

## Module boundaries

### Inside the finance module

- CreditService (allocation, deduction, reversal, balance queries)
- PaymentService (checkout, cash recording, refunds, cancellation)
- Stripe webhook handler
- CreditTransaction schema

### Outside the finance module (domain modules)

- Purchasable field (`stripe_payment_record_id`) lives on each domain model's own table
- Policies for who can initiate payments, refunds, etc.
- Domain-specific logic after payment (confirming reservations, activating tickets) — called directly by the code that invokes PaymentService
- Stripe Product/Price configuration (done in Stripe dashboard or via seed script)

### What the finance module does NOT know about

- Reservation scheduling, conflicts, time slots
- Ticket validation, check-in
- Equipment availability, loan status
- Any domain-specific business rules

---

## Schema summary

### New tables (finance module)

| Table                | Purpose                                   |
| -------------------- | ----------------------------------------- |
| `credit_transaction` | Immutable audit log of all credit changes |

### Modified tables

| Table                                                           | New columns                                               |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `user`                                                          | `credits` (jsonb, default '{}') — running credit balances |
| Each purchasable table (reservations, tickets, equipment_loans) | `stripe_payment_record_id` (text, nullable)               |

### Removed (vs. Laravel app)

| Table          | Reason                                                |
| -------------- | ----------------------------------------------------- |
| `orders`       | Stripe is the ledger                                  |
| `transactions` | Stripe is the ledger                                  |
| `line_items`   | Stripe Checkout Session line items serve this purpose |

---

## Stripe configuration

### Products (created in Stripe dashboard or via seed script)

| Product                   | Metadata                                  |
| ------------------------- | ----------------------------------------- |
| Rehearsal Space           | `eligible_wallets: "free_hours"`          |
| Event Ticket              | `eligible_wallets: ""` (no credits apply) |
| Equipment Loan            | `eligible_wallets: "equipment_credits"`   |
| Membership (subscription) | N/A — not a one-time purchase             |

Each Product has one or more Prices (hourly rate, per-ticket, per-day, etc.).

### Webhooks

| Event                           | Handler                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `checkout.session.completed`    | `onCheckoutComplete()` — links Payment Record to purchasable |
| `invoice.paid`                  | Allocate monthly credits based on subscription amount        |
| `customer.subscription.updated` | Update local subscription state if cached                    |
| `customer.subscription.deleted` | Revoke sustaining member role, reset free hours balance      |

---

## Deferred

- **Caching Stripe Product/Price data locally.** Currently fetched from the API each checkout. Add webhook-driven cache if latency or API rate limits become an issue.
- **Promo codes / one-off discounts.** Stripe has native promotion codes. Could layer these on top of credit coupons, but not needed for launch.
- **Multi-item checkout.** Current design is one purchasable per Checkout Session. Bundling multiple items (e.g., reservation + equipment loan) into one session would need a way to split the Payment Record across purchasables. Deferred because the use case is uncommon.
- **Detailed receipt customization.** Stripe Checkout generates receipts automatically. Custom receipt templates can be added later via Stripe's receipt settings or a custom email.

---

## Open questions

None at this time.
