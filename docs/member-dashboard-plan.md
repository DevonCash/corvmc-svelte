# Member Dashboard — Implementation Plan

Sequenced for a solo developer working through it task by task. No new tables, no new services — this is a frontend assembly job with one small backend tweak.

---

## Epic 1: Backend data loading

Set up the server-side load function that fetches all dashboard data in parallel.

### 1.1 Add limit parameter to `listUpcoming()`

**Modify:** `src/lib/server/event/event-service.ts`

Add an optional `limit` parameter to `listUpcoming()` so the dashboard can request only 4 events without fetching the entire list. Default to no limit so the public events page is unaffected.

```typescript
export async function listUpcoming(limit?: number): Promise<EventRow[]> {
  let query = db.select().from(event)
    .where(and(eq(event.status, 'published'), gt(event.startsAt, new Date())))
    .orderBy(asc(event.startsAt));
  if (limit) query = query.limit(limit);
  return query;
}
```

**Test:** Existing event-service tests should still pass. Add one test: `listUpcoming(2)` returns at most 2 results when more exist.

### 1.2 Create dashboard load function

**Create:** `src/routes/member/+page.server.ts`

Load four data sets in parallel:

- **This week's reservations:** Query `reservation` table for `createdByUserId = user.id`, `startsAt` between Monday 00:00 and Sunday 23:59 (America/Los_Angeles), `status != 'cancelled'`, ordered by `startsAt`. Use the shared timezone utility to compute week boundaries.
- **Upcoming events:** Call `listUpcoming(4)`. Map to serialized shape with poster URLs (same pattern as the public events page load).
- **Credit balance:** Call `getAllBalances(user.id)`.
- **Subscription status:** Call `getSubscription(user.stripeId)` if the user has a stripeId, otherwise null.

For sustaining members, compute `allocatedThisMonth` (subscription quantity) and `usedThisMonth` (allocated minus remaining free_hours) — same logic as the membership page.

Return all four plus the computed fields.

**Key notes:**
- Import `getPublicUrl` and `isConfigured` from storage module for poster URLs.
- The week boundary calculation should use `startOfWeek` / `endOfWeek` in LA timezone. Use date-fns or manual calculation — check what the codebase already uses for date math.

**Test:** Test that the load function returns the expected shape. Mock the db and services. Test week boundary logic with a known date.

---

## Epic 2: Dashboard page

Build the page UI using existing shared components.

### 2.1 Create the dashboard page

**Create:** `src/routes/member/+page.svelte`

Four sections, top to bottom:

**Quick links** — a row of 3 anchor cards. Each has a tabler icon, a label, and an href. Use `IconCalendarPlus` → `/member/reservations/new`, `IconCalendarEvent` → `/events`, `IconStar` → `/member/membership`. Style as small `card bg-base-100 shadow` elements in a 3-column grid (stacking on mobile).

**This week's reservations** — wrapped in an `InfoCard` with title "This Week". Each reservation shows: day of week + date (e.g., "Wed, May 14"), time range, duration, status badge (using `StatusBadge`), and booker type icon (using `BookerTypeIcon`). If empty, show an `EmptyState` with message "No sessions booked this week" and a link to `/member/reservations/new`.

**Credit balance widget** — wrapped in an `InfoCard` with title "Practice Credits".
- Sustaining members: show free hours remaining, hours used this month, and total allocated. Use a daisyUI `progress` element to visualize usage (e.g., `<progress class="progress progress-primary" value={used} max={allocated}>`). 
- Non-sustaining members: show a brief prompt — "Become a sustaining member to get free practice hours each month" — with a `btn btn-primary btn-sm` link to `/member/membership`.

**Upcoming events** — wrapped in an `InfoCard` with title "Upcoming Events". Show up to 4 events as compact horizontal cards: poster thumbnail (small, square, or a placeholder), title, date, and time. Each links to `/events`. If empty, show an `EmptyState` with message "No events on the horizon."

**Layout:** Quick links span full width. Reservations and credits sit in a 2-column grid on desktop (`lg:grid-cols-2`, reservations in `lg:col-span-1`, credits in `lg:col-span-1`). On larger screens where reservations might have more content, consider giving reservations more space — but start equal and adjust after seeing real data. Events span full width below.

**Key notes:**
- Import formatters from `$lib/utils/format` — `formatDate`, `formatTime`, `formatDuration` (or `durationHours`).
- No form actions or mutations — the dashboard is read-only.
- Use `$derived` for computed values like `isSustaining`, `allocatedThisMonth`, etc.

### 2.2 Add Dashboard nav item

**Modify:** `src/routes/member/+layout.svelte`

Add Dashboard as the first nav item: `{ href: '/member', label: 'Dashboard', icon: IconLayoutDashboard }`. Import `IconLayoutDashboard` from `@tabler/icons-svelte`.

### 2.3 Run autofixer

Run the Svelte autofixer on the new `+page.svelte` and fix any issues.

---

## Epic 3: Tests and verification

### 3.1 Write dashboard load tests

**Create:** `src/routes/member/+page.server.test.ts` (or appropriate test location matching project convention)

Test the load function:
- Returns `weekReservations` filtered to current week only (not past, not next week).
- Excludes cancelled reservations.
- Returns `upcomingEvents` limited to 4.
- Returns `credits` object.
- Returns `subscription` as null when user has no stripeId.
- Computes `usedThisMonth` correctly (allocated minus remaining).

### 3.2 Test listUpcoming limit

**Modify:** existing event-service test file.

Add a test: seed 6 events, call `listUpcoming(4)`, assert only 4 returned, ordered by `startsAt`.

### 3.3 Verify compile

Run the dev server or build to confirm no type errors or missing imports.

---

## Dependency graph

```
Epic 1 (backend)
  └─▶ Epic 2 (dashboard page + nav)
        └─▶ Epic 3 (tests + verification)
```

Fully linear — each epic depends on the one before it.

---

## Smoke tests

1. **Sustaining member with reservations:** Log in as a sustaining member who has reservations this week. Dashboard shows quick links, this week's reservations with correct dates and statuses, credit balance with a progress bar, and upcoming events with posters. Clicking "Book a Session" goes to the booking page.

2. **Non-sustaining member with no reservations:** Log in as a regular member with no reservations this week. Quick links render. Reservations section shows the empty state with a booking link. Credit widget shows the "become a sustaining member" prompt. Events section shows whatever public events exist (or empty state).

---

## Out of scope for this plan

- Personalized event recommendations based on member interests/tags
- Recent activity feed (completed reservations, payment history)
- Band reservations on the dashboard
- Equipment loan status on the dashboard
