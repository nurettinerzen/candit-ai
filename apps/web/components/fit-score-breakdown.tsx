import { FIT_SCORE_LABELS } from "../lib/constants";
import type { ApplicantFitScoreView, SubScore } from "../lib/types";
import { FitScoreBar } from "./fit-score-bar";

function SubScoreRow({ label, sub }: { label: string; sub: SubScore }) {
  return (
    <div className="fit-sub-row">
      <span className="fit-sub-label">{label}</span>
      <FitScoreBar score={sub.score} confidence={sub.confidence} size="sm" />
      <span className="fit-sub-reason">{sub.reason}</span>
    </div>
  );
}

function getConfidenceInterpretation(confidence: number): { text: string; color: string } {
  if (confidence > 0.8) return { text: "AI bu değerlendirmeden emin", color: "var(--color-success)" };
  if (confidence >= 0.5) return { text: "AI orta düzeyde emin", color: "var(--color-warning)" };
  return { text: "AI bu değerlendirmeden emin değil — dikkatli inceleyin", color: "var(--color-danger)" };
}

export function FitScoreBreakdown({ fitScore }: { fitScore: ApplicantFitScoreView }) {
  const subs = fitScore.subScores;
  const confidenceInfo = getConfidenceInterpretation(fitScore.confidence);

  return (
    <div className="fit-breakdown">
      <div className="fit-breakdown-header">
        <strong>Genel Uyum Skoru: {Math.round(fitScore.overallScore * 100)}/100</strong>
        <span className="text-muted"> (Değerlendirme Güvenilirliği: {Math.round(fitScore.confidence * 100)}%)</span>
        <div style={{ fontSize: "0.85rem", color: confidenceInfo.color, marginTop: "0.25rem" }}>
          {confidenceInfo.text}
        </div>
      </div>

      <div className="fit-sub-scores">
        <h4>Detaylı Skorlar</h4>
        {(Object.keys(subs) as Array<keyof typeof subs>).map((key) => (
          <SubScoreRow key={key} label={FIT_SCORE_LABELS[key] ?? key} sub={subs[key]} />
        ))}
      </div>

      {fitScore.strengths.length > 0 && (
        <div className="fit-section">
          <h4>Güçlü Yönler</h4>
          <ul>{fitScore.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {fitScore.risks.length > 0 && (
        <div className="fit-section">
          <h4>Riskler ve Uyarılar</h4>
          <ul>{fitScore.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      {fitScore.missingInfo.length > 0 && (
        <div className="fit-section">
          <h4>Eksik Bilgiler</h4>
          <ul>{fitScore.missingInfo.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {fitScore.reasoning && (
        <div className="fit-section">
          <h4>AI Açıklaması</h4>
          <p className="text-muted">{fitScore.reasoning}</p>
        </div>
      )}

      {(fitScore.strengths.length > 0 || fitScore.risks.length > 0) && (
        <div className="fit-section" style={{ borderTop: "1px solid var(--color-border, #e0e0e0)", paddingTop: "0.75rem", marginTop: "0.75rem" }}>
          <h4>Neden bu skor?</h4>
          <p className="text-muted" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
            Bu aday {Math.round(fitScore.overallScore * 100)} puan aldı.
            {fitScore.strengths.length > 0 && (
              <> Adayın {fitScore.strengths.length} güçlü yönü tespit edildi.</>
            )}
            {fitScore.risks.length > 0 && (
              <> Bununla birlikte {fitScore.risks.length} risk veya uyarı bulunuyor.</>
            )}
            {fitScore.missingInfo.length > 0 && (
              <> Ayrıca {fitScore.missingInfo.length} eksik bilgi mevcut; bu bilgiler tamamlandığında skor değişebilir.</>
            )}
            {" "}Detaylar için yukarıdaki bölümleri inceleyin.
          </p>
        </div>
      )}
    </div>
  );
}
