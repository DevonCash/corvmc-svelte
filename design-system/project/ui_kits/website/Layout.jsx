// Layout.jsx — Header (with tri-stripe) + Footer chrome for the public site.

function TriStripe({ variant = "public" }) {
  const style =
    variant === "navy"
      ? { background:
          "linear-gradient(to bottom, var(--cmc-navy) 0 33.333%, var(--cmc-goldenrod) 33.333% 66.666%, var(--cmc-red-orange) 66.666% 100%)",
      }
      : undefined;
  return <div className="tri-stripe" style={style} />;
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      className="btn btn--ghost"
      onClick={onToggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ padding: 8 }}
    >
      {isDark ? (
        // Sun (light-mode target)
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon (dark-mode target)
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

function Header({ active, onNavigate, onLoginClick, theme, onToggleTheme }) {
  const links = [
    { id: "events", label: "Events" },
    { id: "directory", label: "Directory" },
    { id: "resources", label: "Resources" },
    { id: "programs", label: "Programs" },
  ];
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <a
          className="site-header__logo"
          href="#"
          onClick={(e) => { e.preventDefault(); onNavigate("home"); }}
          aria-label="Corvallis Music Collective — home"
        >
          <img src="../../assets/logos/cmc-speaker.png" alt="" />
        </a>
        <div className="site-header__title">Corvallis Music Collective</div>
        <div className="site-header__actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="btn btn--ghost" onClick={onLoginClick}>
            <IconLogin size={18} />
            Login
          </button>
        </div>
        <nav className="site-header__nav">
          {links.map((l) => (
            <a
              key={l.id}
              href="#"
              className={active === l.id ? "is-active" : ""}
              onClick={(e) => { e.preventDefault(); onNavigate(l.id); }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#"
            className="btn btn--outline"
            style={{ marginLeft: 12 }}
            onClick={(e) => { e.preventDefault(); onNavigate("contribute"); }}
          >
            <IconHeartHandshake size={18} />
            Contribute
          </a>
        </nav>
      </div>
      <TriStripe />
    </header>
  );
}

function Footer() {
  const footerLinks = [
    "About", "Programs", "Events", "Directory", "Contribute", "Bylaws", "Privacy", "Contact",
  ];
  return (
    <footer className="site-footer">
      <div className="site-footer__row">
        {footerLinks.map((l) => (
          <a key={l} href="#" onClick={(e) => e.preventDefault()}>{l}</a>
        ))}
      </div>
      <div className="site-footer__socials">
        <a href="#" onClick={(e) => e.preventDefault()} aria-label="Facebook"><IconFacebook size={22} /></a>
        <a href="#" onClick={(e) => e.preventDefault()} aria-label="Instagram"><IconInstagram size={22} /></a>
      </div>
      <div className="site-footer__copy">
        © 2026 Corvallis Music Collective. All rights reserved.<br />
        Corvallis Music Collective is a 501(c)(3) nonprofit. 6775 SW Philomath Blvd, Corvallis, OR.
      </div>
    </footer>
  );
}

Object.assign(window, { TriStripe, Header, Footer, ThemeToggle });
