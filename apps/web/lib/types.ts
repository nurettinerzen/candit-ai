export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue;
};

export type JobStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type ApplicationStage =
  | "APPLIED"
  | "SCREENING"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "RECRUITER_REVIEW"
  | "HIRING_MANAGER_REVIEW"
  | "OFFER"
  | "REJECTED"
  | "HIRED";

export type Recommendation = "ADVANCE" | "HOLD" | "REVIEW";
export type HumanDecision = "advance" | "hold" | "reject";

export type InterviewMode = "MEETING_LINK" | "PHONE" | "ONSITE" | "VOICE" | "VIDEO";

export type InterviewSessionStatus =
  | "SCHEDULED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "NO_SHOW"
  | "CANCELLED";

export type MeetingProvider =
  | "CALENDLY"
  | "GOOGLE_CALENDAR"
  | "MICROSOFT_CALENDAR"
  | "ZOOM"
  | "GOOGLE_MEET";

export type JobRequirement = {
  id: string;
  key: string;
  value: string;
  required: boolean;
};

export type Job = {
  id: string;
  title: string;
  roleFamily: string;
  status: JobStatus;
  locationText: string | null;
  shiftType: string | null;
  salaryMin: string | null;
  salaryMax: string | null;
  jdText: string | null;
  createdAt: string;
  requirements: JobRequirement[];
  _count?: {
    applications: number;
  };
};

export type JobPostingDraftResponse = {
  draftText: string;
  generationMode: "fresh" | "rewrite";
  source: "llm" | "fallback";
  providerKey: string;
  modelKey: string;
  notice: string | null;
};

export type Candidate = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  createdAt: string;
  applicationCount?: number;
};

export type CVFile = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageProvider: string;
  checksumSha256: string | null;
  uploadedBy: string;
  isPrimary: boolean;
  uploadedAt: string;
};

export type CvParsedProfile = {
  id: string;
  cvFileId: string;
  aiTaskRunId: string | null;
  profileJson: JsonValue;
  parseConfidence: string | number;
  requiresManualReview: boolean;
  providerMode: string;
  providerKey: string | null;
  modelKey: string | null;
  extractionStatus: string;
  extractionMethod: string;
  extractionProvider: string | null;
  extractionCharCount: number;
  extractionQuality: string | number | null;
  extractionNotesJson: JsonValue | null;
  uncertaintyJson: JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

export type CandidateCvFile = CVFile & {
  parsedProfile?: CvParsedProfile | null;
  latestParseTask?: AiTaskRun | null;
  isLatest?: boolean;
};

export type CandidateWithApplications = Candidate & {
  applications: Array<{
    id: string;
    jobId: string;
    currentStage: ApplicationStage;
    aiRecommendation: Recommendation | null;
    humanDecision: HumanDecision | null;
    stageUpdatedAt: string;
    createdAt: string;
    job: Job;
  }>;
  cvFiles: CandidateCvFile[];
  latestCvFileId: string | null;
  primaryCvFileId: string | null;
  latestParsingTask: AiTaskRun | null;
  latestParsedProfile: CvParsedProfile | null;
  uploadPolicy: {
    maxSizeBytes: number;
    allowedExtensions: string[];
    allowedMimeTypes: string[];
  };
};

export type CandidateCreateResponse = {
  deduplicated: boolean;
  candidate: Candidate;
};

export type AiEvidenceLink = {
  id: string;
  evidenceType: string;
  evidenceRef: string;
  claimText: string;
  transcriptSegmentId: string | null;
  createdAt: string;
};

export type AiReport = {
  id: string;
  recommendation: Recommendation;
  confidence: string | number;
  overallScore: string | number | null;
  modelName: string;
  promptVersion: string;
  reportJson: JsonValue;
  sessionId: string;
  createdAt: string;
  evidenceLinks: AiEvidenceLink[];
};

export type ApplicationRecommendationArtifact = {
  id: string;
  recommendation: Recommendation;
  confidence: string | number;
  summaryText: string;
  rationaleJson: JsonValue | null;
  uncertaintyJson: JsonValue | null;
  evidenceCount: number;
  requiresHumanApproval: boolean;
  createdBy: string;
  createdAt: string;
  aiTaskRunId: string | null;
};

export type AiTaskType =
  | "CV_PARSING"
  | "JOB_REQUIREMENT_INTERPRETATION"
  | "CANDIDATE_FIT_ASSISTANCE"
  | "SCREENING_SUPPORT"
  | "INTERVIEW_PREPARATION"
  | "INTERVIEW_ORCHESTRATION"
  | "TRANSCRIPT_SUMMARIZATION"
  | "REPORT_GENERATION"
  | "RECOMMENDATION_GENERATION"
  | "APPLICANT_FIT_SCORING";

export type AiTaskRun = {
  id: string;
  taskType: AiTaskType;
  status:
    | "PENDING"
    | "QUEUED"
    | "RUNNING"
    | "SUCCEEDED"
    | "FAILED"
    | "CANCELLED"
    | "NEEDS_REVIEW";
  automationLevel: "ASSISTED" | "MANUAL_WITH_AI_SUPPORT" | "AUTOMATED";
  providerKey: string | null;
  modelKey: string | null;
  candidateId: string | null;
  jobId: string | null;
  applicationId: string | null;
  sessionId: string | null;
  workflowJobId: string | null;
  errorMessage: string | null;
  outputJson: JsonValue | null;
  uncertaintyJson: JsonValue | null;
  guardrailFlags: JsonValue | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recommendations?: ApplicationRecommendationArtifact[];
};

export type HumanApproval = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string;
  reasonCode: string | null;
  requestedBy: string;
  approvedBy: string;
  aiTaskRunId: string | null;
  recommendationId: string | null;
  metadata: JsonValue | null;
  approvedAt: string;
};

export type Application = {
  id: string;
  candidateId: string;
  jobId: string;
  currentStage: ApplicationStage;
  stageUpdatedAt: string;
  humanDecisionRequired: boolean;
  aiRecommendation: Recommendation | null;
  createdAt: string;
  candidate: Candidate;
  job: Job;
  aiReports: AiReport[];
  recommendations: ApplicationRecommendationArtifact[];
  aiTaskRuns?: AiTaskRun[];
};

export type ApplicationDetail = Application & {
  candidate: Candidate & {
    cvFiles?: CandidateCvFile[];
  };
  aiTaskRuns: AiTaskRun[];
  stageHistory: Array<{
    id: string;
    fromStage: ApplicationStage | null;
    toStage: ApplicationStage;
    reasonCode: string | null;
    changedBy: string;
    changedAt: string;
  }>;
  humanApprovals: HumanApproval[];
};

export type ApplicationCreatePayload = {
  candidateId: string;
  jobId: string;
};

export type StageTransitionPayload = {
  toStage: ApplicationStage;
  reasonCode: string;
};

export type DecisionPayload = {
  decision: "advance" | "hold" | "reject";
  reasonCode: string;
  aiReportId: string;
  humanApprovedBy: string;
};

export type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AiTaskRunCreatePayload = {
  taskType: AiTaskType;
  input: Record<string, unknown>;
  traceId?: string;
  candidateId?: string;
  jobId?: string;
  applicationId?: string;
  sessionId?: string;
  aiReportId?: string;
  promptTemplateId?: string;
  rubricId?: string;
  providerKey?: string;
  humanApprovedBy?: string;
};

export type FeatureFlag = {
  id: string;
  key: string;
  type: "BOOLEAN" | "MULTIVARIATE" | "KILL_SWITCH";
  value: JsonValue;
  description: string | null;
  updatedAt: string;
};

export type AnalyticsFunnelRow = {
  stage: ApplicationStage;
  count: number;
};

export type AnalyticsTimeToHire = {
  hires: number;
  avgDays: number | null;
  medianDays: number | null;
};

export type AnalyticsInterviewQuality = {
  transcriptSamples: number;
  reportSamples: number;
  transcriptQualityAvg: number | null;
  reportConfidenceAvg: number | null;
};

export type RecruiterOverviewReadModel = {
  kpis: {
    publishedJobs: number;
    totalCandidates: number;
    activeApplications: number;
    avgReportConfidence: number | null;
  };
  pipeline: AnalyticsFunnelRow[];
  metrics: {
    timeToHire: AnalyticsTimeToHire;
    interviewQuality: AnalyticsInterviewQuality;
  };
  scenarios: Array<{
    applicationId: string;
    candidateName: string;
    jobTitle: string;
    stage: ApplicationStage;
    aiState: {
      hasReport: boolean;
      hasRecommendation: boolean;
      latestTaskType: AiTaskType | null;
      latestTaskStatus: AiTaskRun["status"] | null;
      label: string;
    };
  }>;
};

export type AiSupportCenterReadModel = {
  providers: string[];
  providerStatus?: {
    defaultProvider: string;
    providers: Array<{
      key: string;
      configured: boolean;
      mode: "fallback" | "provider";
      active: boolean;
      reason?: string | null;
    }>;
  };
  flags: FeatureFlag[];
  speech?: {
    preferred: {
      preferredSttProvider: string;
      preferredTtsProvider: string;
      providerMode: string;
      openAiSpeechReady: boolean;
    };
    providers: Array<{
      key: string;
      configured: boolean;
      mode: string;
      reason?: string | null;
    }>;
  };
  integrations?: Array<{
    id: string;
    provider: string;
    status: string;
    effectiveStatus: string;
    displayName: string | null;
    credentialStatus: string | null;
    credentialExpiresAt: string | null;
    credentialLastError: string | null;
    lastVerifiedAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  extraction?: {
    byStatus: Record<string, number>;
    byMethod: Record<string, number>;
  };
  taskRuns: Array<{
    id: string;
    taskType: AiTaskType;
    status: AiTaskRun["status"];
    providerKey: string | null;
    errorMessage: string | null;
    scope: string;
    createdAt: string;
  }>;
};

export type InfrastructureReadinessReadModel = {
  runtime: {
    parsing: {
      provider: string;
      mode: string;
      ready: boolean;
    };
    screening: {
      provider: string;
      mode: string;
      ready: boolean;
    };
    speech: {
      preferredSttProvider: string;
      preferredTtsProvider: string;
      providerMode: string;
      openAiSpeechReady: boolean;
      ready: boolean;
    };
    calendly: {
      oauthConfigured: boolean;
      webhookSigningSecretConfigured: boolean;
    };
    googleCalendar: {
      oauthConfigured: boolean;
    };
    notifications: {
      emailProvider: string;
      ready: boolean;
    };
  };
  ai: AiSupportCenterReadModel["providerStatus"];
  cvExtraction: AiSupportCenterReadModel["extraction"];
  speech: AiSupportCenterReadModel["speech"];
  integrations: NonNullable<AiSupportCenterReadModel["integrations"]>;
  sessions: Array<{
    id: string;
    runtimeProviderMode: string;
    voiceInputProvider: string | null;
    voiceOutputProvider: string | null;
    schedulingSource: string;
    meetingProvider: string | null;
    meetingProviderSource: string | null;
    mode: InterviewMode;
    status: InterviewSessionStatus;
    updatedAt: string;
  }>;
};

export type InterviewTranscriptPreviewSegment = {
  id: string;
  speaker: "AI" | "CANDIDATE" | "RECRUITER";
  startMs: number;
  endMs: number;
  text: string;
  confidence: string | number | null;
};

export type InterviewTurnView = {
  id: string;
  sequenceNo: number;
  blockKey: string;
  questionKey: string;
  category: string;
  kind: string;
  promptText: string;
  answerText: string | null;
  answerConfidence: string | number | null;
  answerLatencyMs: number | null;
  answerDurationMs: number | null;
  answerSource: string | null;
  answerSubmittedAt: string | null;
  followUpDepth: number;
  completionStatus: string;
  transitionDecision: string | null;
  decisionReason: string | null;
};

export type InterviewSessionView = {
  id: string;
  applicationId: string;
  candidateName: string | null;
  jobTitle: string | null;
  templateId: string;
  status: InterviewSessionStatus;
  mode: InterviewMode;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  cancelledAt: string | null;
  cancelReasonCode: string | null;
  scheduleNote: string | null;
  scheduledBy: string | null;
  interviewerName: string | null;
  interviewerUserId: string | null;
  interviewType: string | null;
  modeContextJson: JsonValue | null;
  meetingProvider: MeetingProvider | null;
  meetingProviderSource: string | null;
  meetingConnectionId: string | null;
  meetingJoinUrl: string | null;
  meetingExternalRef: string | null;
  meetingCalendarEventRef: string | null;
  candidateAccessToken: string | null;
  candidateAccessExpiresAt: string | null;
  candidateInterviewUrl: string | null;
  candidateLocale: string | null;
  runtimeMode: string | null;
  runtimeProviderMode: string | null;
  voiceInputProvider: string | null;
  voiceOutputProvider: string | null;
  currentQuestionIndex: number | null;
  currentFollowUpCount: number | null;
  currentQuestionKey: string | null;
  completedReasonCode: string | null;
  abandonedAt: string | null;
  rescheduleCount: number;
  lastRescheduledAt: string | null;
  lastRescheduledBy: string | null;
  lastRescheduleReasonCode: string | null;
  rubricKey: string | null;
  rubricVersion: number | null;
  template: {
    id: string;
    name: string;
    version: number;
    roleFamily: string;
  };
  transcript: {
    id: string;
    qualityStatus: "DRAFT" | "REVIEW_REQUIRED" | "VERIFIED";
    qualityScore: string | number | null;
    qualityReviewedAt: string | null;
    qualityReviewedBy: string | null;
    finalizedAt: string | null;
    ownerType: string;
    ownerId: string;
    ingestionMethod: string;
    ingestionStatus: string;
    reviewNotes: string | null;
    lastIngestedAt: string | null;
    segmentCount: number;
    previewSegments: InterviewTranscriptPreviewSegment[];
  } | null;
  turns: InterviewTurnView[];
  activeTurn: {
    id: string;
    sequenceNo: number;
    blockKey: string;
    questionKey: string;
    category: string;
    promptText: string;
    kind: string;
  } | null;
  progress: {
    answeredBlocks: number;
    totalBlocks: number;
    ratio: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type InterviewTimelineReadModel = {
  auditLogs: AuditLog[];
  domainEvents: Array<{
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: JsonValue;
    status: string;
    createdAt: string;
  }>;
};

export type InterviewTemplate = {
  id: string;
  name: string;
  roleFamily: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  metadata?: {
    blockCount: number;
    categories: string[];
  };
};

export type InterviewSchedulingProviders = {
  providers: Array<{
    provider: MeetingProvider;
    connectionId: string;
    displayName: string | null;
    hasMeetingUrlTemplate: boolean;
    updatedAt: string;
  }>;
  fallback: {
    provider: null;
    source: "internal_fallback";
    label: string;
  };
};

export type PublicInterviewSessionView = {
  sessionId: string;
  status: InterviewSessionStatus;
  candidate: {
    id: string;
    fullName: string;
  };
  job: {
    id: string;
    title: string;
    roleFamily: string;
  };
  template: {
    id: string;
    name: string;
    version: number;
    roleFamily: string;
  };
  runtime: {
    mode: string;
    providerMode: string;
    voiceInputProvider: string;
    voiceOutputProvider: string;
    locale: string;
    transparency: {
      sttPath: string;
      ttsPath: string;
      fallback: boolean;
    };
  };
  progress: {
    answeredBlocks: number;
    totalBlocks: number;
    ratio: number;
    currentQuestionKey: string | null;
    currentQuestionIndex: number | null;
  };
  activePrompt: {
    turnId: string;
    sequenceNo: number;
    blockKey: string;
    questionKey: string;
    category: string;
    kind: string;
    text: string;
    followUpDepth: number;
  } | null;
  conversation: Array<{
    id: string;
    sequenceNo: number;
    blockKey: string;
    questionKey: string;
    category: string;
    kind: string;
    promptText: string;
    answerText: string | null;
    completionStatus: string;
    answerConfidence: string | number | null;
    followUpDepth: number;
    answerSource: string | null;
    answerSubmittedAt: string | null;
  }>;
  transcript: {
    id: string;
    qualityStatus: "DRAFT" | "REVIEW_REQUIRED" | "VERIFIED";
    segmentCount: number;
    preview: Array<{
      id: string;
      speaker: "AI" | "CANDIDATE" | "RECRUITER";
      text: string;
      startMs: number;
      endMs: number;
    }>;
  } | null;
  schedule: {
    scheduledAt: string | null;
    startedAt: string | null;
    endedAt: string | null;
    abandonedAt: string | null;
    completedReasonCode: string | null;
  };
};

export type ApplicationDetailReadModel = {
  summary: {
    id: string;
    stage: ApplicationStage;
    stageUpdatedAt: string;
    createdAt: string;
    aiRecommendation: Recommendation | null;
    humanDecision: HumanDecision | null;
    humanDecisionRequired: boolean;
  };
  candidate: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    source: string | null;
    cvFiles: CandidateCvFile[];
  };
  job: {
    id: string;
    title: string;
    roleFamily: string;
    status: JobStatus;
  };
  artifacts: {
    screeningRuns: AiTaskRun[];
    latestScreeningRun: AiTaskRun | null;
    reports: AiReport[];
    recommendations: ApplicationRecommendationArtifact[];
    taskRuns: AiTaskRun[];
  };
  interview: {
    latestSession: InterviewSessionView | null;
    sessions: InterviewSessionView[];
    timeline: InterviewTimelineReadModel;
  };
  governance: {
    auditLogs: AuditLog[];
    humanApprovals: HumanApproval[];
  };
  timeline: {
    stageHistory: ApplicationDetail["stageHistory"];
    humanApprovals: HumanApproval[];
  };
};

export type RecruiterApplicationsReadModel = {
  total: number;
  items: Array<{
    id: string;
    stage: ApplicationStage;
    aiRecommendation: Recommendation | null;
    humanDecision: HumanDecision | null;
    stageUpdatedAt: string;
    createdAt: string;
    humanDecisionRequired: boolean;
    candidate: {
      id: string;
      fullName: string;
      email: string | null;
    };
    job: {
      id: string;
      title: string;
      status: JobStatus;
    };
    ai: {
      hasReport: boolean;
      reportId: string | null;
      reportConfidence: string | number | null;
      latestRecommendation: {
        id: string;
        recommendation: Recommendation;
        confidence: string | number;
        createdAt: string;
      } | null;
      latestTask: {
        id: string;
        taskType: AiTaskType;
        status: AiTaskRun["status"];
        createdAt: string;
      } | null;
    };
    interview: {
      id: string;
      status: InterviewSessionStatus;
      mode: InterviewMode;
      scheduledAt: string | null;
      schedulingSource: string | null;
      meetingProvider: MeetingProvider | null;
      meetingProviderSource: string | null;
      runtimeProviderMode: string | null;
      voiceInputProvider: string | null;
      voiceOutputProvider: string | null;
    };
  }>;
};

// ── Applicant Inbox Types ──

export type ApplicantFitScoreCategory = {
  key: string;
  label: string;
  weight: number | null;
  score: number;
  confidence: number;
  deterministicScore: number | null;
  aiScore: number | null;
  strengths: string[];
  risks: string[];
  reasoning: string;
};

export type ApplicantFitScoreSubScores = {
  schemaVersion: string;
  rubricRoleFamily: string | null;
  categories: ApplicantFitScoreCategory[];
};

export type ApplicantFitScoreView = {
  id: string;
  overallScore: number;
  confidence: number;
  subScores: ApplicantFitScoreSubScores;
  strengths: string[];
  risks: string[];
  missingInfo: string[];
  reasoning: string;
  createdAt: string;
};

export type RecruiterNote = {
  id: string;
  applicationId: string;
  authorUserId: string;
  noteText: string;
  createdAt: string;
};

export type JobInboxApplicant = {
  applicationId: string;
  candidateId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  locationText: string | null;
  source: string;
  externalRef: string | null;
  yearsOfExperience: number | null;
  stage: string;
  stageUpdatedAt: string;
  createdAt: string;
  aiRecommendation: Recommendation | null;
  fitScore: {
    overallScore: number;
    confidence: number;
    subScores: ApplicantFitScoreSubScores;
    strengths: string[];
    risks: string[];
    missingInfo: string[];
  } | null;
  screening: {
    status: string;
    taskRunId: string;
    createdAt: string;
  } | null;
  interview: {
    sessionId: string;
    status: string;
    mode: string;
    scheduledAt: string | null;
  } | null;
  scheduling: {
    workflowId: string;
    state: string;
    status: string;
  } | null;
  cvStatus: {
    hasCv: boolean;
    isParsed: boolean;
    cvFileId: string | null;
  };
  humanDecision: HumanDecision | null;
  noteCount: number;
};

export type JobInboxStats = {
  totalApplicants: number;
  byStage: Record<string, number>;
  bySource: Record<string, number>;
  avgFitScore: number | null;
  scoredCount: number;
  unscoredCount: number;
};

export type JobInboxReadModel = {
  job: Job;
  stats: JobInboxStats;
  applicants: JobInboxApplicant[];
};

export type QuickActionType =
  | "advance"
  | "reject"
  | "hold"
  | "invite_interview"
  // legacy — kept for backward compatibility
  | "shortlist"
  | "trigger_screening"
  | "trigger_fit_score";

export type QuickActionPayload = {
  action: QuickActionType;
  reasonCode?: string;
  note?: string;
};

export type QuickActionResult = {
  status: string;
  applicationId: string;
  action?: string;
  workflowId?: string;
  schedulingLink?: string;
  interviewLink?: string;
  sessionId?: string;
};

export type BulkImportCandidate = {
  fullName: string;
  phone?: string;
  email?: string;
  locationText?: string;
  yearsOfExperience?: number;
  externalRef?: string;
};

export type BulkImportPayload = {
  candidates: BulkImportCandidate[];
  source: string;
  externalSource?: string;
};

export type BulkCvUploadResult = {
  imported: number;
  queued: number;
  total: number;
  items: Array<{
    originalName: string;
    candidateId?: string;
    applicationId?: string;
    cvFileId?: string;
    taskRunId?: string;
    status: "queued" | "error";
    error?: string;
  }>;
};

export type ProviderHealthDashboard = {
  overall: "healthy" | "degraded";
  warnings: string[];
  ai: {
    providers: Array<{ key: string; available: boolean }>;
    activeProvider: string | null;
  };
  speech: Record<string, unknown>;
  integrations: Array<{
    provider: string;
    status: string;
    displayName: string;
    lastError: string | null;
  }>;
  runtimeProviders: Array<{
    key: string;
    ready: boolean;
    reason: string | null;
  }>;
};

export type BulkApproveResult = {
  total: number;
  results: Array<{
    applicationId: string;
    status: string;
    workflowId?: string;
    schedulingLink?: string;
    interviewLink?: string;
    sessionId?: string;
    error?: string;
  }>;
};
