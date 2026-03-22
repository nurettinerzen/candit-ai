"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui-states";
import { apiClient } from "../../lib/api-client";
import { getRecruiterStageMeta, getRecruiterStatus } from "../../lib/constants";
import { formatDate } from "../../lib/format";
import type {
  InterviewSessionView,
  ProviderHealthDashboard,
  RecruiterApplicationsReadModel,
  RecruiterOverviewReadModel
} from "../../lib/types";

type QueueState = {
  key: "decision" | "feedback" | "today_interview" | "in_progress";
  priority: number;
  helper: string;
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

function resolveQueueState(
  application: RecruiterApplicationsReadModel["items"][number]
): QueueState {
  const recruiterStatus = getRecruiterStatus(application.stage, application.humanDecision);

  if (
    application.interview?.status === "COMPLETED" &&
    recruiterStatus !== "ON_HOLD" &&
    application.stage !== "REJECTED" &&
    application.stage !== "HIRED"
  ) {
    return {
      key: "feedback",
      priority: 1,
      helper: "Mülakat tamamlandı. Recruiter kararı bekleniyor."
    };
  }

  if (recruiterStatus === "ON_HOLD") {
    return {
      key: "in_progress",
      priority: 3,
      helper: "Aday bekletildi. Tekrar inceleme için sırada tutuluyor."
    };
  }

  if (
    (application.ai.hasReport && application.humanDecisionRequired) ||
    recruiterStatus === "DECISION_PENDING"
  ) {
    return {
      key: "decision",
      priority: 2,
      helper: "AI değerlendirmesi tamamlandı. Recruiter kararı bekleniyor."
    };
  }

  if (
    application.interview?.status === "SCHEDULED" &&
    isSameCalendarDay(application.interview?.scheduledAt)
  ) {
    return {
      key: "today_interview",
      priority: 3,
      helper: "Bugün planlanmış bir mülakat var."
    };
  }

  return {
    key: "in_progress",
    priority: 4,
    helper: "Başvurunun güncel aşama detayları ve sonraki adımı içeride yer alıyor."
  };
}

export default function RecruiterOverviewPage() {
  const [data, setData] = useState<RecruiterOverviewReadModel | null>(null);
  const [health, setHealth] = useState<ProviderHealthDashboard | null>(null);
  const [applications, setApplications] = useState<RecruiterApplicationsReadModel["items"]>([]);
  const [interviews, setInterviews] = useState<InterviewSessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [overview, healthData, applicationRows, interviewRows] = await Promise.all([
        apiClient.recruiterOverviewReadModel(),
        apiClient.getProviderHealth().catch(() => null),
        apiClient
          .recruiterApplicationsReadModel()
          .catch(() => ({ total: 0, items: [] as RecruiterApplicationsReadModel["items"] })),
        apiClient.listInterviewSessions().catch(() => [] as InterviewSessionView[])
      ]);

      setData(overview);
      setHealth(healthData);
      setApplications(applicationRows.items);
      setInterviews(interviewRows);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Genel bakış verileri yüklenemedi."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const queueItems = useMemo(() => {
    return [...applications]
      .sort((left, right) => {
        const leftState = resolveQueueState(left);
        const rightState = resolveQueueState(right);

        if (leftState.priority !== rightState.priority) {
          return leftState.priority - rightState.priority;
        }

        return (
          new Date(right.stageUpdatedAt).getTime() - new Date(left.stageUpdatedAt).getTime()
        );
      })
      .slice(0, 6)
      .map((application) => ({
        application,
        state: resolveQueueState(application)
      }));
  }, [applications]);

  const feedbackWaiting = useMemo(
    () => applications.filter((application) => resolveQueueState(application).key === "feedback"),
    [applications]
  );

  const decisionWaitingCount = useMemo(
    () => applications.filter((application) => resolveQueueState(application).key === "decision").length,
    [applications]
  );

  const totalDecisionWaitingCount = decisionWaitingCount + feedbackWaiting.length;

  const todayInterviews = useMemo(
    () =>
      interviews.filter((session) =>
        isSameCalendarDay(session.scheduledAt ?? session.startedAt ?? session.createdAt)
      ),
    [interviews]
  );

  const runningInterviewCount = useMemo(
    () => interviews.filter((session) => session.status === "RUNNING").length,
    [interviews]
  );

  const problematicInterviewCount = useMemo(
    () =>
      interviews.filter((session) =>
        ["FAILED", "CANCELLED", "NO_SHOW"].includes(session.status)
      ).length,
    [interviews]
  );

  const systemHealthSummary = useMemo(() => {
    if (!health) {
      return {
        isHealthy: true,
        label: "Sistem verisi alınamadı, son bilinen akış gösteriliyor."
      };
    }

    const isHealthy = health.overall === "healthy";

    return {
      isHealthy,
      label: isHealthy ? "Tüm sistemler aktif" : "Bazı bağlantılarda dikkat gerekiyor"
    };
  }, [health]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Genel Bakış</h1>
          <p className="small" style={{ margin: 0 }}>
            Bu ekran aday listesi değil, işe alım operasyonunuzun genel özetidir.
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadOverview()}>
          Yenile
        </button>
      </div>

      {loading ? (
        <section className="panel">
          <LoadingState message="Genel bakış yükleniyor..." />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadOverview()}>
                Tekrar dene
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !error && data ? (
        <>
          <div className="ops-summary-grid">
            <article className="ops-summary-card">
              <p className="small">İlanlar</p>
              <strong className="ops-summary-value">{data.kpis.publishedJobs}</strong>
              <p className="small">Yayında olan ilanları ve pipeline girişlerini yönetin.</p>
              <Link href="/jobs" className="ops-summary-link">
                İlanlara Git
              </Link>
            </article>

            <article className="ops-summary-card">
              <p className="small">Başvurular</p>
              <strong className="ops-summary-value">{applications.length}</strong>
              <p className="small">{totalDecisionWaitingCount} kayıt bugün karar bekliyor.</p>
              <Link href="/applications" className="ops-summary-link">
                İş Kuyruğunu Aç
              </Link>
            </article>

            <article className="ops-summary-card">
              <p className="small">Mülakatlar</p>
              <strong className="ops-summary-value">{interviews.length}</strong>
              <p className="small">{todayInterviews.length} oturum bugün gündemde.</p>
              <Link href="/interviews" className="ops-summary-link">
                Mülakatları Aç
              </Link>
            </article>

          </div>

          <div className="mini-grid">
            <section className="panel">
              <div className="section-head" style={{ marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Bugün Yapılacaklar</h3>
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    Takımın aksiyon alması gereken ana başlıklar.
                  </p>
                </div>
              </div>
              <ul className="plain-list">
                <li className="list-row">
                  <span>Karar bekleyen başvurular</span>
                  <strong>{decisionWaitingCount}</strong>
                </li>
                <li className="list-row">
                  <span>Feedback bekleyen mülakatlar</span>
                  <strong>{feedbackWaiting.length}</strong>
                </li>
                <li className="list-row">
                  <span>Bugün planlanan mülakatlar</span>
                  <strong>{todayInterviews.length}</strong>
                </li>
                <li className="list-row">
                  <span>Sorunlu oturumlar</span>
                  <strong>{problematicInterviewCount}</strong>
                </li>
              </ul>
            </section>

            <section className="panel">
              <div className="section-head" style={{ marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Sistem Durumu</h3>
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    Sağlayıcı, entegrasyon ve çalışma zamanı durumu.
                  </p>
                </div>
                <Link href="/ayarlar" className="ghost-button" style={{ fontSize: 12 }}>
                  Detaylar
                </Link>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  background: systemHealthSummary.isHealthy
                    ? "var(--success-light, #ecfdf5)"
                    : "var(--warn-light, #fffbeb)",
                  border: `1px solid ${
                    systemHealthSummary.isHealthy
                      ? "var(--success-border, rgba(16, 185, 129, 0.25))"
                      : "var(--warn-border, rgba(245, 158, 11, 0.25))"
                  }`
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: systemHealthSummary.isHealthy
                      ? "var(--success, #10b981)"
                      : "var(--warn, #f59e0b)"
                  }}
                />
                <strong
                  style={{
                    color: systemHealthSummary.isHealthy
                      ? "var(--success-text, #065f46)"
                      : "var(--warn-text, #92400e)"
                  }}
                >
                  {systemHealthSummary.label}
                </strong>
              </div>
              <ul className="plain-list" style={{ marginTop: 12 }}>
                {(health?.warnings.length ? health.warnings : ["Şu anda kritik uyarı görünmüyor."])
                  .slice(0, 3)
                  .map((warning) => (
                    <li key={warning} className="list-row">
                      <span>{warning}</span>
                    </li>
                  ))}
              </ul>
            </section>
          </div>

          <div className="mini-grid">
            <section className="panel">
              <div className="section-head" style={{ marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Bugün Mülakatlar</h3>
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    Gün içindeki mülakat yoğunluğu ve operasyon durumu.
                  </p>
                </div>
              </div>
              <ul className="plain-list">
                <li className="list-row">
                  <span>Bugün planlanan</span>
                  <strong>{todayInterviews.length}</strong>
                </li>
                <li className="list-row">
                  <span>Şu an devam eden</span>
                  <strong>{runningInterviewCount}</strong>
                </li>
                <li className="list-row">
                  <span>Sorunlu oturum</span>
                  <strong>{problematicInterviewCount}</strong>
                </li>
              </ul>
            </section>

            <section className="panel">
              <div className="section-head" style={{ marginBottom: 10 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Feedback Bekleyenler</h3>
                  <p className="small" style={{ margin: "4px 0 0" }}>
                    Mülakatı tamamlanmış ya da kararı kapanmamış başvurular.
                  </p>
                </div>
              </div>
              <ul className="plain-list">
                <li className="list-row">
                  <span>Son karar bekleyenler</span>
                  <strong>{feedbackWaiting.length}</strong>
                </li>
                <li className="list-row">
                  <span>Bugün planlanan mülakatlar</span>
                  <strong>{todayInterviews.length}</strong>
                </li>
                <li className="list-row">
                  <span>Karar bekleyen başvurular</span>
                  <strong>{decisionWaitingCount}</strong>
                </li>
              </ul>
            </section>
          </div>

          <section className="panel">
            <div className="section-head" style={{ marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0 }}>İş Kuyruğu</h3>
                <p className="small" style={{ margin: "4px 0 0" }}>
                  Tam liste değil; bugün öne çıkan 6 operasyon kaydı burada görünür.
                </p>
              </div>
              <Link href="/applications" className="ghost-button">
                Tüm Kuyruğu Aç
              </Link>
            </div>

            {queueItems.length === 0 ? (
              <EmptyState message="Şu anda öne çıkan bir iş kuyruğu kaydı bulunmuyor." />
            ) : (
              <ul className="plain-list">
                {queueItems.map(({ application, state }) => {
                  const stageMeta = getRecruiterStageMeta(
                    application.stage,
                    application.humanDecision
                  );

                  return (
                    <li key={application.id} className="scenario-card">
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: "inline-block", marginBottom: 6 }}>
                          {application.candidate.fullName}
                        </strong>
                        <p className="small" style={{ margin: "0 0 4px" }}>
                          {application.job.title}
                        </p>
                        <p className="small" style={{ margin: 0 }}>
                          {state.helper} Son güncelleme: {formatDate(application.stageUpdatedAt)}
                        </p>
                      </div>
                      <div className="row-actions">
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
                        <Link href={`/applications/${application.id}`} className="button-link">
                          Başvuruyu Aç
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
