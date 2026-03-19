import type { ReactNode } from "react";

type BadgeTone = "neutral" | "info" | "warn" | "risk";

const toneStyles: Record<BadgeTone, string> = {
  neutral: "#6b7280",
  info: "#0ea5e9",
  warn: "#f59e0b",
  risk: "#ef4444"
};

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tone: BadgeTone = confidence >= 0.8 ? "info" : confidence >= 0.6 ? "warn" : "risk";
  return (
    <span
      style={{
        borderRadius: 999,
        padding: "4px 10px",
        border: `1px solid ${toneStyles[tone]}`,
        color: toneStyles[tone],
        fontSize: 12,
        fontWeight: 600
      }}
    >
      Guven: {(confidence * 100).toFixed(0)}%
    </span>
  );
}

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "white"
      }}
    >
      <h3 style={{ margin: "0 0 10px 0" }}>{title}</h3>
      {children}
    </section>
  );
}
