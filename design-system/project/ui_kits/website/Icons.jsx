// Icons.jsx — Tabler-styled inline SVG icons used across the UI kit.
// Tabler convention: 24×24 viewBox, stroke="currentColor", stroke-width="2",
// round caps/joins. We re-implement only the icons referenced by the site.

const I = ({ children, size = 20, className = "", strokeWidth = 2, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...rest}
  >
    {children}
  </svg>
);

const IconCalendar = (p) => (
  <I {...p}>
    <rect x="4" y="5" width="16" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M4 11h16" />
  </I>
);
const IconUsers = (p) => (
  <I {...p}>
    <circle cx="9" cy="7" r="4" />
    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    <path d="M21 21v-2a4 4 0 0 0-3-3.85" />
  </I>
);
const IconList = (p) => (
  <I {...p}>
    <line x1="9" y1="6" x2="20" y2="6" />
    <line x1="9" y1="12" x2="20" y2="12" />
    <line x1="9" y1="18" x2="20" y2="18" />
    <circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" />
  </I>
);
const IconApps = (p) => (
  <I {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 17h6M17 14v6" />
  </I>
);
const IconHeartHandshake = (p) => (
  <I {...p}>
    <path d="M19 14l-7 7-7-7a5 5 0 0 1 7-7 5 5 0 0 1 7 7z" />
    <path d="M12 5L9.5 7.5l3 3-1.5 1.5 2.5 2.5 4.5-4.5" />
  </I>
);
const IconMusic = (p) => (
  <I {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </I>
);
const IconMicrophone = (p) => (
  <I {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </I>
);
const IconMicrophone2 = (p) => (
  <I {...p}>
    <path d="M15 12.5V6a3 3 0 0 0-6 0v6.5" />
    <path d="M9 17h6" />
    <path d="M4 4l16 16" />
  </I>
);
const IconBook = (p) => (
  <I {...p}>
    <path d="M3 19a2 2 0 0 1 2-2h14V4H5a2 2 0 0 0-2 2v13z" />
    <path d="M3 19a2 2 0 0 0 2 2h14v-4" />
  </I>
);
const IconClock = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </I>
);
const IconLogin = (p) => (
  <I {...p}>
    <path d="M15 12H3" />
    <path d="M11 8l-4 4 4 4" />
    <path d="M15 4h5v16h-5" />
  </I>
);
const IconLayoutDashboard = (p) => (
  <I {...p}>
    <rect x="4" y="4" width="6" height="9" rx="1" fill="currentColor" />
    <rect x="14" y="4" width="6" height="5" rx="1" fill="currentColor" />
    <rect x="4" y="15" width="6" height="5" rx="1" fill="currentColor" />
    <rect x="14" y="11" width="6" height="9" rx="1" fill="currentColor" />
  </I>
);
const IconAlertCircle = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </I>
);
const IconAlertTriangle = (p) => (
  <I {...p}>
    <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
  </I>
);
const IconInfoCircle = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
    <polyline points="11 12 12 12 12 16 13 16" />
  </I>
);
const IconFlame = (p) => (
  <I {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.5-.5-2-1-3-1.25-2.5.5-5 2.5-5 3 0 6 4 6 8a6 6 0 0 1-12 0c0-1.5.5-3 1-4" />
  </I>
);
const IconGuitarPick = (p) => (
  <I {...p}>
    <path d="M12 3c-4 0-8 2-8 6 0 5 4 12 8 12s8-7 8-12c0-4-4-6-8-6z" />
  </I>
);
const IconHome = (p) => (
  <I {...p}>
    <path d="M3 12L12 4l9 8" />
    <path d="M5 10v10h14V10" />
  </I>
);
const IconSettings = (p) => (
  <I {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </I>
);
const IconCreditCard = (p) => (
  <I {...p}>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </I>
);
const IconMenu = (p) => (
  <I {...p}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </I>
);
const IconChevronRight = (p) => (
  <I {...p}>
    <polyline points="9 6 15 12 9 18" />
  </I>
);
const IconFacebook = (p) => (
  <svg width={p.size || 20} height={p.size || 20} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 12c0-5.5-4.5-10-10-10S2 6.5 2 12c0 5 3.7 9.1 8.4 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7C18.3 21.1 22 17 22 12z" />
  </svg>
);
const IconInstagram = (p) => (
  <I {...p}>
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </I>
);

Object.assign(window, {
  IconCalendar, IconUsers, IconList, IconApps, IconHeartHandshake,
  IconMusic, IconMicrophone, IconMicrophone2, IconBook, IconClock,
  IconLogin, IconLayoutDashboard, IconAlertCircle, IconAlertTriangle,
  IconInfoCircle, IconFlame, IconGuitarPick, IconHome, IconSettings,
  IconCreditCard, IconMenu, IconChevronRight, IconFacebook, IconInstagram,
});
