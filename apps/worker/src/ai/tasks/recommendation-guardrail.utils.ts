import { Recommendation } from "@prisma/client";
import type { StructuredTaskSections } from "./task-output.utils.js";

const MIN_ADVANCE_EVIDENCE_LINKS = 2;
const MIN_ADVANCE_CONFIDENCE = 0.6;
const MIN_REVIEWABLE_HOLD_CONFIDENCE = 0.45;
const MAX_MISSING_INFORMATION_ITEMS = 8;
const MAX_UNCERTAINTY_REASON_ITEMS = 6;
const MAX_FLAG_ITEMS = 8;

type DecisionFlag = StructuredTaskSections["flags"][number];

type GuardRecommendationDecisionInput = {
  recommendation: Recommendation;
  confidence: number;
  evidenceCount: number;
  missingInformation: string[];
  uncertaintyReasons: string[];
  flags: DecisionFlag[];
  hasSessionReport?: boolean;
};

function normalizeComparableText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function uniqueStrings(values: string[], limit: number) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = normalizeComparableText(value);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(value);
  }

  return output.slice(0, limit);
}

function uniqueFlags(flags: DecisionFlag[]) {
  const seen = new Set<string>();
  const output: DecisionFlag[] = [];

  for (const flag of flags) {
    const key = `${flag.code}:${normalizeComparableText(flag.note)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(flag);
  }

  return output.slice(0, MAX_FLAG_ITEMS);
}

function softenRecommendation(
  current: Recommendation,
  next: Recommendation
): Recommendation {
  const rank = new Map<Recommendation, number>([
    [Recommendation.ADVANCE, 0],
    [Recommendation.HOLD, 1],
    [Recommendation.REVIEW, 2]
  ]);

  return (rank.get(next) ?? 0) > (rank.get(current) ?? 0) ? next : current;
}

export function guardRecommendationDecision(input: GuardRecommendationDecisionInput) {
  const requestedAdvance = input.recommendation === Recommendation.ADVANCE;
  let recommendation = input.recommendation;
  let flags = [...input.flags];
  let missingInformation = [...input.missingInformation];
  let uncertaintyReasons = [...input.uncertaintyReasons];

  if (input.hasSessionReport === false && requestedAdvance) {
    recommendation = softenRecommendation(recommendation, Recommendation.HOLD);
    flags = uniqueFlags([
      ...flags,
      {
        code: "SESSION_REPORT_REQUIRED",
        severity: "high",
        note: "Ayni session icin dogrulanmis review pack raporu olmadan ADVANCE onerisi korunmadi."
      }
    ]);
    missingInformation = uniqueStrings(
      [...missingInformation, "Bu session icin dogrulanmis review pack raporu tamamlanmali."],
      MAX_MISSING_INFORMATION_ITEMS
    );
    uncertaintyReasons = uniqueStrings(
      [
        ...uncertaintyReasons,
        "Session raporu olmadan ilerletme karari guvenli kabul edilmedi."
      ],
      MAX_UNCERTAINTY_REASON_ITEMS
    );
  }

  if (requestedAdvance && input.evidenceCount < MIN_ADVANCE_EVIDENCE_LINKS) {
    recommendation = softenRecommendation(
      recommendation,
      input.evidenceCount === 0 ? Recommendation.REVIEW : Recommendation.HOLD
    );
    flags = uniqueFlags([
      ...flags,
      {
        code: "RECOMMENDATION_EVIDENCE_GUARDRAIL",
        severity: input.evidenceCount === 0 ? "high" : "medium",
        note: "Ilerletme onerisini tasiyan bagimsiz kanit sayisi yetersiz oldugu icin karar yumusatildi."
      }
    ]);
    missingInformation = uniqueStrings(
      [
        ...missingInformation,
        "Ilerletme karari oncesi en az iki bagimsiz kanit referansi teyit edilmeli."
      ],
      MAX_MISSING_INFORMATION_ITEMS
    );
    uncertaintyReasons = uniqueStrings(
      [
        ...uncertaintyReasons,
        "Kanit yogunlugu ilerletme onerisini tek basina desteklemiyor."
      ],
      MAX_UNCERTAINTY_REASON_ITEMS
    );
  }

  if (requestedAdvance && input.confidence < MIN_ADVANCE_CONFIDENCE) {
    recommendation = softenRecommendation(recommendation, Recommendation.HOLD);
    flags = uniqueFlags([
      ...flags,
      {
        code: "RECOMMENDATION_CONFIDENCE_GUARDRAIL",
        severity: "medium",
        note: "Confidence seviyesi ilerletme onerisini tek basina tasimadigi icin karar HOLD'a cekildi."
      }
    ]);
    uncertaintyReasons = uniqueStrings(
      [...uncertaintyReasons, "Confidence seviyesi ilerletme karari icin dusuk kaldi."],
      MAX_UNCERTAINTY_REASON_ITEMS
    );
  }

  if (requestedAdvance && input.missingInformation.length >= 3) {
    recommendation = softenRecommendation(recommendation, Recommendation.HOLD);
    flags = uniqueFlags([
      ...flags,
      {
        code: "RECOMMENDATION_OPEN_QUESTIONS",
        severity: "medium",
        note: "Kapatilmamis acik sorular nedeniyle otomatik ilerletme onerisi yumusatildi."
      }
    ]);
    uncertaintyReasons = uniqueStrings(
      [...uncertaintyReasons, "Karar oncesi kapatilmasi gereken acik sorular halen fazla."],
      MAX_UNCERTAINTY_REASON_ITEMS
    );
  }

  if (
    recommendation === Recommendation.HOLD &&
    input.evidenceCount === 0 &&
    input.confidence < MIN_REVIEWABLE_HOLD_CONFIDENCE
  ) {
    recommendation = Recommendation.REVIEW;
    flags = uniqueFlags([
      ...flags,
      {
        code: "RECOMMENDATION_REVIEW_GUARDRAIL",
        severity: "high",
        note: "Kanitsiz ve dusuk guvenli durumda HOLD yerine manuel REVIEW zorunlu tutuldu."
      }
    ]);
    uncertaintyReasons = uniqueStrings(
      [
        ...uncertaintyReasons,
        "Kanit ve confidence birlikte zayif kaldigi icin manuel review gerekli."
      ],
      MAX_UNCERTAINTY_REASON_ITEMS
    );
  }

  return {
    recommendation,
    flags,
    missingInformation,
    uncertaintyReasons
  };
}
