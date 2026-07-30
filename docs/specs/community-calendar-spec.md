# Community Calendar — Phase 1: Unified Band + CMC Calendar

## Purpose

First pass of the larger community calendar vision (IDEAS.md "Community Calendar"): a
public `/calendar` page that aggregates CMC venue events (`source='cmc'`) and member
bands' events (`source='band'`) into one month view. Band events previously had no
shared public surface — they were only visible on band pages and microsites. The
calendar answers "what's happening this month" across the Collective and its member
bands, including gigs at other venues.

## Scope

**In:**

- Public `/calendar` route: desktop month grid + agenda list (agenda is the mobile view).
- Month navigation via `?month=YYYY-MM` links (prev / next / today).
- New `listPublicCalendarEvents(start, end, { includeBandEvents })` service query
  joining band name/slug.
- `getPublicCalendar` remote query in a new `src/lib/remote/calendar.remote.ts`.
- Generalized `/events/[id]` detail: band events render with a band byline linking to
  `/directory/bands/[slug]`, an external Tickets button when `externalTicketUrl` is
  set, and no internal RSVP/ticketing UI.
- Nav link in `SiteHeader`, `/calendar` in the sitemap.

**Out (deferred to later phases):**

- Community-submitted events. Extension point: a `source='community'` enum value slots
  into the same source filter in `listPublicCalendarEvents` and gets one more legend
  color — no structural change.
- Partner feed imports.
- Subscribable `.ics` / RSS feeds (the RFC-5545 helpers in `src/lib/utils/calendar.ts`
  make this cheap when wanted).

## Decisions

- **New route, not a view-toggle on `/events`.** `/events` stays the curated CMC
  poster grid; the calendar is a regional view where band gigs are often off-site.
- **No new dependencies.** Month grid + agenda are small custom components built on
  the already-installed `@internationalized/date`, reusing the Sunday-aligned
  week-building pattern from `CalendarSelect.svelte`.
- **Feature flag, soft check.** The page is always live. Band rows are included only
  when `feature.bandEvents` is enabled (`isFeatureEnabled`, not `requireFeature`).
  `getPublicEventDetail` 404s a band event when the flag is off, consistent with
  `getBandEventsPublic`.
- **All calendar entries link to `/events/[id]`.** Band microsites are
  subdomain-hosted and have no per-event detail page; the main-site detail page is the
  canonical URL for both sources.
- **Visual language:** CMC = `--cmc-orange`, band = `--cmc-teal` (dot on grid chips,
  `sticker-badge` on agenda rows). Off-site gigs are communicated by the location
  line. No gradients.
- **Moderation:** none in this phase — a band publishing an event is the existing
  gate (band admins only, behind the flag).

## Dev testing

Feature flags live in KV site-config, not in `scripts/seed-dev.ts`. To see band
events locally, enable `feature.bandEvents` via the staff settings flags UI. Seeded
band events (`seedBandEvents` in scripts/seed-dev.ts) already include published rows
with off-site locations.
