"use client";

import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { canPerformAction } from "../../../lib/auth/policy";
import { resolveActiveSession } from "../../../lib/auth/session";
import { apiClient } from "../../../lib/api-client";
import {
  RECRUITER_STATUS_FILTERS,
  getRecruiterStageMeta,
  getRecruiterStatus
} from "../../../lib/constants";
import { applicationDetailHref } from "../../../lib/entity-routes";
import { formatDate } from "../../../lib/format";
import { getInterviewInvitationMeta } from "../../../lib/interview-invitation";
import type {
  Candidate,
  Job,
  RecruiterApplicationsReadModel
} from "../../../lib/types";

type QueueState = {
  key: "decision" | "feedback" | "invite_pending" | "in_progress";
  helper: string;
  priority: number;
};

function resolveQueueState(application: RecruiterApplicationsReadModel["items"][number]): QueueState {
  const recruiterStatus = getRecruiterStatus(application.stage, application.humanDecision);
  const interviewMeta = getInterviewInvitationMeta(
    application.interview?.invitation ?? null,
    application.interview?.status ?? null
  );

  if (
    application.interview?.status === "COMPLETED" &&
    recruiterStatus !== "ON_HOLD" &&
    application.stage !== "REJECTED" &&
    application.stage !== "HIRED"
  ) {
    return {
      key: "feedback",
      helper: "Mülakat tamamlandı. Recruiter kararı bekleniyor.",
      priority: 1
    };
  }

  if (recruiterStatus === "ON_HOLD") {
    return {
      key: "in_progress",
      helper: "Aday bekletildi. Tekrar değerlendirme için sırada tutuluyor.",
      priority: 3
    };
  }

  if (
    (application.ai.hasReport && application.humanDecisionRequired) ||
    recruiterStatus === "DECISION_PENDING"
  ) {
    return {
      key: "decision",
      helper: "AI değerlendirmesi tamamlandı. Recruiter kararı bekleniyor.",
      priority: 2
    };
  }

  if (
    application.interview?.status === "SCHEDULED" &&
    (application.interview?.invitation?.state === "INVITED" ||
      application.interview?.invitation?.state === "REMINDER_SENT")
  ) {
    return {
      key: "invite_pending",
      helper: `${interviewMeta.label}. Adayın linkten görüşmeyi başlatması bekleniyor.`,
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
  const { t } = useUiText();
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
  const [warning, setWarning] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeCard, setActiveCard] = useState<"ready" | "decision" | "interview" | "all">("all");

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError("");
    setWarning("");

    try {
      const [jobResult, candidateResult, applicationResult] = await Promise.allSettled([
        apiClient.listJobs(),
        apiClient.listCandidates(),
        apiClient.recruiterApplicationsReadModel({
          jobId: undefined
        })
      ]);

      if (applicationResult.status !== "fulfilled") {
        throw applicationResult.reason;
      }

      const nextWarnings: string[] = [];

      if (jobResult.status === "fulfilled") {
        setJobs(jobResult.value);
      } else {
        setJobs([]);
        nextWarnings.push(
          t("İlan listesi şu an yüklenemedi. Filtreler ve yeni başvuru formu kısıtlı çalışabilir.")
        );
      }

      if (candidateResult.status === "fulfilled") {
        setCandidates(candidateResult.value);
      } else {
        setCandidates([]);
        nextWarnings.push(
          t("Aday listesi şu an yüklenemedi. Yeni başvuru açma alanı geçici olarak kullanılamayabilir.")
        );
      }

      setApplications(applicationResult.value.items);
      setWarning(nextWarnings.join(" "));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Başvuru verileri alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      router.push(applicationDetailHref(created.id));
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
    const filtered = applications.filter((application) => {
      if (jobFilter && application.job.id !== jobFilter) return false;

      if (stageFilter) {
        const status = getRecruiterStatus(application.stage, application.humanDecision);
        if (status !== stageFilter) return false;
      }

      if (activeCard === "ready") return resolveQueueState(application).key === "feedback";
      if (activeCard === "decision") return resolveQueueState(application).key === "decision";
      if (activeCard === "interview") return application.stage === "INTERVIEW_SCHEDULED";
      return true;
    });

    return [...filtered].sort((left, right) => {
      const leftState = resolveQueueState(left);
      const rightState = resolveQueueState(right);
      if (leftState.priority !== rightState.priority) return leftState.priority - rightState.priority;
      return new Date(right.stageUpdatedAt).getTime() - new Date(left.stageUpdatedAt).getTime();
    });
  }, [applications, jobFilter, stageFilter, activeCard]);

  type CardKey = "ready" | "decision" | "interview" | "all";

  const cardCounts = useMemo(() => ({
    ready: applications.filter((a) => resolveQueueState(a).key === "feedback").length,
    decision: applications.filter((a) => resolveQueueState(a).key === "decision").length,
    interview: applications.filter((a) => a.stage === "INTERVIEW_SCHEDULED").length,
    all: applications.length,
  }), [applications]);

  const CARDS: Array<{ key: CardKey; label: string; color: string; activeColor: string }> = [
    { key: "ready", label: "Değerlendirme Hazır", color: "var(--success, #22c55e)", activeColor: "rgba(34,197,94,0.12)" },
    { key: "decision", label: "Karar Bekleyen", color: "var(--warn, #f59e0b)", activeColor: "rgba(245,158,11,0.12)" },
    { key: "interview", label: "Görüşme Bekleyen", color: "var(--primary, #7c73fa)", activeColor: "rgba(124,115,250,0.12)" },
    { key: "all", label: "Tümü", color: "var(--text-secondary)", activeColor: "var(--primary-light, rgba(124,115,250,0.12))" },
  ];

  return (
    <section className="page-grid">
      <section className="panel">
        <div className="section-head">
          <div>
            <h2 style={{ marginBottom: 4 }}>Başvurular</h2>
            <p className="small" style={{ marginTop: 0 }}>
              {t("Bu ekran iş kuyruğudur. Aday profili ayrı sayfadadır; buradan ilan bazlı karar ekranına girilir.")}
            </p>
          </div>
          <button type="button" className="ghost-button" onClick={() => void loadPageData()}>
            {t("Yenile")}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
          {CARDS.map((card) => {
            const isActive = activeCard === card.key;
            const count = cardCounts[card.key];
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setActiveCard(card.key)}
                style={{
                  cursor: "pointer",
                  padding: "16px 18px",
                  borderRadius: 12,
                  border: isActive ? `1.5px solid ${card.color}` : "1px solid var(--border)",
                  background: isActive ? card.activeColor : "var(--surface)",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 700, color: count > 0 ? card.color : "var(--text-dim)", lineHeight: 1 }}>
                  {count}
                </div>
                <div style={{ fontSize: 12, color: isActive ? card.color : "var(--text-secondary)", marginTop: 6, fontWeight: isActive ? 600 : 400 }}>
                  {t(card.label)}
                </div>
              </button>
            );
          })}
        </div>

        <form
          className="inline-grid search-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void loadPageData();
          }}
        >
          <select className="select" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="">{t("Tüm durumlar")}</option>
            {RECRUITER_STATUS_FILTERS.map((status) => (
              <option key={status.value} value={status.value}>
                {t(status.label)}
              </option>
            ))}
          </select>

          <select className="select" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}>
            <option value="">{t("Tüm ilanlar")}</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title}
              </option>
            ))}
          </select>

          <button type="submit" className="ghost-button">
            {t("Filtreyi Uygula")}
          </button>
        </form>

        {!loading && !error && warning ? (
          <div
            style={{
              marginTop: 12,
              padding: "12px 16px",
              borderRadius: 8,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              color: "var(--warn, #f59e0b)",
              fontSize: 13
            }}
          >
            {warning}
          </div>
        ) : null}

        {loading ? <LoadingState message={t("Başvurular yükleniyor...")} /> : null}
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
          <EmptyState message={t("Filtreye uygun başvuru bulunamadı.")} />
        ) : null}
        {!loading && !error && prioritizedApplications.length > 0 ? (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Aday")}</th>
                  <th>{t("İlan")}</th>
                  <th>{t("Durum")}</th>
                  <th>{t("Son Güncelleme")}</th>
                </tr>
              </thead>
              <tbody>
                {prioritizedApplications.map((application) => {
                  const stageMeta = getRecruiterStageMeta(
                    application.stage,
                    application.humanDecision
                  );

                  return (
                    <tr
                      key={application.id}
                      onClick={() => { window.location.href = applicationDetailHref(application.id); }}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div style={{ fontWeight: 500 }}>{application.candidate.fullName}</div>
                        {application.candidate.email ? (
                          <div className="small text-muted">{application.candidate.email}</div>
                        ) : null}
                      </td>
                      <td>{application.job.title}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            color: stageMeta.color,
                            fontWeight: 600,
                            fontSize: 13,
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
                          {t(stageMeta.label)}
                        </span>
                      </td>
                      <td>{formatDate(application.stageUpdatedAt)}</td>
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
                <h3 style={{ margin: 0 }}>{t("Yeni Başvuru Aç")}</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  {t("Manuel giriş gerekiyorsa yeni başvuruyu buradan oluşturabilirsiniz.")}
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
                disabled={candidates.length === 0}
              >
                <option value="">Aday seçiniz</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.fullName}
                  </option>
                ))}
              </select>

              <select
                className="select"
                value={jobId}
                onChange={(event) => setJobId(event.target.value)}
                required
                disabled={jobs.length === 0}
              >
                <option value="">İlan seçiniz</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                className="button-link"
                disabled={submitting || candidates.length === 0 || jobs.length === 0}
              >
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
