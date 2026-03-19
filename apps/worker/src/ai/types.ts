import type { AiTaskRun, Prisma } from "@prisma/client";

export const SUPPORTED_WORKFLOW_TYPES = [
  "cv_parse",
  "screening_support",
  "report_generation",
  "recommendation_generation",
  "applicant_fit_scoring"
] as const;

export type SupportedWorkflowType = (typeof SUPPORTED_WORKFLOW_TYPES)[number];

export const WORKFLOW_TO_TASK_TYPE: Record<
  SupportedWorkflowType,
  | "CV_PARSING"
  | "SCREENING_SUPPORT"
  | "REPORT_GENERATION"
  | "RECOMMENDATION_GENERATION"
  | "APPLICANT_FIT_SCORING"
> = {
  cv_parse: "CV_PARSING",
  screening_support: "SCREENING_SUPPORT",
  report_generation: "REPORT_GENERATION",
  recommendation_generation: "RECOMMENDATION_GENERATION",
  applicant_fit_scoring: "APPLICANT_FIT_SCORING"
};

export type SupportedAiTaskType = (typeof WORKFLOW_TO_TASK_TYPE)[SupportedWorkflowType];

export type JsonObject = Record<string, Prisma.InputJsonValue>;

export type TaskExecutionContext = {
  tenantId: string;
  workflowJobId: string;
  traceId?: string;
  taskRun: AiTaskRun;
};

export type ProviderExecutionMode = "llm_openai" | "deterministic_fallback";

export type TaskExecutionArtifacts = {
  cvParsedProfileId?: string;
  reportId?: string;
  recommendationId?: string;
  fitScoreId?: string;
  evidenceLinkIds?: string[];
};

export type TaskExecutionResult = {
  outputJson: JsonObject;
  uncertaintyJson?: JsonObject;
  guardrailFlags: JsonObject;
  providerKey: string;
  providerMode: ProviderExecutionMode;
  modelKey?: string;
  promptVersion: string;
  policyVersion: string;
  artifacts?: TaskExecutionArtifacts;
};

export function isSupportedWorkflowType(type: string): type is SupportedWorkflowType {
  return SUPPORTED_WORKFLOW_TYPES.includes(type as SupportedWorkflowType);
}

export function asJsonObject(value: Record<string, unknown>): JsonObject {
  return value as JsonObject;
}

export function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function toStringValue(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

export function toNumberValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}
