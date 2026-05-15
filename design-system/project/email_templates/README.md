# Email templates

Three production-ready HTML email templates for the Corvallis Music Collective,
covering the main nonprofit use cases:

| File | Use case | When to send |
| --- | --- | --- |
| `event-announcement.html` | Marketing — single-event push | Real Book Club, Open House, ticketed shows, monthly meet-up |
| `reservation-confirmation.html` | Transactional — booking receipt | After a member confirms a practice-space reservation (fires from `Finance::settle` / `ConfirmReservationAction`) |
| `newsletter.html` | Marketing — monthly roundup | "The Collective" issue email — events + library updates + year-end appeal |
| `index.html` | Inbox preview | Reference only — Gmail-style shell that iframes the three templates side-by-side |

## Email-client compatibility

Email is not the web. CSS support varies wildly. These templates follow the
production rules every email designer learns the hard way:

- **Layout is HTML tables**, not flex/grid. Outlook drops both flex and grid.
- **Styles are inline.** The `<style>` block in `<head>` is a progressive
  enhancement — Outlook strips it, Apple Mail respects it. We use it for
  media queries (mobile + dark mode) only; every visual style is also
  present inline on the element.
- **Container is 600px max-width.** Standard "above the fold" desktop width.
  At <600px the `.stack` / `.stack-poster` classes collapse two-column rows
  to single column.
- **Web-safe font fallback chain.** Lexend loads from Google Fonts (works in
  Apple Mail, iOS Mail, mobile Gmail; ignored elsewhere); the fallback is
  `'Trebuchet MS', 'Helvetica Neue', Helvetica, Arial, sans-serif`.
- **No background images on critical content.** Outlook strips them. Tri-stripe
  is built from three 3px-tall `<td>` rows with solid background colors —
  no gradient property.
- **Bulletproof buttons.** Each CTA is `<table><tr><td bgcolor><a></a></td></tr></table>`
  so Outlook renders the colored cell behind the link text instead of
  collapsing to a bare hyperlink.
- **Logo is PNG.** SVG isn't supported in Outlook or several webmail clients.
  Use `assets/logos/cmc-speaker.png` (already in the system).
- **Preheader text** sits in a `display:none` div near `<body>` open. Gmail
  uses it for the inbox-preview snippet beside the subject; clients that
  ignore it just hide it.
- **Dark mode** via `@media (prefers-color-scheme: dark)`. Works in Apple
  Mail (desktop + iOS), Outlook on iOS, and mobile Gmail. Other clients
  ignore it and render light, which is fine — the light design is the
  canonical one.
- **MSO conditional** at the top of `<head>` pins Outlook's render DPI to 96
  so widths render at the px values you set.

## Hooks for production

These are starter templates — drop your variables in where the sample
content sits. Suggested merge tags (Postmark / Mailgun style):

```
{{recipient.first_name}}        → "Maya"
{{event.title}}                  → "Real Book Club"
{{event.starts_at_human}}        → "Thu, Dec 5 · 7:00 PM"
{{event.url}}                    → https://corvmc.org/events/real-book-club
{{reservation.confirmation_id}}  → "RES-2025-0412"
{{reservation.room}}             → "Main Practice"
{{reservation.band}}             → "Indigo Kiss"
{{reservation.free_hours_used}}  → "2 of 10"
{{newsletter.issue}}             → "Issue 14"
{{newsletter.month}}             → "December 2025"
%unsubscribe_url%                → handled by Postmark
```

Image URLs in production should be **absolute** (e.g.
`https://corvmc.org/email-assets/cmc-speaker.png`), not relative — these
files use relative paths only for the local preview to work.

## Plain text versions

A plain-text alternate is **required** for transactional email under
Postmark / Mailgun (and good practice for marketing). We don't bundle the
plain-text bodies as files; generate them at send time from your template
data. Keep the structure identical: same headline, same details block,
same CTA URL, no marketing flourishes.

## Preview locally

Open `index.html` for the Gmail-style 3-template carousel. Open any of the
three standalone files directly for a real-render preview at the exact 600px
width an inbox shows them at.

## Inbox-preview snippet text

Every template starts with a `display:none` preheader. These are the
"second-line" text strings that show in Gmail inbox previews. Tweak them
when you customize content — they're the second most important copy after
the subject line:

| Template | Subject (sample) | Preheader |
| --- | --- | --- |
| Event announcement | "Real Book Club is back this Thursday" | "Bring your instrument and a Real Book — first Thursday of the month at the Collective. All skill levels welcome." |
| Reservation confirm | "You're booked: Thu Dec 5 · 7 PM" | "Main Practice room, Thu Dec 5 at 7:00 PM for 2 hours. Free hours used: 2 of 10 this month." |
| Newsletter | "The Collective · December 2025" | "Real Book Club this Thursday, the open jam returns, and a year-end thanks. Plus: new pedals in the lending library." |
