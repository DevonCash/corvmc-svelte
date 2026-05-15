// Components.jsx — Reusable primitives: Button, Badge, Card, Hero, Section,
// Feature, Stat, Admonition, EventCard, MemberCard.

function Button({ children, variant = "primary", size, wide, block, onClick, href, type, ...rest }) {
  const cls = [
    "btn",
    variant && `btn--${variant}`,
    size === "lg" && "btn--lg",
    wide && "btn--wide",
    block && "btn--block",
  ].filter(Boolean).join(" ");
  if (href) {
    return (
      <a className={cls} href={href} onClick={onClick} {...rest}>{children}</a>
    );
  }
  return (
    <button className={cls} onClick={onClick} type={type || "button"} {...rest}>{children}</button>
  );
}

function Badge({ children, variant = "primary" }) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}

function Card({ children, variant, style, onClick }) {
  const cls = ["card", variant && `card--filled-${variant}`].filter(Boolean).join(" ");
  return (
    <div className={cls} style={style} onClick={onClick}>
      <div className="card__body">{children}</div>
    </div>
  );
}

function Hero({ title, body, children }) {
  return (
    <section className="hero">
      <div className="hero__inner">
        <h1 className="hero__title">{title}</h1>
        {body && <p className="hero__body">{body}</p>}
        {children && <div className="hero__actions">{children}</div>}
      </div>
    </section>
  );
}

function Section({ tint, children, style }) {
  const cls = ["section", tint && `section--tint-${tint}`].filter(Boolean).join(" ");
  return <section className={cls} style={style}><div className="container">{children}</div></section>;
}

function SectionHeader({ title, lede }) {
  return (
    <div className="section__header">
      <h2 className="section__title">{title}</h2>
      {lede && <p className="section__lede">{lede}</p>}
    </div>
  );
}

function Feature({ icon: Icon, title, children }) {
  return (
    <div className="feature">
      {Icon && <Icon size={40} strokeWidth={1.6} className="feature__icon" />}
      <h3 className="feature__title">{title}</h3>
      <p className="feature__body">{children}</p>
    </div>
  );
}

function Stat({ label, value, sub, variant }) {
  const cls = ["stat", variant === "primary" && "stat--primary"].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

function Admonition({ type = "note", label, children }) {
  const Icon =
    type === "tip" ? IconFlame
    : type === "important" ? IconAlertCircle
    : type === "warning" ? IconAlertTriangle
    : IconInfoCircle;
  const cls = `alert alert--${type}`;
  const defaultLabel = type[0].toUpperCase() + type.slice(1);
  return (
    <div className={cls} role="note">
      <Icon size={18} />
      <div><strong>{label || defaultLabel}</strong> &nbsp; {children}</div>
    </div>
  );
}

function EventCard({ event, onClick, featured }) {
  return (
    <article className={`event-card ${featured ? "paper-tape" : ""}`} onClick={onClick} style={featured ? { "--tape-color": "rgba(248,77,19,0.85)", "--tape-x": "14%", "--tape-y": "-12px", "--tape-rotate": "-4deg" } : undefined}>
      <div className="event-card__poster">
        <img src={event.poster} alt="" />
      </div>
      <div className="event-card__body">
        <div className="event-card__date">{event.date}</div>
        <h3 className="event-card__title">{event.title}</h3>
        <div className="event-card__meta">{event.meta}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          {(event.tags || []).map((t) => (
            <span key={t} className="sticker-badge sticker-badge--teal">{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

/* PosterCard — skeuomorphic, for the Events grid.
   Matches the live CMC implementation: parchment matte frame, 8.5×11 poster
   inside, caption strip below with mini speaker logo + title + date.
   Pivots from top-center as if pinned by a single nail. */
function PosterCard({ event, onClick }) {
  return (
    <article className="poster-card" onClick={onClick}>
      <figure className="poster-card__figure">
        <img src={event.poster} alt={event.title || ""} />
      </figure>
      <div className="poster-card__caption">
        <img className="poster-card__logo" src="../../assets/logos/cmc-speaker.png" alt="" />
        <div className="poster-card__caption-text">
          <div className="poster-card__title">
            {event.title}
            {event.free && <span style={{ marginLeft: 8, fontSize: 9, fontWeight: 700, padding: "2px 6px", border: "1px solid var(--cmc-teal)", color: "var(--cmc-teal)", borderRadius: 3, letterSpacing: "0.06em", textTransform: "uppercase", verticalAlign: "middle" }}>Free</span>}
          </div>
          <div className="poster-card__date">{event.date}</div>
        </div>
      </div>
    </article>
  );
}

/* VinylCard — skeuomorphic, for the Band directory. */
function VinylCard({ band, onClick }) {
  return (
    <article className="vinyl-card" onClick={onClick} style={{ "--vinyl-label": band.color || "var(--cmc-orange)" }}>
      <div className="vinyl-card__sleeve">
        <div className="vinyl-card__sleeve-art">
          {band.initials || (band.name || "").split(/\s+/).slice(0, 2).map((p) => p[0]).join("")}
        </div>
        <div className="vinyl-card__sleeve-info">
          <div className="vinyl-card__band">{band.name}</div>
          <div className="vinyl-card__meta">{band.meta}</div>
        </div>
      </div>
      <div className="vinyl-card__disc">
        <div className="vinyl-card__label">{band.name}</div>
      </div>
    </article>
  );
}

/* IdCard — skeuomorphic, for the Member directory. */
function IdCard({ member, onClick }) {
  const initials = member.name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <article className="id-card" onClick={onClick}>
      <div className="id-card__hole"></div>
      <div className="id-card__header">
        <div className="id-card__brand">Corvallis Music Collective</div>
        <div className="id-card__tag">{(member.tier || "Member").toUpperCase()}</div>
      </div>
      <div className="id-card__body">
        <div className="id-card__photo" style={{ "--photo-bg": member.avatarBg }}>{initials}</div>
        <div className="id-card__info">
          <div className="id-card__name">{member.name}</div>
          <div className="id-card__role">{member.role}</div>
          <div className="id-card__no">No. {member.memberNo || "0000"} · {member.joined || "Est 2025"}</div>
        </div>
      </div>
      <div className="id-card__sig">Authorized signature</div>
    </article>
  );
}

function MemberCard({ member, onClick }) {
  const initials = member.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <article className="member" onClick={onClick}>
      <div className="member__avatar" style={member.avatarBg ? { background: member.avatarBg, color: "#fff" } : undefined}>
        {initials}
      </div>
      <div className="member__body">
        <div className="member__name">{member.name}</div>
        <div className="member__role">{member.role}</div>
        <div className="member__tags">
          {(member.tags || []).map((t) => (
            <Badge key={t} variant="outline-primary">{t}</Badge>
          ))}
        </div>
      </div>
    </article>
  );
}

function Step({ num, title, children }) {
  return (
    <div className="step">
      <div className="step__num">{num}</div>
      <div className="step__title">{title}</div>
      <div className="step__body">{children}</div>
    </div>
  );
}

Object.assign(window, { Button, Badge, Card, Hero, Section, SectionHeader, Feature, Stat, Admonition, EventCard, PosterCard, VinylCard, IdCard, MemberCard, Step });
