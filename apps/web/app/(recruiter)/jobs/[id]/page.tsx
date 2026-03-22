"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "../../../../lib/api-client";
import {
  SOURCE_LABELS,
  PIPELINE_STAGE_FILTERS,
  getStageMeta,
  getStageActions
} from "../../../../lib/constants";
import { formatCurrencyTry } from "../../../../lib/format";
import type { JobInboxReadModel, JobInboxApplicant, QuickActionType, ApplicationStage } from "../../../../lib/types";
import { toFitScorePercent } from "../../../../lib/fit-score";
import { JobStatusChip } from "../../../../components/stage-chip";
import { QuickActionMenu } from "../../../../components/quick-action-menu";
import { ApplicantDrawer } from "../../../../components/applicant-drawer";
import { BulkCvUploadModal } from "../../../../components/bulk-cv-upload-modal";
import { useSiteLanguage } from "../../../../components/site-language-provider";
import { LoadingState, ErrorState, EmptyState } from "../../../../components/ui-states";
import type { SiteLocale } from "../../../../lib/i18n";

/* ── helpers ── */

function fitBandLabel(score: number): { text: string; className: string } {
  if (score >= 80) return { text: "Güçlü", className: "fit-band-strong" };
  if (score >= 60) return { text: "İyi", className: "fit-band-good" };
  if (score >= 40) return { text: "Orta", className: "fit-band-mid" };
  return { text: "Zayıf", className: "fit-band-weak" };
}

function fitBandColor(score: number): string {
  if (score >= 80) return "var(--success, #22c55e)";
  if (score >= 60) return "var(--success, #22c55e)";
  if (score >= 40) return "var(--warn, #f59e0b)";
  return "var(--danger, #ef4444)";
}

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

function buildQuickActionMessage(action: QuickActionType) {
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
  const { locale } = useSiteLanguage();
  const jobId = params.id as string;

  const [data, setData] = useState<JobInboxReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number } | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ applicant: JobInboxApplicant; action: QuickActionType } | null>(null);
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
        setError(e instanceof Error ? e.message : "Veri yüklenemedi.");
      }
      return null;
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [jobId, sourceFilter, minFitScore, sortBy]);

  const loadInbox = useCallback(async (options?: { silent?: boolean }) => {
    return fetchInbox({
      silent: options?.silent,
      updateState: true
    });
  }, [fetchInbox]);

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
          setActionError("Otomatik güncelleme zaman aşımına uğradı. Süreç arka planda devam ediyor olabilir.");
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
            ? `${current} Otomatik değerlendirme sonuçları da güncellendi.`
            : "Otomatik değerlendirme sonuçları güncellendi."
        );
        return;
      }

      if (attempts >= maxAttempts) {
        setPendingAutomationIds([]);
        setActionError("Bazı adayların son durumu ekrana geç yansıdı. Sayfa arka planda tekrar güncellenebilir.");
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
  }, [pendingAutomationIds, fetchInbox, loadInbox]);

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
    // Her aksiyon onay gerektirir
    setConfirmDialog({ applicant, action });
  };

  const executeAction = async () => {
    if (!confirmDialog) return;
    const { applicant, action } = confirmDialog;
    setConfirmDialog(null);
    setActionMessage("");
    setActionError("");
    setActionLoadingId(applicant.applicationId);

    try {
      await apiClient.quickAction(applicant.applicationId, { action });
      setActionMessage(buildQuickActionMessage(action));
      await loadInbox({ silent: true });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
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

  const handleBulkApproveInterview = async () => {
    if (selectedIds.size === 0) return;
    setBulkApproving(true);
    setBulkResult(null);
    try {
      const result = await apiClient.bulkApproveInterview(Array.from(selectedIds));
      const ok = result.results.filter((r) => r.status === "ok").length;
      const fail = result.results.filter((r) => r.status === "error").length;
      setBulkResult({ ok, fail });
      setSelectedIds(new Set());
      void loadInbox();
    } catch {
      setBulkResult({ ok: 0, fail: selectedIds.size });
    } finally {
      setBulkApproving(false);
    }
  };

  const job = data?.job;
  const stats = data?.stats;

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

  return (
    <div className="page-grid">
      {/* ── Command Center Header ── */}
      <section className="panel job-detail-hero">
        <div className="section-head job-detail-hero-head">
          <div className="job-detail-hero-main">
            <Link href="/jobs" className="text-muted text-sm job-detail-backlink" style={{ textDecoration: "none" }}>
              ← İlan Merkezi
            </Link>
            {job && (
              <>
                <h2 className="job-detail-title">{job.title}</h2>
                <div className="drawer-meta job-detail-meta-row" style={{ gap: 8 }}>
                  <JobStatusChip status={job.status} />
                  {job.locationText && <span className="text-sm">{job.locationText}</span>}
                  {job.shiftType && <span className="text-sm">{job.shiftType}</span>}
                  {(job.salaryMin || job.salaryMax) && (
                    <span className="text-sm">{formatCurrencyTry(job.salaryMin)} – {formatCurrencyTry(job.salaryMax)}</span>
                  )}
                  <button
                    type="button"
                    className="ghost-button"
                    style={{ fontSize: 12, padding: "2px 8px" }}
                    onClick={() => setShowJobInfo(!showJobInfo)}
                  >
                    {showJobInfo ? "İlan Bilgilerini Gizle" : "İlan Bilgilerini Göster"}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="row-actions job-detail-hero-actions" style={{ gap: 8 }}>
            {job && job.status === "PUBLISHED" && (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: 12, color: "var(--warn, #f59e0b)" }}
                onClick={async () => {
                  if (!confirm("İlan arşivlenecek ve yeni başvuru kabul edilmeyecek. Onaylıyor musunuz?")) return;
                  await apiClient.updateJobStatus(jobId, "ARCHIVED");
                  void loadInbox({ silent: true });
                }}
              >
                Arşivle
              </button>
            )}
            {job && job.status === "ARCHIVED" && (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: 12, color: "var(--success, #22c55e)" }}
                onClick={async () => {
                  await apiClient.updateJobStatus(jobId, "PUBLISHED");
                  void loadInbox({ silent: true });
                }}
              >
                Tekrar Yayınla
              </button>
            )}
            {job && job.status === "DRAFT" && (
              <button
                type="button"
                className="ghost-button"
                style={{ fontSize: 12, color: "var(--success, #22c55e)" }}
                onClick={async () => {
                  await apiClient.updateJobStatus(jobId, "PUBLISHED");
                  void loadInbox({ silent: true });
                }}
              >
                Yayınla
              </button>
            )}
            <button type="button" className="ghost-button job-detail-refresh-button" onClick={() => void loadInbox({ silent: true })}>Yenile</button>
          </div>
        </div>

        {/* Expandable job info panel */}
        {showJobInfo && job && (
          <div className="panel nested-panel" style={{ marginTop: 12 }}>
            {job.jdText && (
              <div style={{ marginBottom: 12 }}>
                <strong className="text-sm" style={{ display: "block", marginBottom: 4 }}>İş Tanımı</strong>
                <p className="small" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{job.jdText}</p>
              </div>
            )}
            {job.requirements && job.requirements.length > 0 && (
              <div>
                <strong className="text-sm" style={{ display: "block", marginBottom: 4 }}>Aranan Nitelikler</strong>
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
                      title={`${r.key}: ${r.value}${r.required ? " (Zorunlu)" : ""}`}
                    >
                      {r.required && "● "}{r.value || r.key}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {loading && <LoadingState message="İlan detayı yükleniyor..." />}
      {!loading && error && <ErrorState error={error} actions={<button className="ghost-button" onClick={() => void loadInbox()}>Tekrar dene</button>} />}

      {!loading && !error && data && stats && (
        <>
          {/* ── KPI Cards ── */}
          <div className="kpi-grid">
            <article className="kpi-card">
              <p className="small">Toplam Başvuru</p>
              <p className="kpi-value">{stats.totalApplicants}</p>
            </article>
            <article className="kpi-card">
              <p className="small">Skoru Hazır</p>
              <p className="kpi-value">{stats.scoredCount}</p>
            </article>
            <article className="kpi-card">
              <p className="small">Ort. Uyum Skoru</p>
              <p className="kpi-value">{stats.avgFitScore != null ? `${stats.avgFitScore}%` : "—"}</p>
            </article>
            <article className="kpi-card">
              <p className="small" style={{ color: attentionCount > 0 ? "var(--warn, #f59e0b)" : undefined }}>
                Karar Bekleyen
              </p>
              <p className="kpi-value" style={{ color: attentionCount > 0 ? "var(--warn, #f59e0b)" : undefined }}>
                {attentionCount}
              </p>
            </article>
          </div>

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
                    {pill.label}
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
                placeholder="Aday adı, e-posta veya telefon ara"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select className="form-select applicant-filter-source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                <option value="">Tüm Kaynaklar</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input
                className="form-input applicant-filter-score"
                type="number"
                placeholder="Minimum skor"
                min={0}
                max={100}
                value={minFitScore}
                onChange={(e) => setMinFitScore(e.target.value)}
              />
              <select className="form-select applicant-filter-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="">Sıralama</option>
                <option value="fitScore_desc">Skor ↓</option>
                <option value="fitScore_asc">Skor ↑</option>
                <option value="appliedAt_desc">Tarih (Yeni)</option>
                <option value="appliedAt_asc">Tarih (Eski)</option>
              </select>
              <button className="button-link applicant-filter-upload-btn" onClick={() => setBulkCvUploadOpen(true)}>
                {locale === "en" ? "Upload CV" : "CV Yükle"}
              </button>
              {selectedIds.size > 0 && (
                <button
                  className="button-link applicant-filter-bulk-btn"
                  onClick={() => void handleBulkApproveInterview()}
                  disabled={bulkApproving}
                >
                  {bulkApproving ? "Gönderiliyor..." : `Görüşmeye Davet Et (${selectedIds.size})`}
                </button>
              )}
              {bulkResult && (
                <span className="text-sm" style={{ color: bulkResult.fail > 0 ? "var(--danger)" : "var(--success)" }}>
                  {bulkResult.ok} başarılı{bulkResult.fail > 0 ? `, ${bulkResult.fail} hata` : ""}
                </span>
              )}
              <span className="text-xs text-muted applicant-toolbar-count compact">
                {filteredApplicants.length !== stats.totalApplicants
                  ? `${filteredApplicants.length} / ${stats.totalApplicants} aday gösteriliyor`
                  : `${filteredApplicants.length} aday gösteriliyor`}
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
            {actionError ? <ErrorState title="İşlem" error={actionError} /> : null}
          </section>

          {/* ── Applicant Inbox Table ── */}
          <section className="panel applicant-table-panel">
            <div className="applicant-table-shell">
              {filteredApplicants.length === 0 ? (
                <EmptyState message={searchQuery ? "Aramayla eşleşen aday bulunamadı." : "Bu ilana henüz aday başvurusu yok."} />
              ) : (
                <div className="table-responsive applicant-table-responsive">
                  <table className="table applicant-inbox-table">
                    <colgroup>
                      <col style={{ width: 40 }} />
                      <col style={{ width: 240 }} />
                      <col style={{ width: 92 }} />
                      <col style={{ width: 132 }} />
                      <col style={{ width: 138 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 74 }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }} onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedIds.size === filteredApplicants.length && filteredApplicants.length > 0} onChange={toggleSelectAll} />
                        </th>
                        <th>Aday</th>
                        <th>Kaynak</th>
                        <th>Uyum Skoru</th>
                        <th>Eksik / Uyarı</th>
                        <th>Aşama</th>
                        <th>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredApplicants.map((a) => {
                        const fit = a.fitScore;
                        const fitPct = toFitScorePercent(fit?.overallScore);
                        const band = fitPct != null ? fitBandLabel(fitPct) : null;
                        const risk = riskSummary(a);
                        const attention = needsAttention(a);

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
                              </div>
                            </td>
                            <td>
                              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                                {sourceLabel(a.source)}
                              </span>
                            </td>
                            <td>
                              {fitPct != null && band ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{
                                    width: 40, height: 40, borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontWeight: 700, fontSize: 13,
                                    background: `color-mix(in srgb, ${fitBandColor(fitPct)} 15%, transparent)`,
                                    color: fitBandColor(fitPct),
                                    border: `2px solid ${fitBandColor(fitPct)}`,
                                  }}>
                                    {fitPct}
                                  </div>
                                  <span className="text-xs" style={{ fontWeight: 600, color: fitBandColor(fitPct) }}>
                                    {band.text}
                                  </span>
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
                                      {tag}{index < risk.tags.length - 1 ? " ·" : ""}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted text-sm">—</span>
                              )}
                            </td>
                            <td>
                              <span
                                className="text-sm"
                                style={{
                                  color: stageTextStyle(a.stage as ApplicationStage).color,
                                  fontWeight: 600
                                }}
                              >
                                {stageTextStyle(a.stage as ApplicationStage).label}
                              </span>
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
                ? "Mülakata Davet Et"
                : "Adayı Reddet"}
            </p>
            <p className="confirm-body">
              {confirmDialog.action === "invite_interview"
                ? `${confirmDialog.applicant.fullName} adayına AI mülakat daveti gönderilecek.`
                : `${confirmDialog.applicant.fullName} adayı reddedilecek.`}
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-btn confirm-btn-cancel"
                onClick={() => setConfirmDialog(null)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className={`confirm-btn ${confirmDialog.action === "reject" ? "confirm-btn-danger" : "confirm-btn-primary"}`}
                onClick={() => void executeAction()}
              >
                {confirmDialog.action === "invite_interview" ? "Evet, Davet Gönder" : "Evet, Reddet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
