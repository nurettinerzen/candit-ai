type FitScoreBarProps = {
  score: number;
  confidence?: number;
  size?: "sm" | "md";
};

function getScoreBand(pct: number): { label: string; color: string } {
  if (pct >= 80) return { label: "Güçlü Eşleşme", color: "var(--color-success)" };
  if (pct >= 60) return { label: "İyi Eşleşme", color: "var(--color-success)" };
  if (pct >= 40) return { label: "Orta Eşleşme", color: "var(--color-warning)" };
  return { label: "Zayıf Eşleşme", color: "var(--color-danger)" };
}

export function FitScoreBar({ score, confidence, size = "md" }: FitScoreBarProps) {
  const pct = Math.round(score * 100);
  const band = getScoreBand(pct);
  const barColor = pct >= 70 ? "var(--color-success)" : pct >= 40 ? "var(--color-warning)" : "var(--color-danger)";

  const tooltip = `Uyum: ${pct}/100`;

  return (
    <div className={`fit-bar fit-bar-${size}`} title={tooltip}>
      <div className="fit-bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      <span className="fit-bar-label">{pct}</span>
      <span className="fit-bar-band" style={{ color: band.color, marginLeft: "0.5rem", fontWeight: 600, fontSize: size === "sm" ? "0.75rem" : "0.85rem" }}>
        {band.label}
      </span>
    </div>
  );
}
