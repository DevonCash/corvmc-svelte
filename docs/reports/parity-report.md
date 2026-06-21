# Laravel → Svelte Parity Report

Last updated: 2026-06-13

This document tracks feature coverage between the Laravel app (corvmc-redux) and the Svelte rebuild (corvmc-svelte). Use it to plan what to build next and to avoid re-discovering gaps.

## Approach differences

The Svelte app is not a 1:1 port. Key architectural shifts:

- **Finance**: The Laravel app has a custom Order/Transaction ledger with state machines. The Svelte app replaces this with direct Stripe API integration — checkout sessions, webhook-driven fulfillment, and Stripe as the source of truth for payment state.
- **Auth**: Laravel uses Fortify/Sanctum. Svelte uses better-auth with scrypt password hashing.
- **Authorization**: Laravel uses spatie/laravel-permission with policies in the integration layer. Svelte mirrors the RBAC tables but authorization is handled via middleware and service-level checks.
- **UI framework**: Laravel uses Filament (server-driven PHP UI). Svelte uses SvelteKit with daisyUI components, bits-ui primitives, a custom DataTable, and tabler icons.

## Staff panel

| Feature                    | Laravel                              | Svelte                      | Notes                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                  | StaffDashboard page                  | ✅ +page.svelte             | Basic stats in both                                                                                                                                                                                                                                                                                               |
| Users list + detail        | UserResource + pages                 | ✅ Full CRUD                | List, detail with role/note editing, soft-delete deactivate/reactivate (cancels future reservations) + hard purge for deactivated users (guards owned bands)                                                                                                                                                      |
| Reservations list + detail | SpaceManagement resource             | ✅ Full CRUD                | Create, resolve, confirm, cancel, no-show, cash-received, day-grouped table                                                                                                                                                                                                                                       |
| Events list + detail       | EventResource                        | ✅ Full CRUD                | List, create, detail with edit form, poster upload, rebook detection, ticketing config                                                                                                                                                                                                                            |
| Ticket check-in            | TicketCheckIn page                   | ✅ Staff check-in           | Search + check in tickets at the door                                                                                                                                                                                                                                                                             |
| Space closures             | SpaceClosures resource               | ✅ List + create + delete   | Parity                                                                                                                                                                                                                                                                                                            |
| Settings                   | ManageOrganizationSettings           | ✅ Settings page            | Hourly rate, buffer, hours; Laravel has more org settings                                                                                                                                                                                                                                                         |
| Subscription status sync   | — (new)                              | ✅ Settings → Subscriptions | Staff-triggered batch reconcile of every user/band subscription status from Stripe. Status snapshot only — never touches credit balances. Backfill after migration + missed-webhook safety net                                                                                                                    |
| Payments view              | OrderResource, TicketOrders          | ✅ /staff/payments          | Cached Stripe Payment Records (cash + credit-covered). Filterable list + per-user table on user detail page                                                                                                                                                                                                       |
| Recurring reservations     | RecurringReservations resource       | ✅ /staff/recurring         | List active/cancelled series, cancel action. Member UI in reservations page                                                                                                                                                                                                                                       |
| Bands                      | BandResource (via tenancy)           | ✅ /staff/bands             | List, detail, create, edit, remove members, transfer ownership, soft-delete deactivation/reactivation                                                                                                                                                                                                             |
| Email marketing            | — (new)                              | ✅ Immediate send           | Audiences, campaigns (draft/send-now), markdown editor with live preview, broadcast via Postmark. Per-audience opt-out + global suppression (Postmark bounce/complaint webhook → `subscriber.suppressedAt`) + one-click `List-Unsubscribe`. Scheduled send built but deferred (UI hidden) pending a cron trigger. |
| Equipment                  | Equipment resource                   | ✅ Full flow                | Catalog, categories, loans (request/schedule/checkout/return/cancel), equipment credits, seed data                                                                                                                                                                                                                |
| Volunteering               | VolunteerReportPage, PendingHourLogs | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Sponsors                   | Sponsors resource                    | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Site pages / CMS           | SitePages with block builder         | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Venues                     | Venues resource                      | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Kiosk devices              | KioskDevices resource                | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Activity log               | ActivityLog resource                 | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Reports                    | Reports resource                     | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Content flags / moderation | — (new)                              | ✅ /staff/flags             | Members report member/band profiles from directory; staff triage queue (list + detail, resolve/dismiss with notes). Gated behind `contentFlags` flag (off by default). New flags notify all staff in-app                                                                                                          |
| Bylaws                     | Bylaws resource                      | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Revisions                  | Revisions resource                   | —                           | Not started                                                                                                                                                                                                                                                                                                       |
| Help authoring + guide     | — (new)                              | ✅ +manual content          | `/staff/help` create/edit; static-vs-dynamic articles. Staff Guide manual authored (`src/content/help/staff-guide/`, `minRole=staff`) — full operations coverage; see `docs/manual/README.md`                                                                                                                     |

## Member panel

| Feature                   | Laravel                         | Svelte               | Notes                                                                                                                                                                                                   |
| ------------------------- | ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                 | MemberDashboard                 | ✅ +page.svelte      | Quick links, this week's reservations (incl. band), credit balance widget, upcoming events, pending band invitation banner                                                                              |
| Membership / subscription | MyMembership page               | ✅ Full flow         | Sliding scale, Stripe checkout, credit balance, benefits grid                                                                                                                                           |
| Reservations              | Reservations resource + widgets | ✅ List + book + pay | New reservation flow with conflict checking, Stripe checkout                                                                                                                                            |
| Account settings          | MyProfile, MyAccount pages      | ✅ Full flow         | Profile editing, password change (modal), account deletion with password confirmation, email list subscriptions                                                                                         |
| My orders                 | MyOrders page                   | —                    | May become "payment history" pulling from Stripe                                                                                                                                                        |
| My tickets                | MyTickets page + Livewire       | ✅ Full flow         | Upcoming/past split, ticket codes, status badges                                                                                                                                                        |
| Member event detail       | EventDetail Livewire            | ✅ Enriched          | Capacity bar + urgency, sustaining-member upsell, per-ticket QR stubs, add-to-calendar (Google/.ics) + share, location, "more shows"; RSVP join table for non-ticketed events (`event_rsvp`)            |
| Equipment loans           | Equipment resource (nested)     | ✅ Full flow         | Browse catalog, request loans (specific + free-form), my loans with cancel                                                                                                                              |
| Bands                     | Bands resource                  | ✅ Full flow         | My Bands list, create band, accept/decline invitations                                                                                                                                                  |
| Help / Knowledge base     | — (new)                         | ✅ +manual content   | `/member/help` KB with search, categories, TOC. User manual authored as static markdown in `src/content/help/` (synced via `pnpm help:sync`) — full member & band coverage; see `docs/manual/README.md` |
| Volunteer hours           | SubmitHoursPage, VolunteerPage  | —                    | Not started                                                                                                                                                                                             |

## Band panel

The band panel uses a per-band layout at `/band/[slug]/` with role-gated navigation. Laravel uses Filament tenancy; Svelte uses a layout-level auth check with `getUserRole` + `hasAnyRole` for staff bypass.

| Feature              | Laravel                   | Svelte               | Notes                                                                                      |
| -------------------- | ------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| Band dashboard       | BandDashboard             | ✅ +page.svelte      | Stat cards, upcoming reservations list                                                     |
| Band members         | BandMembers resource      | ✅ Full flow         | Invite (user search), remove, revoke, update role/position, transfer ownership, leave band |
| Band reservations    | BandReservations resource | ✅ Full flow         | List (upcoming/past tabs), book session (reuses slot/conflict system), cancel              |
| Band profile editing | EditBandProfile page      | ✅ Full flow         | Name, bio, avatar upload/remove via REST endpoint + R2 storage                             |
| Band settings        | —                         | ✅ Settings page     | Owner-only, delete band with confirmation (cascades reservations + avatar)                 |
| Band creation        | RegisterBand tenancy page | ✅ Modal on My Bands | Create band from member panel                                                              |
| Invitations          | AcceptInvitationPage      | ✅ On My Bands page  | Accept/decline with `.for()` pattern                                                       |

## Public pages

| Feature                 | Laravel              | Svelte                            | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home                    | web.php route        | ✅ +page.svelte                   | Parity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Events listing          | EventsGrid Livewire  | ✅ +page.svelte                   | Parity                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| About                   | web.php route        | —                                 | Not started                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Contact form            | ContactForm Livewire | ✅ /contact                       | Creates an inbox thread (web channel). Cloudflare Turnstile bot protection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Bot protection          | — (new)              | ✅ Cloudflare Turnstile           | Gates the three public forms — sign-up (better-auth `/sign-up/email` before-hook reads `x-turnstile-token`), contact, and subscribe (remote `form()` handlers verify a `turnstileToken` field). Widget via `svelte-turnstile`; server `verifyTurnstile` helper hits siteverify. `PUBLIC_TURNSTILE_SITE_KEY` (wrangler vars) + `TURNSTILE_SECRET_KEY` (Worker secret); falls back to Cloudflare test keys when unset.                                                                                                                                                     |
| Ticket purchase         | TicketPurchaseWidget | ✅ Full flow                      | Purchase page, Stripe checkout, sustaining member discount, success page with ticket codes                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Email subscribe         | — (new)              | ✅ /subscribe + /subscribe/[slug] | Public opt-in for audiences with allowOptIn flag                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Email unsubscribe       | — (new)              | ✅ /unsubscribe/[token]           | HMAC-signed unsubscribe — GET friendly page + POST one-click (RFC 8058)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Member directory        | MembersGrid Livewire | ✅ /directory + /member/directory | Two-tier directory (members-only + public opt-in). Rich profiles with bio, tagline, instruments, genres, links w/ embeds (YouTube, SoundCloud, Spotify), looking-for-band/members flags, contact info. Filtering by instruments, genres, status. Member + band profile edit pages.                                                                                                                                                                                                                                                                                       |
| Directory profile pages | — (redesign)         | ✅ Unified component set          | Member & band, public & authenticated profiles all compose one set of 9 parameterised components (`src/lib/components/shared/directory/profile/`): ProfileHeader, QuickFacts, ProseBlock, ListenStrip (switchable embed), ShowsBox (band own + member aggregated-across-bands, with past-show counts), CrossRefList (bands↔members, locked private rows in public), TagCloud, LinksBox (streaming ribbon + web rows), ContactBox. Avatar convention: member = round, band = square (`EntityAvatar`). Adds `user.memberNumber`/`hometown`, `band.hometown`/`foundedYear`. |

## Platform infrastructure

Cross-cutting concerns that Laravel provides out of the box and the Svelte app needs to build up.

### Notification system

The Svelte app uses two channels — Postmark for email and a database-backed in-app notification system with bell dropdown + SSE real-time delivery. Members configure which notification types reach them via email/in-app toggles in account settings. SMS (Twilio) is deferred — can be added as a third channel later. This replaces Laravel's 43 notification classes (of which only ~13 were actually wired; the rest were dead code).

| Concern              | Laravel                                 | Svelte                           | Notes                                                                                                                                                                             |
| -------------------- | --------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email transport      | Laravel Mail (SMTP/SES)                 | ✅ Postmark                      | `postmark` SDK; transactional bodies are Postmark-hosted templates (repo source in `postmark/templates`, pushed via `pnpm email:push`). See `docs/postmark-template-migration.md` |
| SMS                  | — (not implemented)                     | —                                | Deferred; channel architecture supports adding Twilio later                                                                                                                       |
| In-app notifications | Database channel + Filament bell        | ✅ Bell + SSE                    | Persistent `notification` table, bell dropdown in sidebar, SSE real-time push                                                                                                     |
| User preferences     | —                                       | ✅ notification_preference table | Per-user, per-notification-type channel toggles on account page                                                                                                                   |
| Domain event bus     | `event()` dispatcher + 40 event classes | ✅ emittery                      | Typed event map, async listeners, replaces old callback registry                                                                                                                  |
| Auth emails          | Fortify (verification, password reset)  | Via better-auth                  | better-auth handles these natively                                                                                                                                                |
| Ticket emails        | —                                       | ✅ Via notification system       | Confirmation, cancellation, reminder — routed through dispatcher                                                                                                                  |

#### Laravel notification audit

Of 43 notification classes in the Laravel app, only ~13 were actually wired and sending. The rest were aspirational dead code. This breakdown informed what the Svelte app should build:

**Actually sending in production:**

- ✅ Reservation reminder (upcoming) — event + listener + cron endpoint wired
- ✅ Reservation confirmation reminder (unconfirmed bookings) — event + listener + cron endpoint wired
- Daily admin reservation digest — could be a dashboard widget instead of email; TBD
- Rehearsal attendance request — deferred until rehearsal module enhancements
- Rehearsal reminder — deferred until rehearsal module enhancements
- ✅ Band invitation — emitted from band-service.invite(), email + in-app
- ✅ Band invitation accepted — emitted from band-service.acceptInvitation(), email + in-app to admins
- User/platform invitation — invite with token link
- ✅ Contact form submission — emitted from contact.form_submitted event, forwards to staff email

**Previously unbuilt but clearly needed (now built):**

- ✅ Ticket purchase confirmation — emitted from checkout listener after fulfillment, email to buyer
- ✅ Event cancellation to ticket holders — emitted from event-service.cancel(), email + in-app per holder
- Event reschedule to ticket holders — not yet wired (needs event update detection)

**Never wired and probably not needed:**

- Event created/published/cancelled to organizer — self-confirmation noise; they just did the action
- Membership renewal reminders — Stripe already sends subscription renewal emails natively
- Membership expired / welcome / deactivated — never finished, low-signal
- Reservation created/confirmed/cancelled lifecycle — the member just took the action in-app; a toast is sufficient
- Moderation notifications — deferred until moderation module is built
- Volunteering notifications — deferred until volunteering module is built

### Scheduled jobs

Individual `/api/cron/*` routes, each hit by the hosting platform's cron scheduler. No in-app scheduler or job table — Sentry Crons handles pass/fail tracking and missed-run alerts.

| Job                              | Schedule      | Svelte                                       | Notes                                                                                                       |
| -------------------------------- | ------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Auto-complete reservations       | Every few min | ✅ /api/cron/auto-complete                   |                                                                                                             |
| Lock code provisioning           | Daily         | ✅ /api/cron/lock-access                     |                                                                                                             |
| Confirmation reminders           | Daily 09:00   | ✅ /api/cron/confirmation-reminders          | Emits `reservation.confirmation_reminder_due` for unconfirmed (scheduled) reservations starting in next 24h |
| Reservation reminders            | Daily 10:00   | ✅ /api/cron/reservation-reminders           | Emits `reservation.reminder_due` for confirmed reservations starting in next 24h                            |
| Daily reservation digest         | Daily 20:00   | —                                            | Could become a dashboard widget                                                                             |
| Rehearsal reminders              | Daily 09:30   | —                                            | Depends on notification system + band rehearsals                                                            |
| Recurring reservation generation | Daily 00:00   | ✅ /api/cron/generate-recurring-reservations | Expands active recurring series into scheduled reservations within 2.5-week window                          |
| Send scheduled campaigns         | Every few min | ✅ /api/cron/send-campaigns                  | Finds due campaigns (scheduledFor ≤ now, sentAt IS NULL) and executes send                                  |
| Volunteer shift reminders        | Daily 09:00   | —                                            | Deferred until volunteering module is built                                                                 |

**Removed from Laravel's list:**

- Monthly credit allocation — handled by `invoice.paid` webhook in the Svelte app, not a cron job
- Credit expiration — credits reset on subscription cancellation via `customer.subscription.deleted` webhook; no time-based expiry
- Stripe reconciliation — unnecessary; Stripe is the source of truth, not a secondary ledger to verify
- Stale checkout sweep — Stripe expires sessions automatically; the Laravel job existed to clean up local Order/Transaction records which the Svelte app doesn't have
- Membership reminders — was a no-op in Laravel (notify call commented out); Stripe handles renewal emails natively

### Event-driven architecture

Services fire typed domain events via Node's built-in `EventEmitter`. Listeners handle side effects (notifications, activity logging, cross-module reactions). Wiring is explicit in a registration file. This replaces Laravel's 40 event classes + 15 listener classes with a lighter-weight equivalent — typed event payloads instead of event classes, listener functions instead of listener classes.

| Concern               | Laravel                                         | Svelte                    | Notes                                                                                                      |
| --------------------- | ----------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Event bus             | `event()` dispatcher + 40 event classes         | ✅ `emittery`             | Typed event map, async-native, single emitter instance, listeners registered at startup in hooks.server.ts |
| Checkout fan-out      | Part of event/listener system                   | ✅ Via emittery           | Migrated from callback registry to domain event bus                                                        |
| Notification dispatch | Listeners call `$user->notify()`                | ✅ Dispatcher + listeners | Listeners check user preferences, route to email (Postmark) and in-app channels                            |
| Activity logging      | 6 activity-log listeners via spatie/activitylog | —                         | Not started; lower priority                                                                                |
| Lock code management  | Queued listeners on reservation confirm/cancel  | ✅ Cron-based             | Different approach — cron provisions daily instead of per-event                                            |

### Background processing

Laravel uses a Redis/database job queue for async notification sends and lock code provisioning. The Svelte app doesn't need a full job queue — Postmark and Twilio API calls are fast enough to fire-and-forget from event listeners, and the lock code work is already handled via cron.

Event listeners that call external APIs (Postmark, Twilio) should not block the request. Listeners can fire the API call without awaiting it, or use `waitUntil()` on the hosting platform if available. If fan-out to many recipients becomes a latency problem (e.g., notifying all ticket holders of event cancellation), that's the point to consider a queue — not before.

### Authorization

| Concern                | Laravel                                 | Svelte                             | Notes                                                       |
| ---------------------- | --------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Role/permission tables | spatie/laravel-permission (polymorphic) | ✅ Drizzle schema                  | Simplified from morph to direct user FK                     |
| Role checking          | `$user->hasRole()`, middleware          | ✅ hasRole/hasAnyRole/requireStaff | Utility functions in authorization.ts                       |
| Policies               | 20 policy classes in app/Policies       | —                                  | No formal policy layer; checks are inline in route handlers |
| Route-level guards     | Filament panel auth + middleware        | Ad-hoc                             | Each route calls requireStaff() or checks roles manually    |

### Observers / model hooks

Laravel has 5 observers (Reservation, Event, User, SpaceClosure, Tag) handling cache invalidation, cascading side effects, and notification dispatch. The Svelte app handles these inline in services. This is intentional — explicit calls in services are easier to trace than implicit observer hooks.

## API / background

| Feature                    | Laravel                   | Svelte                     | Notes                                                          |
| -------------------------- | ------------------------- | -------------------------- | -------------------------------------------------------------- |
| Stripe webhooks            | Cashier + custom handlers | ✅ /api/stripe/webhook     | checkout.session.completed, invoice.paid, subscription.deleted |
| Auto-complete reservations | Scheduled command         | ✅ /api/cron/auto-complete |                                                                |
| Lock access                | Kiosk module              | ✅ /api/cron/lock-access   |                                                                |
| Event poster serving       | Media library             | ✅ /api/events/[id]/poster |                                                                |
| Band avatar upload         | Media library             | ✅ /api/bands/[id]/avatar  |                                                                |

## Database schema

The Svelte app has 29 tables: auth (user, session, account, verification), authorization (permission, role, model_has_permission, model_has_role, role_has_permission), reservations (reservation, closure, recurring_series), events (event), finance (product_config, credit_transaction, payment_cache), bands (band, band_member), tickets (ticket), notifications (notification, notification_preference), marketing (subscriber, audience, audience_member, campaign, campaign_audience), and equipment (equipment_category, equipment, equipment_loan).

Tables that would need to be added for missing features: volunteer_hour_log, sponsor, venue, site_page, kiosk_device.

## Library decisions

Chosen libraries for platform concerns. Preference is for small, focused packages over frameworks.

| Concern              | Library                          | Why                                                                                                                                                                                               |
| -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email transport      | `postmark`                       | Official SDK, well-typed, direct integration                                                                                                                                                      |
| Email templates      | MJML or Maizzle                  | MJML is battle-tested; Maizzle uses Tailwind (matches existing tooling). Decide when building. Both compile to static HTML for Postmark                                                           |
| SMS                  | `twilio`                         | Official SDK, reliable, overkill for SMS-only but actively maintained                                                                                                                             |
| Domain event bus     | `emittery`                       | Async-native (listeners can do I/O without blocking), strong TypeScript generics, ESM-only (fine for SvelteKit)                                                                                   |
| Recurrence rules     | `rrule`                          | RFC 5545 RRULE parsing/generation with timezone support via luxon. Used for recurring reservation scheduling                                                                                      |
| Error tracking       | `@sentry/sveltekit`              | First-class SvelteKit integration, auto-instruments load functions and routes. Also provides Sentry Crons for scheduled job monitoring                                                            |
| Image crop/resize    | `svelte-easy-crop` (client-side) | Browser-based crop UI + canvas resize before upload. User selects and frames the image, client resizes to target dimensions, uploads the processed result. No server-side image processing needed |
| File uploads         | `@aws-sdk/client-s3` (existing)  | Hand-rolled R2 integration is sufficient. Add `@aws-sdk/s3-request-presigner` if client-direct uploads are needed later                                                                           |
| In-app notifications | Hand-rolled                      | Postgres `notification` table via Drizzle, SSE from SvelteKit `+server.ts` for real-time delivery. Novu/Knock are overkill and have React-only client components                                  |
| Background work      | Detached promises                | Fire-and-forget with `.catch()` piped to Sentry. Add `p-queue` if concurrency control is needed later. No Redis/BullMQ                                                                            |

**Not using:**

- `sharp` — native binary, incompatible with Cloudflare Workers
- `svelte-email` — abandoned (last update 2023)
- `@react-email/render` — adds React as a dependency for email templates
- `uploadthing` — stale Svelte support, adds hosted service dependency
- Novu / Knock — hosted notification platforms with React-only UI, overkill for this app
- BullMQ — requires Redis, unnecessary when detached promises suffice

## Feature flags

Features that exist in the Svelte app but not in the Laravel production app are gated behind KV-backed feature flags. All flags default to **off** and can be toggled from Staff Settings > Features.

| Flag             | Feature                                    | Routes gated                                                             |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `staffInbox`     | Multi-channel unified inbox                | `/staff/inbox/**`, `/api/inbox/postmark`, `/api/inbox/twilio`            |
| `bandPremium`    | Premium tier, page editor, EPK, band sites | `/band/[slug]/page-editor`, `/band/[slug]/subscription`, `/band-site/**` |
| `emailMarketing` | Audiences, campaigns, broadcasts           | `/staff/marketing/**`, `/subscribe/[slug]`, `/api/cron/send-campaigns`   |
| `equipment`      | Equipment catalog, loans, credits          | `/staff/equipment/**`, `/member/equipment/**`                            |
| `helpArticles`   | Help center for staff and members          | `/staff/help/**`, `/member/help/**`, `/api/help/**`                      |

Implementation: `src/lib/server/feature-flags.ts` reads `feature.*` keys from the site config KV store. Navigation items are conditionally rendered in panel layouts. Route data queries call `requireFeature()` which throws 404 when disabled.

## Suggested build order

Features are grouped by dependency. The notification system is foundational — many features need to send notifications, so it comes first.

1. ~~**Notification system**~~ — ✅ Complete. Postmark email + in-app (database + bell + SSE). emittery domain event bus. User preference UI in account settings. Ticket, event, band, and contact form notifications wired. SMS channel deferred.
2. ~~**Reminder cron jobs**~~ — ✅ Complete. Two cron endpoints: `/api/cron/reservation-reminders` (confirmed, daily 10:00) and `/api/cron/confirmation-reminders` (scheduled/unconfirmed, daily 09:00). Both query next-24h reservations, emit domain events, and have full test coverage.
3. ~~**Stripe payments view**~~ — ✅ Complete. Local `payment_cache` table, populated on cash/credit payment creation. Staff list page with filters + per-user table on user detail. Stripe Payment Record IDs link to dashboard.
4. ~~**Recurring reservations**~~ — ✅ Complete. `recurring_series` table with prototype pattern, `rrule` npm package for RFC 5545 scheduling. Generation cron expands series into concrete reservations within 2.5-week window. Sustaining member exclusive. Subscription lapse auto-cancels active series. Staff list page + member booking integration with recurring tab.
5. ~~**Email marketing**~~ — ✅ Complete. Audiences with opt-in control, campaigns with markdown editor + live preview, broadcast sending via Postmark, public subscribe pages, member account subscriptions, HMAC-signed unsubscribe links, send-campaigns cron.
6. ~~**Equipment module**~~ — ✅ Complete. Three tables (equipment_category, equipment, equipment_loan). Staff catalog + category management, loan lifecycle (request/schedule/checkout/return/cancel), member catalog browsing + loan requests (specific + free-form), equipment credits (1:1 with subscription, deducted on return), pricing tiers (major $5/day, accessory $1/day, sustaining members get free accessories).
7. ~~**Bands module**~~ — ✅ Complete. Schema, service, member panel, band panel, dashboard integration, public directory.
8. **Volunteering module** — New tables (volunteer_hour_log). Hour submission, approval workflow, reporting.
9. ~~**Tickets**~~ — ✅ Complete. Schema, service, public purchase with Stripe checkout, staff check-in, member My Tickets, email stubs.
10. **Everything else** — Sponsors, CMS, venues, kiosk, activity log, reports, bylaws.
