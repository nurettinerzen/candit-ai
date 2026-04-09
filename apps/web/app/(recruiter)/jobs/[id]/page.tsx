"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "../../../../lib/api-client";
import { isInternalAdminSession } from "../../../../lib/auth/policy";
import { resolveActiveSession } from "../../../../lib/auth/session";
import {
  SOURCE_LABELS,
  PIPELINE_STAGE_FILTERS,
  getStageMeta,
  getStageActions
} from "../../../../lib/constants";
import { formatCurrencyTry, formatDate } from "../../../../lib/format";
import {
  formatInterviewDeadline,
  getInterviewInvitationMeta
} from "../../../../lib/interview-invitation";
import { sourcingProjectDetailHref, withApiBaseOverride } from "../../../../lib/entity-routes";
import type {
  BillingOverviewReadModel,
  JobInboxReadModel,
  JobInboxApplicant,
  QuickActionType,
  ApplicationStage
} from "../../../../lib/types";
import { toFitScorePercent } from "../../../../lib/fit-score";
import { JobStatusChip } from "../../../../components/stage-chip";
import { QuickActionMenu } from "../../../../components/quick-action-menu";
import { ApplicantDrawer } from "../../../../components/applicant-drawer";
import { BulkCvUploadModal } from "../../../../components/bulk-cv-upload-modal";
import { InterviewInviteModal } from "../../../../components/interview-invite-modal";
import { MatchIndicator } from "../../../../components/match-indicator";
import { useUiText } from "../../../../components/site-language-provider";
import { LoadingState, ErrorState, EmptyState } from "../../../../components/ui-states";
import { translateUiText, type SiteLocale } from "../../../../lib/i18n";

function sourceLabel(source: string | null | undefined): string {
  if (!source) {
    return "—";
  }

  return SOURCE_LABELS[source] ?? source;
}

/** Merkezi stage label — her yerde aynı sonucu verir */
function stageTextStyle(stage: ApplicationStage): { label: string; color: string } {
  return getStageMeta(stage);
}

function buildQuickActionMessage(locale: SiteLocale, action: QuickActionType) {
  if (locale === "en") {
    switch (action) {
      case "invite_interview":
        return "AI interview invitation sent.";
      case "reject":
        return "Candidate rejected.";
      default:
        return "Action completed.";
    }
  }

  switch (action) {
    case "invite_interview":
      return "AI mülakat daveti gönderildi.";
    case "reject":
      return "Aday reddedildi.";
    default:
      return "İşlem tamamlandı.";
  }
}

function buildBulkCvUploadMessage(locale: SiteLocale, queued: number, failedCount: number) {
  if (locale === "en") {
    return `${queued} CVs queued. Candidate cards will be created and post-parse evaluation will start automatically.` +
      (failedCount > 0 ? ` ${failedCount} files had errors.` : "");
  }

  return `${queued} CV kuyruğa alındı. Aday kartları oluşturuluyor ve parse sonrası değerlendirme otomatik başlatılacak.` +
    (failedCount > 0 ? ` ${failedCount} dosyada hata var.` : "");
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
      return "Taslak oluşturuldu";
    case "FAILED":
      return "Gönderim başarısız";
    case "CANCELLED":
      return "Gönderim iptal edildi";
    default:
      return "Outreach bilgisi yok";
  }
}

function applicantNextAction(applicant: JobInboxApplicant, locale: SiteLocale) {
  const interviewMeta = getInterviewInvitationMeta(
    applicant.interview?.invitation ?? null,
    applicant.interview?.status ?? null
  );

  if (applicant.interview) {
    if (applicant.interview.invitation?.expiresAt) {
      return {
        label: interviewMeta.label,
        detail: translateUiText(
          `Son geçerlilik: ${formatInterviewDeadline(applicant.interview.invitation.expiresAt)}`,
          locale
        ),
        tone: interviewMeta.tone
      };
    }

    return {
      label: interviewMeta.label,
      detail: interviewMeta.detail,
      tone: interviewMeta.tone
    };
  }

  if (applicant.stage === "INTERVIEW_COMPLETED") {
    return {
      label: "Karar Bekleniyor",
      detail: "AI değerlendirmesini inceleyip recruiter kararını verin.",
      tone: "success" as const
    };
  }

  if (applicant.stage === "RECRUITER_REVIEW") {
    return {
      label: "Mülakata Davet Et",
      detail: "Ön eleme tamamlandı. Tek tıkla AI first interview gönderebilirsiniz.",
      tone: "warn" as const
    };
  }

  if (applicant.stage === "SCREENING") {
    return {
      label: "AI Ön Eleme Sırada",
      detail: "Skor ve recruiter review paketi hazırlanıyor.",
      tone: "info" as const
    };
  }

  if (applicant.stage === "REJECTED") {
    return {
      label: "Akış Kapandı",
      detail: "Aday reddedildi.",
      tone: "danger" as const
    };
  }

  if (applicant.sourcing?.latestOutreach?.status === "SENT") {
    return {
      label: "Yanıt Bekleniyor",
      detail: "Sourcing outreach gönderilmiş. Yanıt gelirse hızlıca akışa alın.",
      tone: "info" as const
    };
  }

  return {
    label: "AI Ön Eleme Başlayacak",
    detail: "Başvuru yeni eklendi; screening ve fit score hazırlanacak.",
    tone: "neutral" as const
  };
}

function nextActionColor(tone: "neutral" | "info" | "warn" | "success" | "danger") {
  switch (tone) {
    case "info":
      return "var(--info, #60a5fa)";
    case "warn":
      return "var(--warn, #f59e0b)";
    case "success":
      return "var(--success, #22c55e)";
    case "danger":
      return "var(--danger, #ef4444)";
    default:
      return "var(--text-secondary)";
  }
}

function buildInviteSuccessMessage(
  locale: SiteLocale,
  result: { interviewLink?: string; expiresAt?: string | null }
) {
  if (locale === "en") {
    if (result.expiresAt) {
      return `AI interview invitation sent. Link is active until ${formatInterviewDeadline(result.expiresAt)}.`;
    }

    return result.interviewLink
      ? "AI interview invitation sent. Direct interview link is ready."
      : "AI interview invitation sent.";
  }

  if (result.expiresAt) {
    return `AI mülakat daveti gönderildi. Link ${formatInterviewDeadline(result.expiresAt)} tarihine kadar aktif.`;
  }

  return result.interviewLink
    ? "AI mülakat daveti gönderildi. Direkt görüşme linki hazır."
    : "AI mülakat daveti gönderildi.";
}

function normalizeSignalText(text: string) {
  return text.replace(/\s+/g, " ").replace(/[.:;,]+$/g, "").trim();
}

function signalTokens(text: string) {
  const ignored = new Set([
    "aday",
    "bilgi",
    "bilgisi",
    "eksik",
    "risk",
    "uyari",
    "uyarisi",
    "kritik",
    "durumu",
    "ve",
    "ile",
    "icin",
    "olan",
    "yok",
    "teyit",
    "gerekiyor"
  ]);

  return [...new Set(
    text
      .toLocaleLowerCase("tr-TR")
      .split(/[^a-z0-9çğıöşü]+/i)
      .filter((token) => token.length > 2 && !ignored.has(token))
  )];
}

function overlapsMissingInformation(risk: string, missingInfo: string[]) {
  const riskWords = signalTokens(risk);
  if (riskWords.length === 0) {
    return false;
  }

  return missingInfo.some((item) => {
    const overlap = riskWords.filter((token) => signalTokens(item).includes(token));
    return overlap.length >= Math.min(2, riskWords.length);
  });
}

function riskSummary(applicant: JobInboxApplicant): { count: number; tags: string[] } {
  const tags: string[] = [];
  if (!applicant.cvStatus.hasCv) tags.push("CV Yok");
  else if (!applicant.cvStatus.isParsed) tags.push("CV İşlenmedi");
  if (applicant.fitScore) {
    const missingInfo = [...new Set(applicant.fitScore.missingInfo.map(normalizeSignalText).filter(Boolean))];
    const risks = [...new Set(applicant.fitScore.risks.map(normalizeSignalText).filter(Boolean))]
      .filter((item) => !overlapsMissingInformation(item, missingInfo));
    if (missingInfo.length > 0) tags.push(`${missingInfo.length} Eksik Bilgi`);
    if (risks.length > 0) tags.push(`${risks.length} Uyarı`);
  }
  return { count: tags.length, tags };
}

/** Ön eleme tamamlanmış, recruiter'ın karar vermesi beklenen adaylar */
function needsAttention(a: JobInboxApplicant): boolean {
  return a.stage === "RECRUITER_REVIEW";
}

/* ── stage pills ── */

type StagePill = { label: string; value: string };

const STAGE_PILLS: StagePill[] = [
  { label: "Tümü", value: "" },
  ...PIPELINE_STAGE_FILTERS.map((status) => ({
    label: status.label,
    value: status.value
  }))
];

/* ── urgency badge ── */

/* ── page ── */

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, t } = useUiText();
  const session = useMemo(() => resolveActiveSession(), []);
  const jobId = params.id as string;
  const canViewSourcing = isInternalAdminSession(session);

  const [data, setData] = useState<JobInboxReadModel | null>(null);
  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [billingError, setBillingError] = useState("");

  // Filters
  const [stageFilter, setStageFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [minFitScore, setMinFitScore] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & drawers
  const [selectedApplicant, setSelectedApplicant] = useState<JobInboxApplicant | null>(null);
  const [bulkCvUploadOpen, setBulkCvUploadOpen] = useState(false);

  // Bulk selection for interview approval
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ label: string; ok: number; fail: number } | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [inviteOutcome, setInviteOutcome] = useState<{ interviewLink: string | null; expiresAt: string | null } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ applicant: JobInboxApplicant; action: QuickActionType } | null>(null);
  const [inviteDialogApplicant, setInviteDialogApplicant] = useState<JobInboxApplicant | null>(null);
  const [pendingAutomationIds, setPendingAutomationIds] = useState<string[]>([]);
  const hasLoadedInboxRef = useRef(false);

  // Job info panel toggle
  const [showJobInfo, setShowJobInfo] = useState(false);

  const fetchInbox = useCallback(async (options?: {
    silent?: boolean;
    bypassFilters?: boolean;
    updateState?: boolean;
  }) => {
    if (!options?.silent) {
      setLoading(true);
      setError("");
    }

    try {
      const result = await apiClient.getJobInbox(jobId, {
        source: options?.bypassFilters ? undefined : sourceFilter || undefined,
        minFitScore: options?.bypassFilters ? undefined : minFitScore ? Number(minFitScore) : undefined,
        sortBy: options?.bypassFilters ? undefined : sortBy || undefined
      });
      if (options?.updateState !== false) {
        setData(result);
      }
      return result;
    } catch (e) {
      if (!options?.silent) {
        setError(e instanceof Error ? e.message : t("Veri yüklenemedi."));
      }
      return null;
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [jobId, sourceFilter, minFitScore, sortBy, t]);

  const loadInbox = useCallback(async (options?: { silent?: boolean }) => {
    return fetchInbox({
      silent: options?.silent,
      updateState: true
    });
  }, [fetchInbox]);

  useEffect(() => {
    let cancelled = false;

    async function loadBillingOverview() {
      try {
        const overview = await apiClient.billingOverview();
        if (!cancelled) {
          setBilling(overview);
          setBillingError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setBilling(null);
          setBillingError(
            loadError instanceof Error ? loadError.message : t("Abonelik kullanımı şu an yüklenemedi.")
          );
        }
      }
    }

    void loadBillingOverview();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    const silent = hasLoadedInboxRef.current;
    void loadInbox({ silent });
    hasLoadedInboxRef.current = true;
  }, [loadInbox]);

  useEffect(() => {
    if (pendingAutomationIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let timeoutId: number | undefined;
    const maxAttempts = 120;

    const poll = async () => {
      const progressSnapshot = await fetchInbox({
        silent: true,
        bypassFilters: true,
        updateState: false
      });

      if (cancelled) {
        return;
      }

      attempts += 1;

      if (!progressSnapshot) {
        if (attempts >= maxAttempts) {
          setPendingAutomationIds([]);
          setActionError(t("Otomatik güncelleme zaman aşımına uğradı. Süreç arka planda devam ediyor olabilir."));
          return;
        }

        timeoutId = window.setTimeout(poll, 3000);
        return;
      }

      const unresolved = pendingAutomationIds.filter((applicationId) => {
        const applicant = progressSnapshot.applicants.find((item) => item.applicationId === applicationId);
        if (!applicant) {
          return true;
        }

        return !applicant.cvStatus.isParsed || !applicant.screening || applicant.screening.status !== "SUCCEEDED" || !applicant.fitScore;
      });

      await loadInbox({ silent: true });

      if (cancelled) {
        return;
      }

      if (unresolved.length === 0) {
        setPendingAutomationIds([]);
        setActionError("");
        setActionMessage((current) =>
          current
            ? `${current} ${t("Otomatik değerlendirme sonuçları da güncellendi.")}`
            : t("Otomatik değerlendirme sonuçları güncellendi.")
        );
        return;
      }

      if (attempts >= maxAttempts) {
        setPendingAutomationIds([]);
        setActionError(t("Bazı adayların son durumu ekrana geç yansıdı. Sayfa arka planda tekrar güncellenebilir."));
        return;
      }

      timeoutId = window.setTimeout(poll, 3000);
    };

    timeoutId = window.setTimeout(poll, 2500);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pendingAutomationIds, fetchInbox, loadInbox, t]);

  // Client-side search filter
  const filteredApplicants = useMemo(() => {
    const all = data?.applicants ?? [];
    return all.filter((a) => {
      if (stageFilter) {
        if (a.stage !== stageFilter) {
          return false;
        }
      }

      if (!searchQuery.trim()) {
        return true;
      }

      const q = searchQuery.toLowerCase();
      return (
        a.fullName.toLowerCase().includes(q) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q))
      );
    });
  }, [data?.applicants, searchQuery, stageFilter]);

  const handleQuickAction = (applicant: JobInboxApplicant, action: QuickActionType) => {
    setInviteOutcome(null);
    if (action === "invite_interview") {
      setInviteDialogApplicant(applicant);
      return;
    }

    setConfirmDialog({ applicant, action });
  };

  const executeAction = async () => {
    if (!confirmDialog) return;
    const { applicant, action } = confirmDialog;
    setConfirmDialog(null);
    setActionMessage("");
    setActionError("");
    setInviteOutcome(null);
    setActionLoadingId(applicant.applicationId);

    try {
      const result = await apiClient.quickAction(applicant.applicationId, { action });
      setActionMessage(
        action === "invite_interview"
          ? buildInviteSuccessMessage(locale, result)
          : buildQuickActionMessage(locale, action)
      );
      if (action === "invite_interview") {
        setInviteOutcome({
          interviewLink: result.interviewLink ?? null,
          expiresAt: result.expiresAt ?? null
        });
      }
      await loadInbox({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t("İşlem tamamlanamadı."));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkCvUpload = async (files: File[], source: string, externalSource?: string) => {
    const result = await apiClient.bulkUploadApplicantCvs(jobId, {
      files,
      source,
      externalSource
    });

    const queued = result.items.filter((item) => item.status === "queued").length;
    const failed = result.items.filter((item) => item.status === "error");

    setActionError(
      failed.length > 0
        ? failed
            .slice(0, 3)
            .map((item) => `${item.originalName}: ${item.error}`)
            .join(" | ")
        : ""
    );
    setActionMessage(buildBulkCvUploadMessage(locale, queued, failed.length));
    void loadInbox();
    setPendingAutomationIds(
      result.items
        .map((item) => item.applicationId)
        .filter((applicationId): applicationId is string => Boolean(applicationId))
    );
  };

  const toggleSelect = (appId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId); else next.add(appId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApplicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplicants.map((a) => a.applicationId)));
    }
  };

  const selectedApplicants = useMemo(
    () => filteredApplicants.filter((applicant) => selectedIds.has(applicant.applicationId)),
    [filteredApplicants, selectedIds]
  );

  const bulkInviteEligibleIds = useMemo(
    () =>
      selectedApplicants
        .filter((applicant) =>
          getStageActions(applicant.stage as ApplicationStage).some((action) => action.key === "invite_interview")
        )
        .map((applicant) => applicant.applicationId),
    [selectedApplicants]
  );

  const bulkRejectEligibleIds = useMemo(
    () =>
      selectedApplicants
        .filter((applicant) =>
          getStageActions(applicant.stage as ApplicationStage).some((action) => action.key === "reject")
        )
        .map((applicant) => applicant.applicationId),
    [selectedApplicants]
  );

  const handleBulkApproveInterview = async () => {
    if (bulkInviteEligibleIds.length === 0) return;
    setBulkApproving(true);
    setBulkResult(null);
    setInviteOutcome(null);
    try {
      const result = await apiClient.bulkApproveInterview(bulkInviteEligibleIds);
      const ok = result.results.filter((r) => r.status === "ok").length;
      const fail = result.results.filter((r) => r.status === "error").length;
      setBulkResult({ label: "Mülakat daveti", ok, fail });
      if (ok === 1) {
        const success = result.results.find((item) => item.status === "ok");
        if (success) {
          setInviteOutcome({
            interviewLink: success.interviewLink ?? null,
            expiresAt: success.expiresAt ?? null
          });
        }
      }
      setSelectedIds(new Set());
      void loadInbox();
    } catch {
      setBulkResult({ label: "Mülakat daveti", ok: 0, fail: bulkInviteEligibleIds.length });
    } finally {
      setBulkApproving(false);
    }
  };

  const handleBulkReject = async () => {
    if (bulkRejectEligibleIds.length === 0) return;
    setBulkApproving(true);
    setBulkResult(null);
    setInviteOutcome(null);
    try {
      const results = await Promise.all(
        bulkRejectEligibleIds.map(async (applicationId) => {
          try {
            await apiClient.quickAction(applicationId, { action: "reject" });
            return { status: "ok" as const };
          } catch {
            return { status: "error" as const };
          }
        })
      );
      const ok = results.filter((item) => item.status === "ok").length;
      const fail = results.filter((item) => item.status === "error").length;
      setBulkResult({ label: "Reddetme", ok, fail });
      setSelectedIds(new Set());
      void loadInbox();
    } finally {
      setBulkApproving(false);
    }
  };

  const job = data?.job;
  const stats = data?.stats;
  const commandCenter = data?.commandCenter;
  const activeJobsQuota = billing?.usage.quotas.find((quota) => quota.key === "ACTIVE_JOBS") ?? null;
  const canPublishJob = activeJobsQuota ? activeJobsQuota.remaining > 0 : true;

  // Recruiter'ın karar vermesi gereken adaylar (Ön Eleme Tamamlandı)
  const attentionCount = useMemo(() => {
    const all = data?.applicants ?? [];
    return all.filter((a) => needsAttention(a)).length;
  }, [data?.applicants]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const applicant of data?.applicants ?? []) {
      const stage = applicant.stage as string;
      counts[stage] = (counts[stage] ?? 0) + 1;
    }
    return counts;
  }, [data?.applicants]);

  const ensurePublishCapacity = useCallback(() => {
    if (canPublishJob) {
      return true;
    }

    setActionError(
      t("Aktif ilan kotanız dolu. Bu ilanı yeniden yayına almak için önce bir ilanı arşivleyin ya da planınızı yükseltin.")
    );
    return false;
  }, [canPublishJob, t]);

  return (
    <div className="page-grid">
      {/* ── Command Center Header ── */}
      <section className="panel job-detail-hero">
        <div className="section-head job-detail-hero-head">
          <div className="job-detail-hero-main">
            <Link href="/jobs" className="text-muted text-sm job-detail-backlink" style={{ textDecoration: "none" }}>
              ← {t("İlan Merkezi")}
            </Link>
            {job && (
              <>
                <h2 className="job-detail-title">{job.title}</h2>
                <div className="drawer-meta job-detail-meta-row" style={{ gap: 8 }}>
                  <JobStatusChip status={job.status} />
                  {job.locationText && <span className="text-sm">{job.locationText}</span>}
                  {job.shiftType && <span className="text-sm">{t(job.shiftType)}</span>}
                  {(job.salaryMin || job.salaryMax) && (
                    <span className="text-sm">{formatCurrencyTry(job.salaryMin)} – {formatCurrencyTry(job.salaryMax)}</span>
                  )}
                  <button
                    type="button"
                    className="ghost-button"
                    style={{ fontSize: 12, padding: "2px 8px" }}
                    onClick={() => setShowJobInfo(!showJobInfo)}
                  >
                    {showJobInfo ? t("İlan Bilgilerini Gizle") : t("İlan Bilgilerini Göster")}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="row-actions job-detail-hero-actions" style={{ gap: 8 }}>
            {job && canViewSourcing ? (
              <button
                type="button"
                className="button-link"
                style={{ padding: "10px 14px" }}
                onClick={async () => {
                  const result = await apiClient.createSourcingProject({ jobId });
                  router.push(withApiBaseOverride(sourcingProjectDetailHref(result.projectId), searchParams));
                }}
              >
                {t("Kaynak Bulma’yı Aç")}
              </button>
            ) : null}
            {job && job.status === "PUBLISHED" && (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: 12, color: "var(--warn, #f59e0b)" }}
                onClick={async () => {
                  if (!confirm(t("İlan arşivlenecek ve yeni başvuru kabul edilmeyecek. Onaylıyor musunuz?"))) return;
                  await apiClient.updateJobStatus(jobId, "ARCHIVED");
                  void loadInbox({ silent: true });
                }}
              >
                {t("Arşivle")}
              </button>
            )}
            {job && job.status === "ARCHIVED" && (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: 12, color: "var(--success, #22c55e)" }}
                onClick={async () => {
                  if (!ensurePublishCapacity()) {
                    return;
                  }
                  await apiClient.updateJobStatus(jobId, "PUBLISHED");
                  void loadInbox({ silent: true });
                }}
                disabled={!canPublishJob}
              >
                {t("Tekrar Yayınla")}
              </button>
            )}
            {job && job.status === "DRAFT" && (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: 12, color: "var(--success, #22c55e)" }}
                onClick={async () => {
                  if (!ensurePublishCapacity()) {
                    return;
                  }
                  await apiClient.updateJobStatus(jobId, "PUBLISHED");
                  void loadInbox({ silent: true });
                }}
                disabled={!canPublishJob}
              >
                {t("Yayınla")}
              </button>
            )}
            <button type="button" className="ghost-button job-detail-refresh-button" onClick={() => void loadInbox({ silent: true })}>{t("Yenile")}</button>
          </div>
        </div>

        {/* Expandable job info panel */}
        {showJobInfo && job && (
          <div className="panel nested-panel" style={{ marginTop: 12 }}>
            {job.jdText && (
              <div style={{ marginBottom: 12 }}>
                <strong className="text-sm" style={{ display: "block", marginBottom: 4 }}>{t("İş Tanımı")}</strong>
                <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{job.jdText}</p>
              </div>
            )}
            {job.requirements && job.requirements.length > 0 && (
              <div>
                <strong className="text-sm" style={{ display: "block", marginBottom: 4 }}>{t("Aranan Nitelikler")}</strong>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {job.requirements.map((r) => (
                    <span
                      key={r.id}
                      className="text-xs"
                      style={{
                        padding: "3px 10px",
                        borderRadius: 999,
                        background: r.required ? "var(--primary-light, #ede9fe)" : "var(--surface-muted, #f3f4f6)",
                        color: r.required ? "var(--primary, #5046e5)" : "var(--text-secondary)",
                        border: `1px solid ${r.required ? "var(--primary-border, #c4b5fd)" : "var(--border)"}`,
                      }}
                      title={translateUiText(`${r.key}: ${r.value}${r.required ? ` (${t("Zorunlu")})` : ""}`, locale)}
                    >
                      {r.required && "● "}{r.value || r.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeJobsQuota && !canPublishJob && job?.status !== "PUBLISHED" ? (
          <div
            className="panel nested-panel"
            style={{ marginTop: 12, borderColor: "rgba(239,68,68,0.35)" }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>{translateUiText("Aktif ilan kotası dolu", locale)}</strong>
            <p className="small" style={{ margin: 0 }}>
              {translateUiText(`Bu dönem ${activeJobsQuota.used} / ${activeJobsQuota.limit} aktif ilan kullanıyorsunuz.`, locale)}
              {translateUiText("Bu ilanı taslakta tutabilir, slot açıldığında yayına alabilirsiniz.", locale)}
            </p>
          </div>
        ) : null}

        {billingError ? (
          <div className="panel nested-panel" style={{ marginTop: 12 }}>
            <ErrorState title={translateUiText("Abonelik görünürlüğü", locale)} error={billingError} />
          </div>
        ) : null}
      </section>

      {loading && <LoadingState message={translateUiText("İlan detayı yükleniyor...", locale)} />}
      {!loading && error && <ErrorState error={error} actions={<button className="ghost-button" onClick={() => void loadInbox()}>{translateUiText("Tekrar dene", locale)}</button>} />}

      {!loading && !error && data && stats && (
        <>
          {/* ── KPI Cards ── */}
          <div className="kpi-grid">
            <article className="kpi-card">
                  <p className="small">{t("Toplam Başvuru")}</p>
              <p className="kpi-value">{stats.totalApplicants}</p>
            </article>
            <article className="kpi-card">
                  <p className="small">{t("Skoru Hazır")}</p>
              <p className="kpi-value">{stats.scoredCount}</p>
            </article>
            <article className="kpi-card">
                  <p className="small">{t("Ort. Uyum Skoru")}</p>
              <p className="kpi-value">{stats.avgFitScore != null ? `${stats.avgFitScore}%` : "—"}</p>
            </article>
            <article className="kpi-card">
              <p className="small" style={{ color: attentionCount > 0 ? "var(--warn, #f59e0b)" : undefined }}>
                {t("Karar Bekleyen")}
              </p>
              <p className="kpi-value" style={{ color: attentionCount > 0 ? "var(--warn, #f59e0b)" : undefined }}>
                {attentionCount}
              </p>
            </article>
          </div>

          <section className="panel" style={{ marginTop: 16 }}>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{t("Pozisyon Komuta Merkezi")}</h3>
                <p className="small" style={{ margin: "6px 0 0" }}>
                  {t("Başvuru, mülakat ve recruiter karar akışı aynı yerden izlenir.")}
                </p>
              </div>
              {canViewSourcing && commandCenter?.sourcingProject ? (
                <Link
                  href={withApiBaseOverride(sourcingProjectDetailHref(commandCenter.sourcingProject.id), searchParams)}
                  className="button-link"
                  style={{ padding: "8px 12px", textDecoration: "none" }}
                >
                  {commandCenter.sourcingProject.name}
                </Link>
              ) : null}
            </div>
            <div className="kpi-grid">
              {canViewSourcing ? (
                <article className="kpi-card">
                  <p className="small">{t("Kaynak Bulma Projesi")}</p>
                  <p className="kpi-value">{commandCenter?.sourcingProject?.metrics.totalProspects ?? 0}</p>
                  <p className="small" style={{ marginBottom: 0 }}>
                    {t("Prospect")} · {commandCenter?.sourcingProject?.metrics.attachedApplicants ?? 0} {t("akışa bağlandı")}
                  </p>
                </article>
              ) : null}
              <article className="kpi-card">
                <p className="small">{t("Harici Kaynaklı Aday")}</p>
                <p className="kpi-value">{commandCenter?.sourcedApplicants ?? 0}</p>
                <p className="small" style={{ marginBottom: 0 }}>
                  {t("İçe aktarılan ve yeniden keşfedilen adaylar dahil")}
                </p>
              </article>
              <article className="kpi-card">
                <p className="small">{t("Mülakat Daveti Hazır")}</p>
                <p className="kpi-value">{commandCenter?.readyForInterviewInvite ?? 0}</p>
                <p className="small" style={{ marginBottom: 0 }}>
                  {t("E-posta mevcut, tek tıkla AI invite gönderebilirsiniz")}
                </p>
              </article>
              <article className="kpi-card">
                <p className="small">{t("Aktif Invite / Outreach")}</p>
                <p className="kpi-value">
                  {(commandCenter?.activeInterviewInvites ?? 0) + (commandCenter?.outreachAwaitingReply ?? 0)}
                </p>
                <p className="small" style={{ marginBottom: 0 }}>
                  {commandCenter?.activeInterviewInvites ?? 0} {t("invite")}, {commandCenter?.outreachAwaitingReply ?? 0} {t("outreach yanıt bekliyor")}
                </p>
              </article>
            </div>
          </section>

          {/* ── Toolbar: Search + Filters + Actions ── */}
          <section className="panel applicant-toolbar-panel">
            {/* Stage pills */}
            <div className="stage-filter-row">
              {STAGE_PILLS.map((pill) => {
                const isActive = stageFilter === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setStageFilter(pill.value)}
                    className={`stage-filter-pill${isActive ? " is-active" : ""}`}
                  >
                    {t(pill.label)}
                    {pill.value && stageCounts[pill.value] != null && (
                      <span style={{ marginLeft: 6, opacity: 0.7 }}>({stageCounts[pill.value]})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search + filter row */}
            <div className="applicant-filter-compact-row">
              <input
                className="form-input applicant-filter-search"
                type="text"
                placeholder={translateUiText("Aday adı, e-posta veya telefon ara", locale)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select className="form-select applicant-filter-source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">{translateUiText("Tüm Kaynaklar", locale)}</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
              </select>
              <input
                className="form-input applicant-filter-score"
                type="number"
                placeholder={translateUiText("Minimum skor", locale)}
                min={0}
                max={100}
                value={minFitScore}
                onChange={(e) => setMinFitScore(e.target.value)}
              />
              <select className="form-select applicant-filter-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="">{translateUiText("Sıralama", locale)}</option>
                <option value="fitScore_desc">{translateUiText("Skor ↓", locale)}</option>
                <option value="fitScore_asc">{translateUiText("Skor ↑", locale)}</option>
                <option value="appliedAt_desc">{translateUiText("Tarih (Yeni)", locale)}</option>
                <option value="appliedAt_asc">{translateUiText("Tarih (Eski)", locale)}</option>
              </select>
              <button className="button-link applicant-filter-upload-btn" onClick={() => setBulkCvUploadOpen(true)}>
                {t("CV Yükle")}
              </button>
              {selectedIds.size > 0 && (
                <div className="row-actions" style={{ gap: 8, flexWrap: "wrap" }}>
                  {bulkInviteEligibleIds.length > 0 ? (
                    <button
                      className="button-link applicant-filter-bulk-btn"
                      onClick={() => void handleBulkApproveInterview()}
                      disabled={bulkApproving}
                    >
                      {bulkApproving ? t("Gönderiliyor...") : `${t("Mülakata Davet Et")} (${bulkInviteEligibleIds.length})`}
                    </button>
                  ) : null}
                  {bulkRejectEligibleIds.length > 0 ? (
                    <button
                      className="ghost-button applicant-filter-bulk-btn"
                      onClick={() => void handleBulkReject()}
                      disabled={bulkApproving}
                    >
                      {bulkApproving ? t("İşleniyor...") : `${t("Reddet")} (${bulkRejectEligibleIds.length})`}
                    </button>
                  ) : null}
                </div>
              )}
              {bulkResult && (
                <span className="text-sm" style={{ color: bulkResult.fail > 0 ? "var(--danger)" : "var(--success)" }}>
                  {t(bulkResult.label)}: {bulkResult.ok} {t("başarılı")}{bulkResult.fail > 0 ? `, ${bulkResult.fail} ${t("hata")}` : ""}
                </span>
              )}
              <span className="text-xs text-muted applicant-toolbar-count compact">
                {filteredApplicants.length !== stats.totalApplicants
                  ? `${filteredApplicants.length} / ${stats.totalApplicants} ${t("aday gösteriliyor")}`
                  : `${filteredApplicants.length} ${t("aday gösteriliyor")}`}
              </span>
            </div>
            {actionMessage ? (
              <div
                style={{
                  marginTop: 12,
                  padding: "12px 16px",
                  background: "var(--success-light, #ecfdf5)",
                  border: "1px solid var(--success-border, rgba(16, 185, 129, 0.25))",
                  borderRadius: 8,
                  color: "var(--success-text, #065f46)",
                  fontSize: 13
                }}
              >
                {actionMessage}
              </div>
            ) : null}
            {inviteOutcome?.interviewLink ? (
              <div
                className="nested-panel"
                style={{ marginTop: 10, padding: "12px 14px", display: "grid", gap: 6 }}
              >
                <strong style={{ fontSize: 13 }}>{translateUiText("Gönderilen AI mülakat linki", locale)}</strong>
                <a href={inviteOutcome.interviewLink} target="_blank" rel="noreferrer" className="small">
                  {inviteOutcome.interviewLink}
                </a>
                {inviteOutcome.expiresAt ? (
                  <span className="small">{translateUiText("Son geçerlilik", locale)}: {formatInterviewDeadline(inviteOutcome.expiresAt)}</span>
                ) : null}
              </div>
            ) : null}
              {actionError ? <ErrorState title={translateUiText("İşlem", locale)} error={actionError} /> : null}
          </section>

          {/* ── Applicant Inbox Table ── */}
          <section className="panel applicant-table-panel">
            <div className="applicant-table-shell">
              {filteredApplicants.length === 0 ? (
                <EmptyState message={searchQuery ? translateUiText("Aramayla eşleşen aday bulunamadı.", locale) : translateUiText("Bu ilana henüz aday başvurusu yok.", locale)} />
              ) : (
                <div className="table-responsive applicant-table-responsive">
                  <table className="table applicant-inbox-table">
                    <colgroup>
                      <col style={{ width: 40 }} />
                      <col style={{ width: 240 }} />
                      <col style={{ width: 92 }} />
                      <col style={{ width: 132 }} />
                      <col style={{ width: 148 }} />
                      <col style={{ width: 164 }} />
                      <col style={{ width: 74 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.size === filteredApplicants.length && filteredApplicants.length > 0} onChange={toggleSelectAll} />
                        </th>
                        <th>{t("Aday")}</th>
                        <th>{t("Kaynak")}</th>
                        <th>{t("Eşleşme")}</th>
                        <th>{t("Eksik / Uyarı")}</th>
                        <th>{t("Aşama")}</th>
                        <th>{t("İşlem")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplicants.map((a) => {
                        const fit = a.fitScore;
                        const fitPct = toFitScorePercent(fit?.overallScore);
                        const risk = riskSummary(a);
                        const attention = needsAttention(a);
                        const interviewMeta = getInterviewInvitationMeta(a.interview?.invitation ?? null, a.interview?.status ?? null);
                        const nextAction = applicantNextAction(a, locale);

                        return (
                          <tr
                            key={a.applicationId}
                            className="clickable-row"
                            onClick={() => setSelectedApplicant(a)}
                            style={{
                              borderLeft: attention ? "3px solid var(--warn, #f59e0b)" : undefined,
                            }}
                          >
                            <td onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedIds.has(a.applicationId)} onChange={() => toggleSelect(a.applicationId)} />
                            </td>
                            <td>
                              <div className="candidate-identity">
                                <div className="candidate-name-row">
                                  <strong style={{ fontSize: 14 }}>{a.fullName}</strong>
                                  {a.locationText && <span className="candidate-location">{a.locationText}</span>}
                                </div>
                                <div className="candidate-contact-line">
                                  {a.email ?? "—"}
                                </div>
                                <div className="candidate-contact-line">
                                  {a.phone ?? "—"}
                                </div>
                                <div className="candidate-contact-line small" style={{ marginTop: 4 }}>
                                  {a.sourcing
                                    ? `${t("Kaynak projesi")} · ${a.sourcing.projectName}`
                                    : a.externalRef
                                      ? `Ref · ${a.externalRef}`
                                      : t("Doğrudan başvuru akışı")}
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "grid", gap: 4 }}>
                                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                  {t(sourceLabel(a.source))}
                                </span>
                                {a.externalSource ? (
                                  <span className="text-xs text-muted">{a.externalSource}</span>
                                ) : null}
                                {a.sourcing?.sourceLabels.length ? (
                                  <span className="text-xs text-muted">
                                    {a.sourcing.sourceLabels.slice(0, 2).join(" · ")}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td>
                              {fitPct != null ? (
                                <div style={{ display: "grid", gap: 6 }}>
                                  <MatchIndicator score={fitPct} compact />
                                  {fit?.strengths?.[0] ? (
                                    <span className="text-xs text-muted" style={{ lineHeight: 1.4 }}>
                                      {fit.strengths[0]}
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-muted text-sm">—</span>
                              )}
                            </td>
                            <td>
                              {risk.count > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                  {risk.tags.map((tag, index) => (
                                    <span
                                      key={tag}
                                      style={{
                                        color: "var(--danger, #ef4444)",
                                        fontSize: 12,
                                        fontWeight: 600,
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {translateUiText(tag, locale)}{index < risk.tags.length - 1 ? " ·" : ""}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted text-sm">—</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: "grid", gap: 4 }}>
                                <span
                                  className="text-sm"
                                  style={{
                                    color: stageTextStyle(a.stage as ApplicationStage).color,
                                    fontWeight: 600
                                  }}
                                >
                                  {t(stageTextStyle(a.stage as ApplicationStage).label)}
                                </span>
                                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                                  <div style={{ fontWeight: 600, color: nextActionColor(nextAction.tone) }}>{t(nextAction.label)}</div>
                                  <div>{t(nextAction.detail)}</div>
                                  {a.sourcing?.latestOutreach?.status ? (
                                    <div>
                                      {t("Outreach:")} {t(outreachOutcomeLabel(a.sourcing.latestOutreach.status))}
                                    </div>
                                  ) : null}
                                  {a.interview?.candidateInterviewUrl ? (
                                    <a
                                      href={a.interview.candidateInterviewUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(event) => event.stopPropagation()}
                                    >
                                      {t("Aday görüşme linki")}
                                    </a>
                                  ) : a.interview && interviewMeta.detail ? (
                                    <div>{interviewMeta.detail}</div>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <QuickActionMenu
                                stage={a.stage as ApplicationStage}
                                onAction={(act) => handleQuickAction(a, act)}
                                disabled={actionLoadingId === a.applicationId}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Drawer */}
      <ApplicantDrawer
        applicant={selectedApplicant}
        onClose={() => setSelectedApplicant(null)}
        onActionDone={() => {
          setSelectedApplicant(null);
          void loadInbox();
        }}
      />

      {/* Modals */}
      <BulkCvUploadModal
        open={bulkCvUploadOpen}
        onClose={() => setBulkCvUploadOpen(false)}
        onSubmit={handleBulkCvUpload}
      />

      {/* Onay Diyaloğu */}
      {confirmDialog && (
        <div className="confirm-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-title">
              {confirmDialog.action === "invite_interview"
                ? t("Mülakata Davet Et")
                : t("Adayı Reddet")}
            </p>
            <p className="confirm-body">
              {confirmDialog.action === "invite_interview"
                ? `${confirmDialog.applicant.fullName} ${t("adayına tek linkli AI mülakat daveti gönderilecek. Bu akışta slot seçimi yoktur.")}`
                : `${confirmDialog.applicant.fullName} ${t("adayı reddedilecek.")}`}
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn confirm-btn-cancel"
                onClick={() => setConfirmDialog(null)}
              >
                {t("Vazgeç")}
              </button>
              <button
                type="button"
                className={`confirm-btn ${confirmDialog.action === "reject" ? "confirm-btn-danger" : "confirm-btn-primary"}`}
                onClick={() => void executeAction()}
              >
                {confirmDialog.action === "invite_interview" ? t("Evet, Davet Gönder") : t("Evet, Reddet")}
              </button>
            </div>
          </div>
        </div>
      )}

      <InterviewInviteModal
        open={Boolean(inviteDialogApplicant)}
        applicationId={inviteDialogApplicant?.applicationId ?? null}
        candidateName={inviteDialogApplicant?.fullName ?? ""}
        jobTitle={job?.title ?? ""}
        roleFamily={job?.roleFamily ?? null}
        onClose={() => setInviteDialogApplicant(null)}
        onSubmitted={(result) => {
          setInviteDialogApplicant(null);
          setActionMessage(buildInviteSuccessMessage(locale, result));
          setActionError("");
          setInviteOutcome({
            interviewLink: result.interviewLink ?? null,
            expiresAt: result.expiresAt ?? null
          });
          void loadInbox({ silent: true });
        }}
      />
    </div>
  );
}
