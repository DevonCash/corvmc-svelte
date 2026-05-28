# Ideas

## Not Yet Built

### Sponsor Management

Track venue sponsors and their agreements. Manage sponsor logos, tiers, and placement preferences. Sponsors could be linked to events, rooms, or the venue as a whole.

### Local Resources Directory

A public-facing directory of local music-related businesses and spaces — record shops, prominent venues, instrument/gear shops, rehearsal studios, etc. Staff-curated with categories, descriptions, and links. Helps position the venue as a community hub and cross-promotes the local music ecosystem.

### Volunteer Coordination

Manage volunteer sign-ups, shift scheduling, and hour tracking for events and venue operations. Members could browse open volunteer slots, sign up, and log hours. Staff get a dashboard to define needs per event, confirm sign-ups, and track contributions.

### Member Voting / Proposals

Formal voting system for a member-driven non-profit. Staff or board create proposals (board elections, budget priorities, policy changes, event programming) with a defined voting window. Members cast ballots, results publish automatically. Could also power a lightweight feature-request board where members upvote ideas to help prioritize development.

### Merch Consignment

Let bands list merch for sale at the venue. Track inventory, sales splits, and payouts. Ties into the existing band and payments systems.

### Event Recaps / Photo Gallery

Staff or bands upload photos after events. Builds a public archive and gives bands shareable content. Could tie into automatic poster compositing for a cohesive visual identity.

### Member Skill Tags

Let members tag themselves with skills (sound engineer, photographer, promoter). Makes it easy for bands or staff to find help — and feeds naturally into volunteer coordination.

### Sponsored Event Placement

Let sponsors buy visibility on specific events — logo on the poster, mention in email blasts, branding on the event page. More granular than venue-wide sponsorship and priced per event. Ties into sponsor management for tracking agreements and automatic poster compositing for logo placement.

### Affiliate Commissions

Partner with gear shops and music businesses in the local resources directory for referral revenue on member purchases. Track click-throughs and commissions. Turns the directory from a community resource into a revenue channel.

### Booking Request Pipeline

External bands and promoters submit booking inquiries through a public form. Staff review, negotiate, and track from inquiry to confirmed event. Replaces scattered emails with a structured pipeline.

### Tech Rider Management

Bands submit stage plots and backline requirements ahead of events. Staff match against available gear and flag gaps before load-in. Cuts down day-of surprises.

### Annual Report Generator

Pull stats across the platform — events held, members active, volunteer hours, revenue, grants received — into a formatted report for the board and funders. Non-profits need this every year.

### Community Forum / Q&A

Member forum for gear advice, technique questions, and general music knowledge sharing. Threaded discussions, searchable archive, and topic categories. Complements the classifieds for gear talk and help articles for staff-curated knowledge with peer-to-peer support.

### Musician Classifieds / Jam Board

Community bulletin board for members. Post musician-wanted ads, band openings, gear for sale/trade, and jam session invites. Lighter and more immediate than mentorship matching — a quick way to find each other.

### Member Onboarding

Guided checklist for new members: orientation scheduling, safety walkthrough sign-off, gear policy acknowledgment, key fob activation, etc. Ensures everyone starts on the same page and gives staff visibility into onboarding progress.

### Venue Maintenance Requests

Members report broken gear, room issues, or facility problems. Staff track, prioritize, and resolve them. Keeps the space in shape without relying on hallway conversations.

### Incident & Safety Log

Staff log noise complaints, safety incidents, or property damage for liability, insurance, and neighbor relations. Track resolution and spot recurring patterns. Important for a venue's long-term survival.

### Event Settlement

After an event, calculate door splits, bar revenue, and band payouts. Automates end-of-night accounting and ties into the existing payments system.

### Mentorship Matching

Pair experienced musicians with newer members by instrument, genre, or interest. Builds on member skill tags to facilitate connections and track mentorship relationships.

### Grant & Fundraising Tracker

Track grant applications, deadlines, award status, and reporting obligations. Could surface on the staff dashboard alongside donation wishlist fulfillment.

### Community Calendar

A regional music calendar with three event layers: venue events auto-populated from internal systems, community-submitted events moderated by staff, and partner feeds batch-imported from sponsors and affiliated venues. On the export side, syndicate events out to other local aggregators via standardized feeds, API, or formatted blasts — positioning the venue as a two-way hub for the local music scene.

### Club Management

Tools for member-run clubs (jazz night, open mic, songwriter circle, etc.). Each club gets a dedicated space for managing a recurring event series, a member roster, and a simplified email/announcement system for communicating with club members. Club organizers can also share resources (files, links, lesson materials) with their members, similar to the teacher panel. Builds on top of the existing event and email marketing infrastructure without requiring club organizers to use the full staff tools.

### Poster Art Repository

Artists upload poster art and templates to a shared library. Musicians browse and license artwork for their events — either for a fee paid to the artist or covered by a portion of their membership dues. Ties into automatic poster compositing so licensed art can flow directly into event poster generation.

### Member Music Store / Web Radio

Members and bands upload tracks for sale or streaming. A public-facing storefront for digital music sales and a web radio station that rotates member music. Gives bands exposure, generates revenue for artists and the venue, and feeds into ASCAP/BMI compliance tracking with a built-in play log.

### ASCAP/BMI Compliance Tracking

Track setlists and song performances for music licensing compliance. Log what gets played at events to simplify reporting to ASCAP, BMI, and SESAC. Could auto-generate required reports and track license renewal dates. Useful both for the venue itself and as a service offered to other local businesses through the local resources directory.

### Lessons / Teacher Panel

Tools for members who teach music lessons at the venue. A teacher panel for sharing resources with students, keeping lesson notes, and coordinating schedules. Could integrate with the reservation system for booking lesson rooms and with member profiles to link teachers to their specialties.

### Gear Library

Track gear donations with donor attribution, condition notes, and provenance. Members can submit acquisition requests for gear the venue doesn't have yet — like a library purchase request. Staff review, prioritize (possibly informed by member voting), and fulfill. Ties into the donation wishlist for sourcing and the equipment system for cataloging once acquired.

### Donation Wishlist

Public-facing list of items the venue needs — gear, furniture, supplies, services. Members and community can claim items they want to donate. Staff manage the list, mark items as fulfilled, and optionally acknowledge donors. Could tie into consumables inventory for recurring supply needs.

### Consumables Inventory

Track stock levels for space consumables — drumsticks, strings, cables, cleaning supplies, etc. Staff log restocks and usage, set low-stock alerts, and see spending over time. Complements the existing equipment system which covers loanable gear.

### Automatic Poster Compositing

Auto-generate event posters by compositing uploaded artwork with a branded footer containing event details (date, time, venue, ticket info) and sponsor logos. Reduces manual design work for recurring events and ensures consistent branding.

---

## Library Reference

Existing npm packages that could accelerate building these features. Grouped by area.

### Image Processing & Poster Compositing

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `sharp` | 66M | Server-side image compositing, watermarking, thumbnails, format conversion |
| `@napi-rs/canvas` | 12M | Full Canvas 2D API in Node — rich text rendering, complex layouts for poster generation |
| `satori` | 1.3M | HTML+CSS to SVG — template-driven poster design, pipe through sharp for raster output |
| `photoswipe` | 510K | Client-side lightbox for photo galleries — lightweight, touch/gesture support |

### Calendar & Scheduling

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `ical-generator` | 468K | Generate .ics feeds for event syndication |
| `node-ical` | 163K | Parse partner .ics feeds for import |
| `feed` | 1.2M | Generate RSS/Atom feeds for event syndication |
| `@event-calendar/core` | 23K | Svelte-native calendar display — day/week/month views, drag-and-drop |
| `@schedule-x/svelte` | 121K | Calendar with official Svelte adapter — modern alternative |

### Audio & Streaming

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `wavesurfer.js` | 881K | Waveform visualization + playback for music store |
| `howler.js` | 777K | Cross-browser audio playback, playlists — simpler alternative to wavesurfer |
| `music-metadata` | 1.9M | Server-side ID3/metadata extraction — feeds ASCAP/BMI compliance logs |
| `hls.js` | 5.3M | HLS playback in browsers for web radio streaming |

### Forum & Content

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `marked` | 42M | Markdown to HTML for forum posts — fast, lightweight |
| `rehype-sanitize` | 4.9M | Sanitize user-generated HTML — pair with marked |
| `minisearch` | 1.2M | Client-side full-text search for forum/help articles |

### PDF & Reporting

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `pdfkit` | 3.6M | Server-side PDF generation for annual reports |
| `puppeteer` | 10M | Render styled HTML to PDF — most flexible for complex reports |
| `chart.js` | 11.6M | Chart generation for report data visualization |

### Stage Plot & Drawing

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `konva` | 1.7M | 2D canvas with drag-and-drop shapes — stage plot builder |
| `fabric` | 796K | Canvas with object model + SVG export — heavier but more drawing features |

### Inventory & Scanning

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `html5-qrcode` | 1.1M | Camera-based barcode/QR scanning for inventory management |
| `bwip-js` | 572K | Generate barcode/QR labels for printing |

### Drag & Drop / Pipeline UI

| Package | Downloads/wk | Use |
|---------|-------------|-----|
| `svelte-dnd-action` | 134K | Svelte-native DnD — kanban boards for booking pipeline, grant tracker |

### No Good Library Found (yet)

Areas where the npm ecosystem is thin — worth revisiting periodically.

- **Voting / Ranked Choice** — no well-maintained package exists; `nanoid` can generate ballot IDs
- **Affiliate Tracking** — no turnkey solution; `nanoid` or `hashids` for referral codes, rest is custom
- **Shift Scheduling UI** — no standalone package; build on top of a calendar component

---

## Feature-Flagged (Built, Not Yet Enabled)

Features behind feature flags in `src/lib/server/feature-flags.ts`. Toggled via Staff Settings.

## Staff Inbox

**Flag:** `staffInbox`

Multi-channel unified inbox for email, SMS, and web messages. Adds an Inbox nav item to the staff sidebar with conversation list and detail views. Inbound webhooks for Postmark (email) and Twilio (SMS) are gated behind the flag.

**Routes:** `/staff/inbox`, `/staff/inbox/[id]`
**API:** `/api/inbox/postmark`, `/api/inbox/twilio`

## Band Premium

**Flag:** `bandPremium`

Premium tier system for bands with page editor, EPK, and public band sites. When enabled, band owners see a Subscription nav item. Premium-tier bands also get access to a Page Editor for their public site.

**Routes:** `/band/[slug]/subscription`, `/band/[slug]/page-editor`

## Email Marketing

**Flag:** `emailMarketing`

Audience management, campaigns, and broadcast emails. Adds a Marketing section to the staff sidebar with Campaigns and Audiences views. Includes campaign creation, editing, and a cron-based send pipeline.

**Routes:** `/staff/marketing/campaigns`, `/staff/marketing/campaigns/new`, `/staff/marketing/campaigns/[id]`, `/staff/marketing/campaigns/[id]/edit`, `/staff/marketing/audiences`, `/staff/marketing/audiences/[id]`
**API:** `/api/cron/send-campaigns`

## Equipment

**Flag:** `equipment`

Equipment catalog, loan management, and equipment credits. Adds an Equipment section to the staff sidebar with loan tracking and inventory management.

**Routes:** `/staff/equipment`, `/staff/equipment/loans`, `/staff/equipment/[id]`

## Help Articles

**Flag:** `helpArticles`

Knowledge base with staff-managed articles for members. Staff can create and edit articles; members can browse and search them. Adds a Content section to the staff sidebar and a Help section to the member sidebar.

**Routes (staff):** `/staff/help`, `/staff/help/create`, `/staff/help/[id]`
**Routes (member):** `/member/help`, `/member/help/[slug]`
**API:** `/api/help`, `/api/help/search`, `/api/help/[slug]`
