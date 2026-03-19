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

      {/* KPI bar */}
      {!loading && !error && (
        <div className="inbox-stats">
          <div className="inbox-stat">
            <span className="inbox-stat-value">{stats.total}</span>
            <span className="inbox-stat-label">Toplam İlan</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value">{stats.published}</span>
            <span className="inbox-stat-label">Yayında</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value">{stats.draft}</span>
            <span className="inbox-stat-label">Taslak</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value">{stats.archived}</span>
            <span className="inbox-stat-label">Arşiv</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value">{stats.totalApplicants}</span>
            <span className="inbox-stat-label">Toplam Başvuru</span>
          </div>
        </div>
      )}

      {/* Status filter pills */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {([
            { label: "Tümü", value: "" as StatusFilter },
            { label: "Yayında", value: "PUBLISHED" as StatusFilter },
            { label: "Taslak", value: "DRAFT" as StatusFilter },
            { label: "Arşiv", value: "ARCHIVED" as StatusFilter },
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
        <section className="panel">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>İlan Başlığı</th>
                  <th>Departman</th>
                  <th>Durum</th>
                  <th>Lokasyon</th>
                  <th>Maaş Aralığı</th>
                  <th>Başvuru</th>
                  <th>Oluşturulma</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Link href={`/jobs/${job.id}` as any} style={{ textDecoration: "none", color: "inherit" }}>
                        <strong style={{ color: "var(--primary)" }}>{job.title}</strong>
                      </Link>
                    </td>
                    <td>{formatDepartment(job.roleFamily)}</td>
                    <td>
                      <JobStatusChip status={job.status} />
                    </td>
                    <td>{job.locationText ?? "-"}</td>
                    <td>
                      {job.salaryMin || job.salaryMax
                        ? `${formatCurrencyTry(job.salaryMin)} - ${formatCurrencyTry(job.salaryMax)}`
                        : "-"}
                    </td>
                    <td>
                      <strong>{job._count?.applications ?? 0}</strong>
                    </td>
                    <td>{formatDate(job.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
