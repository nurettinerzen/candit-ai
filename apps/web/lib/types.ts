export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = {
  [key: string]: JsonValue;
};

export type AppUserRole = "owner" | "manager" | "staff";
export type MemberStatus = "ACTIVE" | "INVITED" | "DISABLED";

export type JobStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type MemberDirectoryItem = {
  userId: string;
  fullName: string;
  email: string;
  role: AppUserRole;
  status: MemberStatus;
  emailVerifiedAt: string | null;
  invitedAt: string | null;
  pendingInvitationExpiresAt: string | null;
  hasPendingInvitation: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

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

export type InterviewInvitationState =
  | "INVITED"
  | "REMINDER_SENT"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "EXPIRED"
  | "FAILED";

export type InterviewInvitationView = {
  state: InterviewInvitationState;
  issuedAt: string | null;
  expiresAt: string | null;
  reminderCount: number;
  reminder1SentAt: string | null;
  reminder2SentAt: string | null;
  expired: boolean;
  resumeAllowed: boolean;
};

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
  aiDraftText: string | null;
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

export type SourcingProjectStatus = "ACTIVE" | "PAUSED" | "ARCHIVED";
export type SourcingProspectStage =
  | "NEW"
  | "NEEDS_REVIEW"
  | "GOOD_FIT"
  | "SAVED"
  | "CONTACTED"
  | "REPLIED"
  | "CONVERTED"
  | "REJECTED"
  | "ARCHIVED";

export type ProspectFitLabel =
  | "STRONG_MATCH"
  | "GOOD_MATCH"
  | "PARTIAL_MATCH"
  | "WEAK_MATCH"
  | "UNKNOWN";

export type TalentSourceKind =
  | "INTERNAL_CANDIDATE"
  | "PUBLIC_PROFESSIONAL"
  | "RECRUITER_IMPORT"
  | "REFERRAL"
  | "OTHER";

export type ContactSuppressionStatus =
  | "ALLOWED"
  | "DO_NOT_CONTACT"
  | "OPTED_OUT"
  | "NEEDS_REVIEW";

export type SourcingSourceRecord = {
  id: string;
  providerKey: string;
  providerLabel: string;
  displayName: string;
  sourceUrl: string | null;
  sourceKind: TalentSourceKind;
  isVerified: boolean;
};

export type SourcingProspectView = {
  id: string;
  profileId: string;
  stage: SourcingProspectStage;
  fitLabel: ProspectFitLabel;
  fitScore: number | null;
  fitConfidence: number | null;
  fullName: string;
  headline: string | null;
  summary: string | null;
  locationText: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  yearsOfExperience: number | null;
  workModel: string | null;
  email: string | null;
  phone: string | null;
  sourceKind: TalentSourceKind;
  primarySourceLabel: string | null;
  suppressionStatus: ContactSuppressionStatus;
  doNotContactReason: string | null;
  strengths: string[];
  risks: string[];
  missingInfo: string[];
  skills: string[];
  languages: string[];
  education: string[];
  experiences: string[];
  evidence: Array<{
    title: string;
    text: string;
    kind: "title" | "skills" | "location" | "experience" | "source";
  }>;
  discoveryQuality: {
    label: "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    score: number | null;
    recruiterLabel: string;
    summary: string;
    matchedCriteria: string[];
    reasons: string[];
    warnings: string[];
    pageType: string | null;
  };
  recruiterNote: string | null;
  attachedCandidateId: string | null;
  attachedApplicationId: string | null;
  contactedAt: string | null;
  repliedAt: string | null;
  convertedAt: string | null;
  sourceRecords: SourcingSourceRecord[];
  outreachHistory: Array<{
    id: string;
    status: "DRAFT" | "READY_TO_SEND" | "SENT" | "FAILED" | "REPLIED" | "CANCELLED";
    subject: string;
    sentAt: string | null;
    repliedAt: string | null;
  }>;
};

export type SourcingOutreachTemplate = {
  id: string;
  name: string;
  description: string | null;
  subjectTemplate: string;
  bodyTemplate: string;
  isDefault: boolean;
  sequence: Array<{
    dayOffset: number;
    label: string;
  }>;
};

export type SourcingProjectSummary = {
  id: string;
  name: string;
  status: SourcingProjectStatus;
  personaSummary: string | null;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    roleFamily: string;
    locationText: string | null;
  } | null;
  metrics: {
    total: number;
    needsReview: number;
    goodFit: number;
    contacted: number;
    replied: number;
    converted: number;
    blocked: number;
    avgFitScore: number | null;
  };
  sourceMix: Record<string, number>;
};

export type SourcingDiscoveryCriteria = {
  roleTitle: string;
  keyword: string | null;
  locationText: string | null;
  minYearsExperience: number | null;
  skillTags: string[];
  companyBackground: string[];
  languages: string[];
  workModel: string | null;
  compensationMin: number | null;
  compensationMax: number | null;
  idealCandidateNotes: string | null;
};

export type SourcingExternalDiscoverySummary = {
  totalCandidates: number;
  createdProfiles: number;
  mergedProfiles: number;
  linkedProspects: number;
  skippedResults: number;
  existingCandidateMatches: number;
  lastRunAt: string;
  mode: "openai_web_search";
  querySummary: string;
  highQualityResults: number;
  mediumQualityResults: number;
  lowQualityResults: number;
  filteredPatterns: string[];
  digitalVisibility: "limited" | "standard";
  queryHints: string[];
  notes: string[];
};

export type SourcingImportSourceType =
  | "recruiter_import"
  | "public_profile_url"
  | "agency_upload"
  | "referral"
  | "job_board_export";

export type SourcingImportedLead = {
  fullName: string;
  headline?: string;
  currentTitle?: string;
  currentCompany?: string;
  locationText?: string;
  yearsOfExperience?: number;
  workModel?: string;
  email?: string;
  phone?: string;
  sourceUrl?: string;
  skills?: string[];
  languages?: string[];
  notes?: string;
  recruiterTags?: string[];
  externalRef?: string;
};

export type SourcingLeadImportSummary = {
  totalRecords: number;
  processedRecords: number;
  newProfiles: number;
  mergedProfiles: number;
  newProspects: number;
  duplicateProspects: number;
  existingCandidateMatches: number;
  errorCount: number;
  sourceType: SourcingImportSourceType;
  sourceLabel: string;
  errors: Array<{
    index: number;
    reason: string;
    ref: string | null;
  }>;
};

export type SourcingAttachmentContextView = {
  projectId: string;
  projectName: string;
  prospectId: string;
  stage: SourcingProspectStage;
  primarySourceLabel: string | null;
  sourceLabels: string[];
  latestOutreach: {
    status: "DRAFT" | "READY_TO_SEND" | "SENT" | "FAILED" | "REPLIED" | "CANCELLED" | null;
    subject: string | null;
    sentAt: string | null;
    repliedAt: string | null;
    reviewNote: string | null;
    error: string | null;
  } | null;
};

export type SourcingOverviewReadModel = {
  summary: {
    totalProjects: number;
    activeProjects: number;
    totalProspects: number;
    savedProspects: number;
    contacted: number;
    replied: number;
    converted: number;
    rediscoveredCandidates: number;
    doNotContactCount: number;
  };
  projects: SourcingProjectSummary[];
  talentPool: {
    totalProfiles: number;
    bySource: Record<string, number>;
    bySuppression: Record<string, number>;
    recentProfiles: Array<{
      id: string;
      fullName: string;
      headline: string | null;
      locationText: string | null;
      currentTitle: string | null;
      sourceKind: TalentSourceKind;
      suppressionStatus: ContactSuppressionStatus;
      primarySource: {
        providerLabel: string;
        displayName: string;
        sourceUrl: string | null;
      } | null;
    }>;
  };
  savedProspects: Array<{
    id: string;
    projectId: string;
    projectName: string;
    fullName: string;
    headline: string | null;
    currentTitle: string | null;
    fitLabel: ProspectFitLabel;
    fitScore: number | null;
    sourceKind: TalentSourceKind;
    suppressionStatus: ContactSuppressionStatus;
    primarySource: {
      providerLabel: string;
      displayName: string;
    } | null;
  }>;
  compliance: {
    guidance: string;
    supportedSourceKinds: TalentSourceKind[];
  };
};

export type SourcingProjectDetailReadModel = {
  project: {
    id: string;
    name: string;
    status: SourcingProjectStatus;
    personaSummary: string | null;
    searchQuery: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    criteria: SourcingDiscoveryCriteria;
    lastExternalDiscovery: SourcingExternalDiscoverySummary | null;
    job: {
      id: string;
      title: string;
      roleFamily: string;
      locationText: string | null;
      shiftType: string | null;
      salaryMin: number | null;
      salaryMax: number | null;
      requirements: Array<{
        id: string;
        key: string;
        value: string;
        required: boolean;
      }>;
    } | null;
  };
  funnel: {
    total: number;
    byStage: Record<string, number>;
    byFitLabel: Record<string, number>;
    avgFitScore: number | null;
  };
  prospects: SourcingProspectView[];
  filters: {
    locations: string[];
    workModels: string[];
    sourceKinds: string[];
    stages: string[];
    fitLabels: string[];
    companies: Array<{ label: string; count: number }>;
    topSkills: Array<{ label: string; count: number }>;
    educations: Array<{ label: string; count: number }>;
    languages: Array<{ label: string; count: number }>;
  };
  outreachTemplates: SourcingOutreachTemplate[];
  copilot: {
    recommendedCandidates: Array<{
      id: string;
      fullName: string;
      fitScore: number | null;
      fitLabel: ProspectFitLabel;
      reason: string;
    }>;
    searchRefinements: string[];
    batchSuggestions: string[];
    outreachSuggestions: string[];
  };
  rediscovery: {
    internalMatches: number;
    externalMatches: number;
    existingCandidateLinked: number;
  };
  compliance: {
    blockedProfiles: number;
    message: string;
  };
  discovery: {
    status:
      | "NOT_RUN"
      | "STRONG_RESULTS"
      | "LIMITED_RESULTS"
      | "LOW_QUALITY_RESULTS"
      | "PUBLIC_DISCOVERY_WEAK";
    recruiterMessage: string;
    recruiterGuidance: string[];
    roleHints: string[];
    digitalVisibility: "limited" | "standard";
    qualityCounts: {
      high: number;
      medium: number;
      low: number;
    };
    filteredPatterns: string[];
  };
};

export type SourcingDiscoverResult = {
  summary: SourcingExternalDiscoverySummary;
  project: SourcingProjectDetailReadModel;
};

export type SourcingLeadImportResult = {
  summary: SourcingLeadImportSummary;
  project: SourcingProjectDetailReadModel;
};

export type SourcingCreateProjectResult = {
  created: boolean;
  projectId: string;
};

export type SourcingAttachResult = {
  candidateId: string;
  applicationId: string;
  projectId: string;
  jobId: string;
};

export type SourcingOutreachResult = {
  total: number;
  results: Array<{
    prospectId: string;
    status: "DRAFT" | "READY_TO_SEND" | "SENT" | "FAILED" | "REPLIED" | "CANCELLED" | "BLOCKED" | "SKIPPED";
    email: string | null;
    error?: string;
    messageId?: string;
  }>;
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
  sessionId: string | null;
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

export type BillingPlanKey = "FLEX" | "STARTER" | "GROWTH" | "ENTERPRISE";
export type BillingQuotaKey =
  | "SEATS"
  | "ACTIVE_JOBS"
  | "CANDIDATE_PROCESSING"
  | "AI_INTERVIEWS";
export type BillingFeatureKey =
  | "advancedReporting"
  | "calendarIntegrations"
  | "brandedCandidateExperience"
  | "customIntegrations";
export type BillingAddonKey =
  | "JOB_CREDIT_PACK_1"
  | "JOB_CREDIT_PACK_3"
  | "CANDIDATE_PROCESSING_PACK_50"
  | "INTERVIEW_PACK_10"
  | "INTERVIEW_PACK_25"
  | "CANDIDATE_PROCESSING_PACK_100";

export type BillingPlanDefinition = {
  key: BillingPlanKey;
  label: string;
  description: string;
  monthlyAmountCents: number | null;
  currency: string;
  billingModel: "prepaid" | "subscription" | "custom";
  priceLabel?: string;
  seatsIncluded: number;
  activeJobsIncluded: number;
  candidateProcessingIncluded: number;
  aiInterviewsIncluded: number;
  features: Record<BillingFeatureKey, boolean>;
  supportLabel: string;
  recommended?: boolean;
};

export type BillingAddonDefinition = {
  key: BillingAddonKey;
  label: string;
  description: string;
  amountCents: number;
  currency: string;
  quotaKey?: Exclude<BillingQuotaKey, "SEATS">;
  quantity?: number;
  serviceOnly?: boolean;
};

export type BillingQuotaOverview = {
  key: BillingQuotaKey;
  label: string;
  included: number;
  addOn: number;
  limit: number;
  used: number;
  remaining: number;
  utilizationPercent: number;
  warningState: "healthy" | "warning" | "exceeded";
};

export type BillingCheckoutHistoryItem = {
  id: string;
  checkoutType: string;
  status: string;
  planKey: BillingPlanKey | null;
  addOnKey: BillingAddonKey | null;
  label: string | null;
  checkoutUrl: string | null;
  billingEmail: string | null;
  amountCents: number | null;
  currency: string;
  createdAt: string;
  completedAt: string | null;
};

export type BillingOverviewReadModel = {
  stripeReady: boolean;
  viewer: {
    isInternalBillingAdmin: boolean;
  };
  account: {
    tenantId: string;
    billingEmail: string | null;
    stripeCustomerId: string | null;
    currentPlanKey: BillingPlanKey;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    features: Record<BillingFeatureKey, boolean>;
  };
  currentPlan: BillingPlanDefinition & {
    seatsIncluded: number;
    activeJobsIncluded: number;
    candidateProcessingIncluded: number;
    aiInterviewsIncluded: number;
  };
  trial: {
    isActive: boolean;
    isExpired: boolean;
    isEligible: boolean;
    blockReason: string | null;
    startedAt: string | null;
    endsAt: string | null;
    daysRemaining: number;
  };
  usage: {
    currentPeriodStart: string;
    currentPeriodEnd: string;
    quotas: BillingQuotaOverview[];
  };
  planCatalog: BillingPlanDefinition[];
  addOnCatalog: BillingAddonDefinition[];
  warnings: string[];
  recentCheckouts: BillingCheckoutHistoryItem[];
};

export type InternalAdminDashboardReadModel = {
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    suspendedCustomers: number;
    todayCandidateProcessing: number;
    todayAiInterviews: number;
    openAlerts: number;
    enterpriseCustomers: number;
    openLeadInbox: number;
  };
  planDistribution: Array<{
    key: BillingPlanKey;
    label: string;
    count: number;
  }>;
  quickLinks: {
    customers: number;
    redAlerts: number;
    enterprise: number;
    leads: number;
  };
};

export type InternalAdminAlertCategory = "APPLICATION" | "SECURITY" | "ASSISTANT" | "OPERATIONS";
export type InternalAdminAlertSeverity = "critical" | "warning";

export type InternalAdminRedAlertReadModel = {
  filters: {
    windowDays: number;
    category: "ALL" | InternalAdminAlertCategory;
    severity: "ALL" | InternalAdminAlertSeverity;
  };
  summary: Array<{
    key: InternalAdminAlertCategory;
    label: string;
    detail: string;
    count: number;
  }>;
  items: Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    category: InternalAdminAlertCategory;
    severity: InternalAdminAlertSeverity;
    source: string;
    message: string;
    repeats: number;
    lastSeenAt: string;
    status: "OPEN";
  }>;
};

export type InternalAdminCustomerRow = {
  tenantId: string;
  tenantName: string;
  tenantStatus: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  owner: {
    userId: string;
    fullName: string;
    email: string;
    status: MemberStatus;
    lastLoginAt: string | null;
  } | null;
  billing: {
    billingEmail: string | null;
    currentPlanKey: BillingPlanKey;
    status: string;
    currentPeriodEnd: string;
    trial: {
      isActive: boolean;
      isExpired: boolean;
      startedAt: string | null;
      endsAt: string | null;
      daysRemaining: number;
    };
  };
  usage: {
    seats: BillingQuotaOverview | null;
    activeJobs: BillingQuotaOverview | null;
    candidateProcessing: BillingQuotaOverview | null;
    aiInterviews: BillingQuotaOverview | null;
  };
  counts: {
    jobs: number;
    candidates: number;
    applications: number;
    interviews: number;
  };
};

export type InternalAdminAccountListReadModel = {
  summary: {
    total: number;
    active: number;
    suspended: number;
    flex: number;
    starter: number;
    growth: number;
    enterprise: number;
    trialActive: number;
    trialExpired: number;
    billingRisk: number;
  };
  rows: InternalAdminCustomerRow[];
};

export type InternalAdminAccountDetailReadModel = {
  tenant: {
    id: string;
    name: string;
    locale: string;
    timezone: string;
    status: "ACTIVE" | "SUSPENDED" | "DELETED";
    createdAt: string;
  };
  owner: {
    userId: string;
    fullName: string;
    email: string;
    status: MemberStatus;
    lastLoginAt: string | null;
  } | null;
  billing: BillingOverviewReadModel;
  activity: {
    recentCheckouts: Array<{
      id: string;
      checkoutType: string;
      status: string;
      label: string | null;
      billingEmail: string | null;
      checkoutUrl: string | null;
      amountCents: number | null;
      currency: string;
      createdAt: string;
    }>;
  };
};

export type InternalAdminPublicLeadStatus = "NEW" | "REVIEWING" | "CONTACTED" | "ARCHIVED";

export type InternalAdminPublicLeadListReadModel = {
  filters: {
    query: string;
    status: "ALL" | InternalAdminPublicLeadStatus;
  };
  summary: {
    total: number;
    new: number;
    reviewing: number;
    contacted: number;
    archived: number;
  };
  rows: Array<{
    id: string;
    status: InternalAdminPublicLeadStatus;
    fullName: string;
    email: string;
    normalizedEmail: string;
    company: string | null;
    phone: string | null;
    role: string | null;
    teamSize: string | null;
    message: string | null;
    sourcePage: string | null;
    landingUrl: string | null;
    referrerUrl: string | null;
    locale: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    userAgent: string | null;
    submissionCount: number;
    lastSubmittedAt: string;
    createdAt: string;
    updatedAt: string;
    opsNotificationStatus: "QUEUED" | "SENT" | "FAILED" | null;
    opsNotificationProvider: string | null;
    opsNotificationError: string | null;
    opsNotificationLastTriedAt: string | null;
    opsNotificationSentAt: string | null;
  }>;
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

export type AnalyticsSummary = {
  generatedAt: string;
  overview: {
    publishedJobs: number;
    totalCandidates: number;
    totalApplications: number;
    activePipelineApplications: number;
    interviewedApplications: number;
    hiredApplications: number;
  };
  pipeline: {
    funnel: AnalyticsFunnelRow[];
    conversion: {
      shortlistRate: number;
      interviewRate: number;
      offerRate: number;
      hireRate: number;
      rejectionRate: number;
    };
    velocity: {
      averageScreeningTurnaroundMinutes: number | null;
      averageTimeToInterviewDays: number | null;
      timeToHire: AnalyticsTimeToHire;
    };
  };
  interviews: {
    total: number;
    completed: number;
    running: number;
    cancelled: number;
    noShow: number;
    failed: number;
    aiScheduled: number;
    completionRate: number;
    noShowRate: number;
    aiSchedulingRate: number;
    avgDurationMinutes: number | null;
    medianDurationMinutes: number | null;
  };
  ai: {
    screeningCoverageCount: number;
    screeningCoverageRate: number;
    fitScoreAverage: number | null;
    fitScoreConfidenceAverage: number | null;
    reportCount: number;
    reportCoverageRate: number;
    reportConfidenceAverage: number | null;
    transcriptQualityAverage: number | null;
    aiTaskSuccessRate: number | null;
    estimatedTimeSavedHours: {
      screening: number;
      interviewAnalysis: number;
      scheduling: number;
      total: number;
    };
  };
  definitions: {
    timeToHire: string;
    reportConfidence: string;
    timeSaved: string;
  };
  workload: {
    applied: number;
    screening: number;
    interview: number;
    review: number;
    offer: number;
    hired: number;
    rejected: number;
  };
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
  queryWarnings?: string[];
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
  invitation: InterviewInvitationView | null;
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
  invitation: InterviewInvitationView | null;
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
    externalSource: string | null;
    externalRef: string | null;
    sourcing: SourcingAttachmentContextView | null;
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
    fitScoreRuns: AiTaskRun[];
    latestFitScoreRun: AiTaskRun | null;
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
      invitation: InterviewInvitationView | null;
      meetingProvider: MeetingProvider | null;
      meetingProviderSource: string | null;
      runtimeProviderMode: string | null;
      voiceInputProvider: string | null;
      voiceOutputProvider: string | null;
    } | null;
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
  source: string | null;
  externalSource: string | null;
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
    candidateInterviewUrl: string | null;
    invitation: InterviewInvitationView | null;
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
  sourcing: SourcingAttachmentContextView | null;
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
  commandCenter: {
    sourcingProject: {
      id: string;
      name: string;
      updatedAt: string;
      metrics: {
        totalProspects: number;
        needsReview: number;
        goodFit: number;
        contacted: number;
        replied: number;
        converted: number;
        blocked: number;
        attachedApplicants: number;
      };
    } | null;
    sourcedApplicants: number;
    readyForInterviewInvite: number;
    activeInterviewInvites: number;
    outreachAwaitingReply: number;
  };
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

export type InterviewQuestionDraftItem = {
  id: string;
  key: string;
  questionKey: string;
  category: string;
  prompt: string;
  followUps: string[];
  source: "template" | "suggested" | "custom";
  reason?: string;
};

export type InterviewQuestionnairePreview = {
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
  match: {
    score: number | null;
    label: string;
    tone: "strong" | "good" | "partial" | "weak" | "neutral";
    reasons: string[];
  };
  estimatedDuration: {
    min: number;
    max: number;
  };
  questions: InterviewQuestionDraftItem[];
  suggestions: InterviewQuestionDraftItem[];
};

export type QuickActionPayload = {
  action: QuickActionType;
  reasonCode?: string;
  note?: string;
  templateId?: string;
  questionnaire?: Array<{
    key?: string;
    questionKey?: string;
    category?: string;
    prompt: string;
    followUps?: string[];
  }>;
};

export type QuickActionResult = {
  status: string;
  applicationId: string;
  action?: string;
  workflowId?: string;
  schedulingLink?: string;
  interviewLink?: string;
  sessionId?: string;
  expiresAt?: string | null;
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
    expiresAt?: string | null;
    error?: string;
  }>;
};
