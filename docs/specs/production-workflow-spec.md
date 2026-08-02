# Productions

A **production** is a show the Collective puts on: booked, advanced, run, settled, and
cleaned up. Today the app models only the public half of that — an `event` row with a
title, times, a poster, and optional ticketing. Everything a producer actually does
between "we should book this band" and "the room is reset" lives in spreadsheets and
group chats: who's playing and in what order, how long each set runs, which touring act
has no CMC account, whose venue it's at, what the door split was, and whether the load-out
checklist got finished.

This feature adds that back-of-house layer. A `production` row sits behind exactly one
`event`, carrying the lineup, the schedule, the checklists, and the settlement. It adds
a real `venue` table, and it extends `band` so a touring act with no account can be a
first-class lineup entry — and can later claim its own profile without the show history
being rewritten.

Everything here is staff-facing and gated behind a `productions` feature flag.

---

## Key concepts

**The production is the back of house; the event is the front.** `production.eventId` is
a NOT NULL unique FK — strictly one production per event, one event per production.
Creating a production creates its event (reusing `create()` in
`src/lib/server/event/event-service.ts`), which stays `draft` until the show is
announced. Public concerns — title, poster, ticket price, gig-guide listing — stay on
`event` and are edited through the production. Ops concerns — lineup, load-in, payouts,
checklists — live on `production` and never leak to the public schema. Nothing is
duplicated across the two tables.

**A lineup slot always points at a `band` row.** Touring and non-member acts get `band`
rows too, marked unclaimed (see below). One reference type means a lineup can mix member
and non-member acts without a polymorphic column, and an act that later joins the
Collective keeps every production it ever played.

**Set times are computed, then overridable.** A pure helper walks the lineup in order,
laying each set out from the first set time plus preceding set lengths and changeovers —
the same shape as `calculateDailyRate()` / `calculateLoanCharge()` at the top of
`equipment/loan-service.ts`. The computed time is _stored_ on the slot, so staff can
hand-edit one set without every later slot shifting underneath them.

**Stripe stays the payment ledger.** Per [finance-spec.md](finance-spec.md), settlement
creates no Order or Transaction tables. Ticket revenue is read from the existing `ticket`
and `payment_cache` rows and snapshotted onto the production at settle time. Door cash,
expenses, and band payouts are _recorded_ amounts — the app is a settlement worksheet and
a record of what was handed over, not a disbursement system.

**Checklists are data, not code.** Advance and close-out are rows in one
`production_task` table separated by a `phase` column, seeded from default templates and
editable per show. The close-out phase is the cleanup stage, and a production cannot
reach `closed` with unfinished close-out tasks.

---

## Domain model

### Production

The ops record. One per event.

```
production
  id                  uuid pk
  eventId             uuid unique fk → event    — NOT NULL, one-to-one
  venueId             uuid? fk → venue          — null falls back to event.location text
  status              text                      — see Status lifecycle
  producerUserId      uuid? fk → user           — staff lead
  loadInAt            timestamp?
  soundcheckAt        timestamp?
  firstSetAt          timestamp?                — anchor for computed set times
  curfewAt            timestamp?
  loadOutBy           timestamp?
  billingNotes        text                      — how the lineup is billed on the poster
  hospitalityNotes    text
  internalNotes       text
  doorCount           int?                      — settlement snapshot below
  compCount           int?
  ticketRevenueCents  int?
  doorCashCents       int?
  otherRevenueCents   int?
  totalExpenseCents   int?
  totalPayoutCents    int?
  netCents            int?
  settledAt           timestamp?
  settledByUserId     uuid? fk → user
  closedAt            timestamp?
  closedByUserId      uuid? fk → user
  createdByUserId     uuid fk → user
  createdAt           timestamp
  updatedAt           timestamp
```

Settlement totals live directly on `production` because the relationship is 1:1 — a
separate `production_settlement` table would buy nothing. Per-line detail lives in
`production_expense`; per-act payouts live on `production_slot`.

Public-facing times stay on `event`: `event.doorsAt`, `event.startsAt`, `event.endsAt`.
The production's timestamps are the ones the public never sees. `firstSetAt` is
deliberately separate from `event.startsAt` — the listing says "8pm", the first band
actually goes on at 8:20.

### Venue

New table, closing the "Venues — not started" gap in
[parity-report.md](../reports/parity-report.md).

```
venue
  id            uuid pk
  name          text unique
  slug          text unique
  isPrimary     boolean         — the CMC room; exactly one row should have this
  address1      text?
  city          text?
  state         text?
  postalCode    text?
  capacity      int?
  contactName   text?
  contactEmail  text?
  contactPhone  text?
  loadInNotes   text?
  backline      json?           — BacklineItem[], reusing the type from $lib/types/band-page
  links         json?           — ProfileLink[], same shape as band.links
  notes         text?
  deletedAt     timestamp?      — soft delete, matching band/equipment
  createdAt     timestamp
  updatedAt     timestamp
```

`event.venueId` is added as a nullable set-null FK **alongside** the existing
`event.location` free-text column. `location` stays exactly as it is — band-created
off-site gigs keep typing a venue name, and the gig guide's venue line keeps working
unchanged. `venueId` is the structured upgrade, used by productions and available to band
events later.

**Only productions at the primary venue hold space.** When `venue.isPrimary` is true,
confirming a production creates a `reservation` with `bookerType: 'event'` — the existing
polymorphic hook in `reservation.ts`, no enum change needed — covering `loadInAt` through
`loadOutBy`, not just doors-to-close. Off-site productions create no reservation at all,
which is the point of tracking the venue.

### Bands, extended to cover external acts

A touring act needs a name, a bio, genres, links, a photo, and a contact — which is
exactly the `band` table. Rather than fork all of that into an `externalAct` table and
face a painful merge the day the act joins, `band` gains a claim state:

```
band (additions)
  claimStatus   text   — 'claimed' | 'unclaimed' | 'claim_pending', default 'claimed'
```

- **`unclaimed`** — a staff-created stub for an act with no CMC presence. No `bandMember`
  rows. `directoryVisibility` **must be set explicitly to `'hidden'`** at creation.
- **`claim_pending`** — a `platformInvite` has been sent to the act's contact.
- **`claimed`** — a normal member band. Every band today is `claimed`.

**`ownerId` stays `NOT NULL`.** An unclaimed band is owned by a dedicated CMC service
user seeded alongside the existing seed users. This was the pivotal decision, and it is
worth stating why, because the obvious alternative — making `ownerId` nullable — is
considerably more expensive:

- Three queries in `band-service.ts` (`listAll`'s data and count queries, and
  `getByIdWithDetails`) use `.innerJoin(user, eq(user.id, band.ownerId))`. A null owner
  never matches, so external bands would silently vanish from `/staff/bands` and 404 on
  their own detail page.
- `deleteBand` and `deactivate` pass `row.ownerId` into `cancelReservation(id, userId)`,
  which requires a string.
- `band.ownerId` is picked into `BandLayoutResponse` in `db/schema/api.ts`, so the null
  would propagate across the remote boundary into every band-panel consumer.
- SQLite cannot relax `NOT NULL` in place. Drizzle would emit a full table rebuild of
  `band` — the table with the most FK children in the schema (`band_genre`,
  `band_member`, `platform_invite`, `event`, `band_page_config`, `band_media`) — with
  `PRAGMA foreign_keys=OFF` for the duration.

`claimStatus` is a pure `ALTER TABLE ADD COLUMN`. None of the above applies, `/staff/bands`
keeps working untouched, and the staff list even gains useful information: the owner
column shows which staffer stubbed the act until it's claimed.

**Authorization is unaffected.** Every band access decision routes through `bandMember`
(`getUserRole()` in `band/band-context.ts`, `requireBandAdmin`/`requireBandOwner`), and an
unclaimed band has zero `bandMember` rows, so it is inaccessible to everyone by
construction. The service user owning the row grants nothing.

**Claiming** reuses the existing platform-invite machinery: staff send a `platformInvite`
to the act's contact email with `role: 'owner'`, which flips the band to `claim_pending`.
When that person signs up, `resolvePendingInvites()` in `src/hooks.server.ts` inserts
their `bandMember` row on first login. The claim then completes by reusing
`transferOwnership()` — which already requires the new owner to be an active band member,
a precondition the invite has just satisfied — and setting `claimStatus: 'claimed'` and
`directoryVisibility` to the act's choice.

Note that `resolvePendingInvites()` today only inserts the `bandMember` row; it never
touches `band.ownerId` or `claimStatus`. Accepting an owner invite on an unclaimed band
would otherwise leave a `bandMember` with `role: 'owner'` while the band still points at
the service user — split-brain. The claim step must set all three fields together.

### Production slot (run of show)

One act, one set, one position in the running order.

```
production_slot
  id                 uuid pk
  productionId       uuid fk → production (cascade)
  bandId             uuid? fk → band (set null)
  sortOrder          int              — 0 plays first; unique (productionId, sortOrder)
  billing            text             — headliner | support | opener | dj | host
  setLengthMinutes   int
  changeoverMinutes  int              — default 10
  scheduledStartAt   timestamp?       — computed, then overridable
  soundcheckAt       timestamp?
  status             text             — invited | confirmed | declined | cancelled
                                      —   | performed | no_show
  guaranteeCents     int?
  doorSplitPercent   int?
  payoutCents        int?             — what was actually handed over
  payoutMethod       text?            — cash | check | venmo | none
  paidAt             timestamp?
  techNotes          text?
  backlineNeeds      text?
  hospitalityNotes   text?
  contactName        text?            — per-show override of the band's directoryContact
  contactEmail       text?
  contactPhone       text?
  createdAt          timestamp
  updatedAt          timestamp
```

`bandId` is nullable and set-null rather than cascade so a deleted band leaves the slot —
and its payout record — intact for historical settlements.

Tech requirements are entered per show, but a member band with a premium page already has
this on file: `BandEpk` in `src/lib/types/band-page.ts` carries `technicalRiderKey`,
`stagePlotKey`, and `backline`, and `band_media` has `'rider'` and `'stage_plot'` types.
The advance UI surfaces those when they exist so the producer isn't re-collecting them.

### Production task

Advance and close-out checklists, one table.

```
production_task
  id                uuid pk
  productionId      uuid fk → production (cascade)
  phase             text        — advance | day_of | closeout
  label             text
  sortOrder         int
  notes             text?
  done              boolean     — default false
  doneAt            timestamp?
  doneByUserId      uuid? fk → user
  assignedToUserId  uuid? fk → user
  createdAt         timestamp
```

Default templates live in `src/lib/config.ts` next to the existing equipment and inbox
tuples, and are copied into rows when a production is created so they can be edited per
show. Starting set:

- **advance** — confirm lineup and set times, collect tech riders and stage plots,
  confirm backline, send load-in details, confirm door/sound staffing, poster and social
  announcement, ticket link live.
- **day_of** — doors staffed, sound check complete, hospitality set, merch table set,
  float counted.
- **closeout** — door count reconciled, bands paid, load-out complete, room reset, trash
  and recycling out, gear returned to storage, incidents logged, lock-up.

### Production expense

```
production_expense
  id            uuid pk
  productionId  uuid fk → production (cascade)
  label         text
  category      text        — sound | staffing | hospitality | marketing | rental | other
  amountCents   int
  paidTo        text?
  paidAt        timestamp?
  notes         text?
  createdAt     timestamp
```

---

## Status lifecycle

```
draft ──▶ offered ──▶ confirmed ──▶ completed ──▶ settled ──▶ closed
  │          │            │
  └──────────┴────────────┴──────▶ cancelled
```

| Transition                        | Trigger                                                       | Side effects                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| → `draft`                         | Create production                                             | Creates the `draft` event; copies task templates                                                                                  |
| `draft` → `offered`               | Offers sent                                                   | Slots move to `invited`; no public change                                                                                         |
| `offered` → `confirmed`           | Lineup locked                                                 | Creates the space `reservation` if the venue is primary; unlocks event publish                                                    |
| `confirmed` → `completed`         | Show happened (or the auto-complete cron passes the end time) | Slots default to `performed`; unlocks settlement                                                                                  |
| `completed` → `settled`           | Staff settle                                                  | Snapshots ticket revenue and totals onto the production; freezes the money fields                                                 |
| `settled` → `closed`              | Close-out done                                                | Requires every `closeout` task `done`; archives the production                                                                    |
| any pre-`completed` → `cancelled` | Staff cancel                                                  | Cancels the event via `event-service.cancel()` (which notifies ticket holders), releases the reservation, marks slots `cancelled` |

Publishing the event requires `confirmed` or later — you cannot announce a show whose
lineup isn't locked. Unpublishing is always allowed.

Transitions use the house pattern: an atomic conditional
`UPDATE ... SET status = ? WHERE id = ? AND status IN (...)` with a row-count check,
exactly as `updateStatus()` in `reservation-service.ts` does, because D1 has no
interactive transactions. Invalid transitions throw `InvalidProductionTransitionError`,
mirroring `InvalidLoanTransitionError`.

---

## Booking and advance

Staff create a production with a title, a date, and a venue. That single action creates
the `draft` event and copies the task templates. From there:

1. **Build the lineup.** Add slots by picking a member band from a search, or by creating
   an unclaimed band inline for a touring act — name, contact, and optionally bio, genres,
   and links. `billing` and `sortOrder` set the running order.
2. **Send offers.** Terms per slot: guarantee, door split, or both. Moving the production
   to `offered` sets every slot to `invited`. Member bands get an in-app notification;
   external acts are contacted out-of-band (the staff inbox is the natural home for that
   thread, but the spec does not wire it — see Deferred).
3. **Confirm.** Slots move to `confirmed` or `declined` as replies come in. Confirming the
   production locks the lineup and reserves the room.
4. **Advance.** Work the `advance` checklist: collect riders, confirm backline, set
   soundcheck times, finalize set lengths. Any slot pointing at a premium member band
   shows that band's EPK rider, stage plot, and backline inline.

Creating an unclaimed band inline is the one flow that can collide with the global
`UNIQUE` on `band.name`. Today nothing guards that — `create()` in `band-service.ts`
dedupes only the slug via `ensureUniqueSlug()`, and a taken name raises a raw D1
constraint violation that becomes a 500 and a Sentry report. This is rare for member
bands and common for external acts, since touring acts collide with local names and staff
will double-create the same act across shows. So this feature must add:

- a typed `BandNameTakenError` thrown from `create()` and `update()`, following the
  existing precedent in `invite()` which already catches `unique` violations and rethrows
  as `BandMemberExistsError`;
- surfaced as a form issue on the name field, not a 500;
- a "did you mean this existing act?" search in the inline-create UI so the second show
  reuses the first show's band row.

---

## Run of show

Set times are derived, not typed. Given `firstSetAt` and the slots in `sortOrder`:

```
cursor = firstSetAt
for slot in slots ordered by sortOrder:
    slot.scheduledStartAt = cursor
    cursor = cursor + slot.setLengthMinutes + slot.changeoverMinutes
```

`computeSetTimes()` is a pure exported function in the production module — no DB access,
directly unit-testable, the same treatment as the equipment pricing helpers. Staff hit
"recalculate" to apply it and write the results to the slots; individual
`scheduledStartAt` values can then be edited by hand without re-running the walk.

Validation, surfaced as warnings rather than hard errors because real shows run late:

- the last set's end plus its changeover exceeding `curfewAt`;
- `firstSetAt` earlier than `event.doorsAt`;
- a slot with `setLengthMinutes` of 0 or over 240;
- `soundcheckAt` after `firstSetAt`.

Reordering rewrites `sortOrder` for the affected slots. Because
`unique (productionId, sortOrder)` would trip mid-rewrite and D1 has no transactions,
reorders write to a temporary offset range first (`sortOrder + 1000`), then back down —
or, more simply, the service renumbers the whole lineup in one pass from a supplied array
of slot ids. The spec prefers the latter: one array in, one full renumber out.

---

## Settlement

Available once the production is `completed`. The worksheet:

```
grossRevenueCents  = ticketRevenueCents + doorCashCents + otherRevenueCents
totalExpenseCents  = sum(production_expense.amountCents)
totalPayoutCents   = sum(production_slot.payoutCents)
netCents           = grossRevenueCents - totalExpenseCents - totalPayoutCents
```

`ticketRevenueCents` is **read, not entered** — summed from `payment_cache` rows for the
event's tickets, with `ticket` rows in `valid` or `checked_in` status giving the counts.
Comps (`compCount`) come from tickets with no associated payment. Door count is the
checked-in ticket count plus `doorCashCents` walk-ups, and staff can override it.

Payout suggestions per slot, computed but never auto-applied:

```
pool      = grossRevenueCents - totalExpenseCents
suggested = max(guaranteeCents ?? 0, round(pool * doorSplitPercent / 100))
```

Staff enter the actual `payoutCents`, `payoutMethod`, and `paidAt` per slot. The suggestion
is a number on the screen; the record is what was handed over.

Settling writes the snapshot onto the production and stamps `settledAt` / `settledByUserId`.
After that the money fields are read-only — reopening requires a staff action that returns
the production to `completed` and clears the snapshot, so an edited settlement is always
visibly re-settled.

**No Stripe writes.** No refunds, no transfers, no payouts through the API. Ticket refunds
continue to go through the existing event-cancellation path in `event-service.cancel()`.

---

## Close-out

The cleanup stage. Working the `closeout` checklist is the entire gate: the
`settled → closed` transition rejects while any `closeout` task is `done: false`, naming
the outstanding ones in the error. Incident notes go in `internalNotes` (a link to the
Incident & Safety Log idea if that ever lands). Closing stamps `closedAt` /
`closedByUserId` and drops the production out of the default staff list, which shows
active productions unless the closed filter is on.

---

## How a production feeds the rest of the app

- **`event`** — created with the production and updated through it. Title, description,
  doors, start/end, poster, tags, ticketing config, and `venueId` are all written from the
  production's edit form. Publish is gated on `confirmed`. Cancel routes through
  `event-service.cancel()` so ticket holders are notified by the existing listener.
- **`reservation`** — a `bookerType: 'event'` reservation covering load-in through
  load-out is created on confirm at the primary venue, and released on cancel. This reuses
  the existing conflict checking, so a production cannot be confirmed into an occupied
  room without an explicit override, and the existing `checkRebookNeeded()` handles time
  changes.
- **`ticket`** — unchanged. Ticketing config is set through the production; purchase,
  check-in, and refunds keep their current paths. Settlement only reads.
- **`band`** — unclaimed acts become real directory bands on claim, at which point their
  entire production history is already attached. Member bands see their booked shows on
  their band dashboard.
- **`venue`** — reusable across productions and, later, band events. Backline and load-in
  notes carry into the advance checklist.
- **Event bus** — `production.confirmed`, `production.slot_invited`,
  `production.cancelled`, `production.completed`, `production.settled` payloads added to
  `events/event-bus.ts`, with listeners registered in `events/register-listeners.ts`. All
  side effects stay idempotent, per the house rule.
- **Public event page** — once the event is published and the production is `confirmed`,
  `/events/[id]` can render the run of show: act names in order with set times, showing
  only slots in `confirmed` or `performed` status.

### The gig-guide attribution rule

**A production never writes an external act into `event.bandId`.** That column stays for
band-authored events (`source: 'band'`); CMC lineups live entirely in `production_slot`.

This matters because `listPublicCalendarEvents()` and `listPublicUpcomingEvents()` in
`event-service.ts` left-join `band` and emit `bandSlug`, which the public event page
renders as a link to `/directory/bands/[slug]`. An unclaimed act is
`directoryVisibility: 'hidden'`, so that link would 404. Keeping external acts out of
`event.bandId` avoids the problem entirely.

The same rule applies to the published run of show: render a link only for slots whose
band is directory-visible, and plain text otherwise.

---

## Visibility audit

Extending `band` means every existing filter that decides "is this band public?" has to
account for unclaimed rows. The gates today, and what each needs:

| Location                                                   | Current gate                                                         | Required change                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory/directory-service.ts` — `bandWhereConditions()` | `deletedAt IS NULL` + `directoryVisibility`                          | Add `claimStatus != 'unclaimed'`. Single choke point for `listBands()` and `listPublicBands()`, which the sitemap also uses.                                                                                                     |
| `remote/directory.remote.ts` — `loadBandProfile()`         | slug + `deletedAt IS NULL`, then `isBandProfileHidden()`             | Same guard, so `/directory/bands/[slug]` 404s for stubs.                                                                                                                                                                         |
| `remote/band-site.remote.ts` — `getBandSiteData()`         | `deletedAt IS NULL` + `tier === 'premium'` **only**                  | Pre-existing hole — no `directoryVisibility` check at all, so a hidden band with premium tier still renders a full public microsite. Add both checks.                                                                            |
| `event-service.ts` — public calendar queries               | `event.status = 'published'` + source flag; no band visibility check | Pre-existing — a hidden member band's published event already leaks its name and a 404ing profile link. The attribution rule above avoids making it worse; fixing it properly means gating the emitted `bandSlug` on visibility. |

Belt and braces: `directoryVisibility` defaults to `'public'` in the schema and `create()`
never sets it, so the external-create path must pass `'hidden'` explicitly, and that
should be an asserted case in the band service tests rather than a convention.

One more cleanup while in the area: `requireStaffOrOwner()` in `authorization.ts` has
zero callers. It is safe today, but it compares `userId === ownerId` after guarding only
`userId`, which becomes a trap the moment anyone passes an optional owner. Delete it, or
guard `ownerId` too.

---

## Module boundaries

### Inside the production domain

`src/lib/server/production/`:

- `production-service.ts` — create, update, status transitions, queries
- `slot-service.ts` — lineup CRUD, reorder, per-slot status
- `set-times.ts` — pure `computeSetTimes()` and its validation warnings
- `settlement-service.ts` — revenue read, totals, snapshot, reopen
- `task-service.ts` — checklist CRUD and template seeding
- `errors.ts` additions — `ProductionNotFoundError`, `InvalidProductionTransitionError`,
  `CloseoutIncompleteError`, extending the `DomainError` base

`src/lib/server/venue/venue-service.ts` — venue CRUD, kept separate because venues
outlive any one production.

### Integration points

- `event/event-service.ts` — `create()`, `update()`, `publish()`, `cancel()`,
  `checkRebookNeeded()`, all reused, not reimplemented
- `reservation/reservation-service.ts` — `staffCreate()` and `cancel()`
- `band/band-service.ts` — `create()` extended for unclaimed acts; `transferOwnership()`
  reused for claims
- `band/platform-invite-service.ts` — `createInvite()` with `role: 'owner'`
- `ticket/ticket-service.ts` and `finance/payment-cache-service.ts` — read-only, for
  settlement
- `events/event-bus.ts` — new `production.*` payloads

### What doesn't touch productions

Membership and credits, equipment loans, email marketing, and the support inbox. A
production books a room but does not spend free hours; a band borrowing an amp for a show
still goes through the normal loan flow.

---

## Schema

Five new tables — `production`, `production_slot`, `production_task`,
`production_expense`, `venue` — plus two column additions:

```
band (additions)
  claimStatus   text not null default 'claimed'   — claimed | unclaimed | claim_pending
  index on (claimStatus)

event (additions)
  venueId       uuid? references venue(id) on delete set null
  index on (venueId)
```

Indexes on the new tables:

- `production` — unique on `eventId`; index on `(status, createdAt)`; index on `venueId`
- `production_slot` — index on `productionId`; unique on `(productionId, sortOrder)`;
  index on `bandId`
- `production_task` — index on `(productionId, phase)`
- `production_expense` — index on `productionId`
- `venue` — unique on `name` and `slug`; index on `slug`

Checks: `production_slot.setLengthMinutes > 0`, `changeoverMinutes >= 0`,
`doorSplitPercent between 0 and 100`, `production_expense.amountCents >= 0`.

Enum tuples and the task templates go in `src/lib/config.ts` alongside the equipment and
inbox tuples; zod form schemas sit next to their tables, following the house convention.

Per CLAUDE.md, migrations are generated with `drizzle-kit` by hand, not written here. All
of the above is additive — `ALTER TABLE ADD COLUMN` plus `CREATE TABLE` — with no table
rebuild, which is the main practical payoff of keeping `band.ownerId` non-null.

---

## Staff UI

Everything follows [ui-patterns.md](../development/ui-patterns.md): `PageHeader` outside
`PageContent`, `Form`/`FormField`/`SubmitButton` for every form with no raw inputs,
`Action` for row actions, `DataTable` with a `Filter.*` toolbar, and create flows in a
modal on the list page rather than a `/new` route.

- **`/staff/productions`** — `DataTable` of productions with date, title, venue, status,
  lineup summary, and settlement state. Filters for status, venue, and date range.
  `CreateProductionModal.svelte` on the list page.
- **`/staff/productions/[id]`** — `PageHeader` with the status badge and the transition
  action, then a `TabBar`:
  - **Overview** — event fields (title, description, poster, doors, times, ticketing),
    venue, producer, ops timestamps, internal notes.
  - **Run of show** — ordered slot list with inline add, reorder, recalculate set times,
    and per-slot edit in an `Action` form modal.
  - **Advance** — the `advance` and `day_of` checklists, with rider/stage-plot links
    pulled from each member band's EPK.
  - **Settlement** — the worksheet, expense table, per-slot payout rows, settle action.
  - **Close-out** — the `closeout` checklist and the close action.
- **`/staff/venues`** and **`/staff/venues/[id]`** — venue CRUD, same shape as
  `/staff/equipment`.

Remote functions go in `src/lib/remote/productions.remote.ts` and
`src/lib/remote/venues.remote.ts` — `query()` for reads, `form()`/`command()` for writes,
thin over the services.

> **Doc drift worth fixing:** CLAUDE.md and ui-patterns.md both describe colocated
> `data.remote.ts` files. No route in the app uses that — remote functions were
> centralized into `src/lib/remote/*.remote.ts`, and only one `+page.server.ts` remains in
> the whole codebase. This spec follows the code.

`StatusBadge`'s class map currently covers `draft`, `confirmed`, `completed`, `cancelled`,
and `pending`. It needs `offered`, `settled`, `closed`, `invited`, `declined`, and
`performed` added.

---

## Public surface

No new public routes. `/events/[id]` gains an optional lineup section — act names in
running order with set times — rendered when the event is published, the production is
`confirmed` or later, and at least one slot is `confirmed`. Act names link to
`/directory/bands/[slug]` only when that band is directory-visible; otherwise plain text.

---

## Notifications

New entries in the `NOTIFICATION_TYPES` registry in `db/schema/notification.ts`, all
defaulting to in-app plus email for staff:

| Key                           | Trigger                                              | Recipient                         |
| ----------------------------- | ---------------------------------------------------- | --------------------------------- |
| `production_slot_invited`     | A member band is added to a lineup and offers go out | Band admins                       |
| `production_confirmed`        | Production reaches `confirmed`                       | Band admins of confirmed slots    |
| `production_advance_due`      | 7 days before the show with open `advance` tasks     | Producer                          |
| `production_settlement_ready` | Production reaches `completed`                       | Producer and staff                |
| `production_cancelled`        | Production cancelled                                 | Band admins of non-declined slots |

External acts have no user account, so they receive nothing in-app. Emailing them from
their `directoryContact` is deferred.

---

## Permissions

Staff-only throughout — every remote function calls `requireStaff()`, and every route
calls `requireFeature('productions')`. There is no member or band-panel surface in this
phase: a band sees its booked shows only through the existing public event listing.

`'productions'` is added to the `FeatureFlag` union and `ALL_FLAGS` in
`src/lib/server/feature-flags.ts`, defaulting off like every other flag.

---

## What changes

- Five new tables; `band.claimStatus` and `event.venueId` added.
- `band-service.create()` gains an unclaimed-act path that requires an explicit
  `directoryVisibility: 'hidden'`, and `create()`/`update()` gain graceful duplicate-name
  handling via `BandNameTakenError`.
- `directory-service.bandWhereConditions()`, `loadBandProfile()`, and `getBandSiteData()`
  gain claim/visibility guards.
- `StatusBadge` learns six new statuses.
- New `productions` feature flag; new staff nav entries for Productions and Venues.
- `event.venueId` becomes the structured venue reference for productions.

## What doesn't change

- The `event` table's public shape and every existing event query.
- Ticket purchase, check-in, and refunds.
- The reservation lifecycle, conflict checking, and the recurring generation job.
- Band membership, roles, invitations, and premium microsites.
- Stripe integration — no new checkout paths, no payouts, no new webhook handlers.
- `event.location`, which remains the free-text fallback for band events.

## Deferred

- **Multi-night runs and festivals.** The 1:1 production↔event rule makes a two-night
  booking two productions. Relaxing to 1:N is a schema change, not a rewrite — drop the
  unique on `eventId`.
- **Public booking inquiries.** The IDEAS.md "Booking Request Pipeline" front door: a
  public form that lands as a `draft` production. Staff-created productions come first.
- **Recurring productions.** Weekly open mics could expand through the existing
  `recurring_series` machinery, but the lineup makes each occurrence genuinely different.
- **Stage-plot drawing.** Uploading a rider image is in scope; a canvas plot builder is
  not.
- **Emailing external acts** and threading those replies into the staff inbox.
- **Automated payouts.** Recording what was paid is in scope; disbursing through Stripe
  is not.
- **Volunteer and staffing assignment** per production, pending the volunteering module.
- **ASCAP/BMI setlist reporting**, which would need per-song data below the slot level.

## Open questions

1. **Does a claimed act keep its production history public?** An act that claims its
   profile and sets `directoryVisibility: 'public'` retroactively exposes every past
   production it played. Probably desirable — it's a gig history — but it should be a
   deliberate call, not a side effect of claiming.
2. **Who owns unclaimed bands?** This spec says a dedicated CMC service user, so that
   `purgeUser`'s "refuses to delete a band owner" guard never blocks a real staff account.
   The alternative — the creating staffer — is more informative in the staff list but
   makes that staffer un-purgeable. The service user seems right; worth confirming.
3. **Should `venue.isPrimary` be a column or config?** A boolean column allows more than
   one primary venue if the Collective ever runs a second room; a KV config key naming the
   venue id is stricter. This spec picks the column.
4. **Is `day_of` a real checklist phase or noise?** It sits awkwardly between advance and
   close-out. Merging it into `advance` would simplify the UI to two checklists.
5. **How much of settlement should be locked after `settled`?** This spec freezes the
   money fields and requires an explicit reopen. A softer version — always editable, with
   an audit trail — may suit a small collective better.
