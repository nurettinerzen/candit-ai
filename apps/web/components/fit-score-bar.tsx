import { toConfidencePercent, toFitScorePercent } from "../lib/fit-score";

type FitScoreBarProps = {
  score: number | string | null | undefined;
  confidence?: number | string | null;
  size?: "sm" | "md";
};

function getScoreBand(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Güçlü Eşleşme", color: "var(--color-success)" };
  if (pct >= 60) return { label: "İyi Eşleşme", color: "var(--color-success)" };
  if (pct >= 40) return { label: "Orta Eşleşme", color: "var(--color-warning)" };
  return { label: "Zayıf Eşleşme", color: "var(--color-danger)" };
}

export function FitScoreBar({ score, confidence, size = "md" }: FitScoreBarProps) {
  const pct = toFitScorePercent(score) ?? 0;
  const confidencePct = toConfidencePercent(confidence);
  const band = getScoreBand(pct);
  const barColor = pct >= 70 ? "var(--color-success)" : pct >= 40 ? "var(--color-warning)" : "var(--color-danger)";

  const tooltip = confidencePct != null ? `Uyum: ${pct}/100 · Güven: ${confidencePct}%` : `Uyum: ${pct}/100`;

  return (
    <div className={`fit-bar fit-bar-${size}`} title={tooltip}>
      <div className="fit-bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      <span className="fit-bar-label">{String(pct)}</span>
      <span className="fit-bar-band" style={{ color: band.color, marginLeft: "0.5rem", fontWeight: 600, fontSize: size === "sm" ? "0.75rem" : "0.85rem" }}>
        {band.label}
      </span>
    </div>
  );
}
