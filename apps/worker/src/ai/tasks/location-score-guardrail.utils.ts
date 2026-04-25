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

function locationScoreFloorBuffer(input: LocationScoreGuardrailInput) {
  if (input.presenceMode === "remote" || input.candidateFlexibility === "remote_only") {
    return null;
  }

  const deterministicScore = clampScore(input.deterministicScore);
  if (deterministicScore < 70) {
    return null;
  }

  if (input.mismatchLevel === "same_locality") {
    return 4;
  }

  if (input.mismatchLevel !== "same_city") {
    return null;
  }

  switch (input.commuteSeverity) {
    case "minimal":
      return 6;
    case "light":
      return 8;
    case "moderate":
      return 12;
    default:
      return null;
  }
}

export function guardLocationCategoryScore(input: LocationScoreGuardrailInput) {
  const aiScore = clampScore(input.aiScore);
  const deterministicScore = clampScore(input.deterministicScore);
  const floorBuffer = locationScoreFloorBuffer(input);

  if (floorBuffer === null) {
    return aiScore;
  }

  const floorScore = clampScore(deterministicScore - floorBuffer);
  return Math.max(aiScore, floorScore);
}
