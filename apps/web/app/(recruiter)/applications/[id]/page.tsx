"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecruiterNotesPanel } from "../../../../components/recruiter-notes-panel";
import { useSiteLanguage } from "../../../../components/site-language-provider";
import { canPerformAction } from "../../../../lib/auth/policy";
import { resolveActiveSession } from "../../../../lib/auth/session";
import { StageChip } from "../../../../components/stage-chip";
import { ErrorState, LoadingState } from "../../../../components/ui-states";
import { FitScoreBreakdown } from "../../../../components/fit-score-breakdown";
import { FitScoreBar } from "../../../../components/fit-score-bar";
import { apiClient } from "../../../../lib/api-client";
import {
  AI_TASK_TYPE_LABELS,
  APPLICATION_STAGES,
  DECISION_LABELS,
  formatDepartment,
  STAGE_LABELS
} from "../../../../lib/constants";
import {
  compactJson,
  formatDate,
  formatPercent,
  prettyJson,
  truncate
} from "../../../../lib/format";
import type {
  AiReport,
  AiTaskRun,
  AiTaskType,
  ApplicantFitScoreView,
  ApplicationDetailReadModel,
  ApplicationRecommendationArtifact,
  ApplicationStage,
  InterviewMode,
  InterviewSchedulingProviders,
  InterviewSessionStatus,
  InterviewTemplate,
  MeetingProvider,
  RecruiterNote
} from "../../../../lib/types";

type InsightFlag = {
  code: string;
  severity: "low" | "medium" | "high";
  note: string;
};

type InsightEvidence = {
  sourceType: string;
  sourceRef: string;
  claim: string;
};

type ArtifactInsight = {
  summary: string;
  nextStep: string;
  strengths: string[];
  risks: string[];
  missingInformation: string[];
  uncertaintyReasons: string[];
  uncertaintyLevel: string;
  evidenceLinks: InsightEvidence[];
};

type ScreeningSupportView = {
  shortSummary: string;
  strengths: string[];
  risks: string[];
  likelyFitObservations: string[];
  followUpTopics: string[];
  missingInformation: string[];
  uncertaintyReasons: string[];
  evidenceLinks: InsightEvidence[];
};

function mergeUnique(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b]));
}

/* ── PII / kişisel bilgi filtresi ── */
const PII_PATTERNS = [
  /^aday[ıi]n?\s*ad[ıi]/i,
  /^ad[ıi]\s*:/i,
  /e-?posta/i,
  /telefon/i,
  /cv\s*(dosya|boyut|file|size)/i,
  /^\+?[0-9\s\-()]{7,}/,                     // telefon numarası
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,              // e-posta adresi
  /\.(pdf|docx?|png|jpg)$/i,                 // dosya adı
  /bytes?$/i,                                // dosya boyutu
];

function isPiiLine(text: string): boolean {
  return PII_PATTERNS.some((re) => re.test(text.trim()));
}

function filterPii(items: string[]): string[] {
  return items.filter((item) => !isPiiLine(item));
}

/* ── Risk kodu temizleme ── */
const RISK_CODE_LABELS: Record<string, string> = {
  EDUCATION_MISSING: "Eğitim geçmişi eksik",
  SKILLS_UNCLEAR: "Yetenekler tam olarak belirtilmemiş",
  EXPERIENCE_GAP: "Deneyim boşluğu var",
  CERTIFICATE_VERIFICATION_REQUIRED: "Sertifika doğrulaması gerekli",
  LOCATION_MISMATCH: "Lokasyon uyumsuzluğu",
  SALARY_MISMATCH: "Maaş beklentisi uyumsuz",
  OVERQUALIFIED: "Pozisyon için fazla nitelikli",
  UNDERQUALIFIED: "Pozisyon için yetersiz nitelik",
  REFERENCE_MISSING: "Referans bilgisi eksik",
  AVAILABILITY_UNCLEAR: "Uygunluk/başlangıç tarihi belirsiz",
  LANGUAGE_BARRIER: "Dil engeli olabilir",
  SHORT_TENURE: "Kısa süreli iş deneyimleri",
};

function cleanRiskText(text: string): string {
  // "CODE: açıklama" formatını temizle
  const match = text.match(/^([A-Z][A-Z0-9_]+):\s*(.+)$/);
  if (match) {
    const code = match[1] ?? "";
    const note = match[2] ?? text;
    // Türkçe karşılık varsa onu kullan, yoksa notu kullan
    return RISK_CODE_LABELS[code] ?? note;
  }
  return text;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function toStringArray(value: unknown, fallback: string[] = []) {
  const arr = Array.isArray(value) ? value : [];
  const normalized = arr
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalized.length > 0 ? normalized : fallback;
}

function toFlags(value: unknown): InsightFlag[] {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((entry) => toRecord(entry))
    .map((entry) => {
      const severityRaw = typeof entry.severity === "string" ? entry.severity.toLowerCase() : "medium";
      const severity: "low" | "medium" | "high" =
        severityRaw === "high" ? "high" : severityRaw === "low" ? "low" : "medium";

      return {
        code: typeof entry.code === "string" ? entry.code : "FLAG",
        severity,
        note: typeof entry.note === "string" ? entry.note : "Ek inceleme gerekli."
      };
    });
}

function toEvidence(value: unknown): InsightEvidence[] {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((entry) => toRecord(entry))
    .map((entry) => ({
      sourceType:
        typeof entry.sourceType === "string"
          ? entry.sourceType
          : typeof entry.evidenceType === "string"
            ? entry.evidenceType
            : "unknown",
      sourceRef:
        typeof entry.sourceRef === "string"
          ? entry.sourceRef
          : typeof entry.evidenceRef === "string"
            ? entry.evidenceRef
            : "unknown",
      claim:
        typeof entry.claim === "string"
          ? entry.claim
          : typeof entry.claimText === "string"
            ? entry.claimText
            : "Kanıt metni bulunamadı."
    }))
    .filter((item) => item.sourceRef !== "unknown");
}

function parseInsight(payload: unknown, uncertaintyPayload?: unknown): ArtifactInsight {
  const root = toRecord(payload);
  const sections = toRecord(root.sections);
  const recommendation = toRecord(
    Object.keys(sections).length > 0 ? sections.recommendation : root.recommendation
  );
  const uncertaintyRoot = toRecord(
    Object.keys(root).length > 0 ? root.uncertainty : uncertaintyPayload
  );

  const facts = toStringArray(
    Object.keys(sections).length > 0 ? sections.facts : root.facts,
    []
  );
  const interpretation = toStringArray(
    Object.keys(sections).length > 0 ? sections.interpretation : root.interpretation,
    []
  );
  const missingInformation = toStringArray(
    Object.keys(sections).length > 0 ? sections.missingInformation : root.missingInformation,
    []
  );

  const flags = toFlags(Object.keys(sections).length > 0 ? sections.flags : root.flags);
  const evidenceLinks = toEvidence(
    Object.keys(root).length > 0 ? root.evidenceLinks : root.evidenceLinks
  );

  const summary =
    typeof recommendation.summary === "string"
      ? recommendation.summary
      : typeof root.summaryText === "string"
        ? root.summaryText
        : "Özet bulunamadı.";

  const nextStep =
    typeof recommendation.action === "string"
      ? recommendation.action
      : "Recruiter manuel incelemesi tamamlanmalıdır.";

  const uncertaintyReasons = toStringArray(uncertaintyRoot.reasons, []);
  const uncertaintyLevel =
    typeof uncertaintyRoot.level === "string" ? uncertaintyRoot.level : "belirtilmedi";

  const strengths = filterPii(facts).slice(0, 5);
  const riskFromInterpretation = interpretation
    .filter((text) => /risk|eksik|belirsiz|uyumsuz|dogrula|teyit/i.test(text))
    .map(cleanRiskText)
    .slice(0, 5);
  const riskFromFlags = flags
    .filter((flag) => flag.severity !== "low")
    .map((flag) => cleanRiskText(`${flag.code}: ${flag.note}`))
    .slice(0, 5);

  return {
    summary,
    nextStep,
    strengths,
    risks: [...riskFromFlags, ...riskFromInterpretation].slice(0, 6),
    missingInformation,
    uncertaintyReasons,
    uncertaintyLevel,
    evidenceLinks
  };
}

function parseScreeningSupport(payload: unknown, uncertaintyPayload?: unknown): ScreeningSupportView {
  const root = toRecord(payload);
  const additional = toRecord(root.additional);
  const screeningSupport = toRecord(additional.screeningSupport);
  const uncertainty = toRecord(root.uncertainty);
  const uncertaintyFallback = toRecord(uncertaintyPayload);

  const insightFallback = parseInsight(payload, uncertaintyPayload);

  return {
    shortSummary:
      typeof screeningSupport.shortSummary === "string"
        ? screeningSupport.shortSummary
        : insightFallback.summary,
    strengths: filterPii(toStringArray(screeningSupport.strengths, insightFallback.strengths)),
    risks: toStringArray(screeningSupport.risks, insightFallback.risks).map(cleanRiskText),
    likelyFitObservations: filterPii(toStringArray(
      screeningSupport.likelyFitObservations,
      insightFallback.strengths
    )),
    followUpTopics: toStringArray(
      screeningSupport.followUpTopics,
      insightFallback.missingInformation
    ),
    missingInformation: toStringArray(
      screeningSupport.missingInformation,
      insightFallback.missingInformation
    ),
    uncertaintyReasons: toStringArray(
      toRecord(screeningSupport.uncertainty).reasons,
      toStringArray(uncertainty.reasons, toStringArray(uncertaintyFallback.reasons))
    ).map(cleanRiskText),
    evidenceLinks: toEvidence(screeningSupport.evidenceReferences ?? root.evidenceLinks)
  };
}

function readProviderMode(taskRun: AiTaskRun) {
  const output = toRecord(taskRun.outputJson);
  const provider = toRecord(output.provider);
  const mode = typeof provider.mode === "string" ? provider.mode : null;
  const marker = typeof provider.marker === "string" ? provider.marker : null;

  if (mode === "deterministic_fallback" || marker === "generated-without-LLM") {
    return "Deterministik fallback";
  }

  if (mode === "llm_openai") {
    return "Gerçek LLM";
  }

  if (taskRun.providerKey === "deterministic-fallback") {
    return "Deterministik fallback";
  }

  return "Belirtilmedi";
}

const INTERVIEW_MODE_LABELS: Record<string, string> = {
  MEETING_LINK: "Meeting Link",
  PHONE: "Telefon",
  ONSITE: "Yerinde/Manuel",
  VOICE: "Web Sesli",
  VIDEO: "Video"
};

const INTERVIEW_STATUS_LABELS: Record<InterviewSessionStatus, string> = {
  SCHEDULED: "Planlandı",
  RUNNING: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  NO_SHOW: "Katılım Yok",
  CANCELLED: "İptal"
};

const MEETING_PROVIDER_LABELS: Record<MeetingProvider, string> = {
  CALENDLY: "Calendly",
  GOOGLE_CALENDAR: "Google Calendar",
  MICROSOFT_CALENDAR: "Microsoft Calendar",
  ZOOM: "Zoom",
  GOOGLE_MEET: "Google Meet"
};

function describeReportContext(report: AiReport | null, hasScreeningSupport: boolean) {
  if (!report) {
    return "Belirtilmedi";
  }

  const context: string[] = [];
  context.push("CV tabanlı");
  if (hasScreeningSupport) {
    context.push("Screening tabanlı");
  }
  if (report.sessionId) {
    context.push("Interview tabanlı");
  }

  return context.join(" + ");
}

function describeRecommendationContext(recommendation: ApplicationRecommendationArtifact | null) {
  if (!recommendation) {
    return "Belirtilmedi";
  }

  const sourceArtifacts = toRecord(toRecord(recommendation.rationaleJson).sourceArtifacts);
  const context: string[] = ["CV tabanlı"];

  if (typeof sourceArtifacts.screeningTaskRunId === "string" && sourceArtifacts.screeningTaskRunId.length > 0) {
    context.push("Screening tabanlı");
  }

  if (typeof sourceArtifacts.reportId === "string" && sourceArtifacts.reportId.length > 0) {
    context.push("Interview/Report tabanlı");
  }

  return context.join(" + ");
}

function ArtifactCard({
  title,
  subtitle,
  insight
}: {
  title: string;
  subtitle: string;
  insight: ArtifactInsight;
}) {
  return (
    <article className="artifact-card">
      <div className="section-head" style={{ marginBottom: 10 }}>
        <div>
          <h4 style={{ margin: 0 }}>{title}</h4>
          <p className="small" style={{ margin: "4px 0 0" }}>
            {subtitle}
          </p>
        </div>
        <span className="badge warn">Sadece öneridir</span>
      </div>
      <p style={{ marginTop: 0 }}>{insight.summary}</p>
      <div className="mini-grid">
        <div>
          <p className="small section-label">Güçlü Sinyaller</p>
          {insight.strengths.length === 0 ? (
            <p className="small">Belirtilmedi.</p>
          ) : (
            <ul className="plain-list">
              {insight.strengths.map((item, index) => (
                <li key={`strength-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="small section-label">Riskler</p>
          {insight.risks.length === 0 ? (
            <p className="small">Belirgin risk kaydı yok.</p>
          ) : (
            <ul className="plain-list">
              {insight.risks.map((item, index) => (
                <li key={`risk-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="mini-grid">
        <div>
          <p className="small section-label">Eksik Bilgi</p>
          {insight.missingInformation.length === 0 ? (
            <p className="small">Eksik alan işaretlenmedi.</p>
          ) : (
            <ul className="plain-list">
              {insight.missingInformation.map((item, index) => (
                <li key={`missing-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="small section-label">Belirsizlik ({insight.uncertaintyLevel})</p>
          {insight.uncertaintyReasons.length === 0 ? (
            <p className="small">Belirsizlik nedeni yok.</p>
          ) : (
            <ul className="plain-list">
              {insight.uncertaintyReasons.map((item, index) => (
                <li key={`uncertainty-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <p className="small section-label">Önerilen Sonraki Adım</p>
      <p style={{ marginTop: 0 }}>{insight.nextStep}</p>
      <p className="small section-label">Kanıt Bağlantıları</p>
      {insight.evidenceLinks.length === 0 ? (
        <p className="small">Kanıt bağlantısı bulunamadı.</p>
      ) : (
        <ul className="plain-list">
          {insight.evidenceLinks.slice(0, 5).map((evidence, index) => (
            <li key={`evidence-${index}`}>
              <strong>{evidence.sourceType}</strong> / {evidence.sourceRef}: {evidence.claim}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function ApplicationDetailPage() {
  const { locale } = useSiteLanguage();
  const params = useParams<{ id: string }>();
  const applicationId = params.id;
  const session = useMemo(() => resolveActiveSession(), []);
  const canMoveStage = canPerformAction(session, "candidate.move_stage");
  const canAddNote = canPerformAction(session, "candidate.create");
  const canRequestAiTask = canPerformAction(session, "ai.task.request");
  const canRunScreeningSupport = canPerformAction(session, "screening.run");
  const canScheduleInterview = canPerformAction(session, "interview.schedule");
  const canManageInterviewSession = canPerformAction(session, "interview.session.manage");
  const currentUserId = session?.userId ?? "unknown_user";
  const notesSectionRef = useRef<HTMLDivElement | null>(null);
  const [application, setApplication] = useState<ApplicationDetailReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stage, setStage] = useState<ApplicationStage>("RECRUITER_REVIEW");
  const [stageReason, setStageReason] = useState("manual_stage_transition");
  const [stageError, setStageError] = useState("");
  const [stageSubmitting, setStageSubmitting] = useState(false);

  const [decision, setDecision] = useState<"advance" | "hold" | "reject">("hold");
  const [decisionReason, setDecisionReason] = useState("manual_recruiter_decision");
  const [aiReportId, setAiReportId] = useState("");
  const [humanApprovalChecked, setHumanApprovalChecked] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const [taskError, setTaskError] = useState("");
  const [taskMessage, setTaskMessage] = useState("");
  const [taskSubmittingType, setTaskSubmittingType] = useState<AiTaskType | null>(null);
  const [screeningError, setScreeningError] = useState("");
  const [screeningMessage, setScreeningMessage] = useState("");
  const [screeningSubmitting, setScreeningSubmitting] = useState(false);
  const [interviewTemplates, setInterviewTemplates] = useState<InterviewTemplate[]>([]);
  const [schedulingProviders, setSchedulingProviders] = useState<InterviewSchedulingProviders | null>(null);
  const [interviewError, setInterviewError] = useState("");
  const [interviewMessage, setInterviewMessage] = useState("");
  const [interviewSubmittingAction, setInterviewSubmittingAction] = useState<string | null>(null);
  const [scheduleTemplateId, setScheduleTemplateId] = useState("");
  const [scheduleMode, setScheduleMode] = useState<InterviewMode>("VOICE");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleInterviewerName, setScheduleInterviewerName] = useState("");
  const [scheduleInterviewType, setScheduleInterviewType] = useState(
    "Yapılandırılmış Sesli Ön Görüşme"
  );
  const [scheduleNote, setScheduleNote] = useState("");
  const [scheduleModeDetail, setScheduleModeDetail] = useState("");
  const [schedulePreferredProvider, setSchedulePreferredProvider] = useState<MeetingProvider | "">("");
  const [rescheduleSessionId, setRescheduleSessionId] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleReasonCode, setRescheduleReasonCode] = useState("manual_reschedule");
  const [transcriptSessionId, setTranscriptSessionId] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [transcriptReplaceExisting, setTranscriptReplaceExisting] = useState(true);
  const [qualitySessionId, setQualitySessionId] = useState("");
  const [qualityStatus, setQualityStatus] = useState<"REVIEW_REQUIRED" | "VERIFIED">("REVIEW_REQUIRED");
  const [qualityScore, setQualityScore] = useState("0.80");
  const [qualityNotes, setQualityNotes] = useState("");

  const [fitScore, setFitScore] = useState<ApplicantFitScoreView | null>(null);
  const [fitScoreLoading, setFitScoreLoading] = useState(false);
  const [fitScoreError, setFitScoreError] = useState("");
  const [fitScoreTriggering, setFitScoreTriggering] = useState(false);
  const [fitScoreMessage, setFitScoreMessage] = useState("");

  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [notes, setNotes] = useState<RecruiterNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");

  const loadFitScore = useCallback(async () => {
    setFitScoreLoading(true);
    setFitScoreError("");
    try {
      const result = await apiClient.getLatestFitScore(applicationId);
      setFitScore(result);
    } catch (err) {
      setFitScoreError(err instanceof Error ? err.message : "Uyum skoru yüklenemedi.");
    } finally {
      setFitScoreLoading(false);
    }
  }, [applicationId]);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    setNotesError("");
    try {
      const result = await apiClient.listRecruiterNotes(applicationId);
      setNotes(result);
    } catch (err) {
      setNotes([]);
      setNotesError(err instanceof Error ? err.message : "Notlar yüklenemedi.");
    } finally {
      setNotesLoading(false);
    }
  }, [applicationId]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const detailPromise = apiClient.applicationDetailReadModel(applicationId);
      const templatePromise = apiClient.listInterviewTemplates();
      const providerPromise = apiClient.listInterviewSchedulingProviders();
      const [detail, templates, providers] = await Promise.all([
        detailPromise,
        templatePromise,
        providerPromise
      ]);

      setApplication(detail);
      setInterviewTemplates(templates);
      setSchedulingProviders(providers);
      setStage(detail.summary.stage);
      setAiReportId(detail.artifacts.reports[0]?.id ?? "manual_ui_reference");
      const defaultTemplate = templates[0]?.id ?? "";
      setScheduleTemplateId((prev) => prev || defaultTemplate);
      const firstSessionId = detail.interview.sessions[0]?.id ?? "";
      setRescheduleSessionId((prev) => prev || firstSessionId);
      setTranscriptSessionId((prev) => prev || firstSessionId);
      setQualitySessionId((prev) => prev || firstSessionId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Başvuru detayı yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    void loadDetail();
    void loadFitScore();
    void loadNotes();
  }, [loadDetail, loadFitScore, loadNotes]);

  const availableStages = useMemo(
    () => APPLICATION_STAGES.filter((item) => item !== application?.summary.stage),
    [application?.summary.stage]
  );

  const latestReport = application?.artifacts.reports[0] ?? null;
  const latestRecommendation = application?.artifacts.recommendations[0] ?? null;
  const latestTaskRun = application?.artifacts.taskRuns[0] ?? null;
  const latestInterviewSession = application?.interview.latestSession ?? null;
  const latestCompletedSession =
    application?.interview.sessions.find((item) => item.status === "COMPLETED") ?? null;
  const latestScreeningRun =
    application?.artifacts.latestScreeningRun ?? application?.artifacts.screeningRuns[0] ?? null;

  const reportInsight = useMemo(
    () => (latestReport ? parseInsight(latestReport.reportJson) : null),
    [latestReport]
  );
  const recommendationInsight = useMemo(
    () =>
      latestRecommendation
        ? parseInsight(latestRecommendation.rationaleJson, latestRecommendation.uncertaintyJson)
        : null,
    [latestRecommendation]
  );
  const screeningSupportView = useMemo(
    () =>
      latestScreeningRun
        ? parseScreeningSupport(latestScreeningRun.outputJson, latestScreeningRun.uncertaintyJson)
        : null,
    [latestScreeningRun]
  );
  const reportSourceContext = useMemo(
    () => describeReportContext(latestReport, Boolean(latestScreeningRun)),
    [latestReport, latestScreeningRun]
  );
  const recommendationSourceContext = useMemo(
    () => describeRecommendationContext(latestRecommendation),
    [latestRecommendation]
  );

  async function handleAddNote(text: string) {
    setNotesError("");
    try {
      const note = await apiClient.addRecruiterNote(applicationId, text);
      setNotes((prev) => [note, ...prev]);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : "Not eklenemedi.";
      setNotesError(nextError);
      throw err;
    }
  }

  function handleFocusNotes() {
    const root = notesSectionRef.current;
    if (!root) {
      return;
    }

    root.scrollIntoView({ behavior: "smooth", block: "start" });

    window.setTimeout(() => {
      const textarea = root.querySelector("textarea");
      if (textarea instanceof HTMLTextAreaElement) {
        textarea.focus();
      }
    }, 150);
  }

  async function submitDecisionAction(
    nextDecision: "advance" | "hold" | "reject",
    reasonCode: string
  ) {
    setDecisionError("");

    if (!canMoveStage) {
      setDecisionError("Bu aksiyonlar için `candidate.move_stage` yetkisi gereklidir.");
      return;
    }

    setDecision(nextDecision);
    setDecisionReason(reasonCode);
    setDecisionSubmitting(true);

    try {
      await apiClient.submitDecision(applicationId, {
        decision: nextDecision,
        reasonCode,
        aiReportId: aiReportId.trim() || "manual_ui_reference",
        humanApprovedBy: currentUserId
      });
      setHumanApprovalChecked(false);
      await loadDetail();
    } catch (submitError) {
      setDecisionError(
        submitError instanceof Error ? submitError.message : "Karar gönderimi başarısız."
      );
    } finally {
      setDecisionSubmitting(false);
    }
  }

  async function handleStageTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStageError("");

    if (!stageReason.trim()) {
      setStageError("Stage değişimi için neden kodu zorunludur.");
      return;
    }

    setStageSubmitting(true);
    try {
      await apiClient.stageTransition(applicationId, {
        toStage: stage,
        reasonCode: stageReason.trim()
      });
      await loadDetail();
    } catch (submitError) {
      setStageError(submitError instanceof Error ? submitError.message : "Stage değişimi başarısız.");
    } finally {
      setStageSubmitting(false);
    }
  }

  async function handleDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDecisionError("");

    if (!decisionReason.trim()) {
      setDecisionError("Karar için neden kodu zorunludur.");
      return;
    }

    if (!humanApprovalChecked) {
      setDecisionError("İnsan onayı kutusu işaretlenmelidir.");
      return;
    }

    await submitDecisionAction(decision, decisionReason.trim());
  }

  async function handleTaskTrigger(taskType: AiTaskType) {
    if (!application) {
      return;
    }

    setTaskError("");
    setTaskMessage("");
    setTaskSubmittingType(taskType);

    try {
      await apiClient.createAiTaskRun({
        taskType,
        candidateId: application.candidate.id,
        jobId: application.job.id,
        applicationId: application.summary.id,
        sessionId:
          taskType === "REPORT_GENERATION" || taskType === "RECOMMENDATION_GENERATION"
            ? latestCompletedSession?.id ??
              latestReport?.sessionId ??
              application.artifacts.taskRuns.find((run) => run.sessionId)?.sessionId ??
              undefined
            : undefined,
        input: {
          triggerSource: "manual_ui",
          triggerReasonCode: "recruiter_manual_trigger",
          requestedFrom: "application_detail_v1"
        }
      });
      setTaskMessage(`${AI_TASK_TYPE_LABELS[taskType]} kuyruğa alındı.`);
      await loadDetail();
    } catch (submitError) {
      setTaskError(submitError instanceof Error ? submitError.message : "AI görevi kuyruğa alınamadı.");
    } finally {
      setTaskSubmittingType(null);
    }
  }

  async function handleFitScoreTrigger() {
    setFitScoreError("");
    setFitScoreMessage("");
    setFitScoreTriggering(true);
    try {
      await apiClient.quickAction(applicationId, { action: "trigger_fit_score" });
      setFitScoreMessage("Uyum skorlama görevi kuyruğa alındı. Sonuç birkaç saniye içinde hazır olacak.");
      setTimeout(() => void loadFitScore(), 5000);
    } catch (err) {
      setFitScoreError(err instanceof Error ? err.message : "Uyum skorlama tetiklenemedi.");
    } finally {
      setFitScoreTriggering(false);
    }
  }

  async function handleInviteInterview() {
    setInviteError("");
    setInviteMessage("");
    setInviteSubmitting(true);
    try {
      const result = await apiClient.quickAction(applicationId, { action: "invite_interview" });
      setInviteMessage(
        result.interviewLink && result.schedulingLink
          ? "Görüşme daveti gönderildi. Aday aynı e-postadan hemen başlayabilir veya daha sonra planlayabilir."
          : result.interviewLink
            ? "Görüşme daveti gönderildi. Adaya direkt görüşme linki iletildi."
            : "Görüşme daveti oluşturuldu."
      );
      await loadDetail();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Görüşme daveti gönderilemedi.");
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleScreeningTrigger() {
    setScreeningError("");
    setScreeningMessage("");
    setScreeningSubmitting(true);

    try {
      const response = await apiClient.triggerScreeningSupport(applicationId);
      setScreeningMessage(
        response.idempotent
          ? "Ön değerlendirme zaten devam ediyor. Birkaç saniye içinde sonuç hazır olacak."
          : "Ön değerlendirme başlatıldı. Birkaç saniye içinde sonuç hazır olacak."
      );
      await loadDetail();
    } catch (submitError) {
      setScreeningError(
        submitError instanceof Error ? submitError.message : "Screening support başlatılamadı."
      );
    } finally {
      setScreeningSubmitting(false);
    }
  }

  function buildModeContext() {
    if (!scheduleModeDetail.trim()) {
      return undefined;
    }

    if (scheduleMode === "PHONE") {
      return {
        phoneNumber: scheduleModeDetail.trim()
      };
    }

    if (scheduleMode === "ONSITE") {
      return {
        location: scheduleModeDetail.trim()
      };
    }

    return {
      note: scheduleModeDetail.trim()
    };
  }

  async function handleScheduleInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInterviewError("");
    setInterviewMessage("");

    if (!canScheduleInterview) {
      setInterviewError("Interview planlama yetkiniz yok.");
      return;
    }

    if (!scheduleAt) {
      setInterviewError("Interview tarihi zorunludur.");
      return;
    }

    setInterviewSubmittingAction("schedule");
    try {
      await apiClient.scheduleInterview({
        applicationId,
        templateId: scheduleTemplateId || undefined,
        mode: scheduleMode,
        scheduledAt: new Date(scheduleAt).toISOString(),
        interviewerName: scheduleInterviewerName.trim() || undefined,
        interviewType: scheduleInterviewType.trim() || undefined,
        scheduleNote: scheduleNote.trim() || undefined,
        modeContext: buildModeContext(),
        preferredProvider: schedulePreferredProvider || undefined
      });
      setInterviewMessage("Interview session planlandı.");
      setRescheduleAt(scheduleAt);
      await loadDetail();
    } catch (submitError) {
      setInterviewError(
        submitError instanceof Error ? submitError.message : "Interview planlama başarısız."
      );
    } finally {
      setInterviewSubmittingAction(null);
    }
  }

  async function handleRescheduleInterview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInterviewError("");
    setInterviewMessage("");

    if (!canScheduleInterview) {
      setInterviewError("Interview yeniden planlama yetkiniz yok.");
      return;
    }

    if (!rescheduleSessionId) {
      setInterviewError("Yeniden planlama için session seçiniz.");
      return;
    }

    if (!rescheduleAt) {
      setInterviewError("Yeni tarih/saat zorunludur.");
      return;
    }

    setInterviewSubmittingAction("reschedule");
    try {
      await apiClient.rescheduleInterview(rescheduleSessionId, {
        scheduledAt: new Date(rescheduleAt).toISOString(),
        reasonCode: rescheduleReasonCode.trim() || undefined
      });
      setInterviewMessage("Session yeniden planlandı.");
      await loadDetail();
    } catch (submitError) {
      setInterviewError(
        submitError instanceof Error ? submitError.message : "Interview yeniden planlama başarısız."
      );
    } finally {
      setInterviewSubmittingAction(null);
    }
  }

  async function handleSessionStatusAction(
    sessionId: string,
    action: "start" | "complete" | "cancel" | "review_pack"
  ) {
    setInterviewError("");
    setInterviewMessage("");
    setInterviewSubmittingAction(`${action}:${sessionId}`);

    if (!canManageInterviewSession) {
      setInterviewError("Session yönetim yetkiniz yok.");
      setInterviewSubmittingAction(null);
      return;
    }

    try {
      if (action === "start") {
        await apiClient.startInterviewSession(sessionId);
      } else if (action === "complete") {
        await apiClient.completeInterviewSession(sessionId, {
          triggerAiReviewPack: false
        });
      } else if (action === "cancel") {
        await apiClient.cancelInterviewSession(sessionId, {
          reasonCode: "manual_cancel"
        });
      } else {
        await apiClient.requestInterviewReviewPack(sessionId);
      }

      const messages: Record<typeof action, string> = {
        start: "Session başlatıldı.",
        complete: "Session tamamlandı.",
        cancel: "Session iptal edildi.",
        review_pack: "Interview tabanlı rapor/öneri görevleri kuyruğa alındı."
      };
      setInterviewMessage(messages[action]);
      await loadDetail();
    } catch (submitError) {
      setInterviewError(submitError instanceof Error ? submitError.message : "Session aksiyonu başarısız.");
    } finally {
      setInterviewSubmittingAction(null);
    }
  }

  async function handleTranscriptImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInterviewError("");
    setInterviewMessage("");

    if (!canManageInterviewSession) {
      setInterviewError("Transcript yönetim yetkiniz yok.");
      return;
    }

    if (!transcriptSessionId) {
      setInterviewError("Transcript için session seçiniz.");
      return;
    }

    if (!transcriptText.trim()) {
      setInterviewError("Transcript metni boş olamaz.");
      return;
    }

    setInterviewSubmittingAction("transcript_import");
    try {
      await apiClient.importInterviewTranscript(transcriptSessionId, {
        transcriptText,
        defaultSpeaker: "CANDIDATE",
        language: locale,
        sttModel: "manual_text_upload",
        replaceExisting: transcriptReplaceExisting
      });
      setInterviewMessage("Transcript sessiona bağlandı.");
      await loadDetail();
    } catch (submitError) {
      setInterviewError(
        submitError instanceof Error ? submitError.message : "Transcript yükleme başarısız."
      );
    } finally {
      setInterviewSubmittingAction(null);
    }
  }

  async function handleTranscriptQualityReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInterviewError("");
    setInterviewMessage("");

    if (!canManageInterviewSession) {
      setInterviewError("Transcript kalite inceleme yetkiniz yok.");
      return;
    }

    if (!qualitySessionId) {
      setInterviewError("Kalite incelemesi için session seçiniz.");
      return;
    }

    const parsedScore = Number(qualityScore);
    if (!Number.isFinite(parsedScore)) {
      setInterviewError("Kalite skoru sayısal olmalıdır.");
      return;
    }

    setInterviewSubmittingAction("transcript_quality");
    try {
      await apiClient.reviewInterviewTranscript(qualitySessionId, {
        qualityStatus,
        qualityScore: parsedScore,
        reviewNotes: qualityNotes.trim() || undefined
      });
      setInterviewMessage("Transcript kalite durumu güncellendi.");
      await loadDetail();
    } catch (submitError) {
      setInterviewError(
        submitError instanceof Error ? submitError.message : "Transcript kalite incelemesi başarısız."
      );
    } finally {
      setInterviewSubmittingAction(null);
    }
  }

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2 style={{ marginBottom: 4 }}>Başvuru Karar Merkezi</h2>
          <p className="small" style={{ marginTop: 0 }}>
            Bu ekran aday profili değil, bu ilana ait başvurunun karar ve takip ekranıdır.
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadDetail()}>
            Yenile
          </button>
          <Link href="/applications" className="ghost-button">
            Başvuru listesi
          </Link>
        </div>
      </div>

      {loading ? <LoadingState message="Başvuru detayı yükleniyor..." /> : null}
      {!loading && error ? (
        <ErrorState
          error={error}
          actions={
            <button type="button" className="ghost-button" onClick={() => void loadDetail()}>
              Tekrar dene
            </button>
          }
        />
      ) : null}

      {!loading && !error && application ? (
        <>
          <section style={{ marginBottom: 8 }}>
            <div style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 20 }}>
                <Link href={`/candidates/${application.candidate.id}`}>
                  {application.candidate.fullName}
                </Link>
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: 15 }}>
                {application.job.title}
              </p>
            </div>
            <div className="details-grid">
              <div>
                <p className="small">Mevcut Aşama</p>
                <StageChip stage={application.summary.stage} />
              </div>
              <div>
                <p className="small">CV</p>
                <strong>{application.candidate.cvFiles?.[0] ? "CV mevcut" : "CV kaydı yok"}</strong>
              </div>
              <div>
                <p className="small">AI Durumu</p>
                <strong>
                  {latestTaskRun
                    ? (latestTaskRun.status === "SUCCEEDED" ? "Değerlendirme tamamlandı"
                      : latestTaskRun.status === "RUNNING" || latestTaskRun.status === "QUEUED" || latestTaskRun.status === "PENDING" ? "Değerlendirme devam ediyor..."
                      : "Değerlendirme yapılmadı")
                    : "Değerlendirme yapılmadı"}
                </strong>
              </div>
            </div>
          </section>

          <section className="panel nested-panel action-toolbar" style={{ marginTop: 16 }}>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <div>
                <h3 style={{ margin: 0 }}>Karar Merkezi</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  Hızlı recruiter aksiyonları burada. Gelişmiş formlar aşağıda kalır.
                </p>
              </div>
            </div>

            <div className="action-toolbar-actions">
              <button
                type="button"
                className="action-toolbar-link primary"
                disabled={decisionSubmitting || !canMoveStage}
                onClick={() => void submitDecisionAction("advance", "manual_recruiter_advance")}
              >
                {decisionSubmitting && decision === "advance" ? "Gönderiliyor..." : "İlerlet"}
              </button>
              <button
                type="button"
                className="action-toolbar-link"
                disabled={decisionSubmitting || !canMoveStage}
                onClick={() => void submitDecisionAction("hold", "manual_recruiter_hold")}
              >
                {decisionSubmitting && decision === "hold" ? "Gönderiliyor..." : "Beklet"}
              </button>
              <button
                type="button"
                className="action-toolbar-link danger"
                disabled={decisionSubmitting || !canMoveStage}
                onClick={() => void submitDecisionAction("reject", "manual_recruiter_reject")}
              >
                {decisionSubmitting && decision === "reject" ? "Gönderiliyor..." : "Reddet"}
              </button>
              <button
                type="button"
                className="action-toolbar-link success"
                disabled={inviteSubmitting || !canScheduleInterview}
                onClick={() => void handleInviteInterview()}
              >
                {inviteSubmitting ? "Davet gönderiliyor..." : "Mülakata Davet Et"}
              </button>
              <button type="button" className="action-toolbar-link" onClick={handleFocusNotes}>
                Not Ekle
              </button>
            </div>

            {decisionError ? (
              <p className="small" style={{ margin: "10px 0 0", color: "var(--risk-text, #991b1b)" }}>
                {decisionError}
              </p>
            ) : null}
            {inviteError ? (
              <p className="small" style={{ margin: "10px 0 0", color: "var(--risk-text, #991b1b)" }}>
                {inviteError}
              </p>
            ) : null}
            {inviteMessage ? (
              <p
                className="small"
                style={{ margin: "10px 0 0", color: "var(--success-text, #065f46)" }}
              >
                {inviteMessage}
              </p>
            ) : null}
            {!canMoveStage ? (
              <p className="small" style={{ margin: "10px 0 0" }}>
                Karar aksiyonları için `candidate.move_stage` yetkisi gerekiyor.
              </p>
            ) : null}
          </section>

          <section className="mini-grid" style={{ marginTop: 16 }}>
            <article className="panel nested-panel">
              <div className="section-head" style={{ marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Başvuru Özeti</h3>
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    Bu başvurunun kişi ve ilan bağlamı.
                  </p>
                </div>
              </div>
              <div className="details-grid">
                <div>
                  <p className="small">Aday</p>
                  <strong>{application.candidate.fullName}</strong>
                </div>
                <div>
                  <p className="small">E-posta</p>
                  <strong>{application.candidate.email ?? "Belirtilmedi"}</strong>
                </div>
                <div>
                  <p className="small">Telefon</p>
                  <strong>{application.candidate.phone ?? "Belirtilmedi"}</strong>
                </div>
                <div>
                  <p className="small">Kaynak</p>
                  <strong>{application.candidate.source ?? "Belirtilmedi"}</strong>
                </div>
                <div>
                  <p className="small">İlan</p>
                  <strong>{application.job.title}</strong>
                </div>
                <div>
                  <p className="small">Departman</p>
                  <strong>{formatDepartment(application.job.roleFamily)}</strong>
                </div>
                <div>
                  <p className="small">Oluşturuldu</p>
                  <strong>{formatDate(application.summary.createdAt)}</strong>
                </div>
                <div>
                  <p className="small">Son Aşama Güncellemesi</p>
                  <strong>{formatDate(application.summary.stageUpdatedAt)}</strong>
                </div>
              </div>
            </article>

            <article ref={notesSectionRef} className="panel nested-panel">
              <p className="small section-label">Ekip Notları</p>
              {notesError ? <ErrorState title="Not hatası" error={notesError} /> : null}
              <RecruiterNotesPanel
                notes={notes}
                loading={notesLoading}
                onAdd={handleAddNote}
                canAdd={canAddNote}
                placeholder="Bu başvuru için kısa karar notu bırakın..."
              />
            </article>
          </section>

          {/* AI Karar Özeti */}
          {(reportInsight || recommendationInsight || screeningSupportView) ? (
            <section className="panel nested-panel" style={{ marginTop: 16, borderLeft: "3px solid var(--primary, #5046e5)" }}>
              <div className="section-head" style={{ marginBottom: 8 }}>
                <div>
                  <h3 style={{ margin: 0 }}>AI Karar Özeti</h3>
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    AI değerlendirmesi — nihai kararı her zaman insan verir.
                  </p>
                </div>
                <span className="badge warn">Sadece öneridir</span>
              </div>

              {latestRecommendation ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "8px 12px", background: "var(--surface-subtle, #f8fafc)", borderRadius: 6 }}>
                  <span style={{ fontSize: 24 }}>
                    {latestRecommendation.recommendation === "ADVANCE" ? "✅" : latestRecommendation.recommendation === "HOLD" ? "⏸️" : "🔍"}
                  </span>
                  <div>
                    <strong style={{ fontSize: 16 }}>
                      {latestRecommendation.recommendation === "ADVANCE" ? "İlerlet" : latestRecommendation.recommendation === "HOLD" ? "Beklet" : "İncele"}
                    </strong>
                    {recommendationInsight && (
                      <p className="small" style={{ margin: "4px 0 0" }}>{recommendationInsight.summary}</p>
                    )}
                  </div>
                </div>
              ) : screeningSupportView ? (
                <div style={{ padding: "8px 12px", marginBottom: 12, background: "var(--surface-subtle, #f8fafc)", borderRadius: 6 }}>
                  <p style={{ margin: 0, fontSize: 14 }}>{screeningSupportView.shortSummary}</p>
                </div>
              ) : null}

              {(() => {
                const strengths = reportInsight?.strengths.length
                  ? reportInsight.strengths
                  : screeningSupportView
                    ? mergeUnique(screeningSupportView.strengths, screeningSupportView.likelyFitObservations)
                    : [];
                const risks = reportInsight?.risks.length
                  ? reportInsight.risks
                  : screeningSupportView
                    ? mergeUnique(screeningSupportView.risks, screeningSupportView.uncertaintyReasons)
                    : [];
                return (strengths.length > 0 || risks.length > 0) ? (
                  <div className="mini-grid" style={{ marginBottom: 12 }}>
                    <div>
                      <p className="small section-label">Güçlü Yönler</p>
                      {strengths.length === 0 ? <p className="small">Belirtilmedi.</p> : (
                        <ul className="plain-list">
                          {strengths.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      )}
                    </div>
                    <div>
                      <p className="small section-label">Riskler</p>
                      {risks.length === 0 ? <p className="small">Risk yok.</p> : (
                        <ul className="plain-list">
                          {risks.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Önerilen Aksiyon */}
              {(reportInsight?.nextStep || recommendationInsight?.nextStep) && (
                <div style={{ padding: "8px 12px", background: "var(--surface-subtle, #f0fdf4)", borderRadius: 6, marginBottom: 12, borderLeft: "3px solid #22c55e" }}>
                  <p className="small section-label" style={{ margin: "0 0 4px" }}>Önerilen Aksiyon</p>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {recommendationInsight?.nextStep || reportInsight?.nextStep}
                  </p>
                </div>
              )}

              {/* Görüşmeye Davet Et butonu — ADVANCE önerisi varsa */}
              {latestRecommendation?.recommendation === "ADVANCE" && application.summary.stage !== "INTERVIEW_SCHEDULED" && application.summary.stage !== "INTERVIEW_COMPLETED" && (
                <div style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="button-link"
                    disabled={inviteSubmitting}
                    onClick={() => void handleInviteInterview()}
                    style={{ fontSize: 15 }}
                  >
                    {inviteSubmitting ? "Davet gönderiliyor..." : "📅 Görüşmeye Davet Et"}
                  </button>
                  <p className="small" style={{ margin: "6px 0 0", color: "var(--text-muted)" }}>
                    Aday e-posta ile direkt AI görüşme linki alır. İster hemen katılır, ister aynı e-postadaki planlama linkiyle daha sonraki bir zamanı seçer.
                  </p>
                </div>
              )}
            </section>
          ) : (
            <section className="panel nested-panel" style={{ marginTop: 16, borderLeft: "3px solid var(--text-muted, #94a3b8)" }}>
              <h3 style={{ margin: "0 0 8px" }}>AI Karar Özeti</h3>
              <p className="small" style={{ margin: 0 }}>
                Henüz AI değerlendirmesi yapılmadı. Aşağıdaki <strong>Ön Değerlendirme</strong> veya <strong>Uyum Skoru</strong> bölümlerinden bir değerlendirme başlatabilirsiniz.
              </p>
            </section>
          )}

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>Görüşme Planlama</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  Görüşme daveti gönderildiğinde aday önce direkt AI görüşme linki alır. Uygun değilse aynı e-postadaki planlama linkiyle daha sonraki bir zamanı seçebilir.
                </p>
              </div>
            </div>

            {interviewError ? <ErrorState title="Görüşme hatası" error={interviewError} /> : null}
            {interviewMessage ? <p className="small">{interviewMessage}</p> : null}

            {/* Tek tuş akışı */}
            {!latestInterviewSession && application.summary.stage !== "INTERVIEW_SCHEDULED" && application.summary.stage !== "INTERVIEW_COMPLETED" ? (
              <div style={{ padding: "12px 16px", background: "var(--surface-subtle, #f8fafc)", borderRadius: 6, marginBottom: 12 }}>
                <button
                  type="button"
                  className="button-link"
                  disabled={inviteSubmitting || !canScheduleInterview}
                  onClick={() => void handleInviteInterview()}
                >
                  {inviteSubmitting ? "Davet gönderiliyor..." : "📅 Görüşmeye Davet Et"}
                </button>
                {!canScheduleInterview && <p className="small" style={{ marginTop: 6 }}>Görüşme planlama yetkisi gerekli.</p>}
              </div>
            ) : application.summary.stage === "INTERVIEW_SCHEDULED" && (!latestInterviewSession || latestInterviewSession.status === "SCHEDULED") ? (
              <div style={{ padding: "12px 16px", background: "var(--warn-light, #fef9c3)", borderRadius: 6, marginBottom: 12 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>📧 Görüşme daveti gönderildi</p>
                <p className="small" style={{ margin: "4px 0 0" }}>Aday isterse hemen başlayabilir, ister daha sonra planlayabilir.</p>
                {latestInterviewSession?.candidateInterviewUrl && (
                  <p className="small" style={{ margin: "8px 0 0" }}>
                    <a href={latestInterviewSession.candidateInterviewUrl} target="_blank" rel="noreferrer">
                      Aday görüşme linki →
                    </a>
                  </p>
                )}
              </div>
            ) : latestInterviewSession?.status === "COMPLETED" ? (
              <div style={{ padding: "12px 16px", background: "var(--success-light, #dcfce7)", borderRadius: 6, marginBottom: 12 }}>
                <p style={{ margin: 0, fontWeight: 500 }}>✅ Görüşme tamamlandı</p>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  {formatDate(latestInterviewSession.endedAt ?? latestInterviewSession.scheduledAt ?? "")}
                </p>
              </div>
            ) : null}

            {/* Mevcut durum gridi — basitleştirilmiş */}
            {latestInterviewSession && (
              <div className="details-grid" style={{ marginBottom: 12 }}>
                <div>
                  <p className="small">Son Oturum</p>
                  <strong>
                    {INTERVIEW_STATUS_LABELS[latestInterviewSession.status]}
                  </strong>
                </div>
                <div>
                  <p className="small">Planlanan Tarih</p>
                  <strong>
                    {latestInterviewSession.scheduledAt
                      ? formatDate(latestInterviewSession.scheduledAt)
                      : "-"}
                  </strong>
                </div>
                <div>
                  <p className="small">Görüşme Formatı</p>
                  <strong>
                    {INTERVIEW_MODE_LABELS[latestInterviewSession.mode]}
                  </strong>
                </div>
                <div>
                  <p className="small">Transcript Durumu</p>
                  <strong>{latestInterviewSession.transcript?.qualityStatus ?? "Transcript yok"}</strong>
                </div>
              </div>
            )}

            {/* Manuel formlar — gelişmiş kullanıcılar için */}
            <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>Manuel Planlama (Gelişmiş)</summary>

            <div className="action-grid" style={{ marginTop: 10 }}>
              <form className="panel nested-panel" onSubmit={handleScheduleInterview}>
                <h4 style={{ marginTop: 0 }}>Interview Planla</h4>
                <label className="field">
                  <span className="field-label">Template</span>
                  <select
                    className="select"
                    value={scheduleTemplateId}
                    onChange={(event) => setScheduleTemplateId(event.target.value)}
                    required
                  >
                    <option value="">Template seçiniz</option>
                    {interviewTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} / {formatDepartment(template.roleFamily)} / v{template.version}
                        {template.metadata ? ` / ${template.metadata.blockCount} blok` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Tarih Saat</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(event) => setScheduleAt(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Mode</span>
                  <select
                    className="select"
                    value={scheduleMode}
                    onChange={(event) => setScheduleMode(event.target.value as InterviewMode)}
                  >
                    <option value="VOICE">Web Sesli</option>
                    <option value="MEETING_LINK">Meeting Link</option>
                    <option value="PHONE">Telefon</option>
                    <option value="ONSITE">Yerinde/Manuel</option>
                    <option value="VIDEO">Video</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Mode Detayı (link notu/telefon/lokasyon)</span>
                  <input
                    className="input"
                    value={scheduleModeDetail}
                    onChange={(event) => setScheduleModeDetail(event.target.value)}
                    placeholder="Örn. +90 5xx... veya Adres"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Interviewer</span>
                  <input
                    className="input"
                    value={scheduleInterviewerName}
                    onChange={(event) => setScheduleInterviewerName(event.target.value)}
                    placeholder="İK Uzmanı"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Interview Tipi</span>
                  <input
                    className="input"
                    value={scheduleInterviewType}
                    onChange={(event) => setScheduleInterviewType(event.target.value)}
                    placeholder="Yapılandırılmış"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Preferred Provider</span>
                  <select
                    className="select"
                    value={schedulePreferredProvider}
                    onChange={(event) =>
                      setSchedulePreferredProvider(event.target.value as MeetingProvider | "")
                    }
                  >
                    <option value="">Otomatik (aktif bağlantı/fallback)</option>
                    {schedulingProviders?.providers.map((providerItem) => (
                      <option key={providerItem.connectionId} value={providerItem.provider}>
                        {MEETING_PROVIDER_LABELS[providerItem.provider]} /{" "}
                        {providerItem.hasMeetingUrlTemplate
                          ? "template mevcut"
                          : "template eksik (degraded)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Planlama Notu</span>
                  <input
                    className="input"
                    value={scheduleNote}
                    onChange={(event) => setScheduleNote(event.target.value)}
                    placeholder="Aday vardiya çıkışı sonrası aranacak"
                  />
                </label>
                <button
                  type="submit"
                  className="button-link"
                  disabled={interviewSubmittingAction !== null || !canScheduleInterview}
                >
                  {interviewSubmittingAction === "schedule" ? "Planlanıyor..." : "Interview Planla"}
                </button>
              </form>

              <form className="panel nested-panel" onSubmit={handleRescheduleInterview}>
                <h4 style={{ marginTop: 0 }}>Session Yeniden Planla</h4>
                <label className="field">
                  <span className="field-label">Session</span>
                  <select
                    className="select"
                    value={rescheduleSessionId}
                    onChange={(event) => setRescheduleSessionId(event.target.value)}
                    required
                  >
                    <option value="">Session seçiniz</option>
                    {application.interview.sessions.map((sessionItem) => (
                      <option key={sessionItem.id} value={sessionItem.id}>
                        {sessionItem.id} / {INTERVIEW_STATUS_LABELS[sessionItem.status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Yeni Tarih Saat</span>
                  <input
                    className="input"
                    type="datetime-local"
                    value={rescheduleAt}
                    onChange={(event) => setRescheduleAt(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Neden Kodu</span>
                  <input
                    className="input"
                    value={rescheduleReasonCode}
                    onChange={(event) => setRescheduleReasonCode(event.target.value)}
                    required
                  />
                </label>
                <button
                  type="submit"
                  className="button-link"
                  disabled={interviewSubmittingAction !== null || !canScheduleInterview}
                >
                  {interviewSubmittingAction === "reschedule"
                    ? "Yeniden planlanıyor..."
                    : "Yeniden Planla"}
                </button>
              </form>
            </div>

            <div className="action-grid" style={{ marginTop: 10 }}>
              <form className="panel nested-panel" onSubmit={handleTranscriptImport}>
                <h4 style={{ marginTop: 0 }}>Transcript Ekle / Güncelle</h4>
                <label className="field">
                  <span className="field-label">Session</span>
                  <select
                    className="select"
                    value={transcriptSessionId}
                    onChange={(event) => setTranscriptSessionId(event.target.value)}
                    required
                  >
                    <option value="">Session seçiniz</option>
                    {application.interview.sessions.map((sessionItem) => (
                      <option key={sessionItem.id} value={sessionItem.id}>
                        {sessionItem.id} / {INTERVIEW_STATUS_LABELS[sessionItem.status]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Transcript Metni</span>
                  <textarea
                    className="input"
                    rows={7}
                    value={transcriptText}
                    onChange={(event) => setTranscriptText(event.target.value)}
                    placeholder="ADAY: Son iş yerimde depoda ürün toplama yaptım..."
                    required
                  />
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={transcriptReplaceExisting}
                    onChange={(event) => setTranscriptReplaceExisting(event.target.checked)}
                  />
                  Eski transcript segmentlerini temizle
                </label>
                <button
                  type="submit"
                  className="button-link"
                  disabled={interviewSubmittingAction !== null || !canManageInterviewSession}
                >
                  {interviewSubmittingAction === "transcript_import"
                    ? "Transcript kaydediliyor..."
                    : "Transcripti Sessiona Bağla"}
                </button>
              </form>

              <form className="panel nested-panel" onSubmit={handleTranscriptQualityReview}>
                <h4 style={{ marginTop: 0 }}>Transcript Kalite İncelemesi</h4>
                <label className="field">
                  <span className="field-label">Session</span>
                  <select
                    className="select"
                    value={qualitySessionId}
                    onChange={(event) => setQualitySessionId(event.target.value)}
                    required
                  >
                    <option value="">Session seçiniz</option>
                    {application.interview.sessions
                      .filter((sessionItem) => Boolean(sessionItem.transcript))
                      .map((sessionItem) => (
                        <option key={sessionItem.id} value={sessionItem.id}>
                          {sessionItem.id} / {sessionItem.transcript?.qualityStatus}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Kalite Durumu</span>
                  <select
                    className="select"
                    value={qualityStatus}
                    onChange={(event) =>
                      setQualityStatus(event.target.value as "REVIEW_REQUIRED" | "VERIFIED")
                    }
                  >
                    <option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option>
                    <option value="VERIFIED">VERIFIED</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Kalite Skoru</span>
                  <input
                    className="input"
                    value={qualityScore}
                    onChange={(event) => setQualityScore(event.target.value)}
                    placeholder="0.80"
                  />
                </label>
                <label className="field">
                  <span className="field-label">Review Notu</span>
                  <input
                    className="input"
                    value={qualityNotes}
                    onChange={(event) => setQualityNotes(event.target.value)}
                    placeholder="Metin tutarlılığı kontrol edildi"
                  />
                </label>
                <button
                  type="submit"
                  className="button-link"
                  disabled={interviewSubmittingAction !== null || !canManageInterviewSession}
                >
                  {interviewSubmittingAction === "transcript_quality"
                    ? "İnceleme kaydediliyor..."
                    : "Kalite Durumunu Kaydet"}
                </button>
              </form>
            </div>
          </details>
          </section>

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>Aday Uyum Skoru</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  Adayın pozisyona uyumunu gösteren değerlendirme.
                </p>
              </div>
              <span className="badge warn">Sadece öneridir</span>
            </div>

            {fitScoreError ? <ErrorState title="Uyum skoru hatası" error={fitScoreError} /> : null}
            {fitScoreMessage ? <p className="small">{fitScoreMessage}</p> : null}

            <div className="row-actions" style={{ marginBottom: 10, gap: 8 }}>
              <button
                type="button"
                className="ghost-button"
                disabled={fitScoreTriggering || !canRequestAiTask}
                onClick={() => void handleFitScoreTrigger()}
              >
                {fitScoreTriggering ? "Hesaplanıyor..." : "Uyum Skorunu Hesapla"}
              </button>
              <button
                type="button"
                className="ghost-button"
                disabled={fitScoreLoading}
                onClick={() => void loadFitScore()}
              >
                {fitScoreLoading ? "Yükleniyor..." : "Skoru Yenile"}
              </button>
            </div>

            {fitScoreLoading ? (
              <p className="small">Uyum skoru yükleniyor...</p>
            ) : !fitScore ? (
              <p className="small">Bu başvuru için uyum skoru henüz hesaplanmadı.</p>
            ) : (
              <div style={{ marginTop: 8 }}>
                <div className="details-grid" style={{ marginBottom: 12 }}>
                  <div>
                    <p className="small">Genel Skor</p>
                    <FitScoreBar score={fitScore.overallScore} confidence={fitScore.confidence} />
                  </div>
                  <div>
                    <p className="small">Güven</p>
                    <strong>{Math.round(fitScore.confidence * 100)}%</strong>
                  </div>
                  <div>
                    <p className="small">Oluşturulma</p>
                    <strong>{formatDate(fitScore.createdAt)}</strong>
                  </div>
                </div>
                <FitScoreBreakdown fitScore={fitScore} />
              </div>
            )}
          </section>

          <div className="alert-box" style={{ marginTop: 16 }}>
            <strong>V1 Güvenlik Kuralı:</strong> AI çıktısı otomatik karar uygulamaz. Stage etkileyen
            tüm kararlar recruiter/hiring manager onayı ve audit izi ile tamamlanır.
          </div>

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <div className="section-head" style={{ marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0 }}>Ön Değerlendirme</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  Adayın başvuruya uygunluğu hakkında AI tavsiyesi.
                </p>
              </div>
              <span className="badge warn">İnsan kararı zorunlu</span>
            </div>

            {screeningError ? <ErrorState title="Screening hatası" error={screeningError} /> : null}
            {screeningMessage ? <p className="small">{screeningMessage}</p> : null}

            <div className="row-actions" style={{ marginBottom: 10 }}>
              <button
                type="button"
                className="ghost-button"
                disabled={screeningSubmitting || !canRunScreeningSupport}
                onClick={() => void handleScreeningTrigger()}
              >
                {screeningSubmitting ? "Hazırlanıyor..." : "Ön Değerlendirme Oluştur"}
              </button>
            </div>
            {!canRunScreeningSupport ? (
              <p className="small">Ön değerlendirme yetkisi gerekli.</p>
            ) : null}

            {!latestScreeningRun ? (
              <p className="small">Bu başvuru için henüz ön değerlendirme yapılmadı.</p>
            ) : (
              <>
                <p className="small" style={{ margin: "4px 0" }}>Oluşturulma: {formatDate(latestScreeningRun.createdAt)}</p>
                <details className="history-item">
                  <summary className="small">Teknik Detay</summary>
                  <div className="details-grid" style={{ marginTop: 8 }}>
                    <div>
                      <p className="small">Görev ID</p>
                      <code>{latestScreeningRun.id}</code>
                    </div>
                    <div>
                      <p className="small">Durum</p>
                      <strong>{latestScreeningRun.status}</strong>
                    </div>
                    <div>
                      <p className="small">Sağlayıcı</p>
                      <strong>{latestScreeningRun.providerKey ?? "-"}</strong>
                    </div>
                    <div>
                      <p className="small">Model</p>
                      <strong>{latestScreeningRun.modelKey ?? "-"}</strong>
                    </div>
                  </div>
                </details>

                {screeningSupportView ? (
                  <article className="artifact-card" style={{ marginTop: 10 }}>
                    <p style={{ marginTop: 0 }}>{screeningSupportView.shortSummary}</p>

                    {/* 3-soru formatı */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
                      <div>
                        <p className="small section-label" style={{ fontWeight: 600 }}>✅ Neden Uygun?</p>
                        {(() => {
                          const items = mergeUnique(screeningSupportView.strengths, screeningSupportView.likelyFitObservations);
                          return items.length === 0 ? <p className="small">Belirtilmedi.</p> : (
                            <ul className="plain-list">
                              {items.map((item, i) => <li key={`fit-${i}`}>{item}</li>)}
                            </ul>
                          );
                        })()}
                      </div>
                      <div>
                        <p className="small section-label" style={{ fontWeight: 600 }}>⚠ Ne Risk Var?</p>
                        {(() => {
                          const items = mergeUnique(screeningSupportView.risks, screeningSupportView.uncertaintyReasons);
                          return items.length === 0 ? <p className="small">Belirgin risk yok.</p> : (
                            <ul className="plain-list">
                              {items.map((item, i) => <li key={`risk-${i}`}>{item}</li>)}
                            </ul>
                          );
                        })()}
                      </div>
                      <div>
                        <p className="small section-label" style={{ fontWeight: 600 }}>💬 Görüşmede Ne Sorulmalı?</p>
                        {screeningSupportView.followUpTopics.length === 0 ? (
                          <p className="small">Belirtilmedi.</p>
                        ) : (
                          <ul className="plain-list">
                            {screeningSupportView.followUpTopics.map((item, i) => (
                              <li key={`topic-${i}`}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {/* Kanıt kaynakları — 3-soru formatında olmayan ek bilgi */}
                    {screeningSupportView.evidenceLinks.length > 0 && (
                      <details className="history-item" style={{ marginTop: 8 }}>
                        <summary className="small">Kanıt Kaynakları</summary>
                        <ul className="plain-list">
                          {screeningSupportView.evidenceLinks.slice(0, 6).map((item, index) => (
                            <li key={`ev-${index}`}><strong>{item.sourceType}</strong> / {item.sourceRef}: {item.claim}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </article>
                ) : null}
              </>
            )}
          </section>

          <details style={{ marginTop: 24 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 15, padding: "10px 0", borderTop: "1px solid var(--border, #e2e8f0)" }}>
              Yönetim ve Teknik Detaylar
            </summary>

          <details className="panel nested-panel" style={{ marginTop: 16 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, padding: "8px 0" }}>Karar ve Aşama Yönetimi</summary>

          {canMoveStage ? (
            <div className="action-grid">
              <form className="panel nested-panel" onSubmit={handleStageTransition}>
                <h3 style={{ marginTop: 0 }}>Stage Geçişi</h3>
                {stageError ? <ErrorState title="Stage hatası" error={stageError} /> : null}
                <label className="field">
                  <span className="field-label">Yeni stage</span>
                  <select
                    className="select"
                    value={stage}
                    onChange={(event) => setStage(event.target.value as ApplicationStage)}
                    required
                  >
                    <option value={application.summary.stage}>
                      {STAGE_LABELS[application.summary.stage]}
                    </option>
                    {availableStages.map((stageOption) => (
                      <option key={stageOption} value={stageOption}>
                        {STAGE_LABELS[stageOption]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Neden kodu</span>
                  <input
                    className="input"
                    value={stageReason}
                    onChange={(event) => setStageReason(event.target.value)}
                    placeholder="manual_stage_transition"
                    required
                  />
                </label>
                <button type="submit" className="button-link" disabled={stageSubmitting}>
                  {stageSubmitting ? "Güncelleniyor..." : "Stage'i Güncelle"}
                </button>
              </form>

              <form className="panel nested-panel" onSubmit={handleDecision}>
                <h3 style={{ marginTop: 0 }}>İnsan Onaylı Karar</h3>
                {decisionError ? <ErrorState title="Karar hatası" error={decisionError} /> : null}
                <label className="field">
                  <span className="field-label">Karar tipi</span>
                  <select
                    className="select"
                    value={decision}
                    onChange={(event) =>
                      setDecision(event.target.value as "advance" | "hold" | "reject")
                    }
                  >
                    <option value="advance">{DECISION_LABELS.advance}</option>
                    <option value="hold">{DECISION_LABELS.hold}</option>
                    <option value="reject">{DECISION_LABELS.reject}</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Neden kodu</span>
                  <input
                    className="input"
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">Referans rapor</span>
                  <input
                    className="input"
                    value={aiReportId}
                    onChange={(event) => setAiReportId(event.target.value)}
                    required
                  />
                </label>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={humanApprovalChecked}
                    onChange={(event) => setHumanApprovalChecked(event.target.checked)}
                  />
                  Bu kararı {currentUserId} kullanıcısı olarak onaylıyorum.
                </label>
                <button
                  type="submit"
                  className="button-link"
                  disabled={decisionSubmitting || !humanApprovalChecked}
                >
                  {decisionSubmitting ? "Gönderiliyor..." : "Kararı Kaydet"}
                </button>
              </form>
            </div>
          ) : (
            <section className="panel nested-panel" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Stage ve Karar İşlemleri</h3>
              <p className="small">Bu aksiyonlar için `candidate.move_stage` yetkisi gereklidir.</p>
            </section>
          )}

          <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>AI Görev Tetikleme (Gelişmiş)</summary>
          <section className="panel nested-panel" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>AI Görev Tetikleme</h3>
            {!canRequestAiTask ? <p className="small">AI görev yetkisi gerekli.</p> : null}
            {taskError ? <ErrorState title="AI görev hatası" error={taskError} /> : null}
            {taskMessage ? <p className="small">{taskMessage}</p> : null}
            <div className="row-actions" style={{ gap: 8, flexWrap: "wrap" }}>
              {(["CV_PARSING", "REPORT_GENERATION", "RECOMMENDATION_GENERATION", "APPLICANT_FIT_SCORING"] as const).map(
                (taskType) => (
                  <button
                    key={taskType}
                    type="button"
                    className="ghost-button"
                    disabled={taskSubmittingType !== null || !canRequestAiTask}
                    onClick={() => void handleTaskTrigger(taskType)}
                  >
                    {taskSubmittingType === taskType
                      ? "Hazırlanıyor..."
                      : AI_TASK_TYPE_LABELS[taskType]}
                  </button>
                )
              )}
            </div>
          </section>
          </details>
          </details>

          <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>AI Rapor ve Öneri Detayı</summary>
          <section className="artifact-grid" style={{ marginTop: 8 }}>
            <div className="panel nested-panel">
              <h3 style={{ marginTop: 0 }}>Son AI Raporu</h3>
              {!latestReport ? (
                <p className="small">Bu başvuru için AI raporu bulunmuyor.</p>
              ) : (
                <>
                  <div className="details-grid">
                    <div>
                      <p className="small">Öneri</p>
                      <strong>{latestReport.recommendation}</strong>
                    </div>
                    <div>
                      <p className="small">Güven</p>
                      <strong>{formatPercent(latestReport.confidence, 0)}</strong>
                    </div>
                    <div>
                      <p className="small">Oluşturulma</p>
                      <strong>{formatDate(latestReport.createdAt)}</strong>
                    </div>
                    <div>
                      <p className="small">Kaynak</p>
                      <strong>{reportSourceContext}</strong>
                    </div>
                  </div>
                  {reportInsight ? (
                    <ArtifactCard
                      title="Rapor İçgörüsü"
                      subtitle="Kanıt bağlı recruiter raporu"
                      insight={reportInsight}
                    />
                  ) : null}
                </>
              )}
            </div>

            <div className="panel nested-panel">
              <h3 style={{ marginTop: 0 }}>Son AI Önerisi</h3>
              {!latestRecommendation ? (
                <p className="small">Bu başvuru için AI önerisi bulunmuyor.</p>
              ) : (
                <>
                  <div className="details-grid">
                    <div>
                      <p className="small">Öneri ID</p>
                      <code>{latestRecommendation.id}</code>
                    </div>
                    <div>
                      <p className="small">Sonuç</p>
                      <strong>{latestRecommendation.recommendation}</strong>
                    </div>
                    <div>
                      <p className="small">Güven</p>
                      <strong>{formatPercent(latestRecommendation.confidence, 0)}</strong>
                    </div>
                    <div>
                      <p className="small">İnsan onayı</p>
                      <strong>{latestRecommendation.requiresHumanApproval ? "Zorunlu" : "Opsiyonel"}</strong>
                    </div>
                    <div>
                      <p className="small">Kanıt sayısı</p>
                      <strong>{latestRecommendation.evidenceCount}</strong>
                    </div>
                    <div>
                      <p className="small">Oluşturulma</p>
                      <strong>{formatDate(latestRecommendation.createdAt)}</strong>
                    </div>
                    <div>
                      <p className="small">Kaynak Bağlam</p>
                      <strong>{recommendationSourceContext}</strong>
                    </div>
                  </div>
                  {recommendationInsight ? (
                    <ArtifactCard
                      title="Öneri İçgörüsü"
                      subtitle="AI sadece tavsiye verir, nihai karar insanındır"
                      insight={recommendationInsight}
                    />
                  ) : null}
                </>
              )}
            </div>
          </section>
          </details>

          <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Görüşme Oturumları Detayı</summary>
          <section className="panel nested-panel" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Görüşme Oturumları</h3>
            {application.interview.sessions.length === 0 ? (
              <p className="small">Bu başvuruya bağlı görüşme kaydı bulunmuyor.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Oturum</th>
                    <th>Durum</th>
                    <th>Plan</th>
                    <th>Transcript</th>
                    <th>Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {application.interview.sessions.map((sessionRow) => (
                    <tr key={sessionRow.id}>
                      <td>
                        <div>{formatDate(sessionRow.scheduledAt ?? sessionRow.createdAt)}</div>
                        <div className="small">{sessionRow.template.name}</div>
                      </td>
                      <td>{INTERVIEW_STATUS_LABELS[sessionRow.status]}</td>
                      <td>
                        <div>{sessionRow.scheduledAt ? formatDate(sessionRow.scheduledAt) : "-"}</div>
                        <div className="small">{sessionRow.interviewerName ?? "-"}</div>
                        <div className="small">İlerleme: {sessionRow.progress.answeredBlocks}/{sessionRow.progress.totalBlocks}</div>
                      </td>
                      <td>
                        {sessionRow.transcript ? (
                          <span className="badge success">{sessionRow.transcript.qualityStatus}</span>
                        ) : (
                          <span className="badge">Transcript yok</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions" style={{ flexWrap: "wrap", gap: 6 }}>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={
                              interviewSubmittingAction !== null ||
                              !canManageInterviewSession ||
                              sessionRow.status !== "SCHEDULED"
                            }
                            onClick={() => void handleSessionStatusAction(sessionRow.id, "start")}
                          >
                            Başlat
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={
                              interviewSubmittingAction !== null ||
                              !canManageInterviewSession ||
                              (sessionRow.status !== "RUNNING" && sessionRow.status !== "SCHEDULED")
                            }
                            onClick={() => void handleSessionStatusAction(sessionRow.id, "complete")}
                          >
                            Tamamla
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={
                              interviewSubmittingAction !== null ||
                              !canManageInterviewSession ||
                              sessionRow.status === "COMPLETED" ||
                              sessionRow.status === "CANCELLED"
                            }
                            onClick={() => void handleSessionStatusAction(sessionRow.id, "cancel")}
                          >
                            İptal
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            disabled={
                              interviewSubmittingAction !== null ||
                              !canManageInterviewSession ||
                              sessionRow.status !== "COMPLETED"
                            }
                            onClick={() => void handleSessionStatusAction(sessionRow.id, "review_pack")}
                          >
                            Değerlendirme Paketi
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          </details>

          <section className="panel nested-panel" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Görüşme Detayı</h3>
            {!latestInterviewSession || latestInterviewSession.turns.length === 0 ? (
              <p className="small">Henüz görüşme kaydı bulunmuyor.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Kategori</th>
                    <th>Soru</th>
                    <th>Cevap</th>
                  </tr>
                </thead>
                <tbody>
                  {latestInterviewSession.turns.map((turn) => (
                    <tr key={turn.id}>
                      <td>{turn.sequenceNo}</td>
                      <td>
                        {turn.category}
                        {turn.kind !== "PRIMARY" ? (
                          <div className="small">{turn.kind}</div>
                        ) : null}
                      </td>
                      <td>{turn.promptText}</td>
                      <td>{turn.answerText ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>AI Görev Geçmişi (Teknik)</summary>
          <section className="panel nested-panel" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>AI Görev Geçmişi</h3>
            {application.artifacts.taskRuns.length === 0 ? (
              <p className="small">Bu başvuru için AI görev kaydı bulunmadı.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Oluşturma</th>
                    <th>Görev Tipi</th>
                    <th>Durum</th>
                    <th>Hata</th>
                  </tr>
                </thead>
                <tbody>
                  {application.artifacts.taskRuns.map((taskRun) => (
                    <tr key={taskRun.id}>
                      <td>{formatDate(taskRun.createdAt)}</td>
                      <td>{AI_TASK_TYPE_LABELS[taskRun.taskType]}</td>
                      <td>{taskRun.status}</td>
                      <td>{truncate(taskRun.errorMessage, 90) || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          </details>

          <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Teknik Zaman Çizelgesi (Audit)</summary>
          <section className="panel nested-panel" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Interview Timeline</h3>
            {application.interview.timeline.auditLogs.length === 0 &&
            application.interview.timeline.domainEvents.length === 0 ? (
              <p className="small">Interview timeline kaydı bulunamadı.</p>
            ) : (
              <div className="mini-grid">
                <div>
                  <p className="section-label">
                    Audit kayıtları ({application.interview.timeline.auditLogs.length})
                  </p>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Aksiyon</th>
                        <th>Entity</th>
                        <th>Detay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {application.interview.timeline.auditLogs.slice(0, 40).map((log) => (
                        <tr key={log.id}>
                          <td>{formatDate(log.createdAt)}</td>
                          <td>{log.action}</td>
                          <td>
                            {log.entityType}:{log.entityId}
                          </td>
                          <td>
                            <code className="small">{truncate(compactJson(log.metadata), 160) || "-"}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <p className="section-label">
                    Domain event ({application.interview.timeline.domainEvents.length})
                  </p>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Tarih</th>
                        <th>Event</th>
                        <th>Aggregate</th>
                        <th>Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {application.interview.timeline.domainEvents.slice(0, 40).map((event) => (
                        <tr key={event.id}>
                          <td>{formatDate(event.createdAt)}</td>
                          <td>{event.eventType}</td>
                          <td>
                            {event.aggregateType}:{event.aggregateId}
                          </td>
                          <td>
                            <code className="small">{truncate(compactJson(event.payload), 160) || "-"}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
          </details>

          <section className="mini-grid" style={{ marginTop: 16 }}>
            <article className="panel nested-panel">
              <h3 style={{ marginTop: 0 }}>Aşama Geçmişi</h3>
              {application.timeline.stageHistory.length === 0 ? (
                <p className="small">Aşama geçmişi yok.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Geçiş</th>
                      <th>Neden</th>
                      <th>Değiştiren</th>
                    </tr>
                  </thead>
                  <tbody>
                    {application.timeline.stageHistory.map((history) => (
                      <tr key={history.id}>
                        <td>{formatDate(history.changedAt)}</td>
                        <td>
                          {(history.fromStage ? STAGE_LABELS[history.fromStage] : "Başlangıç")}
                          {" -> "}
                          {STAGE_LABELS[history.toStage]}
                        </td>
                        <td>{history.reasonCode ?? "-"}</td>
                        <td>{history.changedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>

            <details>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Onay Kayıtları</summary>
            <article className="panel nested-panel" style={{ marginTop: 8 }}>
              <h3 style={{ marginTop: 0 }}>İnsan Onay Kayıtları</h3>
              {application.governance.humanApprovals.length === 0 ? (
                <p className="small">Bu başvuruya bağlı insan onayı kaydı bulunmuyor.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tarih</th>
                      <th>Aksiyon</th>
                      <th>Onaylayan</th>
                      <th>Neden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {application.governance.humanApprovals.map((approval) => (
                      <tr key={approval.id}>
                        <td>{formatDate(approval.approvedAt)}</td>
                        <td>{approval.actionType}</td>
                        <td>{approval.approvedBy}</td>
                        <td>{approval.reasonCode ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </article>
            </details>
          </section>

          <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>Rapor ve Öneri Arşivi (Teknik)</summary>
          <section className="panel nested-panel" style={{ marginTop: 8 }}>
            <h3 style={{ marginTop: 0 }}>Rapor/Öneri Geçmişi</h3>
            <div className="mini-grid">
              <div>
                <p className="section-label">Rapor geçmişi ({application.artifacts.reports.length})</p>
                {application.artifacts.reports.map((report: AiReport) => (
                  <details key={report.id} className="history-item">
                    <summary>
                      {formatDate(report.createdAt)} - {report.id} - {report.recommendation}
                    </summary>
                    <pre className="code-block">{prettyJson(report.reportJson)}</pre>
                  </details>
                ))}
              </div>
              <div>
                <p className="section-label">Öneri geçmişi ({application.artifacts.recommendations.length})</p>
                {application.artifacts.recommendations.map((item: ApplicationRecommendationArtifact) => (
                  <details key={item.id} className="history-item">
                    <summary>
                      {formatDate(item.createdAt)} - {item.id} - {item.recommendation}
                    </summary>
                    <pre className="code-block">{prettyJson(item.rationaleJson)}</pre>
                    <p className="small">Belirsizlik: {compactJson(item.uncertaintyJson)}</p>
                  </details>
                ))}
              </div>
            </div>
            <p className="section-label" style={{ marginTop: 16 }}>
              Entity bazlı audit kayıtları
            </p>
            {application.governance.auditLogs.length === 0 ? (
              <p className="small">Bu başvuru için audit kaydı bulunmadı.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Aksiyon</th>
                    <th>Actor</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {application.governance.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDate(log.createdAt)}</td>
                      <td>{log.action}</td>
                      <td>{log.actorUserId ?? "-"}</td>
                      <td>
                        <code className="small">{truncate(compactJson(log.metadata), 180) || "-"}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          </details>
          </details>
        </>
      ) : null}
    </section>
  );
}
