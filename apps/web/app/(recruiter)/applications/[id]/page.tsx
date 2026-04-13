"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RecruiterNotesPanel } from "../../../../components/recruiter-notes-panel";
import { InterviewInviteModal } from "../../../../components/interview-invite-modal";
import { MatchIndicator } from "../../../../components/match-indicator";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { useUiText } from "../../../../components/site-language-provider";
import { ErrorState, LoadingState } from "../../../../components/ui-states";
import { FitScoreBreakdown } from "../../../../components/fit-score-breakdown";
import { apiClient } from "../../../../lib/api-client";
import {
  getRecruiterStageMeta,
  getStageActions,
  SOURCE_LABELS,
  STAGE_LABELS
} from "../../../../lib/constants";
import { formatDate } from "../../../../lib/format";
import {
  formatInterviewDeadline,
  getInterviewInvitationMeta
} from "../../../../lib/interview-invitation";
import { decodeRouteEntityId, sourcingProjectDetailHref, withApiBaseOverride } from "../../../../lib/entity-routes";
import type {
  ApplicantFitScoreView,
  ApplicationDetailReadModel,
  ApplicationStage,
  JsonValue,
  QuickActionType,
  RecruiterNote
} from "../../../../lib/types";

/* -- helpers -- */

function aiRecommendationBanner(rec: string | null): { label: string; color: string } | null {
  if (!rec) return null;
  switch (rec) {
    case "ADVANCE":
      return { label: "Ilerlet", color: "var(--success, #22c55e)" };
    case "HOLD":
      return { label: "Beklet", color: "var(--warn, #f59e0b)" };
    case "REVIEW":
      return { label: "Incele", color: "var(--warn, #f59e0b)" };
    case "REJECT":
      return { label: "Reddet", color: "var(--danger, #ef4444)" };
    default:
      return null;
  }
}

function stageHistoryLabel(from: string | null, to: string): string {
  const fromLabel = from ? (STAGE_LABELS[from as ApplicationStage] ?? from) : null;
  const toLabel = STAGE_LABELS[to as ApplicationStage] ?? to;
  if (!fromLabel) return "Basvuru olusturuldu";
  return `${fromLabel} \u2192 ${toLabel}`;
}

function reasonLabel(code: string | null): string {
  if (!code) return "";
  const map: Record<string, string> = {
    application_created: "Sistem",
    shortlisted: "Ilerletildi",
    advanced_by_recruiter: "Recruiter tarafindan ilerletildi",
    rejected_by_recruiter: "Recruiter tarafindan reddedildi",
    held_by_recruiter: "Bekletildi",
    manual_stage_transition: "Manuel gecis",
    manual_recruiter_advance: "Manuel ilerletme",
    screening_triggered_by_recruiter: "On eleme baslatildi",
    interview_approved: "Gorusmeye onaylandi",
    interview_invitation_sent: "Gorusme daveti gonderildi",
    interview_session_completed: "Gorusme tamamlandi",
  };
  return map[code] ?? code.replace(/_/g, " ");
}

function asRecord(value: JsonValue | null | undefined): Record<string, JsonValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, JsonValue>;
}

function asStringArray(value: JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string");
}

function asString(value: JsonValue | null | undefined) {
  return typeof value === "string" ? value : "";
}

function normalizeFlags(value: JsonValue | null | undefined) {
  if (!Array.isArray(value)) return [] as Array<{ code: string; note: string; severity: string | null }>;
  return value
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, JsonValue> => Boolean(item))
    .map((item) => ({
      code: typeof item.code === "string" ? item.code : "FLAG",
      note: typeof item.note === "string" ? item.note : "Detay belirtilmedi.",
      severity: typeof item.severity === "string" ? item.severity : null
    }));
}

function formatConfidence(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return null;
  return `${Math.round(numeric * 100)}%`;
}

function formatDurationLabel(startedAt?: string | null, endedAt?: string | null) {
  if (!startedAt || !endedAt) {
    return null;
  }

  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  const totalMinutes = Math.max(1, Math.round((end - start) / 60000));

  if (totalMinutes < 60) {
    return `${totalMinutes} dk`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours} sa ${minutes} dk` : `${hours} sa`;
}

function flagLabel(code: string): string {
  return code
    .replace(/^MISSING_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function sourceLabel(source: string | null | undefined) {
  if (!source) {
    return "—";
  }

  return SOURCE_LABELS[source] ?? source;
}

function outreachOutcomeLabel(status: string | null | undefined) {
  switch (status) {
    case "REPLIED":
      return "Yanıt geldi";
    case "SENT":
      return "Yanıt bekleniyor";
    case "READY_TO_SEND":
      return "Gönderime hazır";
    case "DRAFT":
      return "Taslak oluştu";
    case "FAILED":
      return "Gönderim başarısız";
    case "CANCELLED":
      return "Gönderim iptal edildi";
    default:
      return "Outreach bilgisi yok";
  }
}

function buildInviteSuccessMessage(result: { interviewLink?: string; expiresAt?: string | null }) {
  if (result.expiresAt) {
    return `AI mülakat daveti gönderildi. Link ${formatInterviewDeadline(result.expiresAt)} tarihine kadar aktif.`;
  }

  return result.interviewLink
    ? "AI mülakat daveti gönderildi. Direkt görüşme linki hazır."
    : "AI mülakat daveti gönderildi.";
}

const INSIGHT_STOP_WORDS = new Set([
  "aday",
  "adayin",
  "adaya",
  "mülakat",
  "mulakat",
  "görüşme",
  "gorusme",
  "yanit",
  "yanıt",
  "cevap",
  "cevaplar",
  "olarak",
  "icin",
  "ve",
  "ile",
  "çok",
  "cok",
  "daha",
  "gibi",
  "olan",
  "göre",
  "gore",
  "tek",
  "basina",
  "başına"
]);

const INTERVIEW_GROUNDED_KEYWORDS = [
  "yanıt",
  "yanit",
  "cevap",
  "soru",
  "mülakat",
  "mulakat",
  "görüşme",
  "gorusme",
  "örnek",
  "ornek",
  "sorumluluk",
  "sahiplik",
  "netleş",
  "netles",
  "açıkl",
  "acikla",
  "belirsiz",
  "doğrulan",
  "dogrulan",
  "teyit",
  "kaçamak",
  "kacamak",
  "yüzeysel",
  "yuzeysel",
  "somut",
  "katkı",
  "katki",
  "sonuç",
  "sonuc"
] as const;

const PROFILE_DERIVED_PATTERNS = [
  /\b\d+\+?\s*y[ıi]ll?[ıi]k\b/i,
  /\bdeneyimi var\b/i,
  /\bdeneyimli bir profesyonel\b/i,
  /\bliderlik pozisyonlar[ıi]nda deneyim/i,
  /\bliderlik deneyim/i,
  /\bteknik becer/i,
  /\buygun bir profil\b/i,
  /\blojistik alan[ıi]nda deneyimli\b/i,
  /\balan[ıi]nda deneyimli\b/i,
  /\bingilizce yeterlili[gğ]i\b/i
] as const;

function normalizeInsightText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/[ıİ]/g, "i")
    .replace(/[şŞ]/g, "s")
    .replace(/[ğĞ]/g, "g")
    .replace(/[üÜ]/g, "u")
    .replace(/[öÖ]/g, "o")
    .replace(/[çÇ]/g, "c")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function insightTokenSet(value: string) {
  return new Set(
    normalizeInsightText(value)
      .split(" ")
      .filter((token) => token.length > 2 && !INSIGHT_STOP_WORDS.has(token))
  );
}

function isSimilarInsight(a: string, b: string) {
  const first = normalizeInsightText(a);
  const second = normalizeInsightText(b);

  if (!first || !second) {
    return false;
  }

  if (first === second) {
    return true;
  }

  if ((first.length > 24 && second.includes(first)) || (second.length > 24 && first.includes(second))) {
    return true;
  }

  const firstTokens = insightTokenSet(a);
  const secondTokens = insightTokenSet(b);

  if (firstTokens.size === 0 || secondTokens.size === 0) {
    return false;
  }

  let overlap = 0;
  firstTokens.forEach((token) => {
    if (secondTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.min(firstTokens.size, secondTokens.size) >= 0.6;
}

function dedupeInsights(
  items: string[],
  options?: { exclude?: string[]; max?: number; filter?: (item: string) => boolean }
) {
  const output: string[] = [];
  const excluded = (options?.exclude ?? []).filter(Boolean);

  for (const raw of items) {
    const item = raw.trim();
    if (!item) {
      continue;
    }

    if (options?.filter && !options.filter(item)) {
      continue;
    }

    if (excluded.some((entry) => isSimilarInsight(entry, item))) {
      continue;
    }

    if (output.some((entry) => isSimilarInsight(entry, item))) {
      continue;
    }

    output.push(item);

    if (output.length >= (options?.max ?? 6)) {
      break;
    }
  }

  return output;
}

function isIdentityFact(value: string, candidateName: string) {
  const normalized = normalizeInsightText(value);
  const normalizedCandidate = normalizeInsightText(candidateName);
  return normalized.startsWith("adayin adi") || normalized === normalizedCandidate;
}

function isInterviewGroundedInsight(value: string) {
  const normalized = normalizeInsightText(value);

  if (!normalized) {
    return false;
  }

  if (PROFILE_DERIVED_PATTERNS.some((pattern) => pattern.test(value))) {
    return false;
  }

  return INTERVIEW_GROUNDED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function applicationNextAction(input: {
  stage: ApplicationStage;
  latestInterview: ApplicationDetailReadModel["interview"]["latestSession"] | null;
  candidateEmail: string | null;
  sourcingOutreachStatus: string | null | undefined;
}) {
  const interviewMeta = getInterviewInvitationMeta(
    input.latestInterview?.invitation ?? null,
    input.latestInterview?.status ?? null
  );

  if (input.latestInterview) {
    return {
      label: interviewMeta.label,
      detail: input.latestInterview.invitation?.expiresAt
        ? `Son geçerlilik: ${formatInterviewDeadline(input.latestInterview.invitation.expiresAt)}`
        : interviewMeta.detail
    };
  }

  if (input.stage === "INTERVIEW_COMPLETED") {
    return {
      label: "Karar Bekleniyor",
      detail: "AI değerlendirmesi hazır. Recruiter kararı verilmesi bekleniyor."
    };
  }

  if (input.stage === "RECRUITER_REVIEW") {
    return {
      label: "Mülakata Davet Et",
      detail: input.candidateEmail
        ? "Aday AI first interview davetine hazır."
        : "Davet öncesi adayın e-posta bilgisini tamamlayın."
    };
  }

  if (input.stage === "SCREENING") {
    return {
      label: "AI Ön Eleme Bekleniyor",
      detail: "Screening ve fit score paketinin tamamlanması bekleniyor."
    };
  }

  if (input.sourcingOutreachStatus === "SENT") {
    return {
      label: "Yanıt Bekleniyor",
      detail: "Sourcing outreach gönderildi. Yanıt gelirse görüşmeye hızla alın."
    };
  }

  if (input.stage === "REJECTED") {
    return {
      label: "Akış Kapandı",
      detail: "Aday reddedildi."
    };
  }

  return {
    label: "Applicant Akışı Başladı",
    detail: "Başvuru oluşturuldu; AI değerlendirme adımları ilerliyor."
  };
}

/* -- page -- */

export default function ApplicationDetailPage() {
  const { t } = useUiText();
  const params = useParams();
  const searchParams = useSearchParams();
  const applicationId = decodeRouteEntityId(params.id as string);

  const [data, setData] = useState<ApplicationDetailReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fitScore, setFitScore] = useState<ApplicantFitScoreView | null>(null);
  const [notes, setNotes] = useState<RecruiterNote[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirmAction, setConfirmAction] = useState<QuickActionType | null>(null);
  const [insightTab, setInsightTab] = useState<"summary" | "transcript">("summary");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.applicationDetailReadModel(applicationId);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  const loadFitScore = useCallback(async () => {
    try { setFitScore(await apiClient.getLatestFitScore(applicationId)); } catch {}
  }, [applicationId]);

  const loadNotes = useCallback(async () => {
    try { setNotes(await apiClient.listRecruiterNotes(applicationId)); } catch {}
  }, [applicationId]);

  useEffect(() => { void loadData(); void loadFitScore(); void loadNotes(); }, [loadData, loadFitScore, loadNotes]);

  const handleAction = (action: QuickActionType) => {
    if (action === "invite_interview") {
      setInviteModalOpen(true);
      return;
    }

    setConfirmAction(action);
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    setActionLoading(action);
    setActionMessage("");
    setActionError("");
    try {
      await apiClient.quickAction(applicationId, { action });
      setActionMessage(
        action === "reject"
          ? t("Aday reddedildi.")
          : action === "invite_interview"
            ? t("Görüşme daveti gönderildi.")
            : t("İşlem tamamlandı.")
      );
      void loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t("İşlem tamamlanamadı."));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async (text: string) => {
    const note = await apiClient.addRecruiterNote(applicationId, text);
    setNotes((prev) => [note, ...prev]);
  };

  if (loading) return <LoadingState message={t("Başvuru detayı yükleniyor...")} />;
  if (error) return <ErrorState error={error} actions={<button className="ghost-button" onClick={() => void loadData()}>{t("Tekrar dene")}</button>} />;
  if (!data) return null;

  const { summary, candidate, job } = data;
  const stageMeta = getRecruiterStageMeta(summary.stage as ApplicationStage, summary.humanDecision);
  const aiBanner = aiRecommendationBanner(summary.aiRecommendation);
  const stageHistory = data.timeline?.stageHistory ?? [];
  const latestInterview = data.interview?.latestSession;
  const interviewMeta = getInterviewInvitationMeta(latestInterview?.invitation ?? null, latestInterview?.status ?? null);
  const latestRecommendation =
    data.artifacts.recommendations.find((item) => item.sessionId === latestInterview?.id) ??
    data.artifacts.recommendations[0] ??
    null;
  const latestReport =
    data.artifacts.reports.find((item) => item.sessionId === latestInterview?.id) ??
    data.artifacts.reports[0] ??
    null;
  const latestReportJson = asRecord(latestReport?.reportJson ?? null);
  const latestReportSections = asRecord(latestReportJson?.sections ?? null);
  const recommendationSummary = latestRecommendation?.summaryText?.trim() ?? "";
  const reportInterviewSummary = asString(latestReportSections?.interviewSummary ?? null);
  const reportFacts = asStringArray(latestReportSections?.facts ?? null);
  const reportInterpretation = asStringArray(latestReportSections?.interpretation ?? null);
  const reportStrengths = asStringArray(latestReportSections?.strengths ?? null);
  const reportWeaknesses = asStringArray(latestReportSections?.weaknesses ?? null);
  const reportMissingInfo = asStringArray(latestReportSections?.missingInformation ?? null);
  const reportFlags = normalizeFlags(latestReportSections?.flags ?? null);
  const distinctInterviewSummary =
    reportInterviewSummary && !isSimilarInsight(reportInterviewSummary, recommendationSummary)
      ? reportInterviewSummary
      : "";
  const interviewHighlights = dedupeInsights(
    [...reportFacts.filter(isInterviewGroundedInsight), ...reportInterpretation.filter(isInterviewGroundedInsight)],
    {
      exclude: [recommendationSummary, reportInterviewSummary],
      max: 3,
      filter: (item) => !isIdentityFact(item, candidate.fullName)
    }
  );
  const conciseStrengths = dedupeInsights(reportStrengths, {
    exclude: [recommendationSummary, reportInterviewSummary, ...interviewHighlights],
    max: 2,
    filter: isInterviewGroundedInsight
  });
  const conciseRisks = dedupeInsights(
    [...reportWeaknesses, ...reportFlags.map((flag) => flag.note)],
    {
      exclude: [
        recommendationSummary,
        reportInterviewSummary,
        ...interviewHighlights,
        ...conciseStrengths
      ],
      max: 3
    }
  );
  const conciseMissingInfo = dedupeInsights(reportMissingInfo, {
    exclude: [...conciseRisks, ...interviewHighlights],
    max: 3,
    filter: isInterviewGroundedInsight
  });
  const transcriptPreview = latestInterview?.transcript?.previewSegments ?? [];
  const actions = getStageActions(summary.stage as ApplicationStage);
  const latestInterviewDuration = formatDurationLabel(latestInterview?.startedAt, latestInterview?.endedAt);
  const interviewSessions = data.interview?.sessions ?? [];
  const completedInterviewCount = interviewSessions.filter((session) => session.status === "COMPLETED").length;
  const recommendationBanner =
    aiRecommendationBanner(latestRecommendation?.recommendation ?? summary.aiRecommendation);
  const nextAction = applicationNextAction({
    stage: summary.stage as ApplicationStage,
    latestInterview,
    candidateEmail: candidate.email,
    sourcingOutreachStatus: candidate.sourcing?.latestOutreach?.status
  });

  return (
    <div className="page-grid">
      {/* Header */}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <PageTitleWithGuide
                guideKey="applicationDetail"
                title={candidate.fullName}
                style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "inherit" }}
              />
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 600, color: stageMeta.color,
                padding: "3px 10px", borderRadius: 12,
                background: `color-mix(in srgb, ${stageMeta.color} 12%, transparent)`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageMeta.color }} />
                {stageMeta.label}
              </span>
              {aiBanner && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: aiBanner.color,
                  padding: "3px 10px", borderRadius: 12,
                  background: `color-mix(in srgb, ${aiBanner.color} 10%, transparent)`,
                }}>
                  AI: {aiBanner.label}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <Link href={`/jobs/${job.id}`} className="text-sm" style={{ color: "var(--primary, #7c73fa)", textDecoration: "none" }}>
                {job.title}
              </Link>
              <span className="text-sm text-muted">{formatDate(summary.createdAt)}</span>
              <span className="text-sm text-muted">{sourceLabel(candidate.source)}</span>
              {candidate.sourcing ? (
                <Link
                  href={withApiBaseOverride(sourcingProjectDetailHref(candidate.sourcing.projectId), searchParams)}
                  className="text-sm"
                  style={{ color: "var(--primary, #7c73fa)", textDecoration: "none" }}
                >
                  {candidate.sourcing.projectName}
                </Link>
              ) : (
                <span className="text-sm text-muted">Merkezi aday profili</span>
              )}
            </div>
          </div>
          <button className="ghost-button" onClick={() => void loadData()}>Yenile</button>
        </div>
      </section>

      {/* Two column layout */}
      <div className="detail-grid">

        {/* LEFT COLUMN */}
        <div>
          <section className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>AI Analizi ve Mülakat</h3>
                <p className="text-xs text-muted" style={{ margin: "4px 0 0" }}>
                  Son tamamlanan AI mülakatının özeti ve transcript'i burada görünür.
                </p>
              </div>
              {latestInterview && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 12,
                  background: interviewMeta.tone === "success" ? "rgba(34,197,94,0.12)"
                    : interviewMeta.tone === "danger" ? "rgba(239,68,68,0.12)"
                    : interviewMeta.tone === "warn" ? "rgba(245,158,11,0.12)"
                    : "rgba(124,115,250,0.12)",
                  color: interviewMeta.tone === "success" ? "var(--success, #22c55e)"
                    : interviewMeta.tone === "danger" ? "var(--danger, #ef4444)"
                    : interviewMeta.tone === "warn" ? "var(--warn, #f59e0b)"
                    : "var(--primary, #7c73fa)",
                }}>
                  {interviewMeta.label}
                </span>
              )}
            </div>

            {!latestInterview ? (
              <p className="text-sm text-muted" style={{ margin: 0 }}>
                Henüz bu başvuru için AI mülakat daveti gönderilmedi.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 10,
                    marginBottom: 16
                  }}
                >
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)"
                    }}
                  >
                    <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Son Mülakat</div>
                    <strong style={{ fontSize: 13 }}>
                      {latestInterview.endedAt ? "Tamamlandı" : latestInterview.startedAt ? "Devam Ediyor" : "Hazır"}
                    </strong>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {latestInterview.endedAt
                        ? formatDate(latestInterview.endedAt)
                        : latestInterview.startedAt
                          ? formatDate(latestInterview.startedAt)
                          : formatDate(latestInterview.createdAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)"
                    }}
                  >
                    <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Transcript</div>
                    <strong style={{ fontSize: 13 }}>
                      {latestInterview.transcript?.segmentCount ?? 0} segment
                    </strong>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {latestInterview.transcript?.finalizedAt ? "Transkript hazır" : "Önizleme gösteriliyor"}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)"
                    }}
                  >
                    <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Süre</div>
                    <strong style={{ fontSize: 13 }}>{latestInterviewDuration ?? "Hesaplanamadı"}</strong>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {latestInterview.startedAt ? "Başlangıç: " + formatDate(latestInterview.startedAt) : "Henüz başlamadı"}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "rgba(255,255,255,0.02)"
                    }}
                  >
                    <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Mülakat Geçmişi</div>
                    <strong style={{ fontSize: 13 }}>{completedInterviewCount} tamamlanan oturum</strong>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      Toplam {interviewSessions.length} AI görüşme kaydı
                    </div>
                  </div>
                </div>

                {latestInterview.status === "SCHEDULED" && latestInterview.invitation?.expiresAt && (
                  <p className="text-sm text-muted" style={{ margin: "0 0 12px" }}>
                    Son geçerlilik: {formatInterviewDeadline(latestInterview.invitation.expiresAt)}
                  </p>
                )}

                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <button
                    type="button"
                    className="ghost-button"
                    style={{
                      borderColor: insightTab === "summary" ? "var(--primary, #7c73fa)" : undefined,
                      color: insightTab === "summary" ? "var(--primary, #7c73fa)" : undefined
                    }}
                    onClick={() => setInsightTab("summary")}
                  >
                    Özet
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    style={{
                      borderColor: insightTab === "transcript" ? "var(--primary, #7c73fa)" : undefined,
                      color: insightTab === "transcript" ? "var(--primary, #7c73fa)" : undefined
                    }}
                    onClick={() => setInsightTab("transcript")}
                  >
                    Transcript
                  </button>
                </div>

                {insightTab === "summary" ? (
                  <div style={{ display: "grid", gap: 12 }}>
                    {latestRecommendation && (
                      <div
                        style={{
                          padding: "18px 18px 16px",
                          borderRadius: 14,
                          background:
                            recommendationBanner?.color === "var(--success, #22c55e)"
                              ? "rgba(34,197,94,0.09)"
                              : recommendationBanner?.color === "var(--danger, #ef4444)"
                                ? "rgba(239,68,68,0.08)"
                                : "rgba(124,115,250,0.08)",
                          border:
                            recommendationBanner?.color === "var(--success, #22c55e)"
                              ? "1px solid rgba(34,197,94,0.2)"
                              : recommendationBanner?.color === "var(--danger, #ef4444)"
                                ? "1px solid rgba(239,68,68,0.18)"
                                : "1px solid rgba(124,115,250,0.16)"
                        }}
                      >
                        <div className="text-xs text-muted" style={{ marginBottom: 8 }}>Son AI mülakat özeti</div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 12,
                            flexWrap: "wrap",
                            marginBottom: recommendationSummary ? 10 : 0
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                letterSpacing: "0.02em",
                                textTransform: "uppercase",
                                color: recommendationBanner?.color ?? "var(--primary, #7c73fa)",
                                marginBottom: 4
                              }}
                            >
                              AI Önerisi
                            </div>
                            <strong
                              style={{
                                fontSize: 24,
                                lineHeight: 1.1,
                                color: recommendationBanner?.color ?? "var(--text-primary)"
                              }}
                            >
                              {recommendationBanner?.label ?? latestRecommendation.recommendation}
                            </strong>
                          </div>
                          {formatConfidence(latestRecommendation.confidence) && (
                            <div
                              style={{
                                padding: "8px 12px",
                                borderRadius: 999,
                                background: "rgba(255,255,255,0.55)",
                                border: "1px solid rgba(255,255,255,0.45)",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text-primary)"
                              }}
                            >
                              Güven: {formatConfidence(latestRecommendation.confidence)}
                            </div>
                          )}
                        </div>
                        {recommendationSummary && (
                          <p
                            style={{
                              fontSize: 14,
                              lineHeight: 1.7,
                              margin: 0,
                              color: "var(--text-secondary)"
                            }}
                          >
                            {recommendationSummary}
                          </p>
                        )}
                      </div>
                    )}

                    {distinctInterviewSummary && (
                      <div>
                        <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Mülakat Özeti</div>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: "var(--text-secondary)" }}>
                          {distinctInterviewSummary}
                        </p>
                      </div>
                    )}

                    {interviewHighlights.length > 0 && (
                      <div>
                        <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Görüşmeden Çıkan Ana Noktalar</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                          {interviewHighlights.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    )}

                    {conciseStrengths.length > 0 ? (
                      <div>
                        <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Güçlü Yönler</div>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                          {conciseStrengths.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    ) : null}

                    {(conciseRisks.length > 0 || conciseMissingInfo.length > 0) && (
                      <div style={{ display: "grid", gap: 10 }}>
                        {conciseRisks.length > 0 && (
                          <div>
                            <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Riskler ve Açık Noktalar</div>
                            <div style={{ display: "grid", gap: 4 }}>
                              {conciseRisks.map((item) => (
                                <div key={item} style={{
                                  display: "flex", alignItems: "baseline", gap: 8,
                                  padding: "6px 10px", borderRadius: 6, fontSize: 13,
                                  background: "rgba(245,158,11,0.06)",
                                  border: "1px solid rgba(245,158,11,0.12)",
                                }}>
                                  <span style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: "50%",
                                    background: "var(--warn, #f59e0b)",
                                    flexShrink: 0,
                                    marginTop: 5
                                  }} />
                                  <span style={{ color: "var(--text-secondary)" }}>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {conciseMissingInfo.length > 0 && (
                          <div>
                            <div className="text-xs text-muted" style={{ marginBottom: 6 }}>Eksik Bilgi</div>
                            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                              {conciseMissingInfo.map((item) => <li key={item}>{item}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : transcriptPreview.length > 0 ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <div className="text-xs text-muted" style={{ marginBottom: 2 }}>
                      Son tamamlanan mülakattan {latestInterview?.transcript?.segmentCount ?? transcriptPreview.length} segment gösteriliyor
                    </div>
                    {transcriptPreview.map((segment) => (
                      <div key={segment.id} style={{
                        padding: "10px 12px", borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: segment.speaker === "CANDIDATE" ? "rgba(124,115,250,0.06)" : "rgba(255,255,255,0.02)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <strong style={{ fontSize: 12, color: segment.speaker === "CANDIDATE" ? "var(--primary, #7c73fa)" : "var(--text-dim)" }}>
                            {segment.speaker === "CANDIDATE" ? "Aday" : segment.speaker === "AI" ? "AI" : segment.speaker}
                          </strong>
                          <span className="text-xs text-muted">{Math.max(0, Math.round(segment.startMs / 1000))}sn</span>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.6 }}>{segment.text}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted" style={{ margin: 0 }}>
                    Transcript henüz oluşmadı.
                  </p>
                )}
              </>
            )}
          </section>

          {fitScore && (
            <section className="panel" style={{ marginBottom: 16 }}>
              <div className="section-head">
                <div>
                  <h3 style={{ margin: 0 }}>Aday Eşleşmesi</h3>
                  <span className="text-xs text-muted">İlana bağlı merkezi değerlendirme görünümü</span>
                </div>
                <div style={{ minWidth: 180 }}>
                  <MatchIndicator score={fitScore.overallScore} />
                </div>
              </div>
              <FitScoreBreakdown fitScore={fitScore} />
              {fitScore.reasoning && (
                <p style={{ fontSize: 13, lineHeight: 1.7, marginTop: 12, marginBottom: 0, color: "var(--text-secondary)" }}>
                  {fitScore.reasoning}
                </p>
              )}
            </section>
          )}

          {/* Stage History */}
          {stageHistory.length > 0 && (
            <section className="panel" style={{ marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setHistoryOpen((current) => !current)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <h3 style={{ margin: 0 }}>Aşama Geçmişi</h3>
                  <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                    {stageHistory.length} kayıt mevcut, yalnız ihtiyaç olduğunda açılır.
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.02)"
                  }}
                >
                  {historyOpen ? "Gizle" : "Göster"}
                </span>
              </button>

              {historyOpen && (
                <div style={{ position: "relative", paddingLeft: 20, marginTop: 16 }}>
                  <div style={{ position: "absolute", left: 5, top: 0, bottom: 0, width: 2, background: "var(--border)" }} />
                  {stageHistory.map((entry: StageHistoryEntry, i: number) => (
                    <div key={i} style={{ position: "relative", paddingBottom: i < stageHistory.length - 1 ? 14 : 0 }}>
                      <span style={{
                        position: "absolute", left: -20, top: 2,
                        width: 12, height: 12, borderRadius: "50%",
                        background: i === 0 ? "var(--primary, #7c73fa)" : "var(--border)",
                        border: "2px solid var(--surface)",
                      }} />
                      <div className="text-xs text-muted">{formatDate(entry.changedAt)}</div>
                      <div style={{ fontSize: 13, marginTop: 2 }}>{stageHistoryLabel(entry.fromStage, entry.toStage)}</div>
                      {entry.reasonCode && (
                        <div className="text-xs text-muted">{reasonLabel(entry.reasonCode)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ position: "sticky", top: 24 }}>

          {actionMessage && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13,
              background: "color-mix(in srgb, var(--success, #22c55e) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--success, #22c55e) 25%, transparent)",
              color: "var(--success, #22c55e)",
            }}>
              {actionMessage}
            </div>
          )}
          {actionError && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13,
              background: "color-mix(in srgb, var(--danger, #ef4444) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--danger, #ef4444) 25%, transparent)",
              color: "var(--danger, #ef4444)",
            }}>
              {actionError}
            </div>
          )}

          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px" }}>Workflow Durumu</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-sm text-muted">Kaynak</span>
                <strong style={{ fontSize: 13 }}>{sourceLabel(candidate.source)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-sm text-muted">Kaynak etiketi</span>
                <strong style={{ fontSize: 13 }}>{candidate.externalSource ?? candidate.sourcing?.primarySourceLabel ?? "—"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="text-sm text-muted">Sonraki adım</span>
                <strong style={{ fontSize: 13 }}>{nextAction.label}</strong>
              </div>
              <p className="text-sm text-muted" style={{ margin: 0 }}>{nextAction.detail}</p>
              {candidate.sourcing ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span className="text-sm text-muted">Sourcing projesi</span>
                    <Link
                      href={withApiBaseOverride(sourcingProjectDetailHref(candidate.sourcing.projectId), searchParams)}
                      className="text-sm"
                      style={{ color: "var(--primary, #7c73fa)", textDecoration: "none" }}
                    >
                      {candidate.sourcing.projectName}
                    </Link>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span className="text-sm text-muted">Son outreach</span>
                    <strong style={{ fontSize: 13 }}>
                      {outreachOutcomeLabel(candidate.sourcing.latestOutreach?.status ?? null)}
                    </strong>
                  </div>
                  {candidate.sourcing.latestOutreach?.subject ? (
                    <p className="text-sm text-muted" style={{ margin: 0 }}>
                      Konu: {candidate.sourcing.latestOutreach.subject}
                    </p>
                  ) : null}
                </>
              ) : null}
              {latestInterview?.candidateInterviewUrl ? (
                <a
                  href={latestInterview.candidateInterviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm"
                  style={{ color: "var(--primary, #7c73fa)" }}
                >
                  Gönderilen AI mülakat linkini aç
                </a>
              ) : null}
            </div>
          </section>

          {/* Decision Card */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ margin: "0 0 12px" }}>Karar</h3>
            {actions.length === 0 ? (
              <p className="text-sm text-muted" style={{ margin: 0 }}>Bu aşamada işlem yapılamaz.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: actions.length > 1 ? "1fr 1fr" : "1fr", gap: 8 }}>
                {actions.map((act) => (
                  <button
                    key={act.key}
                    type="button"
                    className={`drawer-action-btn drawer-action-${act.key === "invite_interview" ? "interview" : act.key}`}
                    style={{ padding: "10px 8px", fontSize: 13, borderRadius: 8, textAlign: "center" }}
                    onClick={() => handleAction(act.key as QuickActionType)}
                    disabled={actionLoading !== null}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Confirmation Dialog */}
          {confirmAction && (
            <div className="confirm-overlay" onClick={() => setConfirmAction(null)}>
              <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: 8, fontSize: 16 }}>
                  Adayı Reddet
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  Aday reddedilecek. Bu işlem geri alınamaz.
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="confirm-btn confirm-btn-cancel" onClick={() => setConfirmAction(null)}>Vazgec</button>
                  <button
                    className="confirm-btn confirm-btn-danger"
                    onClick={() => void executeAction()}
                  >
                    Reddet
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <RecruiterNotesPanel notes={notes} onAdd={handleAddNote} />
          </section>
        </div>
      </div>

      <InterviewInviteModal
        open={inviteModalOpen}
        applicationId={applicationId}
        candidateName={candidate.fullName}
        jobTitle={job.title}
        roleFamily={job.roleFamily}
        onClose={() => setInviteModalOpen(false)}
        onSubmitted={(result) => {
          setInviteModalOpen(false);
          setActionMessage(buildInviteSuccessMessage(result));
          setActionError("");
          void loadData();
        }}
      />
    </div>
  );
}

type StageHistoryEntry = {
  fromStage: string | null;
  toStage: string;
  changedAt: string;
  reasonCode: string | null;
  changedBy: string | null;
};
