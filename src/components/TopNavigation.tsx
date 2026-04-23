import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import "./top-navigation.css";

type NavKey =
  | "dashboard"
  | "ai"
  | "caselaw"
  | "bareacts"
  | "lawcommission"
  | "notifications"
  | "history";

type Props = {
  userName: string;
  onLogout: () => void | Promise<void>;
  currentSection?: NavKey;
  logoSrc?: string;
  cfBaseUrl?: string;
  aiBaseUrl?: string;
};

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: ReactNode;
};

function getInitials(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (
    words[0].charAt(0) + words[words.length - 1].charAt(0)
  ).toUpperCase();
}

function IconWrap({ children }: { children: React.ReactNode }) {
  return <span className="nav-icon">{children}</span>;
}

function DashboardIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="5" rx="2" />
        <rect x="13" y="10" width="8" height="11" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
      </svg>
    </IconWrap>
  );
}

function AiIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="7" y="7" width="10" height="10" rx="3" />
        <path d="M9 3v2M15 3v2M9 19v2M15 19v2M19 9h2M19 15h2M3 9h2M3 15h2" />
        <circle cx="10" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="14" cy="12" r="1" fill="currentColor" stroke="none" />
        <path d="M10 15c.6.5 1.3.75 2 .75s1.4-.25 2-.75" />
      </svg>
    </IconWrap>
  );
}

function CaseLawIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M8 4h8l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path d="M16 4v4h4" />
        <path d="M9 13h6M9 17h6M9 9h3" />
      </svg>
    </IconWrap>
  );
}

function BareActsIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22Z" />
        <path d="M5 4.5v17" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </svg>
    </IconWrap>
  );
}

function BalanceIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3v18M6 7h12M8 7l-3 5a3 3 0 0 0 6 0L8 7Zm8 0-3 5a3 3 0 0 0 6 0l-3-5ZM8 21h8" />
      </svg>
    </IconWrap>
  );
}

// coin icon inlined where needed to avoid JSX parse issues

function BellIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 17H5l2-2v-4a5 5 0 1 1 10 0v4l2 2h-4" />
        <path d="M9 17a3 3 0 0 0 6 0" />
      </svg>
    </IconWrap>
  );
}

function HistoryIcon() {
  return (
    <IconWrap>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    </IconWrap>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="menu-svg" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="menu-svg" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="menu-item-icon" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="menu-item-icon" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.5 2.6 3 .7-.7 3 2.2 2.1-2.2 2.1.7 3-3 .7L12 21l-1.5-2.6-3-.7.7-3L6 12.3l2.2-2.1-.7-3 3-.7L12 3Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="menu-item-icon" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export default function TopNavigation({
  userName,
  onLogout,
  currentSection = "ai",
  logoSrc = "/logo.png",
  cfBaseUrl = import.meta.env.VITE_CF_BASE_URL || "https://beta2.lawsuitcasefinder.com",
  aiBaseUrl = import.meta.env.VITE_AI_BASE_URL || window.location.origin,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef<HTMLDivElement | null>(null);

  const NAV_DASHBOARD = import.meta.env.VITE_NAV_DASHBOARD as string | undefined;
  const NAV_AI = import.meta.env.VITE_NAV_AI as string | undefined;
  const NAV_CASELAW = import.meta.env.VITE_NAV_CASELAW as string | undefined;
  const NAV_BAREACTS = import.meta.env.VITE_NAV_BAREACTS as string | undefined;
  const NAV_LAWCOMMISSION = import.meta.env.VITE_NAV_LAWCOMMISSION as string | undefined;
  const NAV_NOTIFICATIONS = import.meta.env.VITE_NAV_NOTIFICATIONS as string | undefined;
  const NAV_HISTORY = import.meta.env.VITE_NAV_HISTORY as string | undefined;
  const NAV_LOGOUT = import.meta.env.VITE_NAV_LOGOUT as string | undefined;

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        key: "dashboard",
        label: "Dashboard",
        href: NAV_DASHBOARD || `${cfBaseUrl}/Lawsuit/welcome`,
        icon: <DashboardIcon />,
      },
      {
        key: "ai",
        label: "Lawsuit AI",
        href: NAV_AI || `${aiBaseUrl}/dashboard`,
        icon: <AiIcon />,
      },
      {
        key: "caselaw",
        label: "Case Laws",
        href: NAV_CASELAW || `${cfBaseUrl}/Lawsuit/caselaw`,
        icon: <CaseLawIcon />,
      },
      {
        key: "bareacts",
        label: "Bare Acts",
        href: NAV_BAREACTS || `${cfBaseUrl}/Lawsuit/bareacts`,
        icon: <BareActsIcon />,
      },
      {
        key: "lawcommission",
        label: "Law Commission",
        href: NAV_LAWCOMMISSION || `${cfBaseUrl}/Lawsuit/lawcommission`,
        icon: <BalanceIcon />,
      },
      {
        key: "notifications",
        label: "Notifications",
        href: NAV_NOTIFICATIONS || `${cfBaseUrl}/Lawsuit/notifications`,
        icon: <BellIcon />,
      },
      {
        key: "history",
        label: "History",
        href: NAV_HISTORY || `${cfBaseUrl}/Lawsuit/history`,
        icon: <HistoryIcon />,
      },
    ],
    [cfBaseUrl, aiBaseUrl]
  );

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!userRef.current) return;
      if (!userRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const initials = getInitials(userName || "U");

  return (
    <>
      <div className="mob-header mobile">
        <div className="mob-logo">
          <img src={logoSrc} alt="Lawsuit Logo" />
        </div>

        <div className="mob-right">
          <button
            type="button"
            className="ham-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
        </div>

        <div className={`mob-overlay ${mobileOpen ? "is-open" : ""}`}>
          <div className="mob-menu">
            <button
              type="button"
              className="mob-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>

            {navItems.map((item) => (
              <div
                key={item.key}
                className={`mob-menu-item ${currentSection === item.key ? "mob-active" : ""}`}
              >
                <a href={item.href}>{item.label}</a>
              </div>
            ))}

            <div className="mob-menu-divider" />

            <div className="mob-menu-item">
              <a href={`${cfBaseUrl}/Lawsuit/myprofile/updateprofile`}>Profile</a>
            </div>
            <div className="mob-menu-item">
              <a href={`${cfBaseUrl}/Lawsuit/myprofile`}>Subscription Options</a>
            </div>
            <div className="mob-menu-item">
              <a href={`${cfBaseUrl}/Lawsuit/myprofile/changepwd`}>Change Password</a>
            </div>
            <div className="mob-menu-item">
              {NAV_LOGOUT ? (
                <a href={NAV_LOGOUT}>Logout</a>
              ) : (
                <button
                  type="button"
                  className="mob-logout-btn"
                  onClick={onLogout}
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="header desktop">
        <div className="logo">
          <img src={logoSrc} alt="Lawsuit Logo" />
        </div>

        <div className="flex-container nav-menu">
          {navItems.map((item) => (
            <div key={item.key} className={`text ${currentSection === item.key ? "text-active" : ""}`}>
              <a href={item.href}>
                {item.icon}
                {item.label}
              </a>
            </div>
          ))}
        </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

          <div className="user" ref={userRef} onClick={() => setUserMenuOpen((prev) => !prev)}>
            <div className="user-image">
              <span className="user-initials">{initials}</span>
            </div>

            <div className={`us-dropdown-menu ${userMenuOpen ? "is-open" : ""}`}>
              <a href={`${cfBaseUrl}/Lawsuit/myprofile/updateprofile`}>
                <ProfileIcon />
                <span>Profile</span>
              </a>
              <a href={`${cfBaseUrl}/Lawsuit/myprofile`}>
                <ProfileIcon />
                <span>Subscription Options</span>
              </a>
              <a href={`${cfBaseUrl}/Lawsuit/myprofile/changepwd`}>
                <SettingsIcon />
                <span>Change Password</span>
              </a>
              {NAV_LOGOUT ? (
                <a href={NAV_LOGOUT} onClick={(e) => e.stopPropagation()}>
                  <LogoutIcon />
                  <span>Logout</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="user-menu-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLogout();
                  }}
                >
                  <LogoutIcon />
                  <span>Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}