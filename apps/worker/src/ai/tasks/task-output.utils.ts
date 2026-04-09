import type { Prisma } from "@prisma/client";
import {
  asJsonObject,
  toArray,
  toNumberValue,
  toRecord,
  toStringValue,
  type ProviderExecutionMode
} from "../types.js";

export type EvidenceLink = {
  sourceType: string;
  sourceRef: string;
  claim: string;
};

export type StructuredTaskSections = {
  facts: string[];
  interpretation: string[];
  interviewSummary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendationSummary: string;
  recommendationAction: string;
  recommendedOutcome?: string;
  flags: Array<{ code: string; severity: "low" | "medium" | "high"; note: string }>;
  missingInformation: string[];
  evidenceLinks: EvidenceLink[];
  confidence: number;
  uncertaintyReasons: string[];
};

export function defaultOutputSchema(
  schemaName: string,
  options?: { includeInterviewInsights?: boolean }
) {
  const includeInterviewInsights = options?.includeInterviewInsights === true;
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: schemaName,
    type: "object",
    additionalProperties: false,
    required: [
      "facts",
      "interpretation",
      ...(includeInterviewInsights ? ["interviewSummary", "strengths", "weaknesses"] : []),
      "recommendation",
      "flags",
      "missingInformation",
      "evidenceLinks",
      "confidence",
      "uncertainty"
    ],
    properties: {
      facts: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 12
      },
      interpretation: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 10
      },
      ...(includeInterviewInsights
        ? {
            interviewSummary: {
              type: "string"
            },
            strengths: {
              type: "array",
              items: { type: "string" },
              maxItems: 8
            },
            weaknesses: {
              type: "array",
              items: { type: "string" },
              maxItems: 8
            }
          }
        : {}),
      recommendation: {
        type: "object",
        additionalProperties: false,
        required: ["summary", "action", "recommendedOutcome"],
        properties: {
          summary: { type: "string" },
          action: { type: "string" },
          recommendedOutcome: {
            type: "string",
            enum: ["ADVANCE", "HOLD", "REVIEW"]
          }
        }
      },
      flags: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code", "severity", "note"],
          properties: {
            code: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            note: { type: "string" }
          }
        },
        maxItems: 10
      },
      missingInformation: {
        type: "array",
        items: { type: "string" },
        maxItems: 12
      },
      evidenceLinks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sourceType", "sourceRef", "claim"],
          properties: {
            sourceType: { type: "string" },
            sourceRef: { type: "string" },
            claim: { type: "string" }
          }
        },
        maxItems: 20
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      uncertainty: {
        type: "object",
        additionalProperties: false,
        required: ["reasons"],
        properties: {
          reasons: {
            type: "array",
            items: { type: "string" },
            maxItems: 8
          }
        }
      }
    }
  };
}

export function normalizeStructuredSections(
  value: unknown,
  fallback: StructuredTaskSections
): StructuredTaskSections {
  const source = toRecord(value);
  const recommendation = toRecord(source.recommendation);
  const uncertainty = toRecord(source.uncertainty);

  const normalizedOutcome = toStringValue(
    recommendation.recommendedOutcome,
    fallback.recommendedOutcome ?? "REVIEW"
  ).toUpperCase();

  return {
    facts: toStringArray(source.facts, fallback.facts),
    interpretation: toStringArray(source.interpretation, fallback.interpretation),
    interviewSummary: toStringValue(source.interviewSummary, fallback.interviewSummary ?? ""),
    strengths: toStringArray(source.strengths, fallback.strengths ?? []),
    weaknesses: toStringArray(source.weaknesses, fallback.weaknesses ?? []),
    recommendationSummary: toStringValue(recommendation.summary, fallback.recommendationSummary),
    recommendationAction: toStringValue(recommendation.action, fallback.recommendationAction),
    recommendedOutcome: normalizedOutcome,
    flags: normalizeFlags(source.flags, fallback.flags),
    missingInformation: toStringArray(source.missingInformation, fallback.missingInformation),
    evidenceLinks: normalizeEvidence(source.evidenceLinks, fallback.evidenceLinks),
    confidence: toNumberValue(source.confidence, fallback.confidence),
    uncertaintyReasons: toStringArray(uncertainty.reasons, fallback.uncertaintyReasons)
  };
}

export function toOutputJson(input: {
  schemaVersion: string;
  providerMode: ProviderExecutionMode;
  providerKey: string;
  modelKey?: string;
  fallback: boolean;
  facts: string[];
  interpretation: string[];
  interviewSummary?: string;
  strengths?: string[];
  weaknesses?: string[];
  recommendation: {
    summary: string;
    action: string;
    recommendedOutcome?: string;
  };
  flags: Array<{ code: string; severity: "low" | "medium" | "high"; note: string }>;
  missingInformation: string[];
  uncertainty: {
    level: "dusuk" | "orta" | "yuksek";
    reasons: string[];
    confidence: number;
  };
  evidenceLinks: EvidenceLink[];
  additional?: Record<string, unknown>;
}): Record<string, Prisma.InputJsonValue> {
  return asJsonObject({
    schemaVersion: input.schemaVersion,
    provider: {
      mode: input.providerMode,
      key: input.providerKey,
      model: input.modelKey,
      marker: input.fallback ? "generated-without-LLM" : undefined
    },
    sections: {
      facts: input.facts,
      interpretation: input.interpretation,
      interviewSummary: input.interviewSummary,
      strengths: input.strengths ?? [],
      weaknesses: input.weaknesses ?? [],
      recommendation: input.recommendation,
      flags: input.flags,
      missingInformation: input.missingInformation
    },
    uncertainty: input.uncertainty,
    evidenceLinks: input.evidenceLinks,
    safety: {
      recruiterReviewRequired: true,
      autoDecisionApplied: false,
      autoRejectAllowed: false
    },
    ...(input.additional ?? {})
  });
}

function toStringArray(value: unknown, fallback: string[]): string[] {
  const items = toArray(value)
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (items.length === 0) {
    return fallback;
  }

  return items.slice(0, 20);
}

function normalizeFlags(
  value: unknown,
  fallback: Array<{ code: string; severity: "low" | "medium" | "high"; note: string }>
): Array<{ code: string; severity: "low" | "medium" | "high"; note: string }> {
  const items = toArray(value)
    .map((entry) => toRecord(entry))
    .map((entry) => {
      const severity = toStringValue(entry.severity, "medium").toLowerCase();
      const normalizedSeverity: "low" | "medium" | "high" =
        severity === "low" ? "low" : severity === "high" ? "high" : "medium";

      return {
        code: toStringValue(entry.code, "GENERIC_FLAG"),
        severity: normalizedSeverity,
        note: toStringValue(entry.note, "Ek inceleme gerekli.")
      };
    })
    .filter((entry) => entry.code.length > 0);

  if (items.length === 0) {
    return fallback;
  }

  return items.slice(0, 10);
}

function normalizeEvidence(value: unknown, fallback: EvidenceLink[]) {
  const items = toArray(value)
    .map((entry) => toRecord(entry))
    .map((entry) => ({
      sourceType: toStringValue(entry.sourceType, "unknown"),
      sourceRef: toStringValue(entry.sourceRef, "unknown"),
      claim: toStringValue(entry.claim, "Kanit baglantisi belirtilmedi.")
    }))
    .filter((entry) => entry.sourceRef !== "unknown");

  if (items.length === 0) {
    return fallback;
  }

  return items.slice(0, 20);
}
