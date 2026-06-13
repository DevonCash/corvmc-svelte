# CorvMC Documentation

This folder holds all project documentation, grouped by type. Developer docs describe how the
system is designed and built; the user manual (`manual/`) describes how to use it.

| Folder                           | What's in it                                                          | Audience            |
| -------------------------------- | --------------------------------------------------------------------- | ------------------- |
| [`specs/`](#specs)               | Domain & design specs — the source of truth for how a feature behaves | Developers          |
| [`plans/`](#plans)               | Sequenced implementation plans (PR-by-PR); historical once shipped    | Developers          |
| [`architecture/`](#architecture) | Infra proposals, migrations, and deployment runbooks                  | DevOps / Developers |
| [`development/`](#development)   | Contributor guides — UI patterns, component testing                   | Developers          |
| [`reports/`](#reports)           | Living status reports                                                 | Team / Stakeholders |
| [`manual/`](#manual)             | End-user manual manifest & public-site articles                       | End users           |

**Status legend:** ✅ Current · 🔧 In progress · 📦 Historical (shipped) · ⚠️ Action needed

---

## specs

Behavioral source of truth. When code and a spec disagree, treat the spec as intent and the code
as reality — reconcile deliberately.

| Doc                                                                    | Status | Notes                                                       |
| ---------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| [reservation-system-spec.md](specs/reservation-system-spec.md)         | ✅     | Practice-room reservations, lock integration, book-then-pay |
| [recurring-reservations-spec.md](specs/recurring-reservations-spec.md) | ✅     | RRULE series, prototype cloning, advance windows            |
| [staff-reservations-spec.md](specs/staff-reservations-spec.md)         | ✅     | Staff reservation backend, resolve modal, overrides         |
| [bands-spec.md](specs/bands-spec.md)                                   | ✅     | Band entity, membership, ownership, invitations             |
| [staff-bands-spec.md](specs/staff-bands-spec.md)                       | ✅     | Staff band management & moderation                          |
| [tickets-spec.md](specs/tickets-spec.md)                               | ✅     | Ticketed events, Stripe, guest checkout, member discount    |
| [directory-profiles-spec.md](specs/directory-profiles-spec.md)         | ✅     | Member/band profiles, instruments, genres, visibility       |
| [membership-page-spec.md](specs/membership-page-spec.md)               | ✅     | Sustaining membership UI, credit balance, Stripe portal     |
| [member-dashboard-spec.md](specs/member-dashboard-spec.md)             | ✅     | Member landing page                                         |
| [email-marketing-spec.md](specs/email-marketing-spec.md)               | ✅     | Audiences, campaigns, scheduled sends                       |
| [finance-spec.md](specs/finance-spec.md)                               | ✅     | Stripe-first payments, credit wallets / ledger              |

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

| Doc                                                                               | Status | Notes                                                   |
| --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------- |
| [deployment-checklist.md](architecture/deployment-checklist.md)                   | ✅     | First-time prod deploy: D1, R2, secrets, webhooks, cron |
| [d1-migration-proposal.md](architecture/d1-migration-proposal.md)                 | ✅     | Postgres → Cloudflare D1 proposal                       |
| [universal-data-layer-proposal.md](architecture/universal-data-layer-proposal.md) | ✅     | API layer for SSR/SPA + kiosk parity (proposal)         |
| [product-config-kv-migration.md](architecture/product-config-kv-migration.md)     | ⚠️     | product_config → KV — migration pending user action     |

## development

| Doc                                                                          | Status | Notes                                                               |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| [ui-patterns.md](development/ui-patterns.md)                                 | ✅     | **Read before touching any page** — shared components & composition |
| [component-testing.md](development/component-testing.md)                     | ✅     | Stories vs specs, fixtures, mocking the server                      |
| [component-testing-checklist.md](development/component-testing-checklist.md) | 🔧     | Incremental coverage tracker — many items open                      |
| [component-style-audit.md](development/component-style-audit.md)             | ⚠️     | Visual audit; documents the magenta content-token theme bug         |

## reports

| Doc                                          | Status | Notes                                                   |
| -------------------------------------------- | ------ | ------------------------------------------------------- |
| [parity-report.md](reports/parity-report.md) | ✅     | Authoritative feature parity vs. the legacy Laravel app |

## manual

The end-user manual. Most articles live in [`src/content/help/`](../src/content/help) and sync into
the in-app Help/KB via `pnpm help:sync`. The manifest tracks coverage across all four panels.

| Doc                                  | Status | Notes                                                      |
| ------------------------------------ | ------ | ---------------------------------------------------------- |
| [manual/README.md](manual/README.md) | 🔧     | User-manual manifest & checklist (~76 articles)            |
| [manual/public/](manual/public)      | 🔧     | Public-site how-tos (markdown only — the KB is auth-gated) |

---

### Open action items (from the docs above)

- ⚠️ **Magenta content tokens** — theme bug documented in `development/component-style-audit.md`.
- ⚠️ **product_config → KV migration** — pending in `architecture/product-config-kv-migration.md`.
- ⚠️ **Credit/cash rework** — awaiting migration in `plans/reservation-credits-cash-checklist.md`.
