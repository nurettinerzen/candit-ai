import { request } from "./http";
import type {
  AnalyticsFunnelRow,
  AnalyticsInterviewQuality,
  AnalyticsSummary,
  AnalyticsTimeToHire,
  AiSupportCenterReadModel,
  AiTaskRun,
  AiTaskRunCreatePayload,
  ApplicantFitScoreView,
  ApplicationDetailReadModel,
  Application,
  ApplicationCreatePayload,
  ApplicationDetail,
  BillingAddonKey,
  BillingOverviewReadModel,
  BillingPlanKey,
  BulkImportPayload,
  InternalAdminAccountDetailReadModel,
  InternalAdminAccountListReadModel,
  InternalAdminDashboardReadModel,
  InternalAdminPublicLeadListReadModel,
  InternalAdminPublicLeadStatus,
  InternalAdminRedAlertReadModel,
  JobInboxReadModel,
  JobPostingDraftResponse,
  QuickActionPayload,
  RecruiterApplicationsReadModel,
  RecruiterNote,
  RecruiterOverviewReadModel,
  SourcingAttachResult,
  SourcingCreateProjectResult,
  SourcingDiscoverResult,
  SourcingImportedLead,
  SourcingImportSourceType,
  SourcingLeadImportResult,
  SourcingOutreachResult,
  SourcingOverviewReadModel,
  SourcingProjectDetailReadModel,
  SourcingOutreachTemplate,
  AuditLog,
  BulkCvUploadResult,
  Candidate,
  CandidateCvFile,
  CandidateCreateResponse,
  CandidateWithApplications,
  CVFile,
  CvParsedProfile,
  DecisionPayload,
  FeatureFlag,
  InterviewMode,
  InterviewSchedulingProviders,
  InterviewSessionStatus,
  InterviewSessionView,
  InterviewQuestionnairePreview,
  InterviewTemplate,
  InfrastructureReadinessReadModel,
  PublicInterviewSessionView,
  Job,
  JobRequirement,
  ScreeningMode,
  JobStatus,
  MeetingProvider,
  MemberDirectoryItem,
  QuickActionResult,
  StageTransitionPayload,
  ProviderHealthDashboard,
  BulkApproveResult
} from "../types";

type CreateJobPayload = {
  title: string;
  department: string;
  roleFamily?: string;
  status: JobStatus;
  workspaceId?: string;
  locationText?: string;
  shiftType?: string;
  salaryMin?: number;
  salaryMax?: number;
  jdText?: string;
  aiDraftText?: string;
  requirements?: Array<Omit<JobRequirement, "id">>;
};

type GenerateJobDraftPayload = {
  title: string;
  department?: string;
  roleFamily?: string;
  locationText?: string;
  shiftType?: string;
  salaryMin?: number;
  salaryMax?: number;
  jdText?: string;
  requirements?: Array<{
    key: string;
    value: string;
    required: boolean;
  }>;
  existingDraft?: string;
  rewriteInstruction?: string;
};

type CreateCandidatePayload = {
  fullName: string;
  phone?: string;
  email?: string;
  source?: string;
};

type ScheduleInterviewPayload = {
  applicationId: string;
  templateId?: string;
  mode: InterviewMode;
  scheduledAt: string;
  interviewerName?: string;
  interviewerUserId?: string;
  interviewType?: string;
  scheduleNote?: string;
  modeContext?: Record<string, unknown>;
  preferredProvider?: MeetingProvider;
};

type RescheduleInterviewPayload = {
  scheduledAt: string;
  reasonCode?: string;
  scheduleNote?: string;
  modeContext?: Record<string, unknown>;
  preferredProvider?: MeetingProvider;
};

type TranscriptImportPayload = {
  transcriptText: string;
  defaultSpeaker?: "AI" | "CANDIDATE" | "RECRUITER";
  language?: string;
  sttModel?: string;
  replaceExisting?: boolean;
};

type TranscriptQualityPayload = {
  qualityStatus: "REVIEW_REQUIRED" | "VERIFIED";
  qualityScore?: number;
  reviewNotes?: string;
};

type PublicSessionStartPayload = {
  token: string;
  capabilities?: {
    speechRecognition?: boolean;
    speechSynthesis?: boolean;
    locale?: string;
  };
};

type PublicSessionAnswerPayload = {
  token: string;
  transcriptText: string;
  confidence?: number;
  speechLatencyMs?: number;
  speechDurationMs?: number;
  answerSource?: "voice_browser" | "manual_text" | "voice_provider";
  locale?: string;
};

type PublicSessionAudioAnswerPayload = {
  token: string;
  audioBase64: string;
  mimeType: string;
  locale?: string;
};

type PublicSessionCompletePayload = {
  token: string;
  transcriptSegments?: Array<{
    speaker: "AI" | "CANDIDATE" | "RECRUITER";
    text: string;
    confidence?: number;
  }>;
  locale?: string;
  sttModel?: string;
  completionReasonCode?: string;
};

export const apiClient = {
  listJobs() {
    return request<Job[]>("jobs");
  },
  deleteJobs(jobIds: string[]) {
    return request<{ deletedCount: number; deletedIds: string[] }>("jobs/bulk-delete", {
      method: "POST",
      body: { jobIds }
    });
  },
  createJob(payload: CreateJobPayload) {
    return request<Job>("jobs", {
      method: "POST",
      body: payload
    });
  },
  updateJobStatus(jobId: string, status: string) {
    return request<Job>(`jobs/${jobId}`, {
      method: "PATCH",
      body: { status }
    });
  },
  generateJobDraft(payload: GenerateJobDraftPayload) {
    return request<JobPostingDraftResponse>("jobs/draft", {
      method: "POST",
      body: payload
    });
  },
  listCandidates(query?: string) {
    return request<Candidate[]>("candidates", {
      query: query ? { query } : undefined
    });
  },
  getCandidate(id: string) {
    return request<CandidateWithApplications>(`candidates/${id}`);
  },
  listCandidateCvFiles(candidateId: string) {
    return request<{
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
    }>(`candidates/${candidateId}/cv-files`);
  },
  getCandidateCvFile(candidateId: string, cvFileId: string) {
    return request<CandidateCvFile>(`candidates/${candidateId}/cv-files/${cvFileId}`);
  },
  uploadCandidateCv(candidateId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);

    return request<CVFile>(`candidates/${candidateId}/cv-files`, {
      method: "POST",
      body: formData
    });
  },
  triggerCandidateCvParsing(
    candidateId: string,
    payload?: {
      cvFileId?: string;
      providerKey?: string;
    }
  ) {
    return request<{
      idempotent: boolean;
      cvFileId: string;
      taskRun: {
        taskRunId: string;
        taskType: string;
        status: string;
        workflowJobId?: string | null;
        createdAt: string;
      };
    }>(`candidates/${candidateId}/cv-parsing/trigger`, {
      method: "POST",
      body: payload ?? {}
    });
  },
  latestCandidateCvParsing(candidateId: string, cvFileId?: string) {
    return request<{
      candidateId: string;
      cvFileId: string | null;
      taskRun: AiTaskRun | null;
      parsedProfile: CvParsedProfile | null;
    }>(`candidates/${candidateId}/cv-parsing/latest`, {
      query: {
        cvFileId
      }
    });
  },
  createCandidate(payload: CreateCandidatePayload) {
    return request<CandidateCreateResponse>("candidates", {
      method: "POST",
      body: payload
    });
  },
  listApplications(params?: { stage?: string; jobId?: string }) {
    return request<Application[]>("applications", {
      query: {
        stage: params?.stage,
        jobId: params?.jobId
      }
    });
  },
  getApplication(id: string) {
    return request<ApplicationDetail>(`applications/${id}`);
  },
  createApplication(payload: ApplicationCreatePayload) {
    return request<Application>("applications", {
      method: "POST",
      body: payload
    });
  },
  stageTransition(id: string, payload: StageTransitionPayload) {
    return request<{
      applicationId: string;
      fromStage: string;
      toStage: string;
      changedAt: string;
      auditId: string;
    }>(`applications/${id}/stage-transition`, {
      method: "POST",
      body: payload
    });
  },
  submitDecision(id: string, payload: DecisionPayload) {
    return request<{
      applicationId: string;
      status: string;
      changedBy: string;
      changedAt: string;
      auditId: string;
    }>(`applications/${id}/decision`, {
      method: "POST",
      body: payload
    });
  },
  triggerScreeningSupport(applicationId: string, payload?: { providerKey?: string }) {
    return request<{
      idempotent: boolean;
      taskRun: {
        taskRunId: string;
        taskType: string;
        status: string;
        workflowJobId?: string | null;
        createdAt: string;
      };
    }>(`screening/applications/${applicationId}/trigger`, {
      method: "POST",
      body: payload ?? {}
    });
  },
  latestScreeningSupport(applicationId: string) {
    return request<AiTaskRun | null>(`screening/applications/${applicationId}/latest`);
  },
  listAuditLogs(params?: { entityType?: string; entityId?: string; limit?: number }) {
    return request<AuditLog[]>("audit-logs", {
      query: {
        entityType: params?.entityType,
        entityId: params?.entityId,
        limit: params?.limit
      }
    });
  },
  listAiTaskRuns(params?: { taskType?: string; applicationId?: string }) {
    return request<AiTaskRun[]>("ai/task-runs", {
      query: {
        taskType: params?.taskType,
        applicationId: params?.applicationId
      }
    });
  },
  getAiTaskRun(id: string) {
    return request<AiTaskRun>(`ai/task-runs/${id}`);
  },
  createAiTaskRun(payload: AiTaskRunCreatePayload) {
    return request<{
      taskRunId: string;
      taskType: string;
      status: string;
      automationLevel: string;
      workflowJobId?: string;
      createdAt: string;
    }>("ai/task-runs", {
      method: "POST",
      body: payload
    });
  },
  listAiProviders() {
    return request<string[]>("ai/task-runs/providers");
  },
  listFeatureFlags() {
    return request<FeatureFlag[]>("feature-flags");
  },
  updateFeatureFlag(
    key: string,
    payload: {
      value: unknown;
      type?: "BOOLEAN" | "MULTIVARIATE" | "KILL_SWITCH";
      description?: string;
    }
  ) {
    return request<FeatureFlag>(`feature-flags/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: payload
    });
  },
  analyticsFunnel() {
    return request<AnalyticsFunnelRow[]>("analytics/funnel");
  },
  analyticsSummary() {
    return request<AnalyticsSummary>("analytics/summary");
  },
  analyticsTimeToHire() {
    return request<AnalyticsTimeToHire>("analytics/time-to-hire");
  },
  analyticsInterviewQuality() {
    return request<AnalyticsInterviewQuality>("analytics/interview-quality");
  },
  recruiterOverviewReadModel() {
    return request<RecruiterOverviewReadModel>("read-models/recruiter-overview");
  },
  recruiterApplicationsReadModel(params?: { stage?: string; jobId?: string }) {
    return request<RecruiterApplicationsReadModel>("read-models/applications", {
      query: {
        stage: params?.stage,
        jobId: params?.jobId
      }
    });
  },
  applicationDetailReadModel(id: string) {
    return request<ApplicationDetailReadModel>(`read-models/applications/${id}`);
  },
  aiSupportCenterReadModel() {
    return request<AiSupportCenterReadModel>("read-models/ai-support-center");
  },
  infrastructureReadinessReadModel() {
    return request<InfrastructureReadinessReadModel>("read-models/infrastructure-readiness");
  },
  listInterviewTemplates(roleFamily?: string) {
    return request<InterviewTemplate[]>("interviews/templates", {
      query: {
        roleFamily
      }
    });
  },
  listInterviewSchedulingProviders() {
    return request<InterviewSchedulingProviders>("interviews/scheduling/providers");
  },
  listInterviewSessions(params?: { applicationId?: string; status?: InterviewSessionStatus }) {
    return request<InterviewSessionView[]>("interviews/sessions", {
      query: {
        applicationId: params?.applicationId,
        status: params?.status
      }
    });
  },
  getInterviewSession(id: string) {
    return request<InterviewSessionView>(`interviews/sessions/${id}`);
  },
  getInterviewTimeline(id: string) {
    return request<{
      sessionId: string;
      audits: AuditLog[];
      events: Array<{
        id: string;
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload: Record<string, unknown> | null;
        status: string;
        createdAt: string;
      }>;
    }>(`interviews/sessions/${id}/timeline`);
  },
  scheduleInterview(payload: ScheduleInterviewPayload) {
    return request<unknown>("interviews/sessions", {
      method: "POST",
      body: payload
    });
  },
  rescheduleInterview(sessionId: string, payload: RescheduleInterviewPayload) {
    return request<unknown>(`interviews/sessions/${sessionId}/reschedule`, {
      method: "POST",
      body: payload
    });
  },
  startInterviewSession(sessionId: string) {
    return request<unknown>(`interviews/sessions/${sessionId}/start`, {
      method: "POST",
      body: {}
    });
  },
  completeInterviewSession(sessionId: string, payload?: { triggerAiReviewPack?: boolean }) {
    return request<unknown>(`interviews/sessions/${sessionId}/complete`, {
      method: "POST",
      body: payload ?? {}
    });
  },
  cancelInterviewSession(sessionId: string, payload?: { reasonCode?: string }) {
    return request<unknown>(`interviews/sessions/${sessionId}/cancel`, {
      method: "POST",
      body: payload ?? {}
    });
  },
  importInterviewTranscript(sessionId: string, payload: TranscriptImportPayload) {
    return request<unknown>(`interviews/sessions/${sessionId}/transcript/import`, {
      method: "POST",
      body: payload
    });
  },
  reviewInterviewTranscript(sessionId: string, payload: TranscriptQualityPayload) {
    return request<unknown>(`interviews/sessions/${sessionId}/transcript/quality-review`, {
      method: "POST",
      body: payload
    });
  },
  requestInterviewReviewPack(sessionId: string, payload?: { providerKey?: string }) {
    return request<{
      sessionId: string;
      applicationId: string;
      reportTask: {
        taskRunId: string;
        taskType: string;
        status: string;
        automationLevel: string;
        workflowJobId?: string | null;
        createdAt: string;
      };
      recommendationTask: {
        taskRunId: string;
        taskType: string;
        status: string;
        automationLevel: string;
        workflowJobId?: string | null;
        createdAt: string;
      };
    }>(`interviews/sessions/${sessionId}/review-pack`, {
      method: "POST",
      body: payload ?? {}
    });
  },
  getPublicInterviewSession(sessionId: string, token: string) {
    return request<PublicInterviewSessionView>(`interviews/public/sessions/${sessionId}`, {
      query: {
        token
      }
    });
  },
  startPublicInterviewSession(sessionId: string, payload: PublicSessionStartPayload) {
    return request<PublicInterviewSessionView>(`interviews/public/sessions/${sessionId}/start`, {
      method: "POST",
      body: payload
    });
  },
  submitPublicInterviewAnswer(sessionId: string, payload: PublicSessionAnswerPayload) {
    return request<PublicInterviewSessionView>(`interviews/public/sessions/${sessionId}/answer`, {
      method: "POST",
      body: payload
    });
  },
  submitPublicInterviewAudioAnswer(sessionId: string, payload: PublicSessionAudioAnswerPayload) {
    return request<PublicInterviewSessionView>(`interviews/public/sessions/${sessionId}/answer-audio`, {
      method: "POST",
      body: payload
    });
  },
  completePublicInterviewSession(sessionId: string, payload: PublicSessionCompletePayload) {
    return request<PublicInterviewSessionView>(`interviews/public/sessions/${sessionId}/complete`, {
      method: "POST",
      body: payload
    });
  },
  getPublicInterviewPromptAudio(sessionId: string, token: string) {
    return request<{
      status: string;
      providerKey: string;
      audioBase64: string | null;
      mimeType: string | null;
      errorMessage?: string | null;
    }>(`interviews/public/sessions/${sessionId}/prompt-audio`, {
      method: "POST",
      body: {
        token
      }
    });
  },
  repeatPublicInterviewQuestion(sessionId: string, token: string) {
    return request<PublicInterviewSessionView>(`interviews/public/sessions/${sessionId}/repeat`, {
      method: "POST",
      body: {
        token
      }
    });
  },
  abandonPublicInterviewSession(sessionId: string, payload: { token: string; reasonCode?: string }) {
    return request<PublicInterviewSessionView>(`interviews/public/sessions/${sessionId}/abandon`, {
      method: "POST",
      body: payload
    });
  },
  initElevenLabsConversation(sessionId: string, token: string) {
    return request<{
      signedUrl: string;
      agentId: string;
      systemPrompt: string;
      firstMessage: string;
      dynamicVariables: Record<string, string | number | boolean>;
      contextualUpdate: string;
    }>(
      `interviews/public/sessions/${sessionId}/elevenlabs-init`,
      {
        method: "POST",
        body: { token }
      }
    );
  },

  // ── Applicant Inbox ──

  getJobInbox(jobId: string, filters?: { stage?: string; source?: string; minFitScore?: number; sortBy?: string }) {
    return request<JobInboxReadModel>(`jobs/${jobId}/applicants`, {
      query: {
        stage: filters?.stage,
        source: filters?.source,
        minFitScore: filters?.minFitScore,
        sortBy: filters?.sortBy
      }
    });
  },
  bulkImportApplicants(jobId: string, payload: BulkImportPayload) {
    return request<{ imported: number; skipped: number; errors: string[] }>(`jobs/${jobId}/applicants/bulk-import`, {
      method: "POST",
      body: payload
    });
  },
  bulkUploadApplicantCvs(jobId: string, payload: {
    files: File[];
    source: string;
    externalSource?: string;
    screeningMode?: ScreeningMode;
  }) {
    const formData = new FormData();
    for (const file of payload.files) {
      formData.append("files", file);
    }
    formData.append("source", payload.source);
    if (payload.externalSource) {
      formData.append("externalSource", payload.externalSource);
    }
    if (payload.screeningMode) {
      formData.append("screeningMode", payload.screeningMode);
    }

    return request<BulkCvUploadResult>(`jobs/${jobId}/applicants/bulk-cv-upload`, {
      method: "POST",
      body: formData
    });
  },
  getLatestFitScore(applicationId: string) {
    return request<ApplicantFitScoreView | null>(`applications/${applicationId}/fit-score/latest`);
  },
  previewInterviewQuestionnaire(applicationId: string, templateId?: string) {
    return request<InterviewQuestionnairePreview>(`applications/${applicationId}/interview-questionnaire`, {
      query: {
        templateId
      }
    });
  },
  listRecruiterNotes(applicationId: string) {
    return request<RecruiterNote[]>(`applications/${applicationId}/notes`);
  },
  addRecruiterNote(applicationId: string, noteText: string) {
    return request<RecruiterNote>(`applications/${applicationId}/notes`, {
      method: "POST",
      body: { noteText }
    });
  },
  quickAction(applicationId: string, payload: QuickActionPayload) {
    return request<QuickActionResult>(`applications/${applicationId}/quick-action`, {
      method: "POST",
      body: payload
    });
  },
  bulkApproveInterview(applicationIds: string[]) {
    return request<BulkApproveResult>("applications/bulk-approve-interview", {
      method: "POST",
      body: { applicationIds }
    });
  },
  bulkDeleteApplications(applicationIds: string[]) {
    return request<{ deletedCount: number; deletedIds: string[] }>("applications/bulk-delete", {
      method: "POST",
      body: { applicationIds }
    });
  },
  getProviderHealth() {
    return request<ProviderHealthDashboard>("read-models/provider-health");
  },
  getSourcingOverview() {
    return request<SourcingOverviewReadModel>("sourcing/overview");
  },
  createSourcingProject(payload: {
    jobId: string;
    name?: string;
    personaSummary?: string;
    notes?: string;
  }) {
    return request<SourcingCreateProjectResult>("sourcing/projects", {
      method: "POST",
      body: payload
    });
  },
  getSourcingProject(projectId: string) {
    return request<SourcingProjectDetailReadModel>(`sourcing/projects/${projectId}`);
  },
  refreshSourcingProject(projectId: string) {
    return request<SourcingProjectDetailReadModel>(`sourcing/projects/${projectId}/refresh`, {
      method: "POST",
      body: {}
    });
  },
  discoverSourcingProspects(
    projectId: string,
    payload: {
      roleTitle?: string;
      keyword?: string;
      locationText?: string;
      minYearsExperience?: number;
      skillTags?: string[];
      companyBackground?: string[];
      languages?: string[];
      workModel?: string;
      compensationMin?: number;
      compensationMax?: number;
      idealCandidateNotes?: string;
    }
  ) {
    return request<SourcingDiscoverResult>(`sourcing/projects/${projectId}/discover`, {
      method: "POST",
      body: payload
    });
  },
  importSourcingLeads(
    projectId: string,
    payload: {
      sourceType: SourcingImportSourceType;
      sourceLabel?: string;
      leads: SourcingImportedLead[];
    }
  ) {
    return request<SourcingLeadImportResult>(`sourcing/projects/${projectId}/import/leads`, {
      method: "POST",
      body: payload
    });
  },
  importSourcingProfileUrls(
    projectId: string,
    payload: {
      urls: string[];
      note?: string;
    }
  ) {
    return request<SourcingLeadImportResult>(`sourcing/projects/${projectId}/import/urls`, {
      method: "POST",
      body: payload
    });
  },
  updateSourcingProspectStage(
    projectId: string,
    prospectId: string,
    payload: {
      stage: string;
      recruiterNote?: string;
    }
  ) {
    return request<{ ok: boolean }>(`sourcing/projects/${projectId}/prospects/${prospectId}/stage`, {
      method: "POST",
      body: payload
    });
  },
  attachSourcingProspect(projectId: string, prospectId: string) {
    return request<SourcingAttachResult>(`sourcing/projects/${projectId}/prospects/${prospectId}/attach`, {
      method: "POST",
      body: {}
    });
  },
  listSourcingOutreachTemplates() {
    return request<SourcingOutreachTemplate[]>("sourcing/outreach/templates");
  },
  sendSourcingOutreach(
    projectId: string,
    payload: {
      prospectIds: string[];
      templateId?: string;
      subject?: string;
      body?: string;
      reviewNote?: string;
      sendNow?: boolean;
    }
  ) {
    return request<SourcingOutreachResult>(`sourcing/projects/${projectId}/outreach/send`, {
      method: "POST",
      body: payload
    });
  },
  updateSourcingProfileSuppression(
    profileId: string,
    payload: {
      status: "ALLOWED" | "DO_NOT_CONTACT" | "OPTED_OUT" | "NEEDS_REVIEW";
      reason?: string;
    }
  ) {
    return request<{ ok: boolean }>(`sourcing/profiles/${profileId}/suppression`, {
      method: "POST",
      body: payload
    });
  },
  listMembers() {
    return request<MemberDirectoryItem[]>("members");
  },
  inviteMember(payload: {
    email: string;
    fullName: string;
    role: "manager" | "staff";
  }) {
    return request<{
      userId: string;
      email: string;
      fullName: string;
      role: "manager" | "staff";
      status: "INVITED";
      invitedAt: string;
      expiresAt: string;
      invitationUrl: string | null;
    }>("members/invitations", {
      method: "POST",
      body: payload
    });
  },
  resendMemberInvitation(userId: string) {
    return request<{
      userId: string;
      invitedAt: string;
      expiresAt: string;
      invitationUrl: string | null;
    }>(`members/${userId}/resend-invitation`, {
      method: "POST",
      body: {}
    });
  },
  updateMemberRole(userId: string, payload: { role: "owner" | "manager" | "staff" }) {
    return request<{
      userId: string;
      role: "owner" | "manager" | "staff";
      previousOwnerUserId?: string;
      nextOwnerUserId?: string;
    }>(`members/${userId}/role`, {
      method: "PATCH",
      body: payload
    });
  },
  updateMemberStatus(userId: string, payload: { status: "ACTIVE" | "DISABLED" }) {
    return request<{
      userId: string;
      status: "ACTIVE" | "DISABLED";
    }>(`members/${userId}/status`, {
      method: "PATCH",
      body: payload
    });
  },
  transferOwnership(userId: string) {
    return request<{
      previousOwnerUserId: string;
      nextOwnerUserId: string;
    }>(`members/${userId}/transfer-ownership`, {
      method: "POST",
      body: {}
    });
  },
  deleteMember(userId: string) {
    return request<{
      userId: string;
    }>(`members/${userId}`, {
      method: "DELETE"
    });
  },
  billingOverview() {
    return request<BillingOverviewReadModel>("billing/overview");
  },
  createPlanCheckout(payload: { planKey: Exclude<BillingPlanKey, "ENTERPRISE">; billingEmail?: string }) {
    return request<{
      checkoutUrl: string | null;
      sessionId: string;
      flow?:
        | "stripe_checkout"
        | "customer_portal"
        | "scheduled"
        | "local_activation"
        | "subscription_updated"
        | "unchanged";
    }>("billing/checkout/plan", {
      method: "POST",
      body: payload
    });
  },
  createAddOnCheckout(payload: { addOnKey: BillingAddonKey; billingEmail?: string }) {
    return request<{
      checkoutUrl: string | null;
      sessionId: string;
      flow?: "stripe_checkout" | "local_activation";
    }>("billing/checkout/addon", {
      method: "POST",
      body: payload
    });
  },
  createEnterpriseCheckout(payload: {
    billingEmail: string;
    monthlyAmountCents: number;
    seatsIncluded: number;
    activeJobsIncluded: number;
    candidateProcessingIncluded: number;
    aiInterviewsIncluded: number;
    advancedReporting: boolean;
    calendarIntegrations: boolean;
    brandedCandidateExperience: boolean;
    customIntegrations: boolean;
    note?: string;
  }) {
    return request<{
      checkoutUrl: string | null;
      sessionId: string;
    }>("billing/checkout/enterprise", {
      method: "POST",
      body: payload
    });
  },
  sendBillingCheckoutLink(payload: { checkoutSessionId: string; email: string }) {
    return request<{
      sent: true;
      email: string;
    }>("billing/checkout/send-link", {
      method: "POST",
      body: payload
    });
  },
  createBillingCustomerPortal() {
    return request<{
      portalUrl: string;
    }>("billing/customer-portal", {
      method: "POST",
      body: {}
    });
  },
  scheduleBillingSubscriptionCancellation() {
    return request<{
      checkoutUrl: null;
      sessionId: string;
      flow?: "scheduled_cancellation" | "unchanged";
    }>("billing/subscription/cancel", {
      method: "POST",
      body: {}
    });
  },
  resumeBillingSubscriptionCancellation() {
    return request<{
      checkoutUrl: null;
      sessionId: string;
      flow?: "subscription_updated" | "unchanged";
    }>("billing/subscription/resume", {
      method: "POST",
      body: {}
    });
  },
  internalAdminDashboard() {
    return request<InternalAdminDashboardReadModel>("internal-admin/dashboard");
  },
  internalAdminAuthFlags() {
    return request<FeatureFlag[]>("internal-admin/auth-flags");
  },
  internalAdminUpdateAuthFlag(
    key: string,
    payload: {
      value: boolean;
      type?: "BOOLEAN" | "MULTIVARIATE" | "KILL_SWITCH";
      description?: string;
    }
  ) {
    return request<FeatureFlag>(`internal-admin/auth-flags/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: payload
    });
  },
  internalAdminPublicLeads(params?: {
    query?: string;
    status?: "ALL" | InternalAdminPublicLeadStatus;
  }) {
    return request<InternalAdminPublicLeadListReadModel>("internal-admin/public-leads", {
      query: params
    });
  },
  internalAdminRedAlert(params?: {
    windowDays?: number;
    category?: "ALL" | "APPLICATION" | "SECURITY" | "ASSISTANT" | "OPERATIONS";
    severity?: "ALL" | "critical" | "warning";
  }) {
    return request<InternalAdminRedAlertReadModel>("internal-admin/red-alert", {
      query: params
    });
  },
  internalAdminAccounts(params?: {
    query?: string;
    planKey?: "ALL" | BillingPlanKey;
    status?: "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED";
  }) {
    return request<InternalAdminAccountListReadModel>("internal-admin/accounts", {
      query: params
    });
  },
  internalAdminAccountDetail(tenantId: string) {
    return request<InternalAdminAccountDetailReadModel>(`internal-admin/accounts/${tenantId}`);
  },
  internalAdminUpdateAccountStatus(
    tenantId: string,
    payload: { status: "ACTIVE" | "SUSPENDED" | "DELETED" }
  ) {
    return request<{ ok: true; status: "ACTIVE" | "SUSPENDED" | "DELETED" }>(
      `internal-admin/accounts/${tenantId}/status`,
      {
        method: "PATCH",
        body: payload
      }
    );
  },
  internalAdminUpdateAccountPlan(
    tenantId: string,
    payload: {
      planKey: BillingPlanKey;
      billingEmail?: string;
      status?: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "INCOMPLETE";
      monthlyAmountCents?: number;
      seatsIncluded?: number;
      activeJobsIncluded?: number;
      candidateProcessingIncluded?: number;
      aiInterviewsIncluded?: number;
      advancedReporting?: boolean;
      calendarIntegrations?: boolean;
      brandedCandidateExperience?: boolean;
      customIntegrations?: boolean;
      note?: string;
    }
  ) {
    return request<InternalAdminAccountDetailReadModel>(`internal-admin/accounts/${tenantId}/plan`, {
      method: "POST",
      body: payload
    });
  },
  internalAdminCreateQuotaGrant(
    tenantId: string,
    payload: {
      label?: string;
      seats?: number;
      activeJobs?: number;
      candidateProcessing?: number;
      aiInterviews?: number;
    }
  ) {
    return request<InternalAdminAccountDetailReadModel>(
      `internal-admin/accounts/${tenantId}/quota-grants`,
      {
        method: "POST",
        body: payload
      }
    );
  },
  internalAdminSendOwnerResetInvite(tenantId: string) {
    return request<{ sent: true; email: string }>(
      `internal-admin/accounts/${tenantId}/reset-owner-password`,
      {
        method: "POST",
        body: {}
      }
    );
  },
  internalAdminUpdatePublicLeadStatus(
    leadId: string,
    payload: { status: InternalAdminPublicLeadStatus }
  ) {
    return request<{ id: string; status: InternalAdminPublicLeadStatus }>(
      `internal-admin/public-leads/${leadId}/status`,
      {
        method: "PATCH",
        body: payload
      }
    );
  },
  internalAdminEnterprise(params?: {
    query?: string;
    status?: "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED";
  }) {
    return request<InternalAdminAccountListReadModel>("internal-admin/enterprise", {
      query: params
    });
  },
  internalAdminCreateEnterpriseCustomer(payload: {
    companyName: string;
    ownerFullName: string;
    ownerEmail: string;
    billingEmail: string;
    monthlyAmountCents: number;
    seatsIncluded: number;
    activeJobsIncluded: number;
    candidateProcessingIncluded: number;
    aiInterviewsIncluded: number;
    advancedReporting: boolean;
    calendarIntegrations: boolean;
    brandedCandidateExperience: boolean;
    customIntegrations: boolean;
    note?: string;
  }) {
    return request<{
      tenantId: string;
      checkoutUrl: string | null;
      sessionId: string | null;
      linkSent: boolean;
      stripeReady: boolean;
    }>("internal-admin/enterprise/customers", {
      method: "POST",
      body: payload
    });
  }
};

export type {
  CreateCandidatePayload,
  CreateJobPayload,
  RescheduleInterviewPayload,
  ScheduleInterviewPayload,
  TranscriptImportPayload,
  TranscriptQualityPayload
};
