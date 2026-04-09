"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiText } from "../../../components/site-language-provider";
import { JobStatusChip } from "../../../components/stage-chip";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { canPerformAction } from "../../../lib/auth/policy";
import { resolveActiveSession } from "../../../lib/auth/session";
import { apiClient } from "../../../lib/api-client";
import { formatDepartment } from "../../../lib/constants";
import { formatCurrencyTry, formatDate } from "../../../lib/format";
import type { BillingOverviewReadModel, Job, JobStatus } from "../../../lib/types";

type StatusFilter = "" | JobStatus;

export default function JobsPage() {
  const { t, locale } = useUiText();
  const session = useMemo(() => resolveActiveSession(), []);
  const canCreateJob = canPerformAction(session, "job.create");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [billingLoadError, setBillingLoadError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    setBillingLoadError("");

    try {
      const [jobsResult, billingResult] = await Promise.allSettled([
        apiClient.listJobs(),
        apiClient.billingOverview()
      ]);

      if (jobsResult.status === "fulfilled") {
        setJobs(jobsResult.value);
      } else {
        throw jobsResult.reason;
      }

      if (billingResult.status === "fulfilled") {
        setBilling(billingResult.value);
      } else {
        setBilling(null);
        setBillingLoadError(
          billingResult.reason instanceof Error
            ? billingResult.reason.message
            : t("Abonelik kullanımı şu an yüklenemedi.")
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t("İlanlar yüklenemedi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const filteredJobs = useMemo(() => {
    if (!statusFilter) return jobs;
    return jobs.filter((j) => j.status === statusFilter);
  }, [jobs, statusFilter]);

  const stats = useMemo(() => {
    const total = jobs.length;
    const published = jobs.filter((j) => j.status === "PUBLISHED").length;
    const draft = jobs.filter((j) => j.status === "DRAFT").length;
    const archived = jobs.filter((j) => j.status === "ARCHIVED").length;
    const totalApplicants = jobs.reduce((sum, j) => sum + (j._count?.applications ?? 0), 0);
    return { total, published, draft, archived, totalApplicants };
  }, [jobs]);

  const activeJobsQuota = useMemo(
    () => billing?.usage.quotas.find((quota) => quota.key === "ACTIVE_JOBS") ?? null,
    [billing]
  );

  const hasPublishCapacity = activeJobsQuota ? activeJobsQuota.remaining > 0 : true;
  const activeJobsWarning = activeJobsQuota?.warningState === "warning";
  const activeJobsExceeded = activeJobsQuota?.warningState === "exceeded";

  function buildLocationSalary(job: Job): string {
    const parts: string[] = [];
    if (job.locationText) parts.push(job.locationText);
    if (job.salaryMin || job.salaryMax) {
      parts.push(`${formatCurrencyTry(job.salaryMin)} – ${formatCurrencyTry(job.salaryMax)}`);
    }
    return parts.join(" · ") || t("—");
  }

  function formatShiftType(value: string | null): string {
    if (!value) return "";
    const map: Record<string, string> = {
      tam_zamanli: "Tam Zamanlı",
      yari_zamanli: "Yarı Zamanlı",
      vardiyali: "Vardiyalı",
      hibrit: "Hibrit",
      full_time: "Tam Zamanlı",
    };
    return map[value] ?? value;
  }

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{t("İlan Merkezi")}</h1>
          <p className="small" style={{ margin: 0 }}>
            {t("İlan oluşturma, aday yönetimi ve işe alım süreçlerinizin merkezi.")}
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadJobs()}>
            {t("Yenile")}
          </button>
          {canCreateJob ? (
            <Link href="/jobs/new" className="button-link">
              {hasPublishCapacity ? t("Yeni İlan Hazırla") : t("Yeni İlan Taslağı Hazırla")}
            </Link>
          ) : null}
        </div>
      </div>

      {!loading && activeJobsQuota ? (
        <section
          className="panel"
          style={{
            borderColor:
              activeJobsExceeded
                ? "rgba(239,68,68,0.35)"
                : activeJobsWarning
                  ? "rgba(245,158,11,0.35)"
                  : "var(--border)"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{t("Aktif ilan kotası")}</div>
              <p className="small" style={{ margin: "6px 0 0" }}>
                {locale === "en"
                  ? `You are using ${activeJobsQuota.used} / ${activeJobsQuota.limit} active jobs this period.`
                  : `Bu dönem ${activeJobsQuota.used} / ${activeJobsQuota.limit} aktif ilan kullanıyorsunuz.`}
                {hasPublishCapacity
                  ? t(" Yeni ilan hazırlayabilir ve uygun olduğunda yayına alabilirsiniz.")
                  : t(" Yeni ilanı taslak olarak hazırlayabilirsiniz; yeniden yayına almak veya yayınlamak için önce slot açmanız ya da paketinizi yükseltmeniz gerekir.")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background:
                    activeJobsExceeded
                      ? "rgba(239,68,68,0.12)"
                      : activeJobsWarning
                        ? "rgba(245,158,11,0.12)"
                        : "rgba(34,197,94,0.12)",
                  color:
                    activeJobsExceeded
                      ? "var(--danger, #ef4444)"
                      : activeJobsWarning
                        ? "var(--warn, #f59e0b)"
                        : "var(--success, #22c55e)",
                  fontSize: 12,
                  fontWeight: 700
                }}
              >
                {activeJobsExceeded
                  ? t("Limit doldu")
                  : activeJobsWarning
                    ? t("Limit yaklaşıyor")
                    : t("Sağlıklı")}
              </span>
              <Link href={"/subscription" as Route} className="ghost-button" style={{ textDecoration: "none" }}>
                {t("Aboneliği Gör")}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {!loading && billingLoadError ? (
        <section className="panel">
          <ErrorState title={t("Abonelik görünürlüğü")} error={billingLoadError} />
        </section>
      ) : null}

      {/* Status filter pills with counts */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([
            { label: `${t("Tümü")} (${stats.total})`, value: "" as StatusFilter },
            { label: `${t("Yayında")} (${stats.published})`, value: "PUBLISHED" as StatusFilter },
            { label: `${t("Taslak")} (${stats.draft})`, value: "DRAFT" as StatusFilter },
            { label: `${t("Arşiv")} (${stats.archived})`, value: "ARCHIVED" as StatusFilter },
          ]).map((pill) => {
            const isActive = statusFilter === pill.value;
            return (
              <button
                key={pill.value}
                type="button"
                style={{
                  cursor: "pointer",
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  border: isActive ? "1px solid var(--primary-border)" : "1px solid var(--border)",
                  background: isActive ? "var(--primary-light)" : "var(--surface)",
                  color: isActive ? "var(--primary)" : "var(--text-secondary)",
                  borderRadius: 20,
                  fontFamily: "inherit",
                }}
                onClick={() => setStatusFilter(pill.value)}
              >
                {t(pill.label)}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <section className="panel">
          <LoadingState message={t("İlanlar yükleniyor...")} />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadJobs()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !error && filteredJobs.length === 0 ? (
        <section className="panel">
          <EmptyState message={t("Bu filtreye uygun ilan bulunamadı.")} />
        </section>
      ) : null}

      {!loading && !error && filteredJobs.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 14,
        }}>
          {filteredJobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${job.id}` as any}
              style={{
                textDecoration: "none",
                color: "inherit",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 20,
                display: "block",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)";
                e.currentTarget.style.background = "var(--surface-hover, #1f222d)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.background = "var(--surface)";
              }}
            >
              {/* Header: title + status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{job.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                    {t(formatDepartment(job.roleFamily))}
                  </div>
                </div>
                <JobStatusChip status={job.status} />
              </div>

              {/* Line 1: location + salary */}
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                {buildLocationSalary(job)}
              </div>

              {/* Line 2: shift/work type */}
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 14, minHeight: 16 }}>
                    {t(formatShiftType(job.shiftType)) || "\u00A0"}
                  </div>

              {/* Footer: application count + date */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: 12,
                borderTop: "1px solid var(--border)",
              }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  <strong style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginRight: 2 }}>
                    {job._count?.applications ?? 0}
                  </strong>
                  {" "}
                  {t("başvuru")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {formatDate(job.createdAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
