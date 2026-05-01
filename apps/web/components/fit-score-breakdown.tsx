"use client";

import { normalizeFitCategories, toConfidencePercent, toFitScorePercent } from "../lib/fit-score";
import { getFitScoreCopy, type FitScoreCopy } from "../lib/fit-score-copy";
import type { ApplicantFitScoreCategory, ApplicantFitScoreView } from "../lib/types";
import { FitScoreBar } from "./fit-score-bar";
import { useUiText } from "./site-language-provider";

function SubScoreRow({
  sub,
  copy
}: {
  sub: ApplicantFitScoreCategory;
  copy: FitScoreCopy;
}) {
  const isInformational = typeof sub.weight === "number" && sub.weight <= 0;

  return (
    <div className="fit-sub-row">
      <div className="fit-sub-label-group">
        <span className="fit-sub-label">{sub.label}</span>
        {isInformational && <span className="fit-sub-badge">{copy.informational}</span>}
      </div>
      <FitScoreBar score={sub.score} confidence={sub.confidence} size="sm" />
      <span className="fit-sub-reason">
        {sub.reasoning || copy.noCategoryReason}
        {isInformational && ` ${copy.informationalReason}`}
      </span>
    </div>
  );
}

function getConfidenceInterpretation(confidence: number, copy: FitScoreCopy) {
  if (confidence > 0.8) return { text: copy.confidenceHigh, tone: "success" };
  if (confidence >= 0.5) return { text: copy.confidenceMedium, tone: "warning" };
  return { text: copy.confidenceLow, tone: "danger" };
}

export function FitScoreBreakdown({ fitScore }: { fitScore: ApplicantFitScoreView }) {
  const { locale } = useUiText();
  const copy = getFitScoreCopy(locale);
  const categories = normalizeFitCategories(fitScore.subScores);
  const overallScore = toFitScorePercent(fitScore.overallScore) ?? 0;
  const confidence = toConfidencePercent(fitScore.confidence) ?? 0;
  const confidenceInfo = getConfidenceInterpretation(fitScore.confidence, copy);
  const hasInformationalCategory = categories.some((category) => typeof category.weight === "number" && category.weight <= 0);

  return (
    <div className="fit-breakdown">
      <div className="fit-breakdown-header">
        <strong>{copy.overallScore}: {overallScore}/100</strong>
        <span className="text-muted"> ({copy.confidenceLabel}: {confidence}%)</span>
        <div className={`fit-confidence fit-confidence-${confidenceInfo.tone}`}>
          {confidenceInfo.text}
        </div>
        {hasInformationalCategory && (
          <div className="fit-breakdown-note">
            {copy.informationalNote}
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div className="fit-sub-scores">
          <h4>{copy.detailedScores}</h4>
          {categories.map((category) => (
            <SubScoreRow key={category.key} sub={category} copy={copy} />
          ))}
        </div>
      )}

      {fitScore.strengths.length > 0 && (
        <div className="fit-section">
          <h4>{copy.strengths}</h4>
          <ul>{fitScore.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}

      {fitScore.risks.length > 0 && (
        <div className="fit-section">
          <h4>{copy.risks}</h4>
          <ul>{fitScore.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}

      {fitScore.missingInfo.length > 0 && (
        <div className="fit-section">
          <h4>{copy.missingInfo}</h4>
          <ul>{fitScore.missingInfo.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {fitScore.reasoning && (
        <div className="fit-section">
          <h4>{copy.reasoning}</h4>
          <p className="text-muted">{fitScore.reasoning}</p>
        </div>
      )}

      {(fitScore.strengths.length > 0 || fitScore.risks.length > 0) && (
        <div className="fit-section fit-breakdown-footer">
          <h4>{copy.whyScore}</h4>
          <p className="text-muted">
            {copy.scoreIntro} {overallScore} {copy.scoreSuffix}
            {fitScore.strengths.length > 0 && (
              <> {fitScore.strengths.length} {copy.strengthsDetected}</>
            )}
            {fitScore.risks.length > 0 && (
              <> {fitScore.risks.length} {copy.risksDetected}</>
            )}
            {fitScore.missingInfo.length > 0 && (
              <> {fitScore.missingInfo.length} {copy.missingDetected}</>
            )}
            {" "}{copy.reviewDetails}
          </p>
        </div>
      )}
    </div>
  );
}
