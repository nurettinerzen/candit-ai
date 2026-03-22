import type { ApplicantFitScoreCategory, ApplicantFitScoreView } from "./types";

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  experienceFit: "Deneyim Uyumu",
  locationFit: "Lokasyon Uyumu",
  shiftFit: "Vardiya Uyumu",
  roleFit: "Rol Uyumu"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumeric(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

export function toFitScorePercent(value: number | string | null | undefined) {
  const numeric = toNumeric(value);
  if (numeric === null) {
    return null;
  }

  const scaled = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(clamp(scaled, 0, 100));
}

export function toConfidencePercent(value: number | string | null | undefined) {
  const numeric = toNumeric(value);
  if (numeric === null) {
    return null;
  }

  const scaled = numeric > 1 ? numeric / 100 : numeric;
  return Math.round(clamp(scaled, 0, 1) * 100);
}

export function normalizeFitCategories(subScores: ApplicantFitScoreView["subScores"] | Record<string, unknown> | null | undefined): ApplicantFitScoreCategory[] {
  if (!subScores || typeof subScores !== "object") {
    return [];
  }

  if (Array.isArray((subScores as { categories?: unknown }).categories)) {
    return ((subScores as { categories: unknown[] }).categories)
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const category = item as Record<string, unknown>;
        const score = toFitScorePercent(category.score as number | string | null | undefined);
        const confidence = toConfidencePercent(category.confidence as number | string | null | undefined);
        return {
          key: typeof category.key === "string" ? category.key : `category_${index + 1}`,
          label: typeof category.label === "string" ? category.label : `Kategori ${index + 1}`,
          weight: typeof category.weight === "number" ? category.weight : null,
          score: score ?? 0,
          confidence: confidence == null ? 0 : confidence / 100,
          deterministicScore: toFitScorePercent(category.deterministicScore as number | string | null | undefined),
          aiScore: toFitScorePercent(category.aiScore as number | string | null | undefined),
          strengths: uniqueStrings(category.strengths),
          risks: uniqueStrings(category.risks),
          reasoning: typeof category.reasoning === "string" ? category.reasoning : ""
        } satisfies ApplicantFitScoreCategory;
      })
      .filter((item): item is ApplicantFitScoreCategory => item !== null);
  }

  return Object.entries(subScores)
    .filter(([key]) => key !== "schemaVersion" && key !== "rubricRoleFamily")
    .map(([key, value]) => {
      const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const score = toFitScorePercent(record.score as number | string | null | undefined);
      const confidence = toConfidencePercent(record.confidence as number | string | null | undefined);

      return {
        key,
        label: LEGACY_CATEGORY_LABELS[key] ?? key,
        weight: null,
        score: score ?? 0,
        confidence: confidence == null ? 0 : confidence / 100,
        deterministicScore: null,
        aiScore: null,
        strengths: [],
        risks: [],
        reasoning: typeof record.reason === "string" ? record.reason : ""
      } satisfies ApplicantFitScoreCategory;
    });
}
