function clampScore(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
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

export function guardLocationCategoryScore(input: LocationScoreGuardrailInput) {
  return clampScore(input.deterministicScore);
}
