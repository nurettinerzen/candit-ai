const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  experienceFit: "Deneyim Uyumu",
  locationFit: "Lokasyon Uyumu",
  shiftFit: "Vardiya Uyumu",
  roleFit: "Rol Uyumu"
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

export function normalizeFitScore(value: unknown) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return 0;
  }

  const scaled = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return clamp(scaled, 0, 100);
}

export function normalizeConfidence(value: unknown) {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return 0;
  }

  const scaled = numeric > 1 ? numeric / 100 : numeric;
  return clamp(scaled, 0, 1);
}

export function normalizeReasoning(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  const record = asRecord(value);
  if (!record) {
    return "";
  }

  const overallAssessment = record.overallAssessment;
  return typeof overallAssessment === "string" ? overallAssessment.trim() : "";
}

function normalizeCategory(value: unknown, fallbackKey: string) {
  const record = asRecord(value);
  if (!record) {
    return {
      key: fallbackKey,
      label: LEGACY_CATEGORY_LABELS[fallbackKey] ?? fallbackKey,
      weight: null,
      score: 0,
      confidence: 0,
      deterministicScore: null,
      aiScore: null,
      strengths: [],
      risks: [],
      reasoning: ""
    };
  }

  const key = typeof record.key === "string" && record.key.trim() ? record.key.trim() : fallbackKey;
  const label = typeof record.label === "string" && record.label.trim()
    ? record.label.trim()
    : (LEGACY_CATEGORY_LABELS[key] ?? key);
  const weight = toFiniteNumber(record.weight);
  const deterministicScore = toFiniteNumber(record.deterministicScore);
  const aiScore = toFiniteNumber(record.aiScore);

  return {
    key,
    label,
    weight: weight === null ? null : clamp(weight, 0, 1),
    score: normalizeFitScore(record.score),
    confidence: normalizeConfidence(record.confidence),
    deterministicScore: deterministicScore === null ? null : normalizeFitScore(deterministicScore),
    aiScore: aiScore === null ? null : normalizeFitScore(aiScore),
    strengths: uniqueStrings(record.strengths),
    risks: uniqueStrings(record.risks),
    reasoning: typeof record.reasoning === "string" ? record.reasoning.trim() : ""
  };
}

export function normalizeFitScoreSubScores(value: unknown) {
  const record = asRecord(value);
  if (!record) {
    return {
      schemaVersion: "fit_scoring_sub_scores.v1",
      rubricRoleFamily: null,
      categories: []
    };
  }

  const schemaVersion = typeof record.schemaVersion === "string" && record.schemaVersion.trim()
    ? record.schemaVersion.trim()
    : "fit_scoring_sub_scores.v1";
  const rubricRoleFamily = typeof record.rubricRoleFamily === "string" && record.rubricRoleFamily.trim()
    ? record.rubricRoleFamily.trim()
    : null;

  if (Array.isArray(record.categories)) {
    return {
      schemaVersion,
      rubricRoleFamily,
      categories: record.categories.map((category, index) => normalizeCategory(category, `category_${index + 1}`))
    };
  }

  const categories = Object.entries(record)
    .filter(([key]) => key !== "schemaVersion" && key !== "rubricRoleFamily")
    .map(([key, category]) => normalizeCategory(category, key));

  return {
    schemaVersion,
    rubricRoleFamily,
    categories
  };
}

export function normalizeFitWarnings(value: unknown) {
  return uniqueStrings(value);
}
