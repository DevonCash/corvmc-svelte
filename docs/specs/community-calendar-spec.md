# Community Calendar — Phase 1: Unified Gig Guide on /events

## Purpose

First pass of the larger community calendar vision (IDEAS.md "Community Calendar"):
the public `/events` page aggregates CMC venue events (`source='cmc'`) and member
bands' events (`source='band'`) into one poster-forward gig guide. Band events
previously had no shared public surface — they were only visible on band pages and
microsites. The page answers "what's coming up" across the Collective and its member
bands, including gigs at other venues.

## Scope

**In:**

- `/events` composition, top to bottom: hero of the next 3 CMC shows as full
  `PosterCard`s → gig guide: compact `MiniCalendar` date-jumper beside a scannable
  `GigList` with a "Show more" pager.
- **GigList rows** (`src/lib/components/public/calendar/GigList.svelte`): fixed date
  block (month / day-number / weekday) · small framed poster thumb (uploaded art or
  the generated `poster-gen` pattern) · title link · "by {band}" link or CMC badge ·
  venue/time/price line. Rows group under coarse relative sections — "This Week"
  (today..+6 days), "This Month" (rest of the calendar month), "Looking Ahead";
  past-anchored rows group under their month name (`groupGigs` in
  `src/lib/utils/gig-groups.ts`).
- **Continuous pagination**: `getPublicGigGuide({ from?, offset })` returns
  20-per-page from the anchor date forward (fetches limit+1 to derive `hasMore`);
  the page appends client-side via "Show more".
- **MiniCalendar**: compact month grid with per-day dots (orange = any CMC that day,
  teal = band-only), prev/next month, today ringed. Clicking a day navigates to
  `/events?from=YYYY-MM-DD`, re-anchoring the list (works for past dates too);
  "Back to today" link appears when anchored.
- Generalized `/events/[id]` detail: band events render with a band byline linking
  to `/directory/bands/[slug]`, an external Tickets button when `externalTicketUrl`
  is set, and no internal RSVP UI.

  **Bands cannot sell through CMC.** There is no ticketing control anywhere in the
  band panel, and `createBandEventForm` / `updateBandEventForm` do not accept
  ticketing fields — the schema is the guard, since remote functions are the only
  thing standing between a POST and the database. Money for a band's gig would
  land in CMC's Stripe account with no payout path back to the band, so a band
  gig is either sold off-site via `externalTicketUrl` or not sold at all.

  Staff are a different matter: `/staff/events/[id]` has never restricted its
  ticketing toggle by source, so a staff member can ticket a band event. When one
  is ticketed the public detail page treats it like any other ticketed event —
  the buy button keys off `ticketingEnabled`, not `source`. Before Aug 2026 the
  `source === 'band'` branch short-circuited first and such an event rendered no
  buy button at all, which is a silent failure rather than a policy. Band events
  still never get the member-only RSVP path.

- Home page "Upcoming Events" section shows the same next-3 CMC posters
  (`getPublicEvents`).
- Sitemap lists `/events/[id]` detail pages (including published band events when
  the flag is on) instead of `/events/[id]/tickets`, which 404s for non-ticketed
  events.

**Out (deferred to later phases):**

- Community-submitted events. Extension point: a `source='community'` enum value
  slots into the same source filters in `listPublicCalendarEvents` /
  `listPublicUpcomingEvents` — no structural change.
- Partner feed imports; subscribable `.ics` / RSS feeds (the RFC-5545 helpers in
  `src/lib/utils/calendar.ts` make this cheap when wanted).
- Band-admin notice that published events appear on the public gig guide.
- Unified cross-source "More shows" on event detail pages (currently CMC-only).
- Per-band or per-event opt-out from the public gig guide.
- Extending the `contentFlag` moderation system to events — worth doing before the
  `bandEvents` flag turns on in production, since band events publish without staff
  review.

## Decisions

- **One page, not two.** An earlier iteration shipped a separate `/calendar` route;
  design review cut it — "Events" in the nav shouldn't imply CMC-only, and a second
  page hurt discoverability. `/calendar` was never published, so it was removed
  without a redirect.
- **List, not month grid.** A full month grid was built first and reversed: mostly
  negative space at this event density, truncated titles, and it erased the show
  poster — the main vibe-carrier. The gig list keeps rows scannable (fixed date
  column) while giving every event its art. The compact `MiniCalendar` covers the
  "what's on the 20th?" case as a date-jumper.
- **No new dependencies.** Mini-calendar and list are small custom components on the
  already-installed `@internationalized/date`.
- **Feature flag, soft check.** The page is always live. Band rows are included only
  when `feature.bandEvents` is enabled (`isFeatureEnabled`, not `requireFeature`).
  `getPublicEventDetail` 404s a band event when the flag is off, consistent with
  `getBandEventsPublic`.
- **All entries link to `/events/[id]`.** Band microsites are subdomain-hosted and
  have no per-event detail page; the main-site detail page is the canonical URL for
  both sources.
- **Visual language:** CMC = `--cmc-orange`, band = `--cmc-teal` (mini-calendar
  dots, badges/links in rows). Off-site gigs are communicated by the venue line. No
  gradients.
- **Moderation:** none in this phase — a band publishing an event is the existing
  gate (band admins only, behind the flag).

## Dev testing

Feature flags live in KV site-config, not in `scripts/seed-dev.ts`. To see band
events locally, enable `feature.bandEvents` via the staff settings flags UI or
`wrangler kv key put --binding KV --local 'site-config:feature.bandEvents' 'true'`.
Seeded band events (`seedBandEvents` in scripts/seed-dev.ts) already include
published rows with off-site locations.
