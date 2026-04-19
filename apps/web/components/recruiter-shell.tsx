"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AUTH_SESSION_MODE } from "../lib/auth/runtime";
import {
  canAccessRoute,
  canPerformAction,
  getPrimaryRole,
  getRoleLabel,
  isInternalOnlyRoute,
  isInternalAdminSession,
  type AppPermission
} from "../lib/auth/policy";
import {
  logoutCurrentSession,
  resolveActiveSession,
  resolveSessionFromServer
} from "../lib/auth/session";
import type { WebAuthSession } from "../lib/auth/types";
import { useUiText, useSiteLanguage } from "./site-language-provider";
import { useTheme } from "./theme-provider";
import { PublicLanding } from "./public-landing";

type NavItem = {
  href:
    | "/dashboard"
    | "/jobs"
    | "/sourcing"
    | "/interviews"
    | "/candidates"
    | "/reports"
    | "/subscription"
    | "/team"
    | "/admin"
    | "/admin/red-alert"
    | "/admin/leads"
    | "/admin/users"
    | "/admin/settings"
    | "/admin/enterprise"
    | "/settings";
  label: string;
  permission: AppPermission;
  internalOnly?: boolean;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type FloatingMenuStyle = {
  top: number;
  left: number;
  width: number;
};

const primaryNavGroups: NavGroup[] = [
  {
    label: "Ürün",
    items: [
      { href: "/dashboard", label: "Genel Bakış", permission: "job.read" },
      { href: "/jobs", label: "İlan Merkezi", permission: "job.read" },
      { href: "/interviews", label: "Mülakatlar", permission: "interview.read" },
      { href: "/candidates", label: "Aday Havuzu", permission: "candidate.read" },
      { href: "/reports", label: "Raporlar", permission: "report.read" }
    ]
  },
  {
    label: "Hesap",
    items: [
      { href: "/subscription", label: "Abonelik", permission: "tenant.manage" },
      { href: "/team", label: "Ekip", permission: "user.manage" },
      { href: "/settings", label: "Ayarlar", permission: "user.manage" }
    ]
  },
  {
    label: "İç Yönetim",
    items: [
      { href: "/admin", label: "Yönetici Paneli", permission: "tenant.manage", internalOnly: true },
      { href: "/admin/settings", label: "Sistem Ayarları", permission: "tenant.manage", internalOnly: true },
      { href: "/admin/red-alert", label: "Kırmızı Alarm", permission: "tenant.manage", internalOnly: true },
      { href: "/admin/leads", label: "Leadler", permission: "tenant.manage", internalOnly: true },
      { href: "/admin/users", label: "Kullanıcılar", permission: "tenant.manage", internalOnly: true },
      { href: "/admin/enterprise", label: "Kurumsal", permission: "tenant.manage", internalOnly: true },
      { href: "/sourcing", label: "Kaynak Bulma", permission: "job.read", internalOnly: true, badge: "Beta" }
    ]
  }
];

function resolveActiveNavHref(pathname: string): NavItem["href"] | null {
  if (pathname === "/dashboard") {
    return "/dashboard";
  }

  if (pathname === "/jobs" || pathname.startsWith("/jobs/")) {
    return "/jobs";
  }

  if (pathname === "/sourcing" || pathname.startsWith("/sourcing/")) {
    return "/sourcing";
  }

  if (pathname === "/interviews" || pathname.startsWith("/interviews/")) {
    return "/interviews";
  }

  if (
    pathname === "/candidates" ||
    pathname.startsWith("/candidates/")
  ) {
    return "/candidates";
  }

  if (
    pathname === "/applications" ||
    pathname.startsWith("/applications/") ||
    pathname.startsWith("/gorusme/") ||
    pathname.startsWith("/randevu/")
  ) {
    return "/jobs";
  }

  if (
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/raporlar" ||
    pathname.startsWith("/raporlar/")
  ) {
    return "/reports";
  }

  if (
    pathname === "/subscription" ||
    pathname.startsWith("/subscription/") ||
    pathname === "/abonelik" ||
    pathname.startsWith("/abonelik/") ||
    pathname === "/dashboard/subscription" ||
    pathname.startsWith("/dashboard/subscription/")
  ) {
    return "/subscription";
  }

  if (
    pathname === "/team" ||
    pathname.startsWith("/team/") ||
    pathname === "/ekip" ||
    pathname.startsWith("/ekip/")
  ) {
    return "/team";
  }

  if (
    pathname === "/admin" ||
    pathname === "/yonetim" ||
    pathname.startsWith("/yonetim/") ||
    pathname === "/dashboard/admin" ||
    pathname.startsWith("/dashboard/admin/")
  ) {
    return "/admin";
  }

  if (pathname === "/admin/red-alert" || pathname.startsWith("/admin/red-alert/")) {
    return "/admin/red-alert";
  }

  if (pathname === "/admin/leads" || pathname.startsWith("/admin/leads/")) {
    return "/admin/leads";
  }

  if (pathname === "/admin/settings" || pathname.startsWith("/admin/settings/")) {
    return "/admin/settings";
  }

  if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) {
    return "/admin/users";
  }

  if (pathname === "/admin/enterprise" || pathname.startsWith("/admin/enterprise/")) {
    return "/admin/enterprise";
  }

  if (
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/ayarlar" ||
    pathname.startsWith("/ayarlar/") ||
    pathname === "/ai-support" ||
    pathname.startsWith("/ai-support/") ||
    pathname === "/ai-destek" ||
    pathname.startsWith("/ai-destek/") ||
    pathname === "/audit-logs" ||
    pathname.startsWith("/audit-logs/")
  ) {
    return "/settings";
  }

  return null;
}

function getInitials(label: string): string {
  return label
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function clampMenuOffset(value: number, min: number, max: number) {
  if (max <= min) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

export function RecruiterShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useUiText();
  const isDetailPage =
    (pathname.startsWith("/jobs/") && pathname !== "/jobs" && pathname !== "/jobs/new") ||
    (pathname.startsWith("/sourcing/") && pathname !== "/sourcing") ||
    (pathname.startsWith("/candidates/") && pathname !== "/candidates" && pathname !== "/candidates/new") ||
    (pathname.startsWith("/applications/") && pathname !== "/applications");
  const isWidePage =
    isDetailPage ||
    pathname === "/admin/users" ||
    pathname.startsWith("/admin/users/");
  const [session, setSession] = useState<WebAuthSession | null>(() => resolveActiveSession());
  const [checkingCookieSession, setCheckingCookieSession] = useState(
    AUTH_SESSION_MODE === "jwt" || AUTH_SESSION_MODE === "hybrid"
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      if (AUTH_SESSION_MODE !== "jwt" && AUTH_SESSION_MODE !== "hybrid") {
        setCheckingCookieSession(false);
        return;
      }

      const resolved = await resolveSessionFromServer(resolveActiveSession());

      if (cancelled) {
        return;
      }

      if (resolved) {
        setSession(resolved);
      } else if (AUTH_SESSION_MODE === "jwt") {
        setSession(null);
      }

      setCheckingCookieSession(false);
    }

    void hydrateFromServer();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (canAccessRoute(session, pathname)) {
      return;
    }

    if (!isInternalOnlyRoute(pathname)) {
      return;
    }

    router.replace("/dashboard");
  }, [pathname, router, session]);

  if (checkingCookieSession) {
    return (
      <div className="app-layout">
        <main>
          <section className="panel" style={{ maxWidth: 480, margin: "80px auto" }}>
              <div className="loading-state">
              <div className="loading-spinner" />
              <p className="loading-text">{t("Oturum kontrol ediliyor...")}</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!session) {
    if (pathname === "/") {
      // Root page kendi landing'ini gösterecek
      return <>{children}</>;
    }

    // Session yok ve panel sayfasindayiz — login'e yonlendir
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    }
    return null;
  }

  if (!canAccessRoute(session, pathname)) {
    if (isInternalOnlyRoute(pathname)) {
      return null;
    }

    return (
      <div className="app-layout">
        <aside className="sidebar">
          <SidebarContent session={session} pathname={pathname} />
        </aside>
        <div className="main-content">
          <div className="main-content-inner">
            <section className="panel" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
              <div style={{ padding: "20px 0" }}>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>{t("Yetki yok")}</h2>
                <p className="small" style={{ margin: 0 }}>
                  {t("Bu sayfa için gerekli yetkiniz bulunmuyor.")}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <SidebarContent session={session} pathname={pathname} />
      </aside>

      <div className="main-content">
        <div className={`main-content-inner${isWidePage ? " main-content-inner-wide" : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  session,
  pathname
}: {
  session: WebAuthSession;
  pathname: string;
}) {
  const router = useRouter();
  const { t } = useUiText();
  const language = useSiteLanguage();
  const theme = useTheme();
  const primaryRole = getPrimaryRole(session);
  const activeNavHref = resolveActiveNavHref(pathname);
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [languageMenuStyle, setLanguageMenuStyle] = useState<FloatingMenuStyle | null>(null);
  const [themeMenuStyle, setThemeMenuStyle] = useState<FloatingMenuStyle | null>(null);
  const languageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const accountCardRef = useRef<HTMLDivElement | null>(null);
  const themeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const localeLabels =
    language.locale === "tr"
      ? { tr: "Türkçe", en: "English" }
      : { tr: "Turkish", en: "English" };
  const themeOptions = [
    { mode: "light" as const, label: t("Açık") },
    { mode: "dark" as const, label: t("Koyu") },
    { mode: "system" as const, label: t("Sistem") }
  ];
  const compactRoleLabels =
    language.locale === "tr"
      ? { owner: "Sahip", manager: "Yönetici", staff: "Uzman" }
      : { owner: "Owner", manager: "Manager", staff: "Staff" };
  const userRoleLabel = primaryRole ? compactRoleLabels[primaryRole] : session.roles;

  useEffect(() => {
    if (!accountOpen) {
      setThemeMenuOpen(false);
      setLanguageOpen(false);
    }
  }, [accountOpen]);

  useEffect(() => {
    if (!languageOpen && !accountOpen && !themeMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        languageOpen &&
        !languageTriggerRef.current?.contains(target) &&
        !languageMenuRef.current?.contains(target)
      ) {
        setLanguageOpen(false);
      }

      if (
        themeMenuOpen &&
        !themeTriggerRef.current?.contains(target) &&
        !themeMenuRef.current?.contains(target)
      ) {
        setThemeMenuOpen(false);
      }

      if (
        accountOpen &&
        !accountCardRef.current?.contains(target) &&
        !languageMenuRef.current?.contains(target) &&
        !themeMenuRef.current?.contains(target)
      ) {
        setAccountOpen(false);
        setLanguageOpen(false);
        setThemeMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setLanguageOpen(false);
      setThemeMenuOpen(false);
      setAccountOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen, languageOpen, themeMenuOpen]);

  useEffect(() => {
    if (!languageOpen && !themeMenuOpen) {
      return;
    }

    function updateFloatingMenus() {
      if (languageOpen && languageTriggerRef.current) {
        const rect = languageTriggerRef.current.getBoundingClientRect();
        const width = 176;
        const preferredLeft = rect.right + 12;
        const left =
          preferredLeft + width <= window.innerWidth - 12
            ? preferredLeft
            : clampMenuOffset(rect.left - width - 12, 12, window.innerWidth - width - 12);
        const menuHeight = 150;
        setLanguageMenuStyle({
          top: clampMenuOffset(rect.top - 8, 12, window.innerHeight - menuHeight - 12),
          left,
          width
        });
      }

      if (themeMenuOpen && themeTriggerRef.current) {
        const rect = themeTriggerRef.current.getBoundingClientRect();
        const width = 176;
        const preferredLeft = rect.right + 12;
        const left =
          preferredLeft + width <= window.innerWidth - 12
            ? preferredLeft
            : clampMenuOffset(rect.left - width - 12, 12, window.innerWidth - width - 12);
        const menuHeight = 150;
        setThemeMenuStyle({
          top: clampMenuOffset(rect.top - 8, 12, window.innerHeight - menuHeight - 12),
          left,
          width
        });
      }
    }

    updateFloatingMenus();
    window.addEventListener("resize", updateFloatingMenus);
    window.addEventListener("scroll", updateFloatingMenus, true);

    return () => {
      window.removeEventListener("resize", updateFloatingMenus);
      window.removeEventListener("scroll", updateFloatingMenus, true);
    };
  }, [languageOpen, themeMenuOpen]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await logoutCurrentSession(session);
      window.location.href = "/auth/login";
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/brand/candit-mark.svg" alt="" aria-hidden="true" width="34" height="34" />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Candit.ai</span>
            <span className="sidebar-brand-desc">{t("İşe alım işletim paneli")}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {primaryNavGroups.map((group) => {
          const items = group.items
            .filter((item) =>
              item.internalOnly
                ? isInternalAdminSession(session)
                : canPerformAction(session, item.permission)
            )
            .filter((item) => !item.internalOnly || isInternalAdminSession(session));

          if (items.length === 0) {
            return null;
          }

          return (
            <div key={group.label} className="sidebar-nav-group">
              <p className="sidebar-section-label">{t(group.label)}</p>
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={activeNavHref === item.href ? "nav-link active" : "nav-link"}
                >
                  <span>{t(item.label)}</span>
                  {item.badge ? <span className="nav-badge">{t(item.badge)}</span> : null}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-session">
        <div
          ref={accountCardRef}
          className="sidebar-session-card"
          data-open={accountOpen ? "true" : "false"}
        >
          <button
            type="button"
            className="sidebar-session-trigger"
            onClick={() => {
              setAccountOpen((current) => {
                const next = !current;
                if (next) {
                  setLanguageOpen(false);
                } else {
                  setThemeMenuOpen(false);
                }
                return next;
              });
            }}
            aria-expanded={accountOpen}
          >
            <div className="sidebar-avatar">{getInitials(session.userLabel)}</div>
            <div className="sidebar-user-details">
              <span className="sidebar-user-name">{t(session.userLabel)}</span>
              <div className="sidebar-user-meta">
                <span className="sidebar-user-badge">{userRoleLabel}</span>
              </div>
            </div>
            <svg
              className="sidebar-session-chevron"
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>

          {accountOpen ? (
            <div className="sidebar-session-panel">
              <button
                ref={themeTriggerRef}
                type="button"
                className="sidebar-session-action"
                data-open={themeMenuOpen ? "true" : "false"}
                aria-haspopup="menu"
                aria-expanded={themeMenuOpen}
                onClick={() => setThemeMenuOpen((current) => !current)}
              >
                <span className="sidebar-session-action-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1.75" y="2.25" width="12.5" height="8.5" rx="1.5"/>
                    <path d="M5.5 13.75h5"/>
                    <path d="M8 10.75v3"/>
                  </svg>
                </span>
                <span className="sidebar-session-action-label">{t("Tema")}</span>
                <svg
                  className="sidebar-session-action-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 4.5 4 3.5-4 3.5" />
                </svg>
              </button>
              <button
                ref={languageTriggerRef}
                type="button"
                className="sidebar-session-action"
                data-open={languageOpen ? "true" : "false"}
                aria-haspopup="menu"
                aria-expanded={languageOpen}
                onClick={() => {
                  setLanguageOpen((current) => {
                    const next = !current;
                    if (next) {
                      setThemeMenuOpen(false);
                    }
                    return next;
                  });
                }}
              >
                <span className="sidebar-session-action-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8" cy="8" r="6.25"/>
                    <path d="M8 1.75C8 1.75 5.5 4.75 5.5 8s2.5 6.25 2.5 6.25"/>
                    <path d="M8 1.75C8 1.75 10.5 4.75 10.5 8S8 14.25 8 14.25"/>
                    <path d="M1.75 8h12.5"/>
                  </svg>
                </span>
                <span className="sidebar-session-action-label">{t("Dil")}</span>
                <svg
                  className="sidebar-session-action-chevron"
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m6 4.5 4 3.5-4 3.5" />
                </svg>
              </button>
              <button
                type="button"
                className="sidebar-session-action sidebar-session-action-danger"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                <span className="sidebar-session-action-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.75 2.25h2.5A1.5 1.5 0 0 1 13.75 3.75v8.5a1.5 1.5 0 0 1-1.5 1.5h-2.5"/>
                    <path d="M6.75 11.25 10 8 6.75 4.75"/>
                    <path d="M10 8H2.25"/>
                  </svg>
                </span>
                <span className="sidebar-session-action-label">
                  {loggingOut ? t("Çıkış yapılıyor...") : t("Çıkış Yap")}
                </span>
              </button>
            </div>
          ) : null}
        </div>

        {languageOpen && languageMenuStyle ? (
          <div
            ref={languageMenuRef}
            className="sidebar-floating-menu sidebar-language-menu"
            style={{
              top: languageMenuStyle.top,
              left: languageMenuStyle.left,
              width: languageMenuStyle.width
            }}
            role="menu"
            aria-label={t("Dil")}
          >
            {([
              { value: "tr", short: "TR" },
              { value: "en", short: "EN" }
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                className="sidebar-floating-option"
                data-active={language.locale === option.value ? "true" : "false"}
                role="menuitemradio"
                aria-checked={language.locale === option.value}
                onClick={() => {
                  language.setLocale(option.value);
                  setLanguageOpen(false);
                }}
              >
                <span className="sidebar-floating-option-short">{option.short}</span>
                <span className="sidebar-floating-option-label">{localeLabels[option.value]}</span>
                <span className="sidebar-floating-option-check" aria-hidden="true">
                  {language.locale === option.value ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3.5 8.25 2.5 2.5 6-6" />
                    </svg>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {themeMenuOpen && themeMenuStyle ? (
          <div
            ref={themeMenuRef}
            className="sidebar-floating-menu sidebar-theme-menu"
            style={{
              top: themeMenuStyle.top,
              left: themeMenuStyle.left,
              width: themeMenuStyle.width
            }}
            role="menu"
            aria-label={t("Tema")}
          >
            {themeOptions.map((option) => (
              <button
                key={option.mode}
                type="button"
                className="sidebar-theme-option"
                data-active={theme.mode === option.mode ? "true" : "false"}
                role="menuitemradio"
                aria-checked={theme.mode === option.mode}
                onClick={() => {
                  theme.setMode(option.mode);
                  setThemeMenuOpen(false);
                }}
              >
                <span className="sidebar-theme-option-icon" aria-hidden="true">
                  {option.mode === "light" ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="8" cy="8" r="3"/>
                      <line x1="8" y1="1.25" x2="8" y2="2.6"/>
                      <line x1="8" y1="13.4" x2="8" y2="14.75"/>
                      <line x1="1.25" y1="8" x2="2.6" y2="8"/>
                      <line x1="13.4" y1="8" x2="14.75" y2="8"/>
                      <line x1="3.2" y1="3.2" x2="4.18" y2="4.18"/>
                      <line x1="11.82" y1="11.82" x2="12.8" y2="12.8"/>
                      <line x1="12.8" y1="3.2" x2="11.82" y2="4.18"/>
                      <line x1="4.18" y1="11.82" x2="3.2" y2="12.8"/>
                    </svg>
                  ) : option.mode === "dark" ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13.25 10.25A5.75 5.75 0 0 1 5.75 2.75a5.75 5.75 0 1 0 7.5 7.5z"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1.75" y="2.25" width="12.5" height="8.5" rx="1.5"/>
                      <path d="M5.5 13.75h5"/>
                      <path d="M8 10.75v3"/>
                    </svg>
                  )}
                </span>
                <span className="sidebar-theme-option-label">{option.label}</span>
                <span className="sidebar-theme-option-check" aria-hidden="true">
                  {theme.mode === option.mode ? (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3.5 8.25 2.5 2.5 6-6" />
                    </svg>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
