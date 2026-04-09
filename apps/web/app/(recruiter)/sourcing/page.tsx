"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import {
  PROSPECT_FIT_LABELS,
  SUPPRESSION_LABELS,
  TALENT_SOURCE_LABELS
} from "../../../lib/constants";
import { formatDate } from "../../../lib/format";
import { sourcingProjectDetailHref, withApiBaseOverride } from "../../../lib/entity-routes";
import type { Job, SourcingOverviewReadModel } from "../../../lib/types";

export default function SourcingPage() {
  const { t } = useUiText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [overview, setOverview] = useState<SourcingOverviewReadModel | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [accessNotice, setAccessNotice] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    setAccessNotice("");

    try {
      const [overviewPayload, jobRows] = await Promise.all([
        apiClient.getSourcingOverview(),
        apiClient.listJobs()
      ]);

      setOverview(overviewPayload);
      setJobs(jobRows.filter((job) => job.status !== "ARCHIVED"));
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : t("Sourcing ekranı yüklenemedi.");
      if (message.includes("beta erişiminde") || message.includes("iç yönetim ekibi")) {
        setAccessNotice(
          "Sourcing modülü şu anda kontrollü beta erişiminde. İç yönetim ekibi dışında görünüm paylaşılmıyor."
        );
        setOverview(null);
        setJobs([]);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const activeJobs = useMemo(
    () => jobs.filter((job) => job.status !== "ARCHIVED"),
    [jobs]
  );

  async function handleCreateProject() {
    if (!selectedJobId) {
      return;
    }

    setCreating(true);
    try {
      const result = await apiClient.createSourcingProject({
        jobId: selectedJobId
      });
      router.push(withApiBaseOverride(sourcingProjectDetailHref(result.projectId), searchParams));
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : t("Sourcing projesi açılamadı."));
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Sourcing</h1>
          <p className="small" style={{ margin: 0 }}>
            {t("Requisition bağlantılı talent discovery, rediscovery ve outreach foundation.")}
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadPage()}>
            {t("Yenile")}
          </button>
        </div>
      </div>

      {loading ? (
        <section className="panel">
          <LoadingState message={t("Sourcing görünümü hazırlanıyor...")} />
        </section>
      ) : null}

      {!loading && accessNotice ? (
        <section className="panel" style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              padding: "14px 16px",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              borderRadius: 10
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: 16 }}>{t("Beta erişim gerekli")}</h2>
            <p className="small" style={{ margin: 0 }}>
              {t(accessNotice)}
            </p>
          </div>
        </section>
      ) : null}

      {!loading && !accessNotice && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadPage()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !accessNotice && !error && overview ? (
        <>
          {/* ── Compact summary strip ── */}
          <div className="sourcing-summary-grid">
            <SummaryCard label={t("Aktif Proje")} value={overview.summary.activeProjects} helper={t("Requisition bağlantılı sourcing akışları")} />
            <SummaryCard label={t("Toplam Prospect")} value={overview.summary.totalProspects} helper={t("Keşfedilen ve projelere bağlanan profiller")} />
            <SummaryCard label={t("Rediscovery")} value={overview.summary.rediscoveredCandidates} helper={t("İç havuz eşleşmeleri")} />
            <SummaryCard label={t("DNC / Opt-out")} value={overview.summary.doNotContactCount} helper={t("Engelli profiller")} tone="warn" />
          </div>

          {/* ── Project grid with create card ── */}
          <section className="panel">
            <div className="section-head">
              <div>
                <h2>{t("Sourcing Projeleri")}</h2>
                <p className="small" style={{ marginTop: 0 }}>
                  Funnel, source mix ve recruiter aksiyonlarını tek yerden yönetin.
                </p>
              </div>
            </div>

            <div className="sourcing-project-grid">
              {/* Create new project card */}
              <div className="sourcing-project-card" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 14, minHeight: 180, border: "2px dashed var(--border)" }}>
                <div style={{ fontSize: 28, color: "var(--text-dim)" }}>+</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{t("Yeni Proje Aç")}</div>
                  <select
                    className="select"
                    value={selectedJobId}
                    onChange={(event) => setSelectedJobId(event.target.value)}
                    style={{ marginBottom: 8 }}
                  >
                    <option value="">{t("İlan seçin")}</option>
                    {activeJobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title} · {job.locationText ?? t("Esnek")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button-link"
                    disabled={!selectedJobId || creating}
                    onClick={() => void handleCreateProject()}
                    style={{ width: "100%" }}
                  >
                    {creating ? t("Hazırlanıyor...") : t("Projeyi Aç")}
                  </button>
                </div>
              </div>

              {overview.projects.map((project) => (
                <Link
                  key={project.id}
                  href={withApiBaseOverride(sourcingProjectDetailHref(project.id), searchParams)}
                  className="sourcing-project-card"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div className="small" style={{ marginBottom: 4 }}>
                        {project.job?.title ?? t("Bağlı requisition yok")}
                      </div>
                      <h3 style={{ margin: 0, fontSize: 17 }}>{project.name}</h3>
                    </div>
                    <span className="badge info">{project.status}</span>
                  </div>

                  <p className="small" style={{ margin: "10px 0 12px" }}>
                    {project.personaSummary ?? t("Persona özeti henüz yazılmadı.")}
                  </p>

                  {/* Inline pipeline funnel */}
                  <div style={{ display: "flex", alignItems: "center", gap: 0, fontSize: 12 }}>
                    <MetricPill label={t("İnceleme")} value={project.metrics.needsReview} />
                    <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>→</span>
                    <MetricPill label={t("İyi Uyum")} value={project.metrics.goodFit} tone="success" />
                    <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>→</span>
                    <MetricPill label={t("Temas")} value={project.metrics.contacted} tone="info" />
                    <span style={{ color: "var(--text-dim)", margin: "0 4px" }}>→</span>
                    <MetricPill label={t("Yanıt")} value={project.metrics.replied} tone="accent" />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }} className="small">
                    <span>
                      {project.metrics.total} prospect · fit {project.metrics.avgFitScore ?? "—"}
                    </span>
                    <span>{formatDate(project.updatedAt)}</span>
                  </div>
                </Link>
              ))}

              {overview.projects.length === 0 ? (
                <EmptyState message={t("Henüz sourcing projesi yok. İlan seçerek başlayın.")} />
              ) : null}
            </div>
          </section>

          {/* ── Two-column: Talent Pool + Saved Prospects ── */}
          <div className="sourcing-home-grid">
            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>{t("Talent Pool")}</h2>
                  <p className="small" style={{ marginTop: 0 }}>Kaynaklar ve profiller</p>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {Object.entries(overview.talentPool.bySource).map(([key, count]) => (
                  <span key={key} className="sourcing-chip">
                    {TALENT_SOURCE_LABELS[key as keyof typeof TALENT_SOURCE_LABELS] ?? key}: {count}
                  </span>
                ))}
                {Object.entries(overview.talentPool.bySuppression).map(([key, count]) => (
                  <span key={key} className="sourcing-chip muted">
                    {SUPPRESSION_LABELS[key as keyof typeof SUPPRESSION_LABELS] ?? key}: {count}
                  </span>
                ))}
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {overview.talentPool.recentProfiles.map((profile) => (
                  <div key={profile.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.fullName}</div>
                      <div className="small" style={{ marginTop: 2 }}>
                        {profile.currentTitle ?? profile.headline ?? "—"}
                      </div>
                    </div>
                    <div className="small" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div>{TALENT_SOURCE_LABELS[profile.sourceKind]}</div>
                      <div>{profile.locationText ?? "—"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="section-head">
                <div>
                  <h2>{t("Kaydedilen Prospect'ler")}</h2>
                  <p className="small" style={{ marginTop: 0 }}>Güçlü veya beklemeye alınmış profiller</p>
                </div>
              </div>

              {overview.savedProspects.length === 0 ? (
                <EmptyState message={t("Henüz kaydedilmiş prospect yok.")} />
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {overview.savedProspects.map((prospect) => (
                    <Link
                      key={prospect.id}
                      href={withApiBaseOverride(sourcingProjectDetailHref(prospect.projectId), searchParams)}
                      className="sourcing-saved-row"
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{prospect.fullName}</div>
                        <div className="small" style={{ marginTop: 2 }}>
                          {prospect.currentTitle ?? prospect.headline ?? "—"} · {prospect.projectName}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--primary)" }}>
                          {PROSPECT_FIT_LABELS[prospect.fitLabel]}
                        </div>
                        <div className="small">{prospect.fitScore ?? "—"}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  tone
}: {
  label: string;
  value: number;
  helper: string;
  tone?: "warn";
}) {
  return (
    <article className="panel" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
        <div className="small" style={{ marginTop: 2, fontSize: 11 }}>{helper}</div>
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: tone === "warn" ? "var(--warn)" : "var(--text)"
        }}
      >
        {value}
      </div>
    </article>
  );
}

function MetricPill({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone?: "success" | "info" | "accent";
}) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "info"
        ? "var(--info)"
        : tone === "accent"
          ? "var(--primary)"
          : "var(--text-secondary)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span className="small" style={{ fontSize: 11 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color }}>{value}</span>
    </div>
  );
}
