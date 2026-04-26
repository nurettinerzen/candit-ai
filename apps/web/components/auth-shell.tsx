"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BrandWordmark } from "./brand-wordmark";
import { useTheme } from "./theme-provider";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  badge?: string;
};

export function AuthShell({ title, description, children, footer, badge }: AuthShellProps) {
  const { resolved } = useTheme();
  const dark = resolved === "dark";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          dark
            ? "radial-gradient(circle at top left, rgba(80,70,229,0.18), transparent 34%), radial-gradient(circle at top right, rgba(124,58,237,0.14), transparent 28%), linear-gradient(180deg, #07111f 0%, #0f172a 100%)"
            : "radial-gradient(circle at top left, rgba(80,70,229,0.12), transparent 34%), radial-gradient(circle at top right, rgba(124,58,237,0.1), transparent 28%), linear-gradient(180deg, #f8f9fb 0%, #eef2ff 100%)",
        padding: 24
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link
            href="/"
            aria-label="Candit.ai ana sayfa"
            style={{
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              color: "var(--text)"
            }}
          >
            <BrandWordmark variant="auth" decorative />
          </Link>
        </div>

        <section
          style={{
            borderRadius: 28,
            border: "1px solid var(--border)",
            background: dark ? "rgba(15,23,42,0.88)" : "rgba(255,255,255,0.9)",
            boxShadow: dark ? "0 32px 80px rgba(2,6,23,0.45)" : "0 24px 64px rgba(15,23,42,0.12)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              padding: "28px 28px 18px",
              borderBottom: "1px solid var(--border)",
              background:
                dark
                  ? "linear-gradient(135deg, rgba(80,70,229,0.18), rgba(124,58,237,0.12))"
                  : "linear-gradient(135deg, rgba(80,70,229,0.1), rgba(124,58,237,0.08))"
            }}
          >
            {badge ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.01em",
                  textTransform: "none" as const,
                  color: "var(--primary)",
                  background: dark ? "rgba(2,6,23,0.32)" : "rgba(80,70,229,0.08)",
                  marginBottom: 14
                }}
              >
                {badge}
              </div>
            ) : null}
            <h1 style={{ margin: 0, color: "var(--text)", fontSize: 30, lineHeight: 1.1 }}>{title}</h1>
            <p style={{ margin: "10px 0 0", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {description}
            </p>
          </div>

          <div style={{ padding: 28 }}>{children}</div>

          {footer ? (
            <div
              style={{
                padding: "0 28px 24px",
                color: "var(--text-secondary)",
                fontSize: 14
              }}
            >
              {footer}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

export function AuthNotice({
  tone,
  message
}: {
  tone: "danger" | "success" | "info";
  message: string;
}) {
  const palette =
    tone === "danger"
      ? {
          color: "var(--risk-text)",
          border: "var(--risk-border)",
          background: "var(--risk-light)"
        }
      : tone === "success"
        ? {
            color: "var(--success-text)",
            border: "var(--success-border)",
            background: "var(--success-light)"
          }
        : {
            color: "var(--primary)",
            border: "var(--primary-border)",
            background: "var(--primary-light)"
          };

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        color: palette.color,
        padding: "12px 14px",
        fontSize: 14,
        lineHeight: 1.5
      }}
    >
      {message}
    </div>
  );
}
