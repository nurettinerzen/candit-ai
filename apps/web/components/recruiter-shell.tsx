"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
import { useUiText } from "./site-language-provider";
import { PublicLanding } from "./public-landing";
import { SiteSettingsSwitcher } from "./site-language-provider";

type NavItem = {
  href:
    | "/dashboard"
    | "/jobs"
    | "/sourcing"
    | "/interviews"
    | "/candidates"
    | "/reports"
    | "/subscription"
    | "/admin"
    | "/admin/red-alert"
    | "/admin/leads"
    | "/admin/users"
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
      { href: "/settings", label: "Ayarlar & Bağlantılar", permission: "user.manage" }
    ]
  },
  {
    label: "İç Yönetim",
    items: [
      { href: "/admin", label: "Yönetici Paneli", permission: "tenant.manage", internalOnly: true },
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
  const primaryRole = getPrimaryRole(session);
  const activeNavHref = resolveActiveNavHref(pathname);
  const [loggingOut, setLoggingOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

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
            .filter((item) => canPerformAction(session, item.permission))
            .filter((item) => !item.internalOnly || isInternalAdminSession(session));

          if (items.length === 0) {
            return null;
          }

          return (
            <div key={group.label}>
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
        <div className="sidebar-session-card" data-open={accountOpen ? "true" : "false"}>
          <button
            type="button"
            className="sidebar-session-trigger"
            onClick={() => setAccountOpen((current) => !current)}
            aria-expanded={accountOpen}
          >
            <div className="sidebar-session-info">
              <div className="sidebar-avatar">{getInitials(session.userLabel)}</div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-name">{session.userLabel}</span>
                <span className="sidebar-user-role">
                  {primaryRole ? getRoleLabel(primaryRole) : session.roles}
                </span>
              </div>
            </div>
            <span className="sidebar-session-chevron" aria-hidden="true">
              {accountOpen ? "▾" : "▸"}
            </span>
          </button>

          {accountOpen ? (
            <div className="sidebar-session-panel">
              <div className="sidebar-session-meta">{t("Tenant")}: {session.tenantId}</div>
              <SiteSettingsSwitcher variant="account" />
              <button
                type="button"
                className="ghost-button sidebar-session-logout"
                onClick={() => void handleLogout()}
                disabled={loggingOut}
              >
                {loggingOut ? t("Çıkış yapılıyor...") : t("Çıkış Yap")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
