# Finance Module — Implementation Plan

Sequenced for a solo developer working through it PR by PR. Each epic builds on the last, with tests inline.

---

## Epic 1: Schema & Stripe SDK

Add the `credits` column to the user table, create the `credit_transaction` table, and install the Stripe SDK.

### 1.1 Install Stripe SDK

Install `stripe` as a dependency. Create `src/lib/server/stripe.ts` that exports a configured Stripe client reading the secret key from `$env/static/private` (or `$env/dynamic/private`).

### 1.2 Add credits column to user table

Add `credits` (jsonb, default `'{}'`) to the user table in `src/lib/server/db/schema/auth.ts`.

Generate and run the Drizzle migration.

### 1.3 Create credit_transaction schema

Create `src/lib/server/db/schema/finance.ts` with the `credit_transaction` table:

- `id` serial primary key
- `userId` text, FK → user.id
- `creditType` text
- `amount` integer
- `balanceAfter` integer
- `source` text
- `sourceId` text, nullable
- `description` text
- `metadata` jsonb, default `'{}'`
- `createdAt` timestamptz, default now()

Add to the barrel export in `schema/index.ts`. Generate and run migration.

### 1.4 Add credit types and Zod schemas

Create `src/lib/server/finance/types.ts`:

- `CreditType` union: `'free_hours' | 'equipment_credits'`
- Zod schema for the credits JSON shape (`CreditBalance: { balance: number, maxBalance: number | null }`)
- Helper to parse/validate the credits column

**Test:** Schema validates good input, rejects malformed credits JSON.

---

## Epic 2: CreditService

The service that reads and writes credit balances. No Stripe dependency — pure local logic.

### 2.1 Create CreditService

Create `src/lib/server/finance/credit-service.ts` with:

- `getBalance(userId, creditType)` — reads `user.credits` JSON, returns balance for the given type (0 if missing)
- `getAllBalances(userId)` — returns the full credits object
- `addCredits(userId, creditType, amount, source, sourceId?, description?)` — atomic increment via `jsonb_set`, inserts CreditTransaction, respects `maxBalance` cap
- `deductCredits(userId, creditType, amount, source, sourceId?, description?)` — atomic decrement with balance check in WHERE clause, inserts CreditTransaction, throws if insufficient
- `setBalance(userId, creditType, balance, source, sourceId?, description?)` — for monthly resets (free hours), sets balance directly

All write operations run in a transaction (update user + insert credit_transaction).

### 2.2 Create allocateMonthlyCredits

Add to CreditService:

- `allocateMonthlyCredits(userId, freeHours)` — calls `setBalance` for free_hours with source `'monthly_allocation'`
- `allocateEquipmentCredits(userId, amount)` — calls `addCredits` for equipment_credits with cap enforcement, source `'monthly_allocation'`

### 2.3 Tests for CreditService

Unit tests in `src/lib/server/finance/credit-service.spec.ts`:

- `getBalance` returns 0 for user with no credits
- `addCredits` increases balance and creates transaction
- `addCredits` respects maxBalance cap
- `deductCredits` decreases balance and creates transaction
- `deductCredits` throws when insufficient balance
- `deductCredits` with concurrent calls doesn't over-spend (verify via the WHERE clause — at least one call should fail)
- `setBalance` resets to exact value (monthly reset scenario)
- `allocateMonthlyCredits` sets free_hours balance

---

## Epic 3: PaymentService — Checkout

The core payment flow: calculate credit discounts, create Stripe Checkout Sessions or report credits-only payments.

### 3.1 Create PaymentService with checkout()

Create `src/lib/server/finance/payment-service.ts`:

```ts
checkout(options: {
  userId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  quantity: number;
  purchasableType: string;
  purchasableId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ paid: boolean; checkoutUrl?: string }>
```

Implementation:

1. Fetch the Stripe Price, expand the Product, read `eligible_wallets` from product metadata
2. Calculate total price (unit_amount × quantity)
3. For each eligible wallet type, check user's credit balance via CreditService
4. Calculate total credit discount in cents
5. If fully covered by credits:
   - Deduct credits via CreditService
   - Call Stripe `payment_records.report_payment` with $0 amount and metadata `{ credits_applied_cents, purchasable_type, purchasable_id }`
   - Return `{ paid: true }`
6. If partially or not covered:
   - Deduct whatever credits apply via CreditService
   - Create one-time Stripe Coupon (`amount_off`, `currency: 'usd'`, `max_redemptions: 1`) if credits apply
   - Create Stripe Checkout Session with line item, coupon (if any), and metadata `{ credits_applied_cents, purchasable_type, purchasable_id }`
   - Return `{ paid: false, checkoutUrl: session.url }`

Return the `stripe_payment_record_id` (for credits-only) or null (caller sets it after webhook).

### 3.2 Create onCheckoutComplete()

Add to PaymentService:

```ts
onCheckoutComplete(sessionId: string): Promise<{
  purchasableType: string;
  purchasableId: string;
  paymentRecordId: string;
}>
```

1. Retrieve Checkout Session from Stripe (expand payment_intent)
2. Read `purchasable_type` and `purchasable_id` from metadata
3. Get the Payment Record ID associated with the Payment Intent
4. Return all three so the caller can update the purchasable

### 3.3 Tests for checkout flow

Tests in `src/lib/server/finance/payment-service.spec.ts`. These will need Stripe mocking (mock the Stripe SDK calls).

- Checkout with no credits → creates Checkout Session, no coupon
- Checkout with partial credits → deducts credits, creates coupon, creates Checkout Session
- Checkout with full credit coverage → deducts credits, calls report_payment, returns paid: true
- Checkout with ineligible credit type → ignores credits, creates Checkout Session for full amount
- Product with no eligible_wallets metadata → no credit check, straight to Checkout Session

---

## Epic 4: PaymentService — Cash, Refund, Cancel

### 4.1 Create recordCashPayment()

Add to PaymentService:

```ts
recordCashPayment(options: {
  userId: string;
  amountCents: number;
  purchasableType: string;
  purchasableId: string;
}): Promise<{ paymentRecordId: string }>
```

Calls Stripe `payment_records.report_payment` with the amount, `processor_details.type: "custom"`, and metadata linking to the purchasable. Returns the Payment Record ID.

### 4.2 Create refund()

Add to PaymentService:

```ts
refund(options: {
  purchasableType: string;
  purchasableId: string;
  stripePaymentRecordId: string;
}): Promise<void>
```

1. Fetch Payment Record from Stripe, read `credits_applied_cents` from metadata
2. If non-zero payment amount: call `payment_records.report_refund`
3. If credits were applied: reverse via `CreditService.addCredits` with source `'refund'`

### 4.3 Create cancel()

Add to PaymentService:

```ts
cancel(options: {
  purchasableType: string;
  purchasableId: string;
  stripeCheckoutSessionId?: string;
}): Promise<void>
```

For abandoned Checkout Sessions where credits were optimistically deducted:

1. Read `credits_applied_cents` from session metadata
2. Reverse credit deductions via `CreditService.addCredits` with source `'cancelled'`

### 4.4 Tests for cash, refund, cancel

- `recordCashPayment` calls Stripe report_payment with correct amount and metadata
- `refund` on card payment calls report_refund and reverses credits
- `refund` on credits-only payment reverses credits, no Stripe refund call
- `cancel` reverses optimistically deducted credits

---

## Epic 5: Stripe Webhook Handler

### 5.1 Create webhook route

Create `src/routes/api/stripe/webhook/+server.ts`:

- POST handler that verifies the Stripe webhook signature
- Read `STRIPE_WEBHOOK_SECRET` from env
- Dispatch to handlers based on event type

### 5.2 Handle checkout.session.completed

Call `paymentService.onCheckoutComplete(sessionId)`. The handler needs to resolve the purchasable and set `stripe_payment_record_id` on it.

Since the payment service is generic (doesn't know about domain models), the webhook handler maintains a registry or switch on `purchasable_type` to know which table to update. Keep this simple — a function that takes `(type, id, paymentRecordId)` and does the DB update.

### 5.3 Handle invoice.paid (subscription credits)

When `invoice.paid` fires for a subscription:

1. Read the invoice line items
2. Find the contribution line item (the $5/unit Price)
3. Read quantity = free hours
4. Look up user by Stripe customer ID
5. Call `creditService.allocateMonthlyCredits(userId, quantity)`

### 5.4 Handle customer.subscription.deleted

1. Look up user by Stripe customer ID
2. Reset free_hours balance to 0 via `creditService.setBalance`
3. Revoke sustaining member role if applicable

### 5.5 Tests for webhook handler

- Verify signature validation rejects invalid signatures
- `checkout.session.completed` → purchasable gets payment record ID
- `invoice.paid` → correct free hours allocated based on quantity
- `customer.subscription.deleted` → free hours reset to 0

---

## Epic 6: SubscriptionService

### 6.1 Create SubscriptionService

Create `src/lib/server/finance/subscription-service.ts`:

- `createCheckoutSession(userId, quantity, coverFees, successUrl, cancelUrl)` — creates a Stripe Checkout Session in subscription mode with the $5/unit contribution Price × quantity, plus fee coverage line item if opted in
- `getSubscription(userId)` — fetches active subscription from Stripe by customer ID
- `updateQuantity(userId, newQuantity)` — updates subscription quantity (Stripe handles proration)
- `cancel(userId)` — cancels at period end
- `resume(userId)` — resumes a cancelled subscription

### 6.2 Fee calculation helper

Create `src/lib/server/finance/fees.ts`:

- `calculateProcessingFee(amountCents)` — Stripe's 2.9% + 30¢
- `calculateTotalWithFeeCoverage(baseCents)` — inverse calculation so net equals base

### 6.3 Tests for SubscriptionService

- `createCheckoutSession` creates session with correct price and quantity
- `createCheckoutSession` with fee coverage adds second line item
- `updateQuantity` calls Stripe subscription update
- Fee calculation: $25 base → correct fee amount, $0 base → 30¢ fixed

---

## Dependency Graph

```
Epic 1 (Schema & Stripe SDK)
  └─▶ Epic 2 (CreditService)
        └─▶ Epic 3 (PaymentService — Checkout)
              ├─▶ Epic 4 (PaymentService — Cash, Refund, Cancel)
              │     └─▶ Epic 5 (Webhook Handler)
              └─▶ Epic 6 (SubscriptionService)
```

---

## Smoke Tests

**Full card checkout with partial credits:**
Set up a user with 2 free_hours credits. Call `checkout()` for a 3-hour reservation at $10/hr. Verify: 2 credits deducted, CreditTransaction created, Stripe Checkout Session created with $20 coupon, session metadata has `credits_applied_cents: 2000`. Simulate webhook → purchasable gets payment record ID.

**Credits-only checkout + refund roundtrip:**
Set up a user with 5 free_hours credits. Call `checkout()` for a 1-hour reservation. Verify: 1 credit deducted, Stripe `report_payment` called with $0, returns paid: true. Then call `refund()`. Verify: credit added back, CreditTransaction with source 'refund', `report_refund` called on the Payment Record.

**Subscription → credit allocation:**
Simulate `invoice.paid` webhook for a subscription with quantity 5. Verify: user gets 5 free_hours balance via `setBalance`, CreditTransaction recorded with source `'monthly_allocation'`.

---

## Out of Scope

- **Caching Stripe Product/Price data locally.** Fetched from API each time for now.
- **Promo codes / one-off discounts.** Stripe has native promotion codes; not needed for launch.
- **Multi-item checkout.** One purchasable per Checkout Session.
- **Detailed receipt customization.** Using Stripe's default receipts.
- **Staff admin UI for credits/payments.** Will be built when the staff panel gets the finance section.
- **Domain model tables (reservations, tickets, equipment_loans).** Those are separate modules; this plan only builds the finance infrastructure they'll call into.
