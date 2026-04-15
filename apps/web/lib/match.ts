export type MatchUiTone = "strong" | "good" | "partial" | "weak" | "neutral";

export function resolveMatchUi(score: number | null | undefined): {
  score: number | null;
  label: string;
  tone: MatchUiTone;
  segments: number;
  color: string;
} {
  if (score === null || score === undefined || !Number.isFinite(score)) {
    return {
      score: null,
      label: "Henüz değerlendirilmedi",
      tone: "neutral",
      segments: 0,
      color: "var(--text-dim, #94a3b8)"
    };
  }

  const rounded = Math.max(0, Math.min(100, Math.round(score)));

  if (rounded >= 85) {
    return {
      score: rounded,
      label: "Güçlü Uyum",
      tone: "strong",
      segments: 5,
      color: "var(--success, #22c55e)"
    };
  }

  if (rounded >= 70) {
    return {
      score: rounded,
      label: "Uyumlu",
      tone: "good",
      segments: 4,
      color: "var(--success, #22c55e)"
    };
  }

  if (rounded >= 50) {
    return {
      score: rounded,
      label: "Kısmi Uyum",
      tone: "partial",
      segments: 3,
      color: "var(--warn, #f59e0b)"
    };
  }

  return {
    score: rounded,
    label: rounded >= 30 ? "Düşük Uyum" : "Uyumsuz",
    tone: "weak",
    segments: rounded >= 30 ? 2 : 1,
    color: "var(--danger, #ef4444)"
  };
}
