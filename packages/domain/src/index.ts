export const ROLES = [
  "owner",
  "manager",
  "staff"
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "tenant.manage",
  "workspace.manage",
  "user.manage",
  "job.create",
  "job.read",
  "job.update",
  "candidate.create",
  "candidate.read",
  "candidate.move_stage",
  "screening.template.manage",
  "screening.run",
  "interview.template.manage",
  "interview.schedule",
  "interview.read",
  "interview.session.manage",
  "ai.task.request",
  "ai.task.read",
  "ai.report.read",
  "report.generate",
  "report.read",
  "recommendation.read",
  "ai.config.update",
  "workflow.manage",
  "integration.manage",
  "notification.send",
  "audit.read"
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const APPLICATION_STAGES = [
  "applied",
  "screening",
  "interview_scheduled",
  "interview_completed",
  "recruiter_review",
  "hiring_manager_review",
  "offer",
  "rejected",
  "hired"
] as const;

export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  return "low";
}

export const NON_NEGOTIABLE_RULES = {
  aiIsCopilot: true,
  autoRejectAllowed: false,
  evidenceRequired: true,
  structuredInterviewOnly: true,
  humanDecisionRequired: true,
  turkishOnly: true
} as const;

export const DEFAULT_FEATURE_FLAGS = {
  autoStageChangeEnabled: false,
  aiFollowupEnabled: true,
  aiCvParsingEnabled: true,
  aiJobInterpretationEnabled: true,
  aiFitAssistEnabled: true,
  aiScreeningSupportEnabled: true,
  aiInterviewPreparationEnabled: false,
  aiInterviewOrchestrationEnabled: false,
  aiTranscriptSummarizationEnabled: false,
  aiReportGenerationEnabled: false,
  aiRecommendationGenerationEnabled: false,
  aiSystemTriggerApplicationCreatedScreeningEnabled: false,
  aiSystemTriggerStageReviewPackEnabled: false
} as const;

export const CANDIDATE_SOURCES = [
  "manual",
  "csv_import",
  "kariyer_net",
  "linkedin",
  "eleman_net",
  "referral",
  "walk_in",
  "email",
  "phone",
  "agency",
  "other"
] as const;

export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

export const AI_TASK_TYPES = [
  "CV_PARSING",
  "JOB_REQUIREMENT_INTERPRETATION",
  "CANDIDATE_FIT_ASSISTANCE",
  "SCREENING_SUPPORT",
  "INTERVIEW_PREPARATION",
  "INTERVIEW_ORCHESTRATION",
  "TRANSCRIPT_SUMMARIZATION",
  "REPORT_GENERATION",
  "RECOMMENDATION_GENERATION",
  "APPLICANT_FIT_SCORING"
] as const;

export type AiTaskType = (typeof AI_TASK_TYPES)[number];

export const AI_AUTOMATION_LEVELS = [
  "ASSISTED",
  "MANUAL_WITH_AI_SUPPORT",
  "AUTOMATED"
] as const;

export type AiAutomationLevel = (typeof AI_AUTOMATION_LEVELS)[number];

export const AI_FEATURE_FLAGS: Record<AiTaskType, string> = {
  CV_PARSING: "ai.cv_parsing.enabled",
  JOB_REQUIREMENT_INTERPRETATION: "ai.job_requirement_interpretation.enabled",
  CANDIDATE_FIT_ASSISTANCE: "ai.candidate_fit_assistance.enabled",
  SCREENING_SUPPORT: "ai.screening_support.enabled",
  INTERVIEW_PREPARATION: "ai.interview_preparation.enabled",
  INTERVIEW_ORCHESTRATION: "ai.interview_orchestration.enabled",
  TRANSCRIPT_SUMMARIZATION: "ai.transcript_summarization.enabled",
  REPORT_GENERATION: "ai.report_generation.enabled",
  RECOMMENDATION_GENERATION: "ai.recommendation_generation.enabled",
  APPLICANT_FIT_SCORING: "ai.applicant_fit_scoring.enabled"
};

export * from "./billing";
