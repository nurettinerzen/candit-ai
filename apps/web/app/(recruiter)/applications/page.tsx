"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { canPerformAction } from "../../../lib/auth/policy";
import { resolveActiveSession } from "../../../lib/auth/session";
import { apiClient } from "../../../lib/api-client";
import { APPLICATION_STAGES, STAGE_LABELS, getRecruiterStageMeta } from "../../../lib/constants";
import { formatDate } from "../../../lib/format";
import type {
  Candidate,
  Job,
  RecruiterApplicationsReadModel
} from "../../../lib/types";

type QueueState = {
  key: "decision" | "feedback" | "today_interview" | "in_progress";
  helper: string;
  priority: number;
};

function isSameCalendarDay(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function resolveQueueState(application: RecruiterApplicationsReadModel["items"][number]): QueueState {
  if (
    application.interview?.status === "COMPLETED" &&
    application.stage !== "REJECTED" &&
    application.stage !== "HIRED"
  ) {
    return {
      key: "feedback",
      helper: "Mülakat tamamlandı. Recruiter kararı bekleniyor.",
      priority: 1
    };
  }

  if (
    (application.ai.hasReport && application.humanDecisionRequired) ||
    ["APPLIED", "SCREENING", "RECRUITER_REVIEW", "INTERVIEW_COMPLETED"].includes(
      application.stage
    )
  ) {
    return {
      key: "decision",
      helper: "AI değerlendirmesi tamamlandı. Recruiter kararı bekleniyor.",
      priority: 2
    };
  }

  if (
    application.interview?.status === "SCHEDULED" &&
    isSameCalendarDay(application.interview?.scheduledAt)
  ) {
    return {
      key: "today_interview",
      helper: "Bugün planlanmış bir mülakat var.",
      priority: 3
    };
  }

  return {
    key: "in_progress",
    helper: "Başvurunun güncel aşaması ve sonraki adımı içeride yer alıyor.",
    priority: 4
  };
}

export default function ApplicationsPage() {
  const router = useRouter();
  const session = useMemo(() => resolveActiveSession(), []);
  const canCreateApplication = canPerformAction(session, "candidate.create");
  const [applications, setApplications] = useState<RecruiterApplicationsReadModel["items"]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobFilter, setJobFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [jobRows, candidateRows, applicationRows] = await Promise.all([
        apiClient.listJobs(),
        apiClient.listCandidates(),
        apiClient.recruiterApplicationsReadModel({
          stage: stageFilter || undefined,
          jobId: jobFilter || undefined
        })
      ]);

      setJobs(jobRows);
      setCandidates(candidateRows);
      setApplications(applicationRows.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Başvuru verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [jobFilter, stageFilter]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  async function handleCreateApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    if (!candidateId || !jobId) {
      setSubmitError("Aday ve ilan seçimi zorunludur.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await apiClient.createApplication({ candidateId, jobId });
      setCandidateId("");
      setJobId("");
      await loadPageData();
      router.push(`/applications/${created.id}`);
      router.refresh();
    } catch (submitErr) {
      setSubmitError(
        submitErr instanceof Error ? submitErr.message : "Başvuru oluşturulamadı."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const prioritizedApplications = useMemo(() => {
    return [...applications].sort((left, right) => {
      const leftState = resolveQueueState(left);
      const rightState = resolveQueueState(right);

      if (leftState.priority !== rightState.priority) {
        return leftState.priority - rightState.priority;
      }

      return new Date(right.stageUpdatedAt).getTime() - new Date(left.stageUpdatedAt).getTime();
    });
  }, [applications]);

  const decisionWaitingCount = useMemo(
    () => applications.filter((application) => resolveQueueState(application).key === "decision").length,
    [applications]
  );

  const plannedInterviewCount = useMemo(
    () => applications.filter((application) => application.stage === "INTERVIEW_SCHEDULED").length,
    [applications]
  );

  const rejectedCount = useMemo(
    () => applications.filter((application) => application.stage === "REJECTED").length,
    [applications]
  );

  return (
    <section className="page-grid">
      <section className="panel">
        <div className="section-head">
          <div>
            <h2 style={{ marginBottom: 4 }}>Başvurular</h2>
            <p className="small" style={{ marginTop: 0 }}>
              Bu ekran iş kuyruğudur. Aday profili ayrı sayfadadır; buradan ilan bazlı karar ekranına girilir.
            </p>
          </div>
          <button type="button" className="ghost-button" onClick={() => void loadPageData()}>
            Yenile
          </button>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 18 }}>
          <article className="kpi-card">
            <p className="small">Toplam Kayıt</p>
            <p className="kpi-value">{applications.length}</p>
          </article>
          <article className="kpi-card">
            <p className="small">Karar Bekleyen</p>
            <p className="kpi-value">{decisionWaitingCount}</p>
          </article>
          <article className="kpi-card">
            <p className="small">Mülakat Planlandı</p>
            <p className="kpi-value">{plannedInterviewCount}</p>
          </article>
          <article className="kpi-card">
            <p className="small">Reddedildi</p>
            <p className="kpi-value">{rejectedCount}</p>
          </article>
        </div>

        <form
          className="inline-grid search-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void loadPageData();
          }}
        >
          <select className="select" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="">Tüm stage'ler</option>
            {APPLICATION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>

          <select className="select" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
            <option value="">Tüm ilanlar</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>

          <button type="submit" className="ghost-button">
            Filtreyi Uygula
          </button>
        </form>

        {loading ? <LoadingState message="Başvurular yükleniyor..." /> : null}
        {!loading && error ? (
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadPageData()}>
                Tekrar dene
              </button>
            }
          />
        ) : null}
        {!loading && !error && prioritizedApplications.length === 0 ? (
          <EmptyState message="Filtreye uygun başvuru bulunamadı." />
        ) : null}
        {!loading && !error && prioritizedApplications.length > 0 ? (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Aday</th>
                  <th>İlan</th>
                  <th>Aşama</th>
                  <th>Son Güncelleme</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {prioritizedApplications.map((application) => {
                  const stageMeta = getRecruiterStageMeta(
                    application.stage,
                    application.aiRecommendation
                  );

                  return (
                    <tr key={application.id}>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <Link href={`/candidates/${application.candidate.id}`}>
                            {application.candidate.fullName}
                          </Link>
                          {application.candidate.email ? (
                            <span className="small">{application.candidate.email}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: 4 }}>
                          <Link href={`/jobs/${application.job.id}`}>{application.job.title}</Link>
                          <span className="small">{application.job.status}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            color: stageMeta.color,
                            fontWeight: 600
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: stageMeta.color
                            }}
                          />
                          {stageMeta.label}
                        </span>
                      </td>
                      <td>{formatDate(application.stageUpdatedAt)}</td>
                      <td>
                        <Link
                          href={`/applications/${application.id}`}
                          className="table-action-link"
                          style={{ whiteSpace: "nowrap" }}
                        >
                          Başvuruyu Aç
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="panel">
        {canCreateApplication ? (
          <>
            <div className="section-head" style={{ marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>Yeni Başvuru Aç</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  Manuel giriş gerekiyorsa yeni başvuruyu buradan oluşturabilirsiniz.
                </p>
              </div>
            </div>
            {submitError ? <ErrorState error={submitError} /> : null}
            <form className="inline-grid create-application-grid" onSubmit={handleCreateApplication}>
              <select
                className="select"
                value={candidateId}
                onChange={(event) => setCandidateId(event.target.value)}
                required
              >
                <option value="">Aday seçiniz</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName}
                  </option>
                ))}
              </select>

              <select className="select" value={jobId} onChange={(event) => setJobId(event.target.value)} required>
                <option value="">İlan seçiniz</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>

              <button type="submit" className="button-link" disabled={submitting}>
                {submitting ? "Oluşturuluyor..." : "Başvuru Aç"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h3 style={{ marginTop: 0 }}>Yeni Başvuru Aç</h3>
            <p className="small">Bu aksiyon için `candidate.create` yetkisi gerekiyor.</p>
          </>
        )}
      </section>
    </section>
  );
}
