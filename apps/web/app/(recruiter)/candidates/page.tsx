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

type CandidateRow = {
  type: "application" | "orphan";
  candidateId: string;
  candidateName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  applicationId: string | null;
  jobTitle: string | null;
  jobId: string | null;
  stage: AppItem["stage"] | null;
  humanDecision: AppItem["humanDecision"] | null;
  score: number | null;
  recommendation: AppItem["aiRecommendation"] | null;
  followUpLabel: string;
  stageUpdatedAt: string | null;
  createdAt: string;
};

const CANDIDATE_KANBAN_STAGES: AppItem["stage"][] = [
  "APPLIED",
  "SCREENING",
  "RECRUITER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "TALENT_POOL",
  "SHORTLISTED",
  "OFFER",
  "HIRED",
  "REJECTED"
];

function sourceLabel(raw: string | null | undefined): string {
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

  if (!raw) {
    return "Kaynak yok";
  }

  return map[raw] ?? raw;
}

function resolveConfidenceScore(application: AppItem): number | null {
  const raw = application.ai.reportConfidence ?? application.ai.latestRecommendation?.confidence ?? null;

  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const numeric = Number(raw);

  if (Number.isNaN(numeric)) {
    return null;
  }

  const normalized = numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function recommendationLabel(recommendation: string | null | undefined): string {
  switch (recommendation) {
    case "ADVANCE":
      return "İlerle";
    case "HOLD":
      return "Beklet";
    case "REVIEW":
      return "İncele";
    default:
      return "-";
  }
}

function resolveFollowUpLabel(
  stage: AppItem["stage"] | null,
  score: number | null,
  recommendation: string | null | undefined
): string {
  if (stage === "HIRED" || stage === "REJECTED") {
    return "-";
  }

  if (recommendation === "ADVANCE" || (score !== null && score >= 75)) {
    return "Öncelikli";
  }

  if (recommendation === "HOLD") {
    return "Havuzda tut";
  }

  if (score !== null) {
    return "İncele";
  }

  return "Takip";
}

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
  const [sortMode, setSortMode] = useState<"updated" | "score" | "name">("updated");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

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
    const appRows: CandidateRow[] = applications
      .filter((app) => {
        if (q) {
          const name = app.candidate.fullName.toLowerCase();
          const email = (app.candidate.email ?? "").toLowerCase();
          if (!name.includes(q) && !email.includes(q)) return false;
        }
        if (stageFilter) {
          if (app.stage !== stageFilter) return false;
        }
        if (jobFilter && app.job.id !== jobFilter) return false;
        return true;
      })
      .map((app) => {
        const cand = candidates.find((c) => c.id === app.candidate.id);
        const score = resolveConfidenceScore(app);
        const recommendation = app.ai.latestRecommendation?.recommendation ?? app.aiRecommendation;

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
          score,
          recommendation,
          followUpLabel: resolveFollowUpLabel(app.stage, score, recommendation),
          stageUpdatedAt: app.stageUpdatedAt,
          createdAt: app.createdAt,
        };
      });

    // Candidates without any application
    const candidateIdsWithApp = new Set(applications.map((a) => a.candidate.id));
    const orphanRows: CandidateRow[] = candidates
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
        score: null,
        recommendation: null,
        followUpLabel: "Profil",
        stageUpdatedAt: null,
        createdAt: c.createdAt,
      }));

    // Filter by source (applies to both)
    const all = [...appRows, ...orphanRows].filter((r) => {
      if (sourceFilter && r.source !== sourceFilter) return false;
      return true;
    });

    // Sort: applications by selected manager view, orphans after application rows by default.
    return all.sort((a, b) => {
      if (sortMode === "score") {
        const scoreDelta = (b.score ?? -1) - (a.score ?? -1);
        if (scoreDelta !== 0) return scoreDelta;
      }

      if (sortMode === "name") {
        return a.candidateName.localeCompare(b.candidateName, "tr");
      }

      if (a.type === "orphan" && b.type !== "orphan") return 1;
      if (a.type !== "orphan" && b.type === "orphan") return -1;

      const dateA = a.stageUpdatedAt ?? a.createdAt;
      const dateB = b.stageUpdatedAt ?? b.createdAt;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [candidates, applications, query, stageFilter, jobFilter, sourceFilter, sortMode]);

  // Unique sources for filter
  const sources = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => { if (c.source) set.add(c.source); });
    return Array.from(set).sort();
  }, [candidates]);

  const kanbanColumns = useMemo(() => {
    const stageColumns = CANDIDATE_KANBAN_STAGES
      .map((stage) => {
        const meta = getRecruiterStageMeta(stage);
        return {
          key: stage,
          label: meta.label,
          color: meta.color,
          rows: rows.filter((row) => row.stage === stage)
        };
      })
      .filter((column) => column.rows.length > 0);

    const profileRows = rows.filter((row) => row.stage === null);

    if (profileRows.length > 0) {
      stageColumns.push({
        key: "PROFILE" as AppItem["stage"],
        label: "Profil",
        color: "var(--text-dim)",
        rows: profileRows
      });
    }

    return stageColumns;
  }, [rows]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <PageTitleWithGuide
            guideKey="candidates"
            title={t("Adaylar")}
            subtitle={t("Tüm adaylar ve başvuruları tek ekranda.")}
            subtitleClassName="small"
            style={{ margin: 0, fontSize: 22, fontWeight: 700 }}
          />
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 8
            }}
          >
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
            <select
              className="select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as "updated" | "score" | "name")}
            >
              <option value="updated">{t("En güncel süreç")}</option>
              <option value="score">{t("En yüksek AI güveni")}</option>
              <option value="name">{t("Aday adına göre")}</option>
            </select>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginTop: 10,
              flexWrap: "wrap"
            }}
          >
            <span className="small" style={{ color: "var(--text-dim)" }}>
              {t(`${rows.length} aday görünür`)}
            </span>
            <div style={{ display: "inline-flex", gap: 6 }}>
              {([
                { key: "list", label: "Liste" },
                { key: "kanban", label: "Kanban" }
              ] as const).map((item) => {
                const active = viewMode === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className="ghost-button"
                    onClick={() => setViewMode(item.key)}
                    style={{
                      fontSize: 12,
                      borderColor: active ? "var(--primary-border)" : "var(--border)",
                      background: active ? "var(--primary-muted)" : undefined,
                      color: active ? "var(--primary)" : undefined
                    }}
                  >
                    {t(item.label)}
                  </button>
                );
              })}
            </div>
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
        <EmptyState
          message={
            !query && !stageFilter && !jobFilter && !sourceFilter
              ? t("Henüz aday yok. İlk adayı ekleyip başvuru akışını buradan takip edebilirsiniz.")
              : t("Filtreye uygun sonuç bulunamadı.")
          }
          actions={
            !query && !stageFilter && !jobFilter && !sourceFilter ? (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href="/candidates/new" className="button-link">
                  {t("İlk Adayı Ekle")}
                </Link>
                <Link href="/jobs" className="ghost-button" style={{ textDecoration: "none" }}>
                  {t("İlk İlanı Kontrol Et")}
                </Link>
              </div>
            ) : undefined
          }
        />
      )}

      {!loading && !error && rows.length > 0 && viewMode === "kanban" && (
        <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              overflowX: "auto",
              padding: 16,
              alignItems: "stretch"
            }}
          >
            {kanbanColumns.map((column) => (
              <div
                key={column.key}
                style={{
                  minWidth: 260,
                  maxWidth: 300,
                  flex: "0 0 280px",
                  display: "grid",
                  gridTemplateRows: "auto 1fr",
                  gap: 10
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--surface-muted)"
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: column.color, flexShrink: 0 }} />
                    <strong style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t(column.label)}
                    </strong>
                  </span>
                  <strong style={{ fontSize: 12, color: "var(--text-secondary)" }}>{column.rows.length}</strong>
                </div>
                <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
                  {column.rows.map((row) => (
                    <KanbanCandidateCard key={row.applicationId ?? row.candidateId} row={row} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && rows.length > 0 && viewMode === "list" && (
        <section className="panel" style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("Aday")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("İlan")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("Kaynak")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("Durum")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("AI Güven")}</th>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("Takip")}</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("Tarih")}</th>
                <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "var(--text-dim)", letterSpacing: "0.01em" }}>{t("Profil")}</th>
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
                      <Link href={linkHref as Route} className="candidate-directory-link">
                        {row.candidateName}
                      </Link>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                        {row.email ?? row.phone ?? ""}
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
                    <td style={{ padding: "12px 12px" }}>
                      <ScoreBadge score={row.score} />
                    </td>
                    <td style={{ padding: "12px 12px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {row.followUpLabel}
                        {row.recommendation ? (
                          <span style={{ color: "var(--text-dim)" }}>· {t(recommendationLabel(row.recommendation))}</span>
                        ) : null}
                      </span>
                    </td>
                    <td style={{ padding: "12px 12px", fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap", textAlign: "right" }}>
                      {formatDate(row.stageUpdatedAt ?? row.createdAt)}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <Link
                        href={linkHref as Route}
                        className="ghost-button"
                        onClick={(event) => event.stopPropagation()}
                        style={{ fontSize: 12, padding: "4px 9px", textDecoration: "none" }}
                      >
                        {t("Aç")}
                      </Link>
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

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span style={{ fontSize: 12, color: "var(--text-dim)" }}>-</span>;
  }

  const color =
    score >= 75
      ? "var(--success, #10b981)"
      : score >= 55
        ? "var(--info, #3b82f6)"
        : "var(--warn, #f59e0b)";

  return (
    <span
      title="AI rapor güveni"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 34,
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: "color-mix(in srgb, currentColor 10%, transparent)"
      }}
    >
      {score}
    </span>
  );
}

function KanbanCandidateCard({ row }: { row: CandidateRow }) {
  const { t } = useUiText();
  const href = row.applicationId
    ? applicationDetailHref(row.applicationId)
    : candidateDetailHref(row.candidateId);

  return (
    <Link
      href={href as Route}
      style={{
        display: "grid",
        gap: 8,
        padding: "11px 12px",
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--surface)",
        textDecoration: "none",
        color: "inherit"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <strong
            style={{
              display: "block",
              fontSize: 13,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {row.candidateName}
          </strong>
          <span
            className="small"
            style={{
              display: "block",
              color: "var(--text-dim)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {row.jobTitle ?? t("Aday profili")}
          </span>
        </div>
        <ScoreBadge score={row.score} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span
          className="small"
          style={{
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis"
          }}
        >
          {t(row.followUpLabel)}
          {row.recommendation ? ` · ${t(recommendationLabel(row.recommendation))}` : ""}
        </span>
        <span className="small" style={{ color: "var(--text-dim)", whiteSpace: "nowrap" }}>
          {row.source ? t(sourceLabel(row.source)) : "-"}
        </span>
      </div>
    </Link>
  );
}
