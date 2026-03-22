"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JobStatusChip } from "../../../components/stage-chip";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { canPerformAction } from "../../../lib/auth/policy";
import { resolveActiveSession } from "../../../lib/auth/session";
import { apiClient } from "../../../lib/api-client";
import { formatDepartment } from "../../../lib/constants";
import { formatCurrencyTry, formatDate } from "../../../lib/format";
import type { Job, JobStatus } from "../../../lib/types";

type StatusFilter = "" | JobStatus;

export default function JobsPage() {
  const session = useMemo(() => resolveActiveSession(), []);
  const canCreateJob = canPerformAction(session, "job.create");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const rows = await apiClient.listJobs();
      setJobs(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "İlanlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

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

  function buildMetaLine(job: Job): string {
    const parts: string[] = [];
    if (job.locationText) parts.push(job.locationText);
    if (job.salaryMin || job.salaryMax) {
      parts.push(`${formatCurrencyTry(job.salaryMin)} – ${formatCurrencyTry(job.salaryMax)}`);
    }
    if (job.workModel) parts.push(job.workModel);
    return parts.join(" · ") || "—";
  }

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>İlan Merkezi</h1>
          <p className="small" style={{ margin: 0 }}>
            İlan oluşturma, aday yönetimi ve işe alım süreçlerinizin merkezi.
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadJobs()}>
            Yenile
          </button>
          {canCreateJob ? (
            <Link href="/jobs/new" className="button-link">
              Yeni İlan Hazırla
            </Link>
          ) : null}
        </div>
      </div>

      {/* Status filter pills with counts */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([
            { label: `Tümü (${stats.total})`, value: "" as StatusFilter },
            { label: `Yayında (${stats.published})`, value: "PUBLISHED" as StatusFilter },
            { label: `Taslak (${stats.draft})`, value: "DRAFT" as StatusFilter },
            { label: `Arşiv (${stats.archived})`, value: "ARCHIVED" as StatusFilter },
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
                {pill.label}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <section className="panel">
          <LoadingState message="İlanlar yükleniyor..." />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadJobs()}>
                Tekrar dene
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !error && filteredJobs.length === 0 ? (
        <section className="panel">
          <EmptyState message="Bu filtreye uygun ilan bulunamadı." />
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
                    {formatDepartment(job.roleFamily)}
                  </div>
                </div>
                <JobStatusChip status={job.status} />
              </div>

              {/* Meta line */}
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
                {buildMetaLine(job)}
              </div>

              {/* Footer */}
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
                  başvuru
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
