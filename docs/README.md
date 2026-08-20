# CorvMC Documentation

This folder holds all project documentation, grouped by type. Developer docs describe how the
system is designed and built; the user manual (`manual/`) describes how to use it.

| Folder                           | What's in it                                                                  | Audience            |
| -------------------------------- | ----------------------------------------------------------------------------- | ------------------- |
| [`specs/`](#specs)               | Domain & design specs — the source of truth for how a feature behaves         | Developers          |
| [`plans/`](#plans)               | Sequenced implementation plans (PR-by-PR); historical once shipped            | Developers          |
| [`architecture/`](#architecture) | System overview, operations manual, deployment runbook, infra proposals       | DevOps / Developers |
| [`development/`](#development)   | Contributor guides — quickstart, conventions, workflows, UI patterns, testing | Developers          |
| [`reports/`](#reports)           | Living status reports                                                         | Team / Stakeholders |
| [`manual/`](#manual)             | End-user manual manifest & public-site articles                               | End users           |

**Status legend:** ✅ Current · 🔧 In progress · 📋 Designed, not built · 📦 Historical (shipped) · ⚠️ Action needed

**New maintainer? Read in this order:**
[local-dev-quickstart](development/local-dev-quickstart.md) →
[architecture overview](architecture/overview.md) →
[business-workflows](development/business-workflows.md) →
[conventions](development/conventions.md) →
[working-with-claude](development/working-with-claude.md) →
[operations-manual](architecture/operations-manual.md) →
[deployment-checklist](architecture/deployment-checklist.md) (first deploy only).

---

## specs

Behavioral source of truth. When code and a spec disagree, treat the spec as intent and the code
as reality — reconcile deliberately.

| Doc                                                                    | Status | Notes                                                                                                                       |
| ---------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| [reservation-system-spec.md](specs/reservation-system-spec.md)         | ✅     | Practice-room reservations, lock integration, book-then-pay                                                                 |
| [recurring-reservations-spec.md](specs/recurring-reservations-spec.md) | ✅     | RRULE series, prototype cloning, advance windows                                                                            |
| [staff-reservations-spec.md](specs/staff-reservations-spec.md)         | ✅     | Staff reservation backend, resolve modal, overrides                                                                         |
| [bands-spec.md](specs/bands-spec.md)                                   | ✅     | Band entity, membership, ownership, invitations — superseded in part by `groups-spec.md`                                    |
| [groups-spec.md](specs/groups-spec.md)                                 | 📋     | Bands/clubs/committees: the `group` + `band_profile` split, announcements, documents (classes deferred)                     |
| [staff-bands-spec.md](specs/staff-bands-spec.md)                       | ✅     | Staff band management & moderation                                                                                          |
| [tickets-spec.md](specs/tickets-spec.md)                               | ✅     | Ticketed events, Stripe, guest checkout, member discount                                                                    |
| [directory-profiles-spec.md](specs/directory-profiles-spec.md)         | ✅     | Member/band profiles, instruments, genres, visibility                                                                       |
| [membership-page-spec.md](specs/membership-page-spec.md)               | ✅     | Sustaining membership UI, credit balance, Stripe portal                                                                     |
| [member-dashboard-spec.md](specs/member-dashboard-spec.md)             | ✅     | Member landing page                                                                                                         |
| [email-marketing-spec.md](specs/email-marketing-spec.md)               | ✅     | Audiences, campaigns, scheduled sends                                                                                       |
| [finance-spec.md](specs/finance-spec.md)                               | ✅     | Stripe-first payments, credit wallets / ledger                                                                              |
| [production-workflow-spec.md](specs/production-workflow-spec.md)       | 📋     | CMC-produced shows: booking → run of show → settlement → close-out; venues, external acts. Reconciled with `groups-spec.md` |
| [volunteering-spec.md](specs/volunteering-spec.md)                     | ✅     | Volunteer roles, member hour logging, staff approval queue, reporting; shifts + certifications designed, unbuilt            |
| [member-standing-spec.md](specs/member-standing-spec.md)               | ✅     | Scoped `member_standing`: what an upheld report costs, per domain. Merges the three per-domain standing tables              |
| [member-portal-chat-spec.md](specs/member-portal-chat-spec.md)         | ✅     | Member↔staff conversations as an inbox channel (`portal`); `inbox_participant`                                              |
| [direct-messages-spec.md](specs/direct-messages-spec.md)               | ✅     | Member↔member DMs: request/accept consent, silent drops, blocks, reporting                                                  |

## plans

Sequenced build plans. Mostly historical now that the features have shipped — kept for context.

| Doc                                                                                  | Status | Notes                                               |
| ------------------------------------------------------------------------------------ | ------ | --------------------------------------------------- |
| [bands-plan.md](plans/bands-plan.md)                                                 | 📦     |                                                     |
| [tickets-plan.md](plans/tickets-plan.md)                                             | 📦     |                                                     |
| [recurring-reservations-plan.md](plans/recurring-reservations-plan.md)               | 📦     |                                                     |
| [reservation-implementation-plan.md](plans/reservation-implementation-plan.md)       | 📦     |                                                     |
| [email-marketing-plan.md](plans/email-marketing-plan.md)                             | 📦     |                                                     |
| [member-dashboard-plan.md](plans/member-dashboard-plan.md)                           | 📦     |                                                     |
| [finance-implementation-plan.md](plans/finance-implementation-plan.md)               | 📦     |                                                     |
| [events-implementation-plan.md](plans/events-implementation-plan.md)                 | 🔧     | Partial — event CRUD / R2 / ticketing config        |
| [reservation-credits-cash-checklist.md](plans/reservation-credits-cash-checklist.md) | ⚠️     | Credit/cash rework — awaiting drizzle-kit migration |

## architecture

| Doc                                                                               | Status | Notes                                                                                                |
| --------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| [overview.md](architecture/overview.md)                                           | ✅     | **Start here** — how the system is wired (remote functions, auth, event bus, D1, cron, config)       |
| [operations-manual.md](architecture/operations-manual.md)                         | ✅     | Day-to-day production ops: deploys, migrations, secrets, integrations, cron, docs upkeep, monitoring |
| [deployment-checklist.md](architecture/deployment-checklist.md)                   | ✅     | First-time prod deploy: D1, R2, secrets, webhooks, cron                                              |
| [inbox-reply-setup.md](architecture/inbox-reply-setup.md)                         | ✅     | Threaded email replies to the staff inbox: MX, Postmark inbound, secrets, rollback, troubleshooting  |
| [d1-migration-proposal.md](architecture/d1-migration-proposal.md)                 | ✅     | Postgres → Cloudflare D1 proposal                                                                    |
| [universal-data-layer-proposal.md](architecture/universal-data-layer-proposal.md) | ✅     | API layer for SSR/SPA + kiosk parity (proposal)                                                      |
| [product-config-kv-migration.md](architecture/product-config-kv-migration.md)     | ⚠️     | product_config → KV — migration pending user action                                                  |

## development

| Doc                                                                          | Status | Notes                                                                               |
| ---------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| [local-dev-quickstart.md](development/local-dev-quickstart.md)               | ✅     | Zero to running locally: env, seed data, tests, Stripe test mode                    |
| [business-workflows.md](development/business-workflows.md)                   | ✅     | The eight core workflows, traced through code, with triage notes                    |
| [conventions.md](development/conventions.md)                                 | ✅     | Feature checklist, layering rules, custom lint rules, script reference              |
| [working-with-claude.md](development/working-with-claude.md)                 | ✅     | Agent-instruction surface: CLAUDE.md vs rules vs skills vs hooks, verification loop |
| [ui-patterns.md](development/ui-patterns.md)                                 | ✅     | **Read before touching any page** — shared components & composition                 |
| [component-testing.md](development/component-testing.md)                     | ✅     | Stories vs specs, fixtures, mocking the server                                      |
| [component-testing-checklist.md](development/component-testing-checklist.md) | 🔧     | Incremental coverage tracker — many items open                                      |
| [component-style-audit.md](development/component-style-audit.md)             | ✅     | Visual audit; the magenta content-token theme bug it found is now fixed             |
| [template-audit.md](development/template-audit.md)                           | 🔧     | Class-soup census + phased migration to a component-based design system             |

## reports

| Doc                                                          | Status | Notes                                                                    |
| ------------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| [parity-report.md](reports/parity-report.md)                 | ✅     | Authoritative feature parity vs. the legacy Laravel app                  |
| [standardization-audit.md](reports/standardization-audit.md) | ⚠️     | Ranked componentization/standardization candidates; 3 correctness issues |

## manual

The end-user manual. Most articles live in [`src/content/help/`](../src/content/help) and sync into
the in-app Help/KB via `pnpm help:sync`. The manifest tracks coverage across all four panels.

| Doc                                  | Status | Notes                                                      |
| ------------------------------------ | ------ | ---------------------------------------------------------- |
| [manual/README.md](manual/README.md) | 🔧     | User-manual manifest & checklist (~76 articles)            |
| [manual/public/](manual/public)      | 🔧     | Public-site how-tos (markdown only — the KB is auth-gated) |

---

### Open action items (from the docs above)

- ⚠️ **product_config → KV migration** — pending in `architecture/product-config-kv-migration.md`.
- ⚠️ **Credit/cash rework** — awaiting migration in `plans/reservation-credits-cash-checklist.md`.
