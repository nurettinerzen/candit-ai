"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  badge?: string;
};

export function AuthShell({ title, description, children, footer, badge }: AuthShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.16), transparent 34%), radial-gradient(circle at top right, rgba(249,115,22,0.14), transparent 28%), linear-gradient(180deg, #07111f 0%, #0f172a 100%)",
        padding: 24
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: "#f8fafc"
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 46,
                height: 46,
                borderRadius: 14,
                background: "linear-gradient(135deg, #0ea5e9, #f97316)",
                fontWeight: 800,
                letterSpacing: "-0.04em"
              }}
            >
              C
            </span>
            <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em" }}>Candit.ai</span>
          </Link>
        </div>

        <section
          style={{
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(15,23,42,0.88)",
            boxShadow: "0 32px 80px rgba(2,6,23,0.45)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              padding: "28px 28px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background:
                "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(249,115,22,0.12))"
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
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "#bae6fd",
                  background: "rgba(2,6,23,0.32)",
                  marginBottom: 14
                }}
              >
                {badge}
              </div>
            ) : null}
            <h1 style={{ margin: 0, color: "#f8fafc", fontSize: 30, lineHeight: 1.1 }}>{title}</h1>
            <p style={{ margin: "10px 0 0", color: "rgba(226,232,240,0.78)", lineHeight: 1.6 }}>
              {description}
            </p>
          </div>

          <div style={{ padding: 28 }}>{children}</div>

          {footer ? (
            <div
              style={{
                padding: "0 28px 24px",
                color: "rgba(148,163,184,0.92)",
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
          color: "#fecaca",
          border: "rgba(239,68,68,0.28)",
          background: "rgba(127,29,29,0.28)"
        }
      : tone === "success"
        ? {
            color: "#bbf7d0",
            border: "rgba(34,197,94,0.24)",
            background: "rgba(20,83,45,0.28)"
          }
        : {
            color: "#bae6fd",
            border: "rgba(14,165,233,0.24)",
            background: "rgba(12,74,110,0.28)"
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
