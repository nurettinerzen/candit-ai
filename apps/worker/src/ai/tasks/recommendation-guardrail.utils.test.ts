import assert from "node:assert/strict";
import test from "node:test";
import { Recommendation } from "@prisma/client";
import { guardRecommendationDecision } from "./recommendation-guardrail.utils.js";

test("guardRecommendationDecision downgrades unsupported advance decisions", () => {
  const result = guardRecommendationDecision({
    recommendation: Recommendation.ADVANCE,
    confidence: 0.52,
    evidenceCount: 1,
    missingInformation: ["Referans dogrulamasi acik."],
    uncertaintyReasons: [],
    flags: []
  });

  assert.equal(result.recommendation, Recommendation.HOLD);
  assert.equal(
    result.flags.some((flag) => flag.code === "RECOMMENDATION_EVIDENCE_GUARDRAIL"),
    true
  );
  assert.equal(
    result.flags.some((flag) => flag.code === "RECOMMENDATION_CONFIDENCE_GUARDRAIL"),
    true
  );
});

test("guardRecommendationDecision blocks advance when session report is missing", () => {
  const result = guardRecommendationDecision({
    recommendation: Recommendation.ADVANCE,
    confidence: 0.74,
    evidenceCount: 3,
    missingInformation: [],
    uncertaintyReasons: [],
    flags: [],
    hasSessionReport: false
  });

  assert.equal(result.recommendation, Recommendation.HOLD);
  assert.equal(
    result.missingInformation.includes("Bu session icin dogrulanmis review pack raporu tamamlanmali."),
    true
  );
  assert.equal(result.flags.some((flag) => flag.code === "SESSION_REPORT_REQUIRED"), true);
});

test("guardRecommendationDecision escalates weak holds to manual review", () => {
  const result = guardRecommendationDecision({
    recommendation: Recommendation.HOLD,
    confidence: 0.31,
    evidenceCount: 0,
    missingInformation: [],
    uncertaintyReasons: [],
    flags: []
  });

  assert.equal(result.recommendation, Recommendation.REVIEW);
  assert.equal(
    result.flags.some((flag) => flag.code === "RECOMMENDATION_REVIEW_GUARDRAIL"),
    true
  );
});
