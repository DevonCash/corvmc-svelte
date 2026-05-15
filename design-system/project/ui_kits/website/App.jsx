// App.jsx — top-level router for the click-through prototype.

const THEME_STORAGE_KEY = "cmc-ui-kit-theme";

function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

function App() {
  const [page, setPage] = React.useState("home");
  const [focusedEvent, setFocusedEvent] = React.useState(null);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [user, setUser] = React.useState(null);
  const [theme, setTheme] = React.useState(getInitialTheme);

  React.useEffect(() => {
    applyTheme(theme);
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  function navigate(target) {
    setFocusedEvent(null);
    setPage(target);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function handleLogin() {
    setUser({ name: "Maya Rivera", email: "maya@corvmc.org" });
    setLoginOpen(false);
    setPage("member");
  }

  // -------- Member dashboard view: bypasses the public layout entirely
  if (user && page === "member") {
    return (
      <MemberDashboard
        user={user}
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogout={() => { setUser(null); setPage("home"); }}
      />
    );
  }

  // -------- Public layout
  return (
    <>
      <Header
        active={page}
        onNavigate={navigate}
        onLoginClick={() => { user ? setPage("member") : setLoginOpen(true); }}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {page === "home" && <HomePage onNavigate={navigate} />}
      {page === "events" && <EventsPage onNavigate={navigate} focusedEvent={focusedEvent} setFocusedEvent={setFocusedEvent} />}
      {page === "directory" && <DirectoryPage />}
      {page === "programs" && <ProgramsPage />}
      {page === "contribute" && <ContributePage />}
      {page === "resources" && (
        <Section>
          <SectionHeader title="Local Resources" lede="A community-maintained list of music shops, venues, teachers, and engineers in Corvallis." />
          <div className="grid-3">
            {[
              ["Troubadour Music Center", "Instrument repair · lessons · gear"],
              ["Whiteside Theatre", "Historic theatre · all-ages venue"],
              ["Bombs Away Cafe", "Live music · happy hour"],
              ["Cloud 9 Studios", "Tracking + mixing · CMC-friendly rates"],
              ["Corvallis Community Radio", "Local airplay submissions"],
              ["OSU Music Department", "Lessons · ensembles · scholarships"],
            ].map(([n, m]) => (
              <Card key={n}>
                <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 700 }}>{n}</h3>
                <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{m}</div>
              </Card>
            ))}
          </div>
        </Section>
      )}
      {page === "about" && (
        <>
          <Hero title="About CMC" body="A volunteer-run nonprofit dedicated to building and connecting music communities in Corvallis." />
          <Section>
            <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16, fontSize: 16, lineHeight: 1.7, color: "var(--fg-1)" }}>
              <p>The Corvallis Music Collective started as a handful of musicians looking for a room to rehearse in. Five years later we run a sound-treated practice room with a full PA, a gear lending library, monthly meet-ups and shows, and a small studio space for demos.</p>
              <p>Everything we do is built around three ideas — keep it affordable, keep it inclusive, and let the musicians lead.</p>
            </div>
          </Section>
        </>
      )}

      <Footer />

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} onSubmit={handleLogin} />}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
