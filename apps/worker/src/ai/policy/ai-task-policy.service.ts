import { Recommendation } from "@prisma/client";

const POLICY_VERSION = "policy.v1.non_autonomous";

export class AiTaskPolicyService {
  readonly policyVersion = POLICY_VERSION;

  getGuardrailFlags(taskType: string) {
    return {
      policyVersion: POLICY_VERSION,
      taskType,
      nonAutonomous: true,
      autoDecisionApplied: false,
      autoRejectAllowed: false,
      recruiterReviewRequired: true
    };
  }

  normalizeConfidence(value: number, fallback = 0.5) {
    if (!Number.isFinite(value)) {
      return fallback;
    }

    if (value < 0) {
      return 0;
    }

    if (value > 1) {
      return 1;
    }

    return Math.round(value * 100) / 100;
  }

  uncertaintyLevel(confidence: number): "dusuk" | "orta" | "yuksek" {
    if (confidence >= 0.75) {
      return "dusuk";
    }

    if (confidence >= 0.45) {
      return "orta";
    }

    return "yuksek";
  }

  normalizeRecommendation(value: unknown): Recommendation {
    const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";

    if (normalized === Recommendation.ADVANCE) {
      return Recommendation.ADVANCE;
    }

    if (normalized === Recommendation.HOLD) {
      return Recommendation.HOLD;
    }

    if (normalized === Recommendation.REVIEW) {
      return Recommendation.REVIEW;
    }

    if (normalized.includes("REJECT")) {
      return Recommendation.REVIEW;
    }

    return Recommendation.REVIEW;
  }
}
