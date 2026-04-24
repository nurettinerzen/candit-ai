const COMPARISON_STOPWORDS = new Set([
  "aday",
  "adayin",
  "mulakat",
  "mulakatta",
  "gorusme",
  "gorusmede",
  "recruiter",
  "karar",
  "icin",
  "ile",
  "ve",
  "bir",
  "bu",
  "daha",
  "gibi",
  "olan",
  "olarak",
  "gore",
  "icin",
  "veya",
  "ama",
  "ancak",
  "diger",
  "sonraki",
  "asama",
  "asamaya",
  "manuel",
  "teyit",
  "gerekir",
  "gerekiyor",
  "edilmeli",
  "edilmeden",
  "net",
  "degil",
  "heniz",
  "halen"
]);

const CONTEXT_LEAK_PATTERNS = [
  /\bcv\b/,
  /ozgecmis/,
  /\bresume\b/,
  /fit score/,
  /screening support/,
  /cv parsing/,
  /prompt/,
  /rubric/,
  /overall score/,
  /mevcut fit score/,
  /genel profil/,
  /liderlik gecmisi/,
  /likely fit/,
  /normalized summary/,
  /profil ozeti/,
  /profil gucu/
];

const LOW_SIGNAL_SUMMARY_PATTERNS = [
  /recruiter degerlendirmesi gerekir/,
  /nihai karar.*insan/,
  /nihai karar.*recruiter/,
  /otomatik karar uygulanmadi/,
  /manuel stage karari/,
  /manuel inceleme yapin/,
  /recruiter onayi gerekir/,
  /human review required/
];

export function normalizeComparableText(value: string) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toComparisonTokens(value: string) {
  return normalizeComparableText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !COMPARISON_STOPWORDS.has(token));
}

export function textsOverlap(
  left: string,
  right: string,
  options: {
    minSharedTokens?: number;
    minSimilarityRatio?: number;
  } = {}
) {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return true;
  }

  const leftTokens = Array.from(new Set(toComparisonTokens(normalizedLeft)));
  const rightTokens = Array.from(new Set(toComparisonTokens(normalizedRight)));

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const sharedTokenCount = leftTokens.filter((token) => rightTokens.includes(token)).length;
  const minTokenCount = Math.min(leftTokens.length, rightTokens.length);
  const ratio = sharedTokenCount / minTokenCount;
  const minSharedTokens = options.minSharedTokens ?? 3;
  const minSimilarityRatio = options.minSimilarityRatio ?? 0.64;

  if (minTokenCount <= 2) {
    return sharedTokenCount === minTokenCount;
  }

  return sharedTokenCount >= minSharedTokens && ratio >= minSimilarityRatio;
}

export function looksLikeDerivedContextLeakage(value: string) {
  const normalized = normalizeComparableText(value);

  return CONTEXT_LEAK_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function looksLikeLowSignalDecisionSummary(value: string) {
  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return true;
  }

  return LOW_SIGNAL_SUMMARY_PATTERNS.some((pattern) => pattern.test(normalized));
}
