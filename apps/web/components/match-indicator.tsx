"use client";

import { resolveMatchUi } from "../lib/match";
import { useUiText } from "./site-language-provider";

type MatchIndicatorProps = {
  score: number | null | undefined;
  compact?: boolean;
};

export function MatchIndicator({ score, compact = false }: MatchIndicatorProps) {
  const { t } = useUiText();
  const match = resolveMatchUi(score);

  if (match.score === null) {
    return <span className="text-muted text-sm">{t("Henüz değerlendirilmedi")}</span>;
  }

  return (
    <div className={`match-indicator${compact ? " match-indicator-compact" : ""}`}>
      <div className="match-indicator-head">
        <span className="match-indicator-label" style={{ color: match.color }}>
          {t(match.label)}
        </span>
        {!compact && <span className="match-indicator-score">{match.score}</span>}
      </div>
      <div className="match-indicator-bars" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <span
            key={index}
            className="match-indicator-bar"
            style={{
              background:
                index < match.segments
                  ? match.color
                  : "color-mix(in srgb, var(--border, #334155) 75%, transparent)"
            }}
          />
        ))}
      </div>
    </div>
  );
}
