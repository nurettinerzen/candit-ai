"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AUTH_SESSION_MODE, AUTH_TOKEN_TRANSPORT } from "../lib/auth/runtime";
import { canAccessRoute, canPerformAction, type AppPermission } from "../lib/auth/policy";
import { resolveActiveSession, resolveSessionFromServer } from "../lib/auth/session";
import type { WebAuthSession } from "../lib/auth/types";
import { SiteSettingsSwitcher } from "./site-language-provider";

type NavItem = {
  href:
    | "/"
    | "/applications"
    | "/jobs"
    | "/interviews"
    | "/candidates"
    | "/raporlar"
    | "/ayarlar";
  label: string;
  icon: string;
  permission: AppPermission;
};

const primaryNavItems: NavItem[] = [
  { href: "/", label: "Genel Bakış", icon: "📊", permission: "job.read" },
  { href: "/jobs", label: "İlan Merkezi", icon: "💼", permission: "job.read" },
  { href: "/interviews", label: "Mülakatlar", icon: "🎙️", permission: "interview.read" },
  { href: "/candidates", label: "Aday Havuzu", icon: "👥", permission: "candidate.read" },
  { href: "/raporlar", label: "Raporlar", icon: "📈", permission: "job.read" },
  { href: "/ayarlar", label: "Ayarlar & Bağlantılar", icon: "⚙️", permission: "ai.task.read" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
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
  const isJobDetailPage = pathname.startsWith("/jobs/") && pathname !== "/jobs" && pathname !== "/jobs/new";
  const [session, setSession] = useState<WebAuthSession | null>(() => resolveActiveSession());
  const [checkingCookieSession, setCheckingCookieSession] = useState(
    AUTH_TOKEN_TRANSPORT === "cookie" && (AUTH_SESSION_MODE === "jwt" || AUTH_SESSION_MODE === "hybrid")
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      if (
        AUTH_TOKEN_TRANSPORT !== "cookie" ||
        (AUTH_SESSION_MODE !== "jwt" && AUTH_SESSION_MODE !== "hybrid")
      ) {
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

  if (checkingCookieSession) {
    return (
      <div className="app-layout">
        <main>
          <section className="panel" style={{ maxWidth: 480, margin: "80px auto" }}>
            <div className="loading-state">
              <div className="loading-spinner" />
              <p className="loading-text">Oturum kontrol ediliyor...</p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-layout">
        <main>
          <section className="panel" style={{ maxWidth: 480, margin: "80px auto", textAlign: "center" }}>
            <div style={{ padding: "20px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Oturum gerekli</h2>
              <p className="small" style={{ margin: "0 0 20px" }}>
                Recruiter paneli için aktif bir oturum bulunamadı.
              </p>
              <Link href="/auth/login" className="button-link">
                Giriş ekranına git
              </Link>
            </div>
          </section>
        </main>
      </div>
    );
  }

  if (!canAccessRoute(session, pathname)) {
    return (
      <div className="app-layout">
        <aside className="sidebar">
          <SidebarContent session={session} pathname={pathname} />
        </aside>
        <div className="main-content">
          <div className="main-content-inner">
            <section className="panel" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
              <div style={{ padding: "20px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>🚫</div>
                <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Yetki yok</h2>
                <p className="small" style={{ margin: 0 }}>
                  Bu sayfa için gerekli yetkiniz bulunmuyor.
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
        <div className={`main-content-inner${isJobDetailPage ? " main-content-inner-wide" : ""}`}>
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
  return (
    <>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-logo">AI</div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">AI Recruiter</span>
            <span className="sidebar-brand-desc">İşe alım işletim paneli</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {primaryNavItems.filter((item) => canPerformAction(session, item.permission)).map((item) => (
          <Link
            key={item.href}
            href={item.href as any}
            className={isActive(pathname, item.href) ? "nav-link active" : "nav-link"}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-controls">
        <SiteSettingsSwitcher variant="sidebar" />
      </div>

      <div className="sidebar-session">
        <div className="sidebar-session-info">
          <div className="sidebar-avatar">{getInitials(session.userLabel)}</div>
          <div className="sidebar-user-details">
            <span className="sidebar-user-name">{session.userLabel}</span>
            <span className="sidebar-user-role">{session.roles}</span>
          </div>
        </div>
      </div>
    </>
  );
}
