"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiClient } from "../../../../lib/api-client";
import { SOURCE_LABELS, STAGE_LABELS, getRecruiterStageMeta } from "../../../../lib/constants";
import { formatCurrencyTry } from "../../../../lib/format";
import type { JobInboxReadModel, JobInboxApplicant, QuickActionType, BulkImportCandidate, ApplicationStage } from "../../../../lib/types";
import { JobStatusChip } from "../../../../components/stage-chip";
import { QuickActionMenu } from "../../../../components/quick-action-menu";
import { ApplicantDrawer } from "../../../../components/applicant-drawer";
import { BulkImportModal } from "../../../../components/bulk-import-modal";
import { BulkCvUploadModal } from "../../../../components/bulk-cv-upload-modal";
import { CsvUploadModal } from "../../../../components/csv-upload-modal";
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

function stageTextStyle(
  stage: ApplicationStage,
  recruiterDecision?: JobInboxApplicant["recruiterDecision"]
): { label: string; color: string } {
  if (stage === "RECRUITER_REVIEW") {
    return getRecruiterStageMeta(stage, recruiterDecision);
  }

  switch (stage) {
    case "APPLIED":
      return { label: STAGE_LABELS[stage], color: "var(--info-text, #1d4ed8)" };
    case "SCREENING":
      return { label: STAGE_LABELS[stage], color: "var(--primary, #5046e5)" };
    case "INTERVIEW_SCHEDULED":
      return { label: STAGE_LABELS[stage], color: "var(--warn-text, #92400e)" };
    case "INTERVIEW_COMPLETED":
      return { label: STAGE_LABELS[stage], color: "var(--success, #22c55e)" };
    case "HIRING_MANAGER_REVIEW":
      return { label: STAGE_LABELS[stage], color: "var(--warn-text, #92400e)" };
    case "OFFER":
    case "HIRED":
      return { label: STAGE_LABELS[stage], color: "var(--success, #22c55e)" };
    case "REJECTED":
      return { label: STAGE_LABELS[stage], color: "var(--danger, #ef4444)" };
    default:
      return { label: STAGE_LABELS[stage], color: "var(--text-secondary)" };
  }
}

function buildQuickActionMessage(action: QuickActionType, locale: SiteLocale) {
  const labels =
    locale === "en"
      ? {
          shortlist: "Candidate moved to the screening stage.",
          reject: "Candidate was rejected.",
          hold: "Candidate was moved to the hold queue.",
          triggerScreening: "Screening task has been queued.",
          triggerFitScore: "Fit score calculation has been queued.",
          inviteInterview: "Interview invite sent. The candidate can start now or schedule for later.",
          fallback: "Action completed."
        }
      : {
          shortlist: "Aday ön değerlendirme aşamasına alındı.",
          reject: "Aday reddedildi.",
          hold: "Aday recruiter inceleme bekleyenler listesine alındı.",
          triggerScreening: "Ön eleme görevi kuyruğa alındı.",
          triggerFitScore: "Uyum skoru hesabı kuyruğa alındı.",
          inviteInterview: "Görüşme daveti gönderildi. Aday hemen başlayabilir veya daha sonra planlayabilir.",
          fallback: "İşlem tamamlandı."
        };

  switch (action) {
    case "shortlist":
      return labels.shortlist;
    case "reject":
      return labels.reject;
    case "hold":
      return labels.hold;
    case "trigger_screening":
      return labels.triggerScreening;
    case "trigger_fit_score":
      return labels.triggerFitScore;
    case "invite_interview":
      return labels.inviteInterview;
    default:
      return labels.fallback;
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

function interviewStatusLabel(interview: JobInboxApplicant["interview"]): { text: string; color: string } {
  if (!interview) return { text: "—", color: "var(--text-secondary)" };
  switch (interview.status) {
    case "SCHEDULED": return { text: "📅 Planlandı", color: "var(--primary, #5046e5)" };
    case "RUNNING": return { text: "🔄 Devam Ediyor", color: "var(--warn, #f59e0b)" };
    case "COMPLETED": return { text: "✅ Tamamlandı", color: "var(--success, #22c55e)" };
    case "FAILED": return { text: "❌ Başarısız", color: "var(--danger, #ef4444)" };
    case "NO_SHOW": return { text: "⚠️ Katılmadı", color: "var(--warn, #f59e0b)" };
    case "CANCELLED": return { text: "🚫 İptal", color: "var(--text-secondary)" };
    default: return { text: "—", color: "var(--text-secondary)" };
  }
}

function riskSummary(applicant: JobInboxApplicant): { count: number; tags: string[] } {
  const tags: string[] = [];
  if (!applicant.cvStatus.hasCv) tags.push("CV Yok");
  else if (!applicant.cvStatus.isParsed) tags.push("CV İşlenmedi");
  if (applicant.fitScore) {
    if (applicant.fitScore.missingInfo.length > 0) tags.push(`${applicant.fitScore.missingInfo.length} Eksik Bilgi`);
    if (applicant.fitScore.risks.length > 0) tags.push(`${applicant.fitScore.risks.length} Risk`);
  }
  return { count: tags.length, tags };
}

function nextAction(a: JobInboxApplicant): { label: string; urgency: "high" | "medium" | "low" | "done" } {
  const stage = a.stage as ApplicationStage;
  switch (stage) {
    case "APPLIED":
      return a.screening
        ? { label: "Değerlendir", urgency: "medium" }
        : { label: "Ön Eleme Başlat", urgency: "high" };
    case "SCREENING":
      return { label: "Görüşmeye Davet Et", urgency: "medium" };
    case "INTERVIEW_SCHEDULED":
      if (!a.interview) return { label: "Randevu Bekliyor", urgency: "low" };
      if (a.interview.status === "SCHEDULED") return { label: "Görüşme Bekliyor", urgency: "low" };
      if (a.interview.status === "RUNNING") return { label: "Görüşme Devam", urgency: "low" };
      return { label: "—", urgency: "low" };
    case "INTERVIEW_COMPLETED":
      return { label: "Sonuçları İncele", urgency: "high" };
    case "RECRUITER_REVIEW":
      return { label: "Karar Ver", urgency: "high" };
    case "OFFER":
    case "HIRED":
    case "REJECTED":
      return { label: "Tamamlandı", urgency: "done" };
    default:
      return { label: "—", urgency: "low" };
  }
}

/* ── stage pills ── */

type StagePill = { label: string; value: string; icon?: string };

const STAGE_PILLS: StagePill[] = [
  { label: "Tümü", value: "" },
  { label: "Başvurdu", value: "APPLIED", icon: "📥" },
  { label: "Ön Eleme", value: "SCREENING", icon: "🔍" },
  { label: "Görüşme", value: "INTERVIEW_SCHEDULED", icon: "🎙️" },
  { label: "İnceleme", value: "RECRUITER_REVIEW", icon: "📋" },
  { label: "Teklif / Sonuç", value: "OFFER", icon: "✅" },
];

/* ── pipeline mini chart ── */

function PipelineBar({ stats }: { stats: JobInboxReadModel["stats"] }) {
  const stages: { key: string; label: string; color: string }[] = [
    { key: "APPLIED", label: "Başvuru", color: "var(--text-secondary)" },
    { key: "SCREENING", label: "Ön Eleme", color: "var(--primary, #5046e5)" },
    { key: "INTERVIEW_SCHEDULED", label: "Görüşme", color: "var(--warn, #f59e0b)" },
    { key: "INTERVIEW_COMPLETED", label: "Tamamlandı", color: "var(--success, #22c55e)" },
    { key: "RECRUITER_REVIEW", label: "İnceleme", color: "var(--primary, #5046e5)" },
    { key: "OFFER", label: "Teklif", color: "var(--success, #22c55e)" },
    { key: "HIRED", label: "İşe Alım", color: "var(--success, #22c55e)" },
    { key: "REJECTED", label: "Red", color: "var(--danger, #ef4444)" },
  ];

  const total = stats.totalApplicants || 1;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
        {stages.map((s) => {
          const count = stats.byStage?.[s.key] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${count}`}
              style={{ width: `${pct}%`, minWidth: count > 0 ? 4 : 0, background: s.color, borderRadius: 2 }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6 }}>
        {stages.map((s) => {
          const count = stats.byStage?.[s.key] ?? 0;
          if (count === 0) return null;
          return (
            <span key={s.key} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: s.color, marginRight: 4, verticalAlign: "middle" }} />
              {s.label} {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── urgency badge ── */

function UrgencyBadge({ urgency }: { urgency: "high" | "medium" | "low" | "done" }) {
  const styles = {
    high: { bg: "var(--danger-light, #fef2f2)", color: "var(--danger, #ef4444)" },
    medium: { bg: "var(--warn-light, #fffbeb)", color: "var(--warn-text, #92400e)" },
    low: { bg: "var(--surface-muted, #f3f4f6)", color: "var(--text-secondary)" },
    done: { bg: "var(--success-light, #f0fdf4)", color: "var(--success, #22c55e)" },
  };
  const s = styles[urgency];
  return (
    <span style={{
      display: "inline-block",
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: s.color,
      marginRight: 6,
      verticalAlign: "middle",
    }} />
  );
}

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
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [bulkCvUploadOpen, setBulkCvUploadOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);

  // Bulk selection for interview approval
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number } | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Job info panel toggle
  const [showJobInfo, setShowJobInfo] = useState(false);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.getJobInbox(jobId, {
        stage: stageFilter || undefined,
        source: sourceFilter || undefined,
        minFitScore: minFitScore ? Number(minFitScore) / 100 : undefined,
        sortBy: sortBy || undefined
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [jobId, stageFilter, sourceFilter, minFitScore, sortBy]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  // Client-side search filter
  const filteredApplicants = useMemo(() => {
    const all = data?.applicants ?? [];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter((a) =>
      a.fullName.toLowerCase().includes(q) ||
      (a.email && a.email.toLowerCase().includes(q)) ||
      (a.phone && a.phone.includes(q))
    );
  }, [data?.applicants, searchQuery]);

  const handleQuickAction = async (applicant: JobInboxApplicant, action: QuickActionType) => {
    setActionMessage("");
    setActionError("");
    setActionLoadingId(applicant.applicationId);

    try {
      await apiClient.quickAction(applicant.applicationId, { action });
      setActionMessage(buildQuickActionMessage(action, locale));
      void loadInbox();

      if (action === "trigger_screening" || action === "trigger_fit_score") {
        setTimeout(() => void loadInbox(), 4000);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkImport = async (candidates: BulkImportCandidate[], source: string, externalSource?: string) => {
    await apiClient.bulkImportApplicants(jobId, { candidates, source, externalSource });
    void loadInbox();
  };

  const handleCsvImport = async (candidates: BulkImportCandidate[], source: string) => {
    await apiClient.bulkImportApplicants(jobId, { candidates, source });
    void loadInbox();
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
    setTimeout(() => void loadInbox(), 4000);
    setTimeout(() => void loadInbox(), 10000);
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

  // Counts for urgent items
  const urgentCount = useMemo(() => {
    const all = data?.applicants ?? [];
    return all.filter((a) => nextAction(a).urgency === "high").length;
  }, [data?.applicants]);

  return (
    <div className="page-grid">
      {/* ── Command Center Header ── */}
      <section className="panel">
        <div className="section-head">
          <div>
            <Link href="/jobs" className="text-muted text-sm" style={{ textDecoration: "none" }}>
              ← İlan Merkezi
            </Link>
            {job && (
              <>
                <h2 style={{ marginBottom: 4, marginTop: 8 }}>{job.title}</h2>
                <div className="drawer-meta" style={{ gap: 8 }}>
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
          <div className="row-actions">
            <button type="button" className="ghost-button" onClick={() => void loadInbox()}>Yenile</button>
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
              <p className="kpi-value">{stats.avgFitScore != null ? `%${stats.avgFitScore}` : "—"}</p>
            </article>
            <article className="kpi-card">
              <p className="small" style={{ color: urgentCount > 0 ? "var(--danger, #ef4444)" : undefined }}>
                İşlem Bekliyor
              </p>
              <p className="kpi-value" style={{ color: urgentCount > 0 ? "var(--danger, #ef4444)" : undefined }}>
                {urgentCount}
              </p>
            </article>
          </div>

          {/* ── Pipeline Bar ── */}
          <section className="panel">
            <div className="section-head">
              <strong style={{ fontSize: 14 }}>Aday Akışı</strong>
            </div>
            <PipelineBar stats={stats} />
          </section>

          {/* ── Toolbar: Search + Filters + Actions ── */}
          <section className="panel">
            {/* Stage pills */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              {STAGE_PILLS.map((pill) => {
                const isActive = stageFilter === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => setStageFilter(pill.value)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      cursor: "pointer",
                      border: isActive ? "1px solid var(--primary-border)" : "1px solid var(--border)",
                      background: isActive ? "var(--primary-light)" : "var(--surface)",
                      color: isActive ? "var(--primary)" : "var(--text-secondary)",
                    }}
                  >
                    {pill.icon && <span style={{ marginRight: 4 }}>{pill.icon}</span>}
                    {pill.label}
                    {pill.value && stats.byStage?.[pill.value] != null && (
                      <span style={{ marginLeft: 6, opacity: 0.7 }}>({stats.byStage[pill.value]})</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Search + filter row */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <input
                className="form-input"
                type="text"
                placeholder="Aday ara (ad, e-posta, telefon)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ flex: 1, minWidth: 200, maxWidth: 320, fontSize: 13 }}
              />
              <select className="form-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ fontSize: 13 }}>
                <option value="">Tüm Kaynaklar</option>
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input
                className="form-input"
                type="number"
                placeholder="Min skor"
                min={0}
                max={100}
                value={minFitScore}
                onChange={(e) => setMinFitScore(e.target.value)}
                style={{ width: 90, fontSize: 13 }}
              />
              <select className="form-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ fontSize: 13 }}>
                <option value="">Sıralama</option>
                <option value="fitScore_desc">Skor ↓</option>
                <option value="fitScore_asc">Skor ↑</option>
                <option value="appliedAt_desc">Tarih (Yeni)</option>
                <option value="appliedAt_asc">Tarih (Eski)</option>
              </select>
            </div>

            {/* Action bar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button className="button-link" style={{ fontSize: 13, padding: "6px 16px" }} onClick={() => setBulkCvUploadOpen(true)}>
                {locale === "en" ? "Upload CV" : "CV Yükle"}
              </button>
              <button className="button-link" style={{ fontSize: 13, padding: "6px 16px" }} onClick={() => setBulkImportOpen(true)}>
                Toplu Aday Ekle
              </button>
              <button className="ghost-button" style={{ fontSize: 13, padding: "6px 16px" }} onClick={() => setCsvUploadOpen(true)}>
                CSV Yükle
              </button>
              {selectedIds.size > 0 && (
                <button
                  className="button-link"
                  style={{ fontSize: 13, padding: "6px 16px" }}
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
              <span className="text-xs text-muted" style={{ marginLeft: "auto" }}>
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
          <section className="panel">
            {filteredApplicants.length === 0 ? (
              <EmptyState message={searchQuery ? "Aramayla eşleşen aday bulunamadı." : "Bu ilana henüz aday başvurusu yok."} />
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 32 }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.size === filteredApplicants.length && filteredApplicants.length > 0} onChange={toggleSelectAll} />
                      </th>
                      <th>Aday</th>
                      <th>Kaynak</th>
                      <th>Uyum Skoru</th>
                      <th>Uyarılar</th>
                      <th>Durum</th>
                      <th>Görüşme</th>
                      <th>Sonraki Adım</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplicants.map((a) => {
                      const fit = a.fitScore;
                      const fitPct = fit ? Math.round(fit.overallScore * 100) : null;
                      const band = fitPct != null ? fitBandLabel(fitPct) : null;
                      const risk = riskSummary(a);
                      const action = nextAction(a);
                      const iv = interviewStatusLabel(a.interview);

                      return (
                        <tr
                          key={a.applicationId}
                          className="clickable-row"
                          onClick={() => setSelectedApplicant(a)}
                          style={{
                            borderLeft: action.urgency === "high" ? "3px solid var(--danger, #ef4444)" : undefined,
                          }}
                        >
                          <td onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selectedIds.has(a.applicationId)} onChange={() => toggleSelect(a.applicationId)} />
                          </td>
                          <td>
                            <div>
                              <strong style={{ fontSize: 14 }}>{a.fullName}</strong>
                              {a.locationText && <span className="text-muted text-xs" style={{ marginLeft: 6 }}>{a.locationText}</span>}
                            </div>
                            <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                              {a.email ?? ""}{a.email && a.phone ? " · " : ""}{a.phone ?? ""}
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
                                color: stageTextStyle(a.stage as ApplicationStage, a.recruiterDecision).color,
                                fontWeight: 600
                              }}
                            >
                              {stageTextStyle(a.stage as ApplicationStage, a.recruiterDecision).label}
                            </span>
                          </td>
                          <td>
                            <span className="text-sm" style={{ color: iv.color }}>{iv.text}</span>
                          </td>
                          <td>
                            <span className="text-sm" style={{ whiteSpace: "nowrap" }}>
                              <UrgencyBadge urgency={action.urgency} />
                              {action.label}
                            </span>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <QuickActionMenu
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
      <BulkImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSubmit={handleBulkImport}
      />
      <BulkCvUploadModal
        open={bulkCvUploadOpen}
        onClose={() => setBulkCvUploadOpen(false)}
        onSubmit={handleBulkCvUpload}
      />
      <CsvUploadModal
        open={csvUploadOpen}
        onClose={() => setCsvUploadOpen(false)}
        onSubmit={handleCsvImport}
      />
    </div>
  );
}
