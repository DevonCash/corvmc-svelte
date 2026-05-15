# Skeuomorphic components

This system includes three opt-in components that mimic physical objects — a
poster pinned to a wall, a vinyl record in its sleeve, and a laminated ID
card. They exist because the brand promise is "modern, but retro-inspired"
and the digital UI has historically been the **least** retro surface in the
collateral — flat shadows, generic cards, sans-serif buttons. Posters,
records, and ID cards are objects the audience already associates with music
communities; using them as UI metaphors closes the gap.

This document explains the **principles** behind each pattern so you can
apply them correctly (or invent new ones in the same spirit). The CSS is in
`skeuomorphic.css`; the live React implementations are in
`ui_kits/website/Components.jsx`.

---

## When to reach for skeuomorphism

**Use it for content surfaces, not chrome.** Posters work in the Events
grid. Records work in the Bands directory. ID cards work in the Member
directory. **None of these belong in the header, footer, modal chrome,
form fields, or the member dashboard's data tables.** Those stay clean.

**Use it where the metaphor is load-bearing.** A poster card invites the
"flyer wall" mental model — the user is browsing what's on. A record invites
"this is a band, an identity, a body of work." An ID card invites
"membership, status, belonging." Don't use a record metaphor for a list of
playlist items, or an ID card for a contact form — the metaphor breaks down
and reads as decoration.

**One skeuo per surface.** A page with poster cards + vinyl cards + ID cards
on the same screen reads as a craft fair, not a coherent product. Stick to
one metaphor per page.

---

## Principle 1 — Honor the physics

A real object responds to gravity, hinges, friction, and how it's attached
to the world. UI that mimics a physical object and then violates that
physics reads as cheap. The clearest example in this system:

> **A taped or pinned poster doesn't pivot around its own center on hover.**
> It hangs from where it's pinned. A poster pinned at the top center
> swings (or doesn't) around that pin point.

So the poster card uses **`transform-origin: top center`** — not the default
`center center`. The base tilt is a few degrees off vertical, and on hover
the poster **rotates *further* in the opposite direction** rather than
unrotating to 0°. That's how a poster sways when you brush past it; the
straightening-on-hover pattern is a tooltip / Linear-card move that doesn't
belong on a physical thing.

| Object | Anchor / pivot | Hover behavior |
| --- | --- | --- |
| Poster | Top center (single pin) | Swings further from rest, doesn't snap to 0 |
| Vinyl disc | Geometric center | Rotates around its own center, slides further out of the sleeve |
| ID card | Lanyard hole at top | Could swing from lanyard; we only lift + straighten slightly |

The same principle applies to **shadows**: a poster pinned to a wall casts a
small shadow against the wall, not a glow underneath. A record on a shelf
casts its shadow on whatever's behind it. The CSS shadow stack should match —
short, slightly offset, never a halo.

---

## Principle 2 — The matte is the chrome

In print, the matte (the cardstock frame around a poster) and the sleeve
(the cardboard around a record) is where the brand lives. The poster itself
might be wildly variable — different illustrators, different colors, hand-
lettered titles. The frame is what makes a wall of CMC posters *feel like* a
wall of CMC posters.

The poster card mirrors this. The poster image is the **only** part of the
card that varies. Everything around it — the parchment matte, the caption
strip's color, the mini speaker logo, the brown title type — is fixed.
Result: any uploaded poster sits inside a frame that's instantly readable as
CMC, even when the poster art clashes wildly with brand colors.

Apply the same idea to new skeuo components: **fix the frame, vary the
content**.

---

## Principle 3 — Specimen over diagram

A poster card shows the poster art. A vinyl record shows the band's color
on the center label. An ID card shows the member's name and number. The
component is a specimen — it shows you the actual thing, not a label-for-
the-thing. This is the difference between a "Real Book Club" tile (which
just says "Real Book Club") and a poster card (which shows the real Real
Book Club flyer with the sax player on it).

This is why the photography / illustration in the system matters so much.
The 9 reference posters in `assets/posters/` aren't moodboard inspiration —
they're the *primary surface* of the events grid. The component is the
matte; the poster is the picture.

Same with records: the center label color **is** the band's identity
(`--vinyl-label: #e5771e`). Same with ID cards: the photo (we use avatar
initials in the mock) **is** the member.

---

## Principle 4 — Restraint over enthusiasm

Skeuomorphism is high-calorie. Use it once per surface and keep the rest of
the surface plain. The Events page uses poster cards on a corkboard
background — and **everything else on that page is clean** (header, tri-
stripe, "All / Showcase / Jazz" filter sticker-badges, page footer). The
Directory page uses ID cards on a normal cream background — no corkboard,
no halftone, no marker underlines.

Avoid stacking effects: don't put a sticker-badge **on** a poster card. Don't
add marker-underline to text **inside** an ID card. Each metaphor is
self-contained; stacking them reads as "noisy graphic design student" not
"considered brand."

---

## The three components

### `.poster-card` — Event card

Anchored at top center as if hanging from a single pin. 5px parchment
border acts as a matte/frame. 8.5×11 poster figure inside (US flyer
aspect). Caption strip below with mini speaker logo, title in CMC brown,
date as muted brown. On hover, rotates further from its rest angle and
lifts z-index. Best in a 2–3 column grid with extra row/column gap so
neighbors don't clip on rotate.

### `.vinyl-card` — Band card

Sleeve on the left (62% of card width, cream cardstock with the band's
color block + initials as sleeve art and band name + meta in a cream
footer strip). Disc to the right (55% of width, partially hidden behind
the sleeve, peeking out the right edge). The disc's center label is the
band's color — that color **is** the band's identity. On hover, the
disc spins 30° around its center and slides further out of the sleeve.

### `.id-card` — Member card

5:3 aspect ratio (credit-card proportions). Lanyard hole at top center.
Header row with brand name + tier tag, tri-stripe directly beneath. Body
with photo square (avatar) + name / role / member number. Signature line
at bottom. Plastic-shine highlight via diagonal `linear-gradient`.
Auto-rotates by `:nth-child` so a grid feels organic.

---

## When **not** to use them

- **Dashboards, tables, settings pages, modals, forms** — keep flat
- **Mobile** — they still work but the rotation / overlap can be noisy at
  narrow widths; consider falling back to plain cards under 600px
- **Print and email** — the rotations and overlap don't survive PDF/email
  rendering; use the plain `EventCard` / `MemberCard` instead
- **High-density grids** — these are 280–400px components, not 120px tiles
- **As decoration without content** — empty / loading states should fall
  back to plain skeletons, not skeumorphic ghosts of records or ID cards
