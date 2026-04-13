"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import {
  getRecruiterStageMeta,
  getRecruiterStatus,
  RECRUITER_STATUS_FILTERS
} from "../../../lib/constants";
import {
  applicationDetailHref,
  candidateDetailHref
} from "../../../lib/entity-routes";
import { formatDate } from "../../../lib/format";
import type {
  Candidate,
  Job,
  RecruiterApplicationsReadModel
} from "../../../lib/types";

type AppItem = RecruiterApplicationsReadModel["items"][number];

export default function CandidatesPage() {
  const { t } = useUiText();
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [applications, setApplications] = useState<AppItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    setWarning("");
    try {
      const [candidateResult, applicationResult, jobResult] = await Promise.allSettled([
        apiClient.listCandidates(),
        apiClient.recruiterApplicationsReadModel({}),
        apiClient.listJobs()
      ]);

      const nextWarnings: string[] = [];

      if (candidateResult.status === "fulfilled") {
        setCandidates(candidateResult.value);
      } else {
        setCandidates([]);
        nextWarnings.push(
          t("Merkezi aday listesi şu an tam yüklenemedi. Başvurusu olmayan adaylar görünmeyebilir.")
        );
      }

      if (applicationResult.status === "fulfilled") {
        setApplications(applicationResult.value.items);
      } else {
        setApplications([]);
        nextWarnings.push(
          t("Başvuru kuyruğu şu an yüklenemedi. Ekran yalnızca erişilebilen aday verisini gösteriyor olabilir.")
        );
      }

      if (jobResult.status === "fulfilled") {
        setJobs(jobResult.value);
      } else {
        setJobs([]);
        nextWarnings.push(
          t("İlan filtresi şu an yüklenemedi. Filtre seçenekleri kısıtlı olabilir.")
        );
      }

      if (candidateResult.status === "rejected" && applicationResult.status === "rejected") {
        throw candidateResult.reason instanceof Error
          ? candidateResult.reason
          : applicationResult.reason;
      }

      setWarning(nextWarnings.join(" "));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Veriler yüklenemedi."));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Build unified rows: one row per application, plus candidates without applications
  const rows = useMemo(() => {
    const q = query.toLowerCase().trim();

    // Application rows
    const appRows = applications
      .filter((app) => {
        if (q) {
          const name = app.candidate.fullName.toLowerCase();
          const email = (app.candidate.email ?? "").toLowerCase();
          if (!name.includes(q) && !email.includes(q)) return false;
        }
        if (stageFilter) {
          const status = getRecruiterStatus(app.stage, app.humanDecision);
          if (status !== stageFilter) return false;
        }
        if (jobFilter && app.job.id !== jobFilter) return false;
        return true;
      })
      .map((app) => {
        const cand = candidates.find((c) => c.id === app.candidate.id);
        return {
          type: "application" as const,
          candidateId: app.candidate.id,
          candidateName: app.candidate.fullName,
          email: app.candidate.email,
          phone: cand?.phone ?? null,
          source: cand?.source ?? null,
          applicationId: app.id,
          jobTitle: app.job.title,
          jobId: app.job.id,
          stage: app.stage,
          humanDecision: app.humanDecision,
          stageUpdatedAt: app.stageUpdatedAt,
          createdAt: app.createdAt,
        };
      });

    // Candidates without any application
    const candidateIdsWithApp = new Set(applications.map((a) => a.candidate.id));
    const orphanRows = candidates
      .filter((c) => !candidateIdsWithApp.has(c.id))
      .filter((c) => {
        if (q) {
          const name = c.fullName.toLowerCase();
          const email = (c.email ?? "").toLowerCase();
          const phone = (c.phone ?? "").toLowerCase();
          if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false;
        }
        if (stageFilter || jobFilter) return false; // stage/job filter excludes orphans
        return true;
      })
      .map((c) => ({
        type: "orphan" as const,
        candidateId: c.id,
        candidateName: c.fullName,
        email: c.email,
        phone: c.phone,
        source: c.source,
        applicationId: null,
        jobTitle: null,
        jobId: null,
        stage: null,
        humanDecision: null,
        stageUpdatedAt: null,
        createdAt: c.createdAt,
      }));

    // Filter by source (applies to both)
    const all = [...appRows, ...orphanRows].filter((r) => {
      if (sourceFilter && r.source !== sourceFilter) return false;
      return true;
    });

    // Sort: applications by stageUpdatedAt desc, orphans at bottom
    return all.sort((a, b) => {
      if (a.type === "orphan" && b.type !== "orphan") return 1;
      if (a.type !== "orphan" && b.type === "orphan") return -1;
      const dateA = a.stageUpdatedAt ?? a.createdAt;
      const dateB = b.stageUpdatedAt ?? b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [candidates, applications, query, stageFilter, jobFilter, sourceFilter]);

  // Unique sources for filter
  const sources = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => { if (c.source) set.add(c.source); });
    return Array.from(set).sort();
  }, [candidates]);

  function sourceLabel(raw: string): string {
    const map: Record<string, string> = {
      kariyer_net: "Kariyer.net",
      eleman_net: "Eleman.net",
      csv_import: "CSV Aktarım",
      manual: "Manuel Giriş",
      referral: "Referans",
      walk_in: "Doğrudan Başvuru",
      phone: "Telefon",
      email: "E-posta",
      agency: "Ajans",
      kariyer_portali: "Kariyer Portalı",
    };
    return map[raw] ?? raw;
  }

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <PageTitleWithGuide
            guideKey="candidates"
            title={t("Adaylar")}
            style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}
          />
          <p className="small" style={{ margin: 0 }}>
            {t("Tüm adaylar ve başvuruları tek ekranda.")}
          </p>
        </div>
        <div className="row-actions">
          <button type="button" className="ghost-button" onClick={() => void loadData()}>
            {t("Yenile")}
          </button>
          <Link href="/candidates/new" className="button-link">
            {t("Yeni Aday Ekle")}
          </Link>
        </div>
      </div>

      {/* Search + Filters */}
      <section className="panel" style={{ padding: "12px 16px" }}>
        <form onSubmit={(e) => { e.preventDefault(); }}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Aday adı, e-posta veya telefon...")}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <select
              className="select"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">{t("Tüm Durumlar")}</option>
              {RECRUITER_STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>{t(s.label)}</option>
              ))}
            </select>
            <select
              className="select"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
            >
              <option value="">{t("Tüm İlanlar")}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
            <select
              className="select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="">{t("Tüm Kaynaklar")}</option>
              {sources.map((s) => (
                <option key={s} value={s}>{t(sourceLabel(s))}</option>
              ))}
            </select>
          </div>
        </form>
      </section>

      {/* Results */}
      {loading && <LoadingState message={t("Adaylar yükleniyor...")} />}
      {!loading && error && (
        <ErrorState error={error} actions={<button className="ghost-button" onClick={() => void loadData()}>{t("Tekrar dene")}</button>} />
      )}
      {!loading && !error && warning && (
        <section
          className="panel"
          style={{
            padding: "12px 16px",
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.2)"
          }}
        >
          <p className="small" style={{ margin: 0, color: "var(--warn, #f59e0b)" }}>
            {warning}
          </p>
        </section>
      )}
      {!loading && !error && rows.length === 0 && (
        <EmptyState message={t("Filtreye uygun sonuç bulunamadı.")} />
      )}

      {!loading && !error && rows.length > 0 && (
        <section className="panel" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.3px" }}>{t("Aday")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.3px" }}>{t("İlan")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.3px" }}>{t("Kaynak")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.3px" }}>{t("Durum")}</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, textTransform: "uppercase", fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.3px" }}>{t("Tarih")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const stageMeta = row.stage
                  ? getRecruiterStageMeta(row.stage, row.humanDecision)
                  : null;
                const linkHref = row.applicationId
                  ? applicationDetailHref(row.applicationId)
                  : candidateDetailHref(row.candidateId);

                return (
                  <tr
                    key={row.applicationId ?? row.candidateId}
                    style={{ borderBottom: "1px solid var(--surface, #1e1e26)", transition: "background 0.1s", cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    onClick={() => { router.push(linkHref as Route); }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={linkHref as Route} style={{ fontSize: 13, fontWeight: 600, color: "var(--primary, #7c73fa)", textDecoration: "none" }}>
                        {row.candidateName}
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                        {row.email ?? ""}
                      </div>
                    </td>
                    <td style={{ padding: "12px 12px", color: "var(--text-secondary)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.jobTitle ? (
                        <Link href={`/jobs/${row.jobId}` as Route} style={{ color: "var(--text-secondary)", textDecoration: "none" }}>
                          {row.jobTitle}
                        </Link>
                      ) : (
                        <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 12px", fontSize: 12, color: "var(--text-dim)" }}>
                      {row.source ? t(sourceLabel(row.source)) : "—"}
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      {stageMeta ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: stageMeta.color, whiteSpace: "nowrap" }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageMeta.color, flexShrink: 0 }} />
                          {t(stageMeta.label)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap", textAlign: "right" }}>
                      {formatDate(row.stageUpdatedAt ?? row.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text-dim)" }}>
            {t(`${rows.length} sonuç`)}
          </div>
        </section>
      )}
    </section>
  );
}
