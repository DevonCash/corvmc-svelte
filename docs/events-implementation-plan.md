# Events — Implementation Plan

Sequenced for a solo developer working through it PR by PR. Each epic builds on the previous one.

---

## Epic 1: R2 Storage Foundation

Set up Cloudflare R2 as a generic file storage layer. This comes first because the event poster upload depends on it, and the storage module is reusable for future uploads.

### 1.1 Add dependencies

Install `@aws-sdk/client-s3`. Add R2 env vars to `.env.example`.

**Env vars:**
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL` — the public access base URL for the bucket (direct, no transforms)
- `R2_TRANSFORM_URL` — optional, Cloudflare Image Transformations base URL. When set, `getPublicUrl()` serves images through the transform pipeline (resized, webp). When unset, serves originals directly from `R2_PUBLIC_URL`.

### 1.2 Create storage module

**File:** `src/lib/server/storage.ts`

Create an S3 client configured for R2 (`https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` as the endpoint). Export three functions:

- `uploadFile(buffer: ArrayBuffer, key: string, contentType: string): Promise<string>` — validates file size (≤5MB) and content type (must be `image/jpeg`, `image/png`, or `image/webp`), uploads to R2, returns the key.
- `deleteObject(key: string): Promise<void>` — deletes an object from R2. No-ops if the object doesn't exist.
- `getPublicUrl(key: string): string` — if `R2_TRANSFORM_URL` is set, returns `${R2_TRANSFORM_URL}/width=1200,format=webp/${key}`. Otherwise returns `${R2_PUBLIC_URL}/${key}`.

The S3 client should be lazily initialized (created on first use) so the app doesn't fail on startup if R2 env vars aren't set (dev environments without R2). Uses `ArrayBuffer` instead of Node `Buffer` for Cloudflare Workers compatibility.

**Test:** Unit test with mocked S3 client verifying validation rejects oversized/wrong-type files, correct content type is set, and key is returned. Test `getPublicUrl` returns transform URL when configured, direct URL when not.

---

## Epic 2: Event Schema and Service

The data model and core business logic. Everything else depends on this.

### 2.1 Create event schema

**File:** `src/lib/server/db/schema/event.ts`

```
event table:
  id            uuid PK, defaultRandom
  title         text, not null
  description   text, nullable
  startsAt      timestamp with tz, not null
  endsAt        timestamp with tz, not null
  doorsAt       timestamp with tz, nullable
  status        text, not null, default 'draft'
  publishedAt   timestamp with tz, nullable
  reservationId uuid, nullable, references reservation.id
  posterKey     text, nullable
  tags          text, nullable (comma-separated)
  createdByUserId text, not null, references user.id
  createdAt     timestamp with tz, not null, defaultNow
  updatedAt     timestamp with tz, not null, defaultNow

Indexes:
  idx_event_status_starts on (status, startsAt) — public listing query
  idx_event_reservation on (reservationId) — lookup by linked reservation

Checks:
  event_time_order: ends_at > starts_at
```

Export the table from `src/lib/server/db/schema/index.ts`.

### 2.2 Run migration

Generate and apply the drizzle migration: `pnpm drizzle-kit generate` then `pnpm drizzle-kit migrate`.

### 2.3 Create event service

**File:** `src/lib/server/event/event-service.ts`

**Types** (can live in same file or a sibling `types.ts`):

```typescript
interface CreateEventParams {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  doorsAt?: Date;
  tags?: string;
  createdByUserId: string;
  // Optional reservation linkage
  reservation?: {
    startsAt: Date;
    endsAt: Date;
    overrideConflicts: boolean;
  };
  // Optional poster
  posterFile?: { buffer: ArrayBuffer; contentType: string };
}
```

**Functions:**

- `create(params: CreateEventParams): Promise<EventRow>` — inserts the event. If `reservation` is provided, calls `staffCreate()` from reservation-service with `bookerType: 'event'`, `bookerId: event.id`, then updates the event's `reservationId`. If `posterFile` is provided, uploads via `uploadFile()` to key `events/posters/${event.id}` (extension from content type) and sets `posterKey`. Uses a transaction for the event insert + reservation create so both succeed or both fail. The `reservation` param includes an `overrideConflicts` boolean — when false, runs `hasConflict()` inside the transaction and throws if conflicts exist; when true, skips the check (staff override).

- `update(eventId: string, params: UpdateEventParams): Promise<EventRow>` — updates mutable fields (title, description, startsAt, endsAt, doorsAt, tags). If a new `posterFile` is provided, deletes the old poster (if any) and uploads the new one. Cannot update reservation times after creation (that's a cancel-and-rebook concern, deferred).

- `publish(eventId: string): Promise<void>` — atomic conditional update: `UPDATE event SET status = 'published', publishedAt = now() WHERE id = ? AND status = 'draft'`. Throws if rowCount is 0.

- `cancel(eventId: string, userId: string): Promise<void>` — atomic conditional update to `cancelled`. If the event has a `reservationId`, cancels the linked reservation via `reservation-service.cancel()` with `staffOverride: true`. Deletes the poster from R2 if present.

- `getById(eventId: string): Promise<EventRow | null>` — single event lookup, joins user for creator name.

- `listUpcoming(): Promise<EventRow[]>` — published events where `startsAt > now()`, ordered by startsAt asc. For the public listing.

- `listAll(): Promise<EventRow[]>` — all non-cancelled events for staff, ordered by startsAt desc.

**Key notes:**
- The `create` function must create the event first (to get the ID for `bookerId`), then create the reservation, then update the event with the `reservationId`. All in one transaction.
- `cancel` must handle the case where the linked reservation is already cancelled (reservation-service.cancel will throw — catch and ignore).

**Test:** Unit tests for publish (draft→published works, published→published throws), cancel (cancels reservation, deletes poster), create (with and without reservation).

---

## Epic 3: Staff Events UI

Staff CRUD pages for managing events. Depends on Epic 2.

### 3.1 Staff events list page

**Files:**
- `src/routes/staff/events/+page.server.ts` — loads all events via `listAll()`
- `src/routes/staff/events/+page.svelte` — DataTable with columns: title, date/time, status (StatusBadge), tags, actions

Table should show: title, startsAt formatted in PT, status badge (draft/published/cancelled), tags as small badges, and a link to the detail page.

Add "Events" to the sidebar nav in `src/lib/components/staff/Sidebar.svelte` (or the layout's navItems array — it's in `staff/+layout.svelte`).

### 3.2 Create event page

**Files:**
- `src/routes/staff/events/new/+page.svelte` — form page
- `src/routes/staff/events/new/data.remote.ts` — `createEvent` form handler

**Form fields:**
- Title (text, required)
- Description (textarea, optional)
- Event date (date picker)
- Start time / end time (time selects, same pattern as reservation create)
- Doors time (time select, optional)
- Tags (text input, comma-separated)
- Poster image (file input, accept image/jpeg,image/png,image/webp)
- "Reserve space" toggle → shows reservation time fields when enabled:
  - Reservation start time / end time (defaults to event times but independently adjustable)

When "Reserve space" is toggled on and reservation times are set, the form calls a `checkEventConflicts` query (in `data.remote.ts`) that runs `getConflictDetails()` and `getValidationWarnings()` from conflict-service — same pattern as the staff reservation CreateModal. If conflicts exist, display them as warnings with details (conflicting reservation holder or closure reason). The submit button changes to "Create with Override" to make the override explicit. The `overrideConflicts` flag is passed through to `event-service.create()`.

The form handler reads the file from the form submission as an `ArrayBuffer` and passes to `event-service.create()`. Uses `buildDateInTz` for all time construction.

Auth: `requireStaff()` in the form handler and the conflict check query.

### 3.3 Event detail/edit page

**Files:**
- `src/routes/staff/events/[id]/+page.server.ts` — loads event by ID with creator info and linked reservation details
- `src/routes/staff/events/[id]/+page.svelte` — detail view with edit capability
- `src/routes/staff/events/[id]/data.remote.ts` — `updateEvent`, `publishEvent`, `cancelEvent` command handlers

**Detail view shows:**
- Event info (title, description, times, status, tags)
- Poster image preview (if present)
- Linked reservation card (if present) with link to reservation detail page
- Creator info

**Actions:**
- Edit button → inline edit mode or edit modal for title/description/times/tags/poster
- Publish button (visible when status is draft)
- Cancel button with confirmation (visible when not cancelled)

Auth: `requireStaff()` on all command handlers.

### 3.4 Add nav item

Add `{ href: '/staff/events', label: 'Events', icon: '...' }` to the `navItems` array in `src/routes/staff/+layout.svelte`. Use a calendar/event-style SVG path.

---

## Epic 4: Public Events Listing

A public page showing upcoming published events. No auth required.

### 4.1 Public events page

**Files:**
- `src/routes/events/+page.server.ts` — loads upcoming published events via `listUpcoming()`, maps posterKey to public URL via `getPublicUrl()`
- `src/routes/events/+page.svelte` — card grid of upcoming events

Each card shows: poster image (if present, with fallback), title, date/time, doors time (if set), tags, and description preview (truncated).

No layout guard needed — this is a public route outside the `/member` and `/staff` groups.

---

## Epic 5: Verification

### 5.1 Compile check

Run `pnpm check` to verify no TypeScript errors.

### 5.2 Manual smoke test

Create an event (draft) → upload poster → publish → verify it appears on public listing → cancel → verify it disappears and linked reservation is cancelled.

---

## Dependency graph

```
Epic 1 (R2 storage)
  └──▶ Epic 2 (schema + service)
         ├──▶ Epic 3 (staff UI)
         │      └──▶ Epic 4 (public listing)
         └──▶ Epic 4 (public listing)

Epic 5 (verification) ── after all epics
```

---

## Smoke tests

1. **Full lifecycle:** Staff creates a draft event with poster and linked reservation → publishes → event appears on public page with poster image → staff cancels → event disappears from public page, linked reservation is cancelled.

2. **Event without reservation:** Staff creates event with no space reservation → publishes → appears on public page → cancel works cleanly.

---

## Out of scope for this plan

- Recurring events
- Ticket sales / RSVPs
- Event categories (beyond simple tags)
- Multi-image galleries
- Event templates
- Editing reservation times after event creation
- Member-created events
