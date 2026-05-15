# Website UI Kit — corvmc.org

Hi-fi recreation of the **Corvallis Music Collective** public website plus a
member-area dashboard, factored into small reusable components on top of the
shared `colors_and_type.css` design tokens.

This is a **click-through prototype**, not production code. Functions like
RSVPs, payments, and band management are mocked. Visual fidelity to the live
site is the priority.

## Run

Open `index.html`. No build step — components are transpiled in-browser via
Babel standalone. The single page covers six public screens plus a Filament-
style member dashboard.

## Screens

- **Home** — hero, upcoming events, "What We Do" feature grid, "Get Involved"
  CTA tiles. Mirrors `resources/views/public/home.blade.php`.
- **Events** — filterable grid of cards + a single-event detail view.
- **Directory** — member grid with avatar, role, and genre tags.
- **Programs** — alternating tinted sections (success / primary / warning /
  info), stat cards, admonitions, step-by-step CTA. Mirrors
  `resources/content/pages/programs.md`.
- **Contribute** — three-tier sustaining membership pricing + other ways to
  contribute (gear, volunteer, host).
- **Resources / About** — secondary content pages.
- **Member dashboard** — Filament-style sidebar shell with Dashboard,
  Reservations, Events, Bands, Profile, Billing, Settings. Click "Login" in
  the header and submit the prefilled form to enter.

## Files

| File | What it is |
| --- | --- |
| `index.html` | Mount point — loads React 18 + Babel + the JSX modules below |
| `styles.css` | UI-kit styles, imports `../../colors_and_type.css` |
| `Icons.jsx` | ~25 Tabler-styled inline-SVG icon components |
| `Layout.jsx` | `<Header>`, `<Footer>`, `<TriStripe>` |
| `Components.jsx` | `<Button>`, `<Badge>`, `<Card>`, `<Hero>`, `<Section>`, `<SectionHeader>`, `<Feature>`, `<Stat>`, `<Admonition>`, `<EventCard>`, `<MemberCard>`, `<Step>` |
| `Pages.jsx` | `HomePage`, `EventsPage`, `DirectoryPage`, `ProgramsPage`, `ContributePage`, `LoginModal`, `MemberDashboard` |
| `App.jsx` | Top-level state machine — page routing, login flow |

## Notes & known cuts

- The live site uses **daisyUI + Tailwind v4**. We translated the brand into
  hand-written CSS so the kit runs as a single static page. CSS variable
  names match the daisyUI `corvmc` theme 1:1, so design tokens transfer.
- Tabler Icons are **re-implemented inline** as SVG components — same
  24×24 viewBox, `currentColor`, 2px stroke. Names match Tabler's React
  package (`IconCalendar`, `IconUsers`, etc.) for easy migration.
- The **Real Book Club sax-player illustration** and other halftone collage
  artwork on event posters are not separable vectors. We use the existing
  poster PNGs from `assets/posters/` directly as event-card thumbnails.
- Mobile breakpoint at 900px collapses the 3/4-column grids to 2 columns;
  640px collapses everything to a single column. The hand-rolled mobile
  drawer from the live site is not recreated — the desktop nav still shows.
- "NOTAFLOF" appears as plain inline copy, not a tooltip. The live site
  doesn't gloss it either; the abbreviation is the canonical phrasing.
