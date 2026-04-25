function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function clampRange(min: number, max: number) {
  const normalizedMin = clampScore(min);
  const normalizedMax = clampScore(max);
  return normalizedMin <= normalizedMax
    ? { min: normalizedMin, max: normalizedMax }
    : { min: normalizedMax, max: normalizedMin };
}

export type LocationScoreGuardrailInput = {
  aiScore: number;
  deterministicScore: number;
  presenceMode: "remote" | "hybrid" | "onsite";
  candidateFlexibility:
    | "unknown"
    | "remote_only"
    | "commute_open"
    | "relocation_open"
    | "relocation_resistant";
  mismatchLevel: "same_locality" | "same_city" | "cross_city" | "cross_country" | "ambiguous";
  commuteSeverity: "minimal" | "light" | "moderate" | "heavy" | "severe" | "extreme" | "unknown";
};

function resolveLocationScoreRange(input: LocationScoreGuardrailInput) {
  const deterministicScore = clampScore(input.deterministicScore);

  if (input.presenceMode === "remote") {
    return clampRange(deterministicScore - 10, deterministicScore + 8);
  }

  let range = (() => {
    switch (input.mismatchLevel) {
      case "same_locality":
        return clampRange(Math.max(82, deterministicScore - 7), 100);
      case "same_city":
        switch (input.commuteSeverity) {
          case "minimal":
          case "light":
            return clampRange(Math.max(58, deterministicScore - 12), deterministicScore + 10);
          case "moderate":
          case "unknown":
            return clampRange(Math.max(42, deterministicScore - 14), deterministicScore + 10);
          default:
            return clampRange(Math.max(28, deterministicScore - 16), deterministicScore + 8);
        }
      case "cross_country":
        return clampRange(Math.max(0, deterministicScore - 8), Math.min(34, deterministicScore + 8));
      case "cross_city":
        return clampRange(Math.max(8, deterministicScore - 10), Math.min(42, deterministicScore + 10));
      case "ambiguous":
      default:
        return clampRange(Math.max(12, deterministicScore - 12), Math.min(68, deterministicScore + 12));
    }
  })();

  switch (input.candidateFlexibility) {
    case "commute_open":
      range = clampRange(range.min + 2, range.max + 6);
      break;
    case "relocation_open":
      range = clampRange(range.min + 4, range.max + 10);
      break;
    case "relocation_resistant":
      range = clampRange(range.min - 4, range.max - 8);
      break;
    case "remote_only":
      range = clampRange(range.min - 10, range.max - 14);
      break;
    default:
      break;
  }

  return range;
}

export function guardLocationCategoryScore(input: LocationScoreGuardrailInput) {
  const aiScore = clampScore(input.aiScore);
  const range = resolveLocationScoreRange(input);
  return Math.min(range.max, Math.max(range.min, aiScore));
}
