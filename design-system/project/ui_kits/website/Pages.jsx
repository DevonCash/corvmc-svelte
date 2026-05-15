// Pages.jsx — Top-level page screens that compose the small primitives.
// Each page is a click-target the user can navigate to from the Header.

const SAMPLE_EVENTS = [
  {
    id: "real-book-club",
    title: "Real Book Club",
    date: "Thu, Dec 5 · 7:00 PM",
    meta: "6775 SW Philomath Blvd · Free",
    tags: ["Jazz", "Monthly"],
    poster: "../../assets/posters/real-book-club.png",
    description:
      "Our flagship jazz jam club where musicians of all levels come together to explore the Great American Songbook and beyond. Bring your instrument and a Real Book (or we'll share!).",
  },
  {
    id: "monthly-meetup",
    title: "Monthly Meet-Up & Open Jam",
    date: "Thu, Dec 26 · 6:30 PM",
    meta: "Last Thursday of every month",
    tags: ["Meetup"],
    poster: "../../assets/posters/monthly-meetup-open-jam.png",
    description:
      "Come chat with — or just listen to — other local musicians about gear, gigs, and everything music-related. Everyone is welcome!",
  },
  {
    id: "open-house",
    title: "CMC Open House",
    date: "Sat, Nov 22 · 5:30 PM",
    meta: "Come check out our space",
    tags: ["Open House"],
    poster: "../../assets/posters/open-house.png",
    description:
      "Get a tour of our practice rooms, meet the team, see the gear library, and find out how to get involved.",
  },
  {
    id: "showcase",
    title: "El Ten Johnny · Indigo Kiss · Monarch!",
    date: "Sun, Oct 2 · 5:00 PM",
    meta: "$10 / NOTAFLOF",
    tags: ["Showcase", "All Ages"],
    poster: "../../assets/posters/cassette-tape-concert.png",
    description:
      "A triple bill of Corvallis-and-around bands. No One Turned Away For Lack Of Funds.",
  },
  {
    id: "jazz",
    title: "Sunday Jazz at the Collective",
    date: "Sun, Nov 16 · 4:00 PM",
    meta: "Suggested donation $5",
    tags: ["Jazz"],
    poster: "../../assets/posters/jazz-concert-illustrated.png",
    description: "An afternoon of standards and original arrangements from CMC members.",
  },
  {
    id: "meeting",
    title: "Come Chat About Music",
    date: "Thu, Jan 30 · 7:00 PM",
    meta: "Monthly community meeting",
    tags: ["Meetup"],
    poster: "../../assets/posters/instagram-come-chat.png",
    description: "Our monthly all-hands gathering. New voices welcome.",
  },
];

const SAMPLE_MEMBERS = [
  { name: "Maya Rivera",    role: "Bass · Vocals",       tags: ["Soul", "R&B"],          avatarBg: "#e5771e", tier: "Sustaining",  memberNo: "0142", joined: "Est 2024" },
  { name: "Devon Park",     role: "Guitar · Songwriter", tags: ["Folk", "Americana"],    avatarBg: "#003b5c", tier: "Member",      memberNo: "0067", joined: "Est 2022" },
  { name: "Sam Chen",       role: "Drums · Producer",    tags: ["Jazz", "Hip-Hop"],      avatarBg: "#00859b", tier: "Sustaining",  memberNo: "0214", joined: "Est 2025" },
  { name: "Ari Goldstein",  role: "Sax · Piano",         tags: ["Jazz", "Real Book"],    avatarBg: "#ffb500", tier: "Member",      memberNo: "0089", joined: "Est 2023" },
  { name: "Riley Thompson", role: "Vocals",              tags: ["Indie", "Songwriter"],  avatarBg: "#f84d13", tier: "Sustaining",  memberNo: "0156", joined: "Est 2024" },
  { name: "Jordan Park",    role: "Guitar · Synth",      tags: ["Electronic", "Ambient"],avatarBg: "#003b5c", tier: "Member",      memberNo: "0231", joined: "Est 2025" },
  { name: "Noor Hassan",    role: "Bass · Producer",     tags: ["Hip-Hop"],              avatarBg: "#e5771e", tier: "Member",      memberNo: "0178", joined: "Est 2024" },
  { name: "Mei Watanabe",   role: "Violin · Composer",   tags: ["Classical", "Film"],    avatarBg: "#00859b", tier: "Sustaining",  memberNo: "0102", joined: "Est 2023" },
];

const SAMPLE_BANDS = [
  { name: "Indigo Kiss",       meta: "Indie soul · 4 members",      color: "#e5771e", initials: "IK" },
  { name: "Monarch! Anarchy",  meta: "Post-punk · 3 members",       color: "#f84d13", initials: "M!" },
  { name: "Riverbed Choir",    meta: "Folk · 5 members",            color: "#00859b", initials: "RC" },
  { name: "Late Bloom",        meta: "Dream pop · 4 members",       color: "#003b5c", initials: "LB" },
  { name: "Spilyay",           meta: "Electronic · 2 members",      color: "#6da5cc", initials: "SP" },
  { name: "Real Book Combo",   meta: "Jazz collective · open",      color: "#ffb500", initials: "RB" },
];

// =============================================================== HOME

function HomePage({ onNavigate }) {
  return (
    <>
      <Hero
        title="Building and Connecting Music Communities in Corvallis"
        body="We provide shared music resources, affordable practice space, and a supportive community for local musicians to grow, collaborate, and thrive together."
      >
        <Button variant="primary" size="lg" wide onClick={() => onNavigate("contribute")}>
          Join Our Community!
        </Button>
        <Button variant="outline" wide onClick={() => onNavigate("about")}>
          Learn More About Us
        </Button>
      </Hero>

      <Section>
        <SectionHeader title="Upcoming Events" />
        <div className="grid-3">
          {SAMPLE_EVENTS.slice(0, 3).map((e, i) => (
            <EventCard key={e.id} event={e} featured={i === 0} onClick={() => onNavigate("events")} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 32 }}>
          <Button variant="outline" onClick={() => onNavigate("events")}>View All Events</Button>
        </div>
      </Section>

      <Section tint="secondary">
        <SectionHeader title="What We Do" lede="Supporting musicians and building community through various programs" />
        <div className="grid-4">
          <Feature icon={IconMusic} title="Practice Space">
            Affordable hourly rehearsal space with professional equipment for bands and musicians.
          </Feature>
          <Feature icon={IconMicrophone} title="Live Events">
            Regular concerts and showcases featuring local and touring musicians.
          </Feature>
          <Feature icon={IconHeartHandshake} title="Community">
            Connecting musicians for collaboration, education, and mutual support.
          </Feature>
          <Feature icon={IconBook} title="Education">
            Workshops, masterclasses, and mentorship programs for musicians of all levels.
          </Feature>
        </div>
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <Button variant="outline" wide onClick={() => onNavigate("programs")}>View All Programs</Button>
        </div>
      </Section>

      <Section>
        <SectionHeader title="Get Involved" lede="Join our mission to support the local music community" />
        <div className="grid-3">
          <Card variant="primary">
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Become a Member</h3>
              <p style={{ margin: 0, lineHeight: 1.55 }}>Join our community of musicians and gain access to practice space, events, and networking opportunities.</p>
              <Button variant="secondary" onClick={() => onNavigate("contribute")} style={{ marginTop: 6 }}>Join Now</Button>
            </div>
          </Card>
          <Card variant="secondary">
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Volunteer</h3>
              <p style={{ margin: 0, lineHeight: 1.55 }}>Help us organize events, maintain our space, and support fellow musicians in our community.</p>
              <Button variant="primary" onClick={() => onNavigate("contribute")} style={{ marginTop: 6 }}>Learn More</Button>
            </div>
          </Card>
          <Card variant="accent">
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", textAlign: "center" }}>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Support Us</h3>
              <p style={{ margin: 0, lineHeight: 1.55 }}>Your donation helps us provide affordable space and programs for the local music community.</p>
              <Button variant="secondary" onClick={() => onNavigate("contribute")} style={{ marginTop: 6 }}>Contribute</Button>
            </div>
          </Card>
        </div>
      </Section>
    </>
  );
}

// =============================================================== EVENTS

function EventsPage({ onNavigate, focusedEvent, setFocusedEvent }) {
  const event = focusedEvent ? SAMPLE_EVENTS.find((e) => e.id === focusedEvent) : null;
  if (event) {
    return (
      <Section>
        <a href="#" onClick={(e) => { e.preventDefault(); setFocusedEvent(null); }}
           style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--cmc-navy)", marginBottom: 18, fontSize: 14, fontWeight: 600 }}>
          ← All events
        </a>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 360px) 1fr", gap: 36, alignItems: "start" }}>
          <img src={event.poster} alt="" style={{ width: "100%", borderRadius: 8, boxShadow: "0 10px 20px -4px rgba(0,0,0,0.18)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(event.tags || []).map((t) => <Badge key={t} variant="primary">{t}</Badge>)}
            </div>
            <h1 style={{ margin: 0, fontSize: 40, fontWeight: 700, lineHeight: 1.05 }}>{event.title}</h1>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 16, color: "var(--fg-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><IconCalendar size={18} /> {event.date}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><IconClock size={18} /> Doors at 6:30 PM</div>
              <div>{event.meta}</div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--fg-1)" }}>{event.description}</p>
            <Admonition type="tip">All ages welcome. NOTAFLOF — No One Turned Away For Lack Of Funds.</Admonition>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <Button variant="primary" size="lg">RSVP</Button>
              <Button variant="outline">Share</Button>
            </div>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section style={{ background: "transparent", padding: 0 }}>
      <div className="corkboard" style={{ padding: "64px 24px 80px" }}>
        <div className="container" style={{ paddingInline: 0 }}>
          <div style={{ textAlign: "center", marginBottom: 36, color: "var(--cmc-cream)" }}>
            <h2 style={{ fontSize: 40, fontWeight: 700, margin: "0 0 10px", color: "#fffbf6", textShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>Upcoming Events</h2>
            <p style={{ fontSize: 16, margin: 0, color: "#fffbf6", opacity: 0.92, textShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>Shows, jams, and meetups from the Collective</p>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 36, flexWrap: "wrap", justifyContent: "center" }}>
            {["All", "Showcase", "Jazz", "Meetup", "Open House"].map((f, i) => (
              <span key={f} className={`sticker-badge ${i === 0 ? "sticker-badge--orange" : "sticker-badge--teal"}`} style={i !== 0 ? { background: "rgba(255,251,246,0.92)", color: "var(--cmc-navy)", boxShadow: "1.5px 1.5px 0 rgba(0,0,0,0.35)" } : undefined}>
                {f}
              </span>
            ))}
          </div>
          <div className="poster-grid">
            {SAMPLE_EVENTS.map((e) => (
              <PosterCard key={e.id} event={e} onClick={() => setFocusedEvent(e.id)} />
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// =============================================================== DIRECTORY

function DirectoryPage() {
  const [tab, setTab] = React.useState("musicians");
  return (
    <Section>
      <SectionHeader
        title="Directory"
        lede="Musicians and bands in the Corvallis Music Collective"
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 36, justifyContent: "center" }}>
        <button onClick={() => setTab("musicians")}
          className={tab === "musicians" ? "btn btn--primary" : "btn btn--outline"}>
          Musicians
        </button>
        <button onClick={() => setTab("bands")}
          className={tab === "bands" ? "btn btn--primary" : "btn btn--outline"}>
          Bands
        </button>
      </div>
      {tab === "musicians" ? (
        <div className="id-grid">
          {SAMPLE_MEMBERS.map((m) => <IdCard key={m.name} member={m} />)}
        </div>
      ) : (
        <div className="vinyl-grid">
          {SAMPLE_BANDS.map((b) => <VinylCard key={b.name} band={b} />)}
        </div>
      )}
    </Section>
  );
}

// =============================================================== PROGRAMS

function ProgramsPage() {
  return (
    <>
      <Hero title="Programs" body="Practice spaces, performances, meetups & clubs for the music community" />

      <Section tint="success">
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--cmc-navy)" }}>Practice Space</div>
            <h2 style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.15, margin: "10px 0 16px" }}>Affordable Practice Space for Musicians</h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--fg-2)" }}>Our practice rooms are equipped with professional gear and designed for musicians who need a reliable space to rehearse, record demos, and develop their craft.</p>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--fg-2)" }}>Members can book hourly sessions in our sound-treated practice room, complete with a PA system, microphones, and all the essentials for a productive practice session.</p>
            <Admonition type="note">Practice space access requires a free CMC membership.</Admonition>
          </div>
          <Card variant="success">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <IconMusic size={26} />
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Room Features</h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75, fontSize: 15 }}>
              <li>Sound treated walls</li>
              <li>Full PA system</li>
              <li>Microphones &amp; stands</li>
              <li>Drum kit (cymbals &amp; hardware)</li>
              <li>Guitar &amp; bass amplifiers</li>
              <li>Comfortable seating</li>
            </ul>
          </Card>
        </div>
        <div className="grid-2" style={{ marginTop: 36 }}>
          <Stat label="Standard Rate" value="$15/hour" sub="All equipment included" />
          <Stat label="Sustaining Members" value="up to 10 Free Hours" sub="then $15/hour" variant="primary" />
        </div>
      </Section>

      <Section tint="primary">
        <SectionHeader title="Shows & Performances" lede="Showcase your talent and connect with the community through our regular performance opportunities." />
        <div className="grid-2">
          <Card variant="primary">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <IconMicrophone2 size={26} />
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Performance Opportunities</h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75, fontSize: 15 }}>
              <li>Monthly showcase events</li>
              <li>Open mic nights</li>
              <li>Collaborative performances</li>
              <li>Community festivals</li>
              <li>Recording showcases</li>
            </ul>
          </Card>
          <div>
            <h3 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 12px" }}>Perform & Connect</h3>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg-2)" }}>Whether you're a seasoned performer or just starting out, our performance programs provide supportive environments to share your music with appreciative audiences.</p>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: "var(--fg-2)" }}>From intimate acoustic sets to full band productions, we create spaces where musicians can grow, collaborate, and celebrate the power of live music.</p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <Button variant="primary">View Upcoming Shows</Button>
              <Button variant="outline-navy">Apply to Perform</Button>
            </div>
          </div>
        </div>
      </Section>

      <Section tint="warning">
        <SectionHeader title="Meetups & Clubs" lede="Connect with like-minded musicians through our regular meetups, learning sessions, and specialty clubs." />
        <div className="grid-2">
          <Card variant="warning">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <IconMusic size={24} />
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Real Book Club</h3>
            </div>
            <p style={{ margin: "0 0 12px", lineHeight: 1.55 }}>Our flagship jazz jam club where musicians of all levels come together to explore the Great American Songbook and beyond.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14, marginBottom: 12 }}>
              <div><strong>When</strong> · 1st Thursday of every month, 6:30 PM – 8:00 PM</div>
              <div><strong>Format</strong> · Open jam session, all skill levels welcome</div>
            </div>
            <Admonition type="tip">Bring your instrument and a Real Book (or we'll share!)</Admonition>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <IconUsers size={22} />
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Songwriter Circle</h3>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 14, lineHeight: 1.55, color: "var(--fg-2)" }}>Monthly gathering for sharing original songs, getting feedback, and collaborating on new material.</p>
              <div style={{ fontWeight: 700, fontSize: 14 }}>2nd Saturday · 2:00 PM</div>
            </Card>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <IconMicrophone size={22} />
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Monthly Meetup</h3>
              </div>
              <p style={{ margin: "0 0 6px", fontSize: 14, lineHeight: 1.55, color: "var(--fg-2)" }}>Come chat with — or just listen to — other local musicians about gear, gigs, and everything music-related. Everyone is welcome!</p>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Last Thursday · 6:30 PM</div>
            </Card>
          </div>
        </div>
      </Section>

      <Section tint="primary">
        <SectionHeader title="Ready to Get Involved?" lede="Join the Corvallis Music Collective to access all our programs and connect with a vibrant community of musicians." />
        <div className="grid-3">
          <Step num="1" title="Join CMC">Become a member to access all programs.</Step>
          <Step num="2" title="Choose Your Path">Practice, perform, or join our clubs.</Step>
          <Step num="3" title="Make Music">Connect and create with the community.</Step>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 36 }}>
          <Button variant="primary" size="lg">Become a Member</Button>
          <Button variant="outline-navy">Ask Questions</Button>
        </div>
      </Section>
    </>
  );
}

// =============================================================== CONTRIBUTE

function ContributePage() {
  return (
    <>
      <Hero title="Help Us Keep the Music Going" body="CMC is a 501(c)(3) nonprofit. Every membership, donation, and volunteer hour goes directly toward affordable practice space and programs for local musicians." />
      <Section>
        <div className="grid-3">
          {[
            { amount: "$5", label: "Monthly Supporter", body: "Covers one hour of practice space for a musician in need." },
            { amount: "$25", label: "Sustaining Member", body: "Gets you 10 free practice hours each month, plus member events." , variant: "primary" },
            { amount: "$100+", label: "Studio Patron", body: "Funds new gear for our lending library and PA upgrades." },
          ].map((tier, i) => (
            <Card key={tier.label} variant={tier.variant}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.85 }}>{tier.label}</div>
                <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1, margin: "10px 0 6px" }}>{tier.amount}</div>
                <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 4 }}>per month</div>
                <p style={{ fontSize: 14, lineHeight: 1.55, margin: "16px 0" }}>{tier.body}</p>
                <Button variant={i === 1 ? "secondary" : "primary"} block>Choose</Button>
              </div>
            </Card>
          ))}
        </div>
      </Section>
      <Section tint="warning">
        <SectionHeader title="Other Ways to Contribute" />
        <div className="grid-3">
          <Feature icon={IconGuitarPick} title="Donate Gear">Working amps, drums, mics, or instruments find a new home in our lending library.</Feature>
          <Feature icon={IconHeartHandshake} title="Volunteer">Help us run shows, maintain the space, or host meetups. We'll teach you the ropes.</Feature>
          <Feature icon={IconMicrophone2} title="Host a Workshop">Share your craft with other musicians — songwriting, recording, gear repair, theory.</Feature>
        </div>
      </Section>
    </>
  );
}

// =============================================================== LOGIN

function LoginModal({ onClose, onSubmit }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 60,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 10, padding: 30, width: "100%", maxWidth: 380,
        boxShadow: "0 24px 40px -8px rgba(0,0,0,0.30)", display: "flex", flexDirection: "column", gap: 14,
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <img src="../../assets/logos/cmc-speaker.png" alt="" style={{ height: 38 }} />
          <div style={{ fontWeight: 700, color: "var(--cmc-orange)", lineHeight: 1.1 }}>
            Corvallis Music<br /><span style={{ color: "var(--cmc-navy)" }}>Collective</span>
          </div>
        </div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Member Login</h2>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Email</label>
          <input type="email" defaultValue="hello@corvmc.org" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Password</label>
          <input type="password" defaultValue="••••••••" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
        </div>
        <Button variant="primary" block onClick={onSubmit}>Log in</Button>
        <div style={{ fontSize: 12, color: "var(--fg-3)", textAlign: "center" }}>
          Don't have an account? <a href="#" style={{ color: "var(--cmc-orange)", fontWeight: 600 }} onClick={(e) => e.preventDefault()}>Become a member</a>
        </div>
      </div>
    </div>
  );
}

// =============================================================== MEMBER DASHBOARD

function MemberDashboard({ user, onLogout, theme, onToggleTheme }) {
  const [active, setActive] = React.useState("dashboard");
  const items = [
    { id: "dashboard",    label: "Dashboard",        icon: IconLayoutDashboard, group: "Member" },
    { id: "reservations", label: "Reservations",     icon: IconClock,           group: "Member" },
    { id: "events",       label: "Events",           icon: IconCalendar,        group: "Member" },
    { id: "bands",        label: "Bands",            icon: IconUsers,           group: "Member" },
    { id: "profile",      label: "Profile",          icon: IconHome,            group: "Member" },
    { id: "billing",      label: "Billing",          icon: IconCreditCard,      group: "Account" },
    { id: "settings",     label: "Settings",         icon: IconSettings,        group: "Account" },
  ];
  const groups = ["Member", "Account"];
  return (
    <>
      <div className="tri-stripe" style={{ background: "linear-gradient(to bottom, var(--cmc-navy) 0 33.333%, var(--cmc-goldenrod) 33.333% 66.666%, var(--cmc-red-orange) 66.666% 100%)" }} />
      <div className="dashboard">
        <aside className="sidebar">
          <div className="sidebar__brand">
            <img src="../../assets/logos/cmc-speaker.png" alt="" />
            <div className="sidebar__brand-text">Corvallis<br /><span style={{ color: "var(--cmc-navy)" }}>Music Collective</span></div>
          </div>
          {groups.map((g) => (
            <React.Fragment key={g}>
              <div className="sidebar__group">{g}</div>
              {items.filter((i) => i.group === g).map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className={`sidebar__item ${active === item.id ? "is-active" : ""}`}
                    onClick={() => setActive(item.id)}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    {item.label}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
          <div style={{ marginTop: "auto", paddingTop: 20, display: "flex", alignItems: "center", gap: 10, padding: "10px" }}>
            <div className="member__avatar" style={{ width: 36, height: 36, fontSize: 14, background: "var(--cmc-orange)", color: "#fff" }}>
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "var(--fg-3)" }}>{user.email}</div>
            </div>
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button className="btn btn--ghost" style={{ padding: 6 }} title="Log out" onClick={onLogout} aria-label="Log out">
              <IconLogin size={16} />
            </button>
          </div>
        </aside>

        <main className="dashboard__main">
          {active === "dashboard" && <DashboardHome user={user} setActive={setActive} />}
          {active === "reservations" && <ReservationsView />}
          {active === "events" && <DashboardEvents />}
          {active === "bands" && <BandsView />}
          {active === "profile" && <ProfileView user={user} />}
          {active === "billing" && <BillingView />}
          {active === "settings" && <SettingsView />}
        </main>
      </div>
    </>
  );
}

function DashboardHome({ user, setActive }) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user.name.split(" ")[0]}.</h1>
          <p>Here's what's happening in the Collective this week.</p>
        </div>
        <Button variant="primary" onClick={() => setActive("reservations")}>Book Practice Space</Button>
      </div>

      <div className="grid-3" style={{ marginBottom: 28 }}>
        <Stat label="Free Hours Left This Month" value="6 / 10" sub="Sustaining member benefit" variant="primary" />
        <Stat label="Upcoming Reservations" value="2" sub="Next: Thu, Dec 5 · 7 PM" />
        <Stat label="Bands You're In" value="2" sub="Indigo Kiss · Monarch! Anarchy" />
      </div>

      <div className="table-card" style={{ marginBottom: 28 }}>
        <div className="table-card__head">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Your reservations</h2>
          <Button variant="outline">New reservation</Button>
        </div>
        <table className="table">
          <thead>
            <tr><th>When</th><th>Room</th><th>Band</th><th>Status</th><th>Cost</th></tr>
          </thead>
          <tbody>
            <tr><td>Thu, Dec 5 · 7:00 – 9:00 PM</td><td>Main Practice</td><td>Indigo Kiss</td><td><Badge variant="primary">Confirmed</Badge></td><td>Free (member)</td></tr>
            <tr><td>Sun, Dec 8 · 2:00 – 4:00 PM</td><td>Main Practice</td><td>Monarch! Anarchy</td><td><Badge variant="warning">Pending</Badge></td><td>$30.00</td></tr>
            <tr><td>Tue, Nov 26 · 6:00 – 8:00 PM</td><td>Main Practice</td><td>Indigo Kiss</td><td><Badge variant="accent">Completed</Badge></td><td>Free</td></tr>
          </tbody>
        </table>
      </div>

      <div className="grid-2">
        <Card>
          <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>Upcoming events</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SAMPLE_EVENTS.slice(0, 3).map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <img src={e.poster} alt="" style={{ width: 56, height: 70, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{e.title}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-2)" }}>{e.date}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>Activity</h3>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
            <li><strong>Maya Rivera</strong> joined <strong>Indigo Kiss</strong> · 2h ago</li>
            <li>Your reservation on <strong>Thu, Dec 5</strong> was confirmed · yesterday</li>
            <li><strong>Real Book Club</strong> · 12 going · 3 days ago</li>
            <li>Open House poster uploaded · last week</li>
          </ul>
        </Card>
      </div>
    </>
  );
}

function ReservationsView() {
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reservations</h1>
          <p>Book the practice room — $15/hour, free hours for sustaining members.</p>
        </div>
        <Button variant="primary">New reservation</Button>
      </div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <Stat label="Free Hours Left" value="6 / 10" sub="Resets on the 1st" variant="primary" />
        <Stat label="Hours This Month" value="4" sub="2 sessions" />
      </div>
      <div className="table-card">
        <div className="table-card__head">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Upcoming</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <Badge variant="outline-secondary">This week</Badge>
            <Badge variant="outline-primary">This month</Badge>
          </div>
        </div>
        <table className="table">
          <thead><tr><th>When</th><th>Duration</th><th>Band</th><th>Status</th><th></th></tr></thead>
          <tbody>
            <tr><td>Thu, Dec 5 · 7:00 PM</td><td>2 hrs</td><td>Indigo Kiss</td><td><Badge variant="primary">Confirmed</Badge></td><td><a href="#" style={{ color: "var(--cmc-orange)", fontWeight: 600 }} onClick={(e) => e.preventDefault()}>Manage</a></td></tr>
            <tr><td>Sun, Dec 8 · 2:00 PM</td><td>2 hrs</td><td>Monarch! Anarchy</td><td><Badge variant="warning">Pending payment</Badge></td><td><a href="#" style={{ color: "var(--cmc-orange)", fontWeight: 600 }} onClick={(e) => e.preventDefault()}>Pay</a></td></tr>
            <tr><td>Wed, Dec 18 · 5:00 PM</td><td>1 hr</td><td>Solo</td><td><Badge variant="accent">Scheduled</Badge></td><td><a href="#" style={{ color: "var(--cmc-orange)", fontWeight: 600 }} onClick={(e) => e.preventDefault()}>Manage</a></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function DashboardEvents() {
  return (
    <>
      <div className="page-header">
        <div><h1>Events</h1><p>Events you're hosting or attending.</p></div>
        <Button variant="primary">Submit a show</Button>
      </div>
      <div className="grid-3">
        {SAMPLE_EVENTS.slice(0, 3).map((e) => <EventCard key={e.id} event={e} />)}
      </div>
    </>
  );
}

function BandsView() {
  return (
    <>
      <div className="page-header">
        <div><h1>Your Bands</h1><p>Two active bands. Tap to manage members and reservations.</p></div>
        <Button variant="primary">New band</Button>
      </div>
      <div className="grid-2">
        {[
          { name: "Indigo Kiss", role: "Bass · Vocals", members: 4, avatarBg: "#003b5c", tags: ["Indie", "Active"] },
          { name: "Monarch! Anarchy", role: "Founder · Synth", members: 3, avatarBg: "#f84d13", tags: ["Punk", "Active"] },
        ].map((b) => (
          <Card key={b.name}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div className="member__avatar" style={{ background: b.avatarBg, color: "#fff" }}>
                {b.name.split(" ")[0].slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{b.name}</div>
                <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{b.role} · {b.members} members</div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  {b.tags.map((t) => <Badge key={t} variant="outline-primary">{t}</Badge>)}
                </div>
              </div>
              <IconChevronRight size={20} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function ProfileView({ user }) {
  return (
    <>
      <div className="page-header"><div><h1>Profile</h1><p>How other members see you in the directory.</p></div></div>
      <div className="grid-2">
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <div className="member__avatar" style={{ width: 72, height: 72, fontSize: 24, background: "var(--cmc-orange)", color: "#fff" }}>
              {user.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{user.name}</h2>
              <div style={{ fontSize: 13, color: "var(--fg-2)" }}>Bass · Vocals · Songwriter</div>
            </div>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--fg-2)" }}>Corvallis-based bass player and songwriter. Plays with Indigo Kiss and occasionally sits in for Real Book Club. Available for session work.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {["Bass", "Vocals", "Soul", "R&B", "Available for session"].map((t) => <Badge key={t} variant="outline-primary">{t}</Badge>)}
          </div>
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 700 }}>Edit profile</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Display name</label>
              <input defaultValue={user.name} style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Headline</label>
              <input defaultValue="Bass · Vocals · Songwriter" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 8, fontSize: 14, fontFamily: "inherit" }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Bio</label>
              <textarea rows={3} defaultValue="Corvallis-based bass player and songwriter…" style={{ width: "100%", padding: "10px 12px", border: "1.5px solid rgba(0,0,0,0.15)", borderRadius: 8, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
            </div>
            <Button variant="primary">Save changes</Button>
          </div>
        </Card>
      </div>
    </>
  );
}

function BillingView() {
  return (
    <>
      <div className="page-header"><div><h1>Billing</h1><p>Sustaining membership and one-off charges.</p></div></div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <Card variant="primary">
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Current plan</div>
          <div style={{ fontSize: 26, fontWeight: 700, margin: "8px 0 4px" }}>Sustaining Member</div>
          <div style={{ fontSize: 14, opacity: 0.85 }}>$25/month · renews Jan 1, 2026</div>
          <div style={{ marginTop: 16 }}><Button variant="secondary">Manage subscription</Button></div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--fg-3)" }}>Payment method</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <IconCreditCard size={24} />
            <div>
              <div style={{ fontWeight: 700 }}>Visa ending 4242</div>
              <div style={{ fontSize: 12, color: "var(--fg-2)" }}>Expires 06/28</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}><Button variant="outline">Update card</Button></div>
        </Card>
      </div>
      <div className="table-card">
        <div className="table-card__head"><h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Recent charges</h2></div>
        <table className="table">
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            <tr><td>Dec 1, 2025</td><td>Sustaining membership · December</td><td>$25.00</td><td><Badge variant="accent">Paid</Badge></td></tr>
            <tr><td>Nov 26, 2025</td><td>Practice space · 2 hrs (Indigo Kiss)</td><td>$0.00</td><td><Badge variant="accent">Free hours</Badge></td></tr>
            <tr><td>Nov 1, 2025</td><td>Sustaining membership · November</td><td>$25.00</td><td><Badge variant="accent">Paid</Badge></td></tr>
            <tr><td>Oct 18, 2025</td><td>Practice space · 1 hr</td><td>$15.00</td><td><Badge variant="accent">Paid</Badge></td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsView() {
  return (
    <>
      <div className="page-header"><div><h1>Settings</h1><p>Notifications, privacy, and account preferences.</p></div></div>
      <div className="grid-2">
        <Card>
          <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 700 }}>Notifications</h3>
          {["New events", "Reservation confirmations", "Band invitations", "Real Book Club reminders"].map((label, i) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 14 }}>
              <input type="checkbox" defaultChecked={i !== 3} />
              {label}
            </label>
          ))}
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 700 }}>Visibility</h3>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55 }}>Show your profile in the public directory at corvmc.org.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
            <input type="checkbox" defaultChecked /> Listed in public directory
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, marginTop: 6 }}>
            <input type="checkbox" defaultChecked /> Available for session work
          </label>
        </Card>
      </div>
    </>
  );
}

Object.assign(window, {
  HomePage, EventsPage, DirectoryPage, ProgramsPage, ContributePage,
  LoginModal, MemberDashboard,
});
