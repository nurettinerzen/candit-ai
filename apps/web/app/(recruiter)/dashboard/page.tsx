"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { getRecruiterStageMeta, getRecruiterStatus } from "../../../lib/constants";
import { applicationDetailHref } from "../../../lib/entity-routes";
import { formatDate } from "../../../lib/format";
import { getInterviewInvitationMeta } from "../../../lib/interview-invitation";
import type {
  InterviewSessionView,
  RecruiterApplicationsReadModel,
  RecruiterOverviewReadModel
} from "../../../lib/types";

type QueueState = {
  key: "decision" | "feedback" | "invite_pending" | "in_progress";
  priority: number;
  helper: string;
};

function resolveQueueState(
  application: RecruiterApplicationsReadModel["items"][number]
): QueueState {
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
    (application.interview?.invitation?.state === "INVITED" ||
      application.interview?.invitation?.state === "REMINDER_SENT")
  ) {
    return {
      key: "invite_pending",
      priority: 3,
      helper: `${interviewMeta.label}. Adayın görüşmeyi başlatması bekleniyor.`
    };
  }

  return {
    key: "in_progress",
    priority: 4,
    helper: "Başvurunun güncel aşama detayları içeride yer alıyor."
  };
}

function isSameLocalDay(value: string, reference: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export default function RecruiterOverviewPage() {
  const { t } = useUiText();
  const [data, setData] = useState<RecruiterOverviewReadModel | null>(null);
  const [applications, setApplications] = useState<RecruiterApplicationsReadModel["items"]>([]);
  const [interviews, setInterviews] = useState<InterviewSessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [overview, applicationRows, interviewRows] = await Promise.all([
        apiClient.recruiterOverviewReadModel(),
        apiClient
          .recruiterApplicationsReadModel()
          .catch(() => ({ total: 0, items: [] as RecruiterApplicationsReadModel["items"] })),
        apiClient.listInterviewSessions().catch(() => [] as InterviewSessionView[])
      ]);

      setData(overview);
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
        return new Date(right.stageUpdatedAt).getTime() - new Date(left.stageUpdatedAt).getTime();
      })
      .slice(0, 8)
      .map((application) => ({
        application,
        state: resolveQueueState(application)
      }));
  }, [applications]);

  const feedbackWaitingCount = useMemo(
    () => applications.filter((a) => resolveQueueState(a).key === "feedback").length,
    [applications]
  );

  const decisionWaitingCount = useMemo(
    () => applications.filter((a) => resolveQueueState(a).key === "decision").length,
    [applications]
  );

  const pendingInviteCount = useMemo(
    () => interviews.filter((s) =>
      s.status === "SCHEDULED" &&
      (s.invitation?.state === "INVITED" || s.invitation?.state === "REMINDER_SENT")
    ).length,
    [interviews]
  );

  const todayScheduledCount = useMemo(() => {
    const today = new Date();
    return interviews.filter(
      (session) =>
        session.status === "SCHEDULED" &&
        session.scheduledAt &&
        isSameLocalDay(session.scheduledAt, today)
    ).length;
  }, [interviews]);

  const runningInterviewCount = useMemo(
    () => interviews.filter((s) => s.status === "RUNNING").length,
    [interviews]
  );

  const problematicInterviewCount = useMemo(
    () => interviews.filter((s) => ["FAILED", "CANCELLED", "NO_SHOW"].includes(s.status)).length,
    [interviews]
  );

  const actionableCount = decisionWaitingCount + feedbackWaitingCount;

  const actionItems = useMemo(
    () =>
      [
        {
          label: "Karar bekleyen başvurular",
          count: decisionWaitingCount,
          href: "/candidates" as const,
          urgent: true
        },
        {
          label: "Feedback bekleyen mülakatlar",
          count: feedbackWaitingCount,
          href: "/candidates" as const,
          urgent: true
        },
        {
          label: "Bekleyen görüşme davetleri",
          count: pendingInviteCount,
          href: "/interviews" as const
        },
        {
          label: "Devam eden görüşmeler",
          count: runningInterviewCount,
          href: "/interviews" as const
        },
        {
          label: "Sorunlu oturumlar",
          count: problematicInterviewCount,
          href: "/interviews" as const,
          urgent: true
        }
      ].filter((item) => item.count > 0),
    [
      decisionWaitingCount,
      feedbackWaitingCount,
      pendingInviteCount,
      runningInterviewCount,
      problematicInterviewCount
    ]
  );

  const upcomingInterviews = useMemo(() => {
    const now = Date.now();
    return interviews
      .filter(
        (session) =>
          session.status === "SCHEDULED" &&
          session.scheduledAt &&
          new Date(session.scheduledAt).getTime() >= now
      )
      .sort(
        (left, right) =>
          new Date(left.scheduledAt ?? 0).getTime() - new Date(right.scheduledAt ?? 0).getTime()
      )
      .slice(0, 4);
  }, [interviews]);

  const kpiCards = useMemo(() => [
    {
      label: "Aktif İlanlar",
      value: data?.kpis.publishedJobs ?? 0,
      color: "var(--primary, #7c73fa)",
      href: "/jobs" as const
    },
    {
      label: "Toplam Başvuru",
      value: applications.length,
      color: "var(--text, #e2e8f0)",
      href: "/candidates" as const
    },
    {
      label: "Karar Bekleyen",
      value: actionableCount,
      color: actionableCount > 0 ? "var(--warn, #f59e0b)" : "var(--success, #22c55e)",
      href: "/candidates" as const
    },
    {
      label: "Aktif Görüşme",
      value: pendingInviteCount + runningInterviewCount,
      color: pendingInviteCount + runningInterviewCount > 0 ? "#60a5fa" : "var(--text-dim)",
      href: "/interviews" as const
    }
  ], [data, applications.length, actionableCount, pendingInviteCount, runningInterviewCount]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <PageTitleWithGuide
            guideKey="dashboard"
            title={t("Genel Bakış")}
            subtitle={t("İşe alım operasyonunuzun günlük özeti.")}
            subtitleClassName="small"
            style={{ margin: 0, fontSize: 22, fontWeight: 700 }}
          />
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadOverview()}>
          {t("Yenile")}
        </button>
      </div>

      {loading ? (
        <section className="panel">
          <LoadingState message={t("Genel bakış yükleniyor...")} />
        </section>
      ) : null}

      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadOverview()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        </section>
      ) : null}

      {!loading && !error && data ? (
        <>
          {/* KPI Strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12
            }}
          >
            {kpiCards.map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  padding: "18px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  display: "block",
                  transition: "border-color 0.15s"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124,115,250,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {t(kpi.label)}
                </p>
                <strong style={{ fontSize: 28, fontWeight: 700, color: kpi.color, letterSpacing: "-1px" }}>
                  {kpi.value}
                </strong>
              </Link>
            ))}
          </div>

          {/* Action Items + Upcoming Interviews */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: 14
            }}
          >
            {/* Aksiyonlar */}
            <section className="panel">
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{t("Aksiyonlar")}</h3>
                <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                  {t("Önce tamamlanması gereken işler burada listelenir.")}
                </p>
              </div>
              {actionItems.length === 0 ? (
                <EmptyState message={t("Şu anda öne çıkan aksiyon bulunmuyor.")} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {actionItems.map((item) => (
                    <ActionRow
                      key={item.label}
                      label={item.label}
                      count={item.count}
                      href={item.href}
                      urgent={item.urgent}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Yaklaşan Görüşmeler */}
            <section className="panel">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  marginBottom: 14
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{t("Yaklaşan Görüşmeler")}</h3>
                  <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                    {t("Bugünkü yoğunluk ve sıradaki planlı görüşmeler.")}
                  </p>
                </div>
                <Link href="/interviews" className="ghost-button" style={{ fontSize: 12 }}>
                  {t("Mülakatlar")}
                </Link>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
                  gap: 8,
                  marginBottom: 14
                }}
              >
                <InterviewStat
                  label={t("Bugün planlanan")}
                  value={todayScheduledCount}
                  tone={todayScheduledCount > 0 ? "info" : "neutral"}
                />
                <InterviewStat
                  label={t("Devam eden")}
                  value={runningInterviewCount}
                  tone={runningInterviewCount > 0 ? "primary" : "neutral"}
                />
                <InterviewStat
                  label={t("Sorunlu")}
                  value={problematicInterviewCount}
                  tone={problematicInterviewCount > 0 ? "danger" : "neutral"}
                />
              </div>

              {upcomingInterviews.length === 0 ? (
                <EmptyState message={t("Yaklaşan planlı görüşme bulunmuyor.")} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {upcomingInterviews.map((session) => (
                    <Link
                      key={session.id}
                      href="/interviews"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.01)",
                        textDecoration: "none",
                        color: "inherit"
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {session.candidateName || t("Aday")}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-dim)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {session.jobTitle || t("Pozisyon")}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>
                          {session.scheduledAt ? formatDate(session.scheduledAt) : "-"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                          {t("Planlı")}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* İş Kuyruğu */}
          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{t("İş Kuyruğu")}</h3>
                <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                  {t("Aksiyon gerektiren başvurular, öncelik sırasına göre.")}
                </p>
              </div>
              <Link href="/candidates" className="ghost-button" style={{ fontSize: 12 }}>
                {t("Tüm Adaylar")}
              </Link>
            </div>

            {queueItems.length === 0 ? (
              <EmptyState message={t("Şu anda aksiyon gerektiren başvuru bulunmuyor.")} />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th style={{ ...thStyle, textAlign: "left" }}>{t("Aday")}</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>{t("Pozisyon")}</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>{t("Durum")}</th>
                    <th style={{ ...thStyle, textAlign: "left" }}>{t("Güncelleme")}</th>
                    <th style={{ ...thStyle, textAlign: "right" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {queueItems.map(({ application, state }) => {
                    const stageMeta = getRecruiterStageMeta(application.stage, application.humanDecision);
                    return (
                      <tr key={application.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={tdStyle}>
                          <span style={{ fontWeight: 600 }}>{application.candidate.fullName}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: "var(--text-secondary)" }}>{application.job.title}</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: stageMeta.color, flexShrink: 0 }} />
                            <span style={{ color: stageMeta.color, fontWeight: 500 }}>{t(stageMeta.label)}</span>
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{formatDate(application.stageUpdatedAt)}</span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <Link
                            href={applicationDetailHref(application.id)}
                            style={{
                              fontSize: 12, fontWeight: 500, color: "var(--primary, #7c73fa)",
                              textDecoration: "none", padding: "4px 12px", borderRadius: 6,
                              border: "1px solid rgba(124,115,250,0.2)", background: "rgba(124,115,250,0.04)"
                            }}
                          >
                            {t("Detay")}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

const thStyle: React.CSSProperties = {
  padding: "8px 0",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  color: "var(--text-dim)",
  fontWeight: 600
};

const tdStyle: React.CSSProperties = {
  padding: "12px 0"
};

function ActionRow({
  label,
  count,
  href,
  urgent
}: {
  label: string;
  count: number;
  href: Route;
  urgent?: boolean;
}) {
  const { t } = useUiText();

  return (
    <Link
      href={href}
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px", borderRadius: 8,
        border: "1px solid var(--border)", background: "rgba(255,255,255,0.01)",
        textDecoration: "none", color: "inherit",
        transition: "border-color 0.15s"
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(124,115,250,0.25)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      <span style={{ fontSize: 13 }}>{t(label)}</span>
      <strong style={{
        fontSize: 15, fontWeight: 700,
        color: urgent && count > 0 ? "var(--warn, #f59e0b)" : count > 0 ? "var(--text)" : "var(--text-dim)"
      }}>
        {count}
      </strong>
    </Link>
  );
}

function InterviewStat({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "neutral" | "info" | "primary" | "danger";
}) {
  const palette = {
    neutral: {
      color: "var(--text)",
      border: "var(--border)",
      background: "rgba(255,255,255,0.01)"
    },
    info: {
      color: "#60a5fa",
      border: "rgba(96,165,250,0.2)",
      background: "rgba(96,165,250,0.08)"
    },
    primary: {
      color: "var(--primary, #7c73fa)",
      border: "rgba(124,115,250,0.2)",
      background: "rgba(124,115,250,0.08)"
    },
    danger: {
      color: "var(--warn, #f59e0b)",
      border: "rgba(245,158,11,0.2)",
      background: "rgba(245,158,11,0.08)"
    }
  } satisfies Record<
    "neutral" | "info" | "primary" | "danger",
    { color: string; border: string; background: string }
  >;

  const current = palette[tone];

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${current.border}`,
        background: current.background
      }}
    >
      <div
        style={{
          marginBottom: 6,
          fontSize: 11,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.04em"
        }}
      >
        {label}
      </div>
      <strong style={{ fontSize: 20, fontWeight: 700, color: current.color }}>{value}</strong>
    </div>
  );
}
