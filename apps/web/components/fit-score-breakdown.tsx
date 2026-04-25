import { normalizeFitCategories, toConfidencePercent, toFitScorePercent } from "../lib/fit-score";
import type { ApplicantFitScoreCategory, ApplicantFitScoreView } from "../lib/types";
import { FitScoreBar } from "./fit-score-bar";

function SubScoreRow({ sub }: { sub: ApplicantFitScoreCategory }) {
  const isInformational = typeof sub.weight === "number" && sub.weight <= 0;

  return (
    <div className="fit-sub-row">
      <div className="fit-sub-label-group">
        <span className="fit-sub-label">{sub.label}</span>
        {isInformational && <span className="fit-sub-badge">Bilgilendirici</span>}
      </div>
      <FitScoreBar score={sub.score} confidence={sub.confidence} size="sm" />
      <span className="fit-sub-reason">
        {sub.reasoning || "Bu kategori için ek açıklama yok."}
        {isInformational && " Bu alt skor genel uyum skoruna dahil edilmez; recruiter kararı için ek bağlam sağlar."}
      </span>
    </div>
  );
}

function getConfidenceInterpretation(confidence: number): { text: string; color: string } {
  if (confidence > 0.8) return { text: "AI bu değerlendirmeden emin", color: "var(--color-success)" };
  if (confidence >= 0.5) return { text: "AI orta düzeyde emin", color: "var(--color-warning)" };
  return { text: "AI bu değerlendirmeden emin değil — dikkatli inceleyin", color: "var(--color-danger)" };
}

export function FitScoreBreakdown({ fitScore }: { fitScore: ApplicantFitScoreView }) {
  const categories = normalizeFitCategories(fitScore.subScores);
  const overallScore = toFitScorePercent(fitScore.overallScore) ?? 0;
  const confidence = toConfidencePercent(fitScore.confidence) ?? 0;
  const confidenceInfo = getConfidenceInterpretation(fitScore.confidence);
  const hasInformationalCategory = categories.some((category) => typeof category.weight === "number" && category.weight <= 0);

  return (
    <div className="fit-breakdown">
      <div className="fit-breakdown-header">
        <strong>Genel Uyum Skoru: {overallScore}/100</strong>
        <span className="text-muted"> (Değerlendirme Güvenilirliği: {confidence}%)</span>
        <div style={{ fontSize: "0.85rem", color: confidenceInfo.color, marginTop: "0.25rem" }}>
          {confidenceInfo.text}
        </div>
        {hasInformationalCategory && (
          <div className="fit-breakdown-note">
            Bazı alt skorlar bilgilendiricidir. Özellikle lokasyon ve çalışma modeli gibi alanlar genel uyum skoruna
            doğrudan eklenmez; recruiter kararına bağlam sağlamak için ayrı gösterilir.
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div className="fit-sub-scores">
          <h4>Detaylı Skorlar</h4>
          {categories.map((category) => (
            <SubScoreRow key={category.key} sub={category} />
          ))}
        </div>
      )}

      {fitScore.strengths.length > 0 && (
        <div className="fit-section">
          <h4>Güçlü Yönler</h4>
          <ul>{fitScore.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {fitScore.risks.length > 0 && (
        <div className="fit-section">
          <h4>Uyarılar</h4>
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
            Bu aday {overallScore} puan aldı.
            {fitScore.strengths.length > 0 && (
              <> Adayın {fitScore.strengths.length} güçlü yönü tespit edildi.</>
            )}
            {fitScore.risks.length > 0 && (
              <> Bununla birlikte {fitScore.risks.length} dikkat edilmesi gereken uyarı bulunuyor.</>
            )}
            {fitScore.missingInfo.length > 0 && (
              <> Ayrıca {fitScore.missingInfo.length} eksik bilgi mevcut; bunlar takip sorularıyla tamamlanabilir.</>
            )}
            {" "}Detaylar için yukarıdaki bölümleri inceleyin.
          </p>
        </div>
      )}
    </div>
  );
}
