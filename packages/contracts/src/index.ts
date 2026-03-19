export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail?: string;
  traceId?: string;
}

export interface CursorPage<T> {
  data: T[];
  nextCursor?: string;
}

export interface DecisionRequest {
  decision: "advance" | "hold" | "reject";
  reasonCode: string;
  aiReportId: string;
  humanApprovedBy: string;
}

export interface DecisionResponse {
  applicationId: string;
  status: string;
  changedBy: string;
  changedAt: string;
  auditId: string;
}

export interface CreateJobRequest {
  title: string;
  roleFamily: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  workspaceId?: string;
  locationText?: string;
  shiftType?: string;
  salaryMin?: number;
  salaryMax?: number;
  jdText?: string;
  requirements?: Array<{
    key: string;
    value: string;
    required?: boolean;
  }>;
}

export interface CandidateRecord {
  fullName: string;
  phone?: string;
  email?: string;
  source?: string;
  locationText?: string;
  yearsOfExperience?: number;
  externalRef?: string;
  externalSource?: string;
}

export interface StageTransitionRequest {
  toStage:
    | "APPLIED"
    | "SCREENING"
    | "INTERVIEW_SCHEDULED"
    | "INTERVIEW_COMPLETED"
    | "RECRUITER_REVIEW"
    | "HIRING_MANAGER_REVIEW"
    | "OFFER"
    | "REJECTED"
    | "HIRED";
  reasonCode?: string;
}

export interface AsyncJobResponse {
  jobId: string;
  status: string;
  acceptedAt: string;
}

export interface InterviewTemplate {
  templateId: string;
  language: "tr";
  durationTargetMin: number;
  followupMaxPerQuestion: number;
}

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

export interface AiTaskRunCreateRequest {
  taskType: AiTaskType;
  candidateId?: string;
  jobId?: string;
  applicationId?: string;
  sessionId?: string;
  promptTemplateId?: string;
  rubricId?: string;
  traceId?: string;
  input: Record<string, unknown>;
}

export interface AiTaskRunResponse {
  taskRunId: string;
  taskType: AiTaskType;
  status: "PENDING" | "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "NEEDS_REVIEW";
  automationLevel: "ASSISTED" | "MANUAL_WITH_AI_SUPPORT" | "AUTOMATED";
  workflowJobId?: string;
  createdAt: string;
}

export interface StructuredRecommendation {
  recommendation: "ADVANCE" | "HOLD" | "REVIEW";
  confidence: number;
  summaryText: string;
  rationale: Record<string, unknown>;
  uncertainty: Record<string, unknown>;
  evidenceCount: number;
}

export interface DomainEventEnvelope {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  tenantId: string;
  traceId?: string;
  payload: Record<string, unknown>;
}

/* ── Applicant Fit Scoring ── */

export interface SubScore {
  score: number;
  reason: string;
  confidence: number;
}

export interface ApplicantFitScoreResponse {
  id: string;
  applicationId: string;
  overallScore: number;
  confidence: number;
  subScores: {
    experienceFit: SubScore;
    locationFit: SubScore;
    shiftFit: SubScore;
    roleFit: SubScore;
  };
  strengths: string[];
  risks: string[];
  missingInfo: string[];
  reasoning?: string;
  createdAt: string;
}

/* ── Bulk Import ── */

export interface BulkImportApplicantsRequest {
  candidates: Array<CandidateRecord>;
  source: string;
  externalSource?: string;
}

export interface BulkImportApplicantsResponse {
  imported: number;
  deduplicated: number;
  applications: Array<{
    candidateId: string;
    applicationId: string;
    deduplicated: boolean;
  }>;
}

/* ── Quick Action ── */

export interface QuickActionRequest {
  action: "shortlist" | "reject" | "hold" | "trigger_screening" | "trigger_fit_score" | "invite_interview";
  reasonCode?: string;
  note?: string;
}
