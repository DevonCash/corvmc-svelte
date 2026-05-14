# Laravel → Svelte Parity Report

Last updated: 2026-05-13

This document tracks feature coverage between the Laravel app (corvmc-redux) and the Svelte rebuild (corvmc-svelte). Use it to plan what to build next and to avoid re-discovering gaps.

## Approach differences

The Svelte app is not a 1:1 port. Key architectural shifts:

- **Finance**: The Laravel app has a custom Order/Transaction ledger with state machines. The Svelte app replaces this with direct Stripe API integration — checkout sessions, webhook-driven fulfillment, and Stripe as the source of truth for payment state.
- **Auth**: Laravel uses Fortify/Sanctum. Svelte uses better-auth with scrypt password hashing.
- **Authorization**: Laravel uses spatie/laravel-permission with policies in the integration layer. Svelte mirrors the RBAC tables but authorization is handled via middleware and service-level checks.
- **UI framework**: Laravel uses Filament (server-driven PHP UI). Svelte uses SvelteKit with daisyUI components, a custom DataTable, and tabler icons.

## Staff panel

| Feature | Laravel | Svelte | Notes |
|---------|---------|--------|-------|
| Dashboard | StaffDashboard page | +page.svelte | Basic stats in both |
| Users list + detail | UserResource + pages | Full CRUD | Svelte has list, detail with role/note editing |
| Reservations list + detail | SpaceManagement resource | Full CRUD | Svelte has create, resolve, confirm, cancel, no-show, cash-received, day-grouped table |
| Events list + detail | EventResource | List + detail + create | Svelte missing: edit event, delete event, poster upload |
| Space closures | SpaceClosures resource | List + create + delete | Parity |
| Settings | ManageOrganizationSettings | Settings page | Svelte has hourly rate, buffer, hours; Laravel has more org settings |
| Orders / finance | OrderResource, TicketOrders | — | Not needed: Svelte uses Stripe directly. May want a "payments" view that reads from Stripe API |
| Recurring reservations | RecurringReservations resource | — | Not started |
| Equipment | — (resource exists) | — | Not started |
| Volunteering | VolunteerReportPage, PendingHourLogs | — | Not started |
| Sponsors | Sponsors resource | — | Not started |
| Site pages / CMS | SitePages with block builder | — | Not started |
| Venues | Venues resource | — | Not started |
| Kiosk devices | KioskDevices resource | — | Not started |
| Activity log | ActivityLog resource | — | Not started |
| Reports | Reports resource | — | Not started |
| Bylaws | Bylaws resource | — | Not started |
| Revisions | Revisions resource | — | Not started |

## Member panel

| Feature | Laravel | Svelte | Notes |
|---------|---------|--------|-------|
| Membership / subscription | MyMembership page | Full flow | Svelte has sliding scale, Stripe checkout, credit balance, benefits grid |
| Reservations | Reservations resource + widgets | List + book + pay | Svelte has new reservation flow with conflict checking, Stripe checkout |
| Dashboard | MemberDashboard | — | Not started |
| Profile / account | MyProfile, MyAccount pages | — | Not started |
| My orders | MyOrders page | — | May become "payment history" pulling from Stripe |
| My tickets | MyTickets page + Livewire | — | Not started |
| Equipment loans | Equipment resource (nested) | — | Not started |
| Bands | Bands resource | — | Not started |
| Volunteer hours | SubmitHoursPage, VolunteerPage | — | Not started |

## Band panel

The entire band panel is not started. Laravel has Filament tenancy where each band is a tenant.

| Feature | Laravel | Svelte | Notes |
|---------|---------|--------|-------|
| Band dashboard | BandDashboard | — | |
| Band members | BandMembers resource | — | |
| Band reservations | BandReservations resource | — | |
| Band profile | EditBandProfile page | — | |
| Band registration | RegisterBand tenancy page | — | |
| Invitations | AcceptInvitationPage | — | |

## Public pages

| Feature | Laravel | Svelte | Notes |
|---------|---------|--------|-------|
| Home | web.php route | +page.svelte | Parity |
| Events listing | EventsGrid Livewire | +page.svelte | Parity |
| About | web.php route | — | Not started |
| Contact form | ContactForm Livewire | — | Not started |
| Ticket purchase | TicketPurchaseWidget | — | Not started |
| Member directory | MembersGrid Livewire | — | Not started |

## API / background

| Feature | Laravel | Svelte | Notes |
|---------|---------|--------|-------|
| Stripe webhooks | Cashier + custom handlers | /api/stripe/webhook | Parity (different implementation) |
| Auto-complete reservations | Scheduled command | /api/cron/auto-complete | Parity |
| Lock access | Kiosk module | /api/cron/lock-access | Parity |
| Event poster serving | Media library | /api/events/[id]/poster | Parity |

## Database schema

The Svelte app has 10 tables covering auth (user, session, account, verification), authorization (permissions, roles, model_has_permissions, model_has_roles, role_has_permissions), reservations (reservation, closure), events (event), and finance (product_config, credit_transaction).

Tables that would need to be added for missing features: equipment, equipment_loan, band, band_member, volunteer_hour_log, sponsor, venue, ticket, site_page, kiosk_device.

## Suggested build order

Features are grouped by how much new schema and infrastructure they require, with "extends existing patterns" items first.

1. **Staff event editing** — No new tables. Add edit form, poster upload, delete action to existing event routes.
2. **Member profile / account** — No new tables. Uses existing user table. Add profile editing, password change, account settings.
3. **Member dashboard** — No new tables. Aggregation view over existing reservation and credit data.
4. **Stripe payments view** — No new tables. Read-only view pulling payment history from Stripe API for staff.
5. **Recurring reservations** — Needs rrule storage on reservation or a new recurrence table. Moderate complexity.
6. **Equipment module** — New tables (equipment, equipment_loan). Full CRUD with state machine for loan lifecycle.
7. **Bands module** — New tables (band, band_member). Multi-tenant UI pattern, invitations.
8. **Volunteering module** — New tables (volunteer_hour_log). Hour submission, approval workflow, reporting.
9. **Tickets** — New table (ticket). Stripe integration for purchase, check-in flow.
10. **Everything else** — Sponsors, CMS, venues, kiosk, activity log, reports, bylaws.
