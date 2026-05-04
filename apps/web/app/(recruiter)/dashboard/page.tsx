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
  ApplicationStage,
  Candidate,
  InterviewSessionView,
  RecruiterApplicationsReadModel,
  RecruiterOverviewReadModel
} from "../../../lib/types";

type QueueState = {
  key: "decision" | "feedback" | "invite_pending" | "in_progress";
  priority: number;
  helper: string;
};

const DASHBOARD_FUNNEL_STAGES: ApplicationStage[] = [
  "APPLIED",
  "SCREENING",
  "RECRUITER_REVIEW",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "TALENT_POOL",
  "SHORTLISTED",
  "HIRING_MANAGER_REVIEW",
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
    kariyer_portali: "Kariyer Portalı"
  };

  if (!raw) {
    return "Kaynak belirtilmedi";
  }

  return map[raw] ?? raw;
}

function resolveApplicationConfidenceScore(
  application: RecruiterApplicationsReadModel["items"][number]
): number | null {
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
  const { t, locale } = useUiText();
  const [data, setData] = useState<RecruiterOverviewReadModel | null>(null);
  const [applications, setApplications] = useState<RecruiterApplicationsReadModel["items"]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<InterviewSessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [overview, applicationRows, interviewRows, candidateRows] = await Promise.all([
        apiClient.recruiterOverviewReadModel(),
        apiClient
          .recruiterApplicationsReadModel()
          .catch(() => ({ total: 0, items: [] as RecruiterApplicationsReadModel["items"] })),
        apiClient.listInterviewSessions().catch(() => [] as InterviewSessionView[]),
        apiClient.listCandidates().catch(() => [] as Candidate[])
      ]);

      setData(overview);
      setApplications(applicationRows.items);
      setInterviews(interviewRows);
      setCandidates(candidateRows);
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

  const funnelRows = useMemo(() => {
    const total = applications.length;

    return DASHBOARD_FUNNEL_STAGES
      .map((stage) => {
        const count = applications.filter((application) => application.stage === stage).length;
        const stageMeta = getRecruiterStageMeta(stage);

        return {
          stage,
          label: stageMeta.label,
          color: stageMeta.color,
          count,
          share: total > 0 ? Math.round((count / total) * 100) : 0
        };
      })
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count);
  }, [applications]);

  const hiringStatus = useMemo(() => {
    const total = applications.length;
    const hired = applications.filter((application) => application.stage === "HIRED").length;
    const rejected = applications.filter(
      (application) => application.stage === "REJECTED" || application.humanDecision === "reject"
    ).length;
    const onHold = applications.filter(
      (application) => application.stage === "TALENT_POOL" || application.humanDecision === "hold"
    ).length;
    const active = Math.max(total - hired - rejected - onHold, 0);

    return {
      total,
      hired,
      rate: total > 0 ? Math.round((hired / total) * 100) : 0,
      segments: [
        { key: "hired", label: "İşe alındı", detail: "Tamamlanan", count: hired, color: "var(--success, #10b981)" },
        { key: "active", label: "Süreçte", detail: "Aktif akış", count: active, color: "var(--info, #3b82f6)" },
        { key: "hold", label: "Havuzda", detail: "Bekletiliyor", count: onHold, color: "var(--warn, #f59e0b)" },
        { key: "rejected", label: "Olumsuz", detail: "Kapanan", count: rejected, color: "var(--danger, #ef4444)" }
      ]
    };
  }, [applications]);

  const sourcePerformance = useMemo(() => {
    const candidateSourceById = new Map(candidates.map((candidate) => [candidate.id, candidate.source]));
    const totals = new Map<string, { key: string; label: string; count: number; ready: number; advanced: number }>();

    if (applications.length === 0) {
      candidates.forEach((candidate) => {
        const key = candidate.source ?? "unknown";
        const current = totals.get(key) ?? {
          key,
          label: sourceLabel(candidate.source),
          count: 0,
          ready: 0,
          advanced: 0
        };

        current.count += 1;
        totals.set(key, current);
      });
    } else {
      applications.forEach((application) => {
        const source = candidateSourceById.get(application.candidate.id);
        const key = source ?? "unknown";
        const current = totals.get(key) ?? {
          key,
          label: sourceLabel(source),
          count: 0,
          ready: 0,
          advanced: 0
        };

        current.count += 1;
        if (application.ai.hasReport || application.stage === "INTERVIEW_COMPLETED") {
          current.ready += 1;
        }
        if (
          application.stage === "SHORTLISTED" ||
          application.stage === "INTERVIEW_SCHEDULED" ||
          application.stage === "INTERVIEW_COMPLETED" ||
          application.stage === "OFFER" ||
          application.stage === "HIRED"
        ) {
          current.advanced += 1;
        }
        totals.set(key, current);
      });
    }

    return Array.from(totals.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 6)
      .map((source) => ({
        ...source,
        readyRate: source.count > 0 ? Math.round((source.ready / source.count) * 100) : 0,
        advancedRate: source.count > 0 ? Math.round((source.advanced / source.count) * 100) : 0
      }));
  }, [applications, candidates]);

  const positionBenchmark = useMemo(() => {
    const candidateSourceById = new Map(candidates.map((candidate) => [candidate.id, candidate.source]));
    const groups = new Map<
      string,
      {
        key: string;
        title: string;
        count: number;
        scoreTotal: number;
        scoreCount: number;
        sourceCounts: Map<string, number>;
        stageCounts: Map<ApplicationStage, number>;
      }
    >();

    applications.forEach((application) => {
      const key = application.job.id;
      const current = groups.get(key) ?? {
        key,
        title: application.job.title,
        count: 0,
        scoreTotal: 0,
        scoreCount: 0,
        sourceCounts: new Map<string, number>(),
        stageCounts: new Map<ApplicationStage, number>()
      };
      const score = resolveApplicationConfidenceScore(application);
      const sourceKey = candidateSourceById.get(application.candidate.id) ?? "unknown";

      current.count += 1;
      if (score !== null) {
        current.scoreTotal += score;
        current.scoreCount += 1;
      }
      current.sourceCounts.set(sourceKey, (current.sourceCounts.get(sourceKey) ?? 0) + 1);
      current.stageCounts.set(application.stage, (current.stageCounts.get(application.stage) ?? 0) + 1);
      groups.set(key, current);
    });

    return Array.from(groups.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 6)
      .map((group) => {
        const bestSource = Array.from(group.sourceCounts.entries()).sort((left, right) => right[1] - left[1])[0];
        const commonStage = Array.from(group.stageCounts.entries()).sort((left, right) => right[1] - left[1])[0];
        const stageMeta = commonStage ? getRecruiterStageMeta(commonStage[0]) : null;

        return {
          key: group.key,
          title: group.title,
          count: group.count,
          avgScore: group.scoreCount > 0 ? Math.round(group.scoreTotal / group.scoreCount) : null,
          bestSource: bestSource ? sourceLabel(bestSource[0]) : "-",
          commonStage: stageMeta?.label ?? "-"
        };
      });
  }, [applications, candidates]);

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

  const onboardingSteps = useMemo(() => {
    const steps = [
      {
        key: "job",
        label: locale === "en" ? "Publish the first job" : "İlk ilanı yayınla",
        helper:
          locale === "en"
            ? "Create or publish a live role so the hiring flow has a real starting point."
            : "Aday akışının başlaması için önce canlı bir pozisyon açın.",
        href: "/jobs" as const,
        done: (data?.kpis.publishedJobs ?? 0) > 0
      },
      {
        key: "candidate",
        label: locale === "en" ? "Add the first candidate" : "İlk adayı ekle",
        helper:
          locale === "en"
            ? "Bring in one test or real candidate and verify profile visibility."
            : "Bir test veya gerçek aday ekleyip profil görünürlüğünü doğrulayın.",
        href: "/candidates" as const,
        done: (data?.kpis.totalCandidates ?? 0) > 0
      },
      {
        key: "application",
        label: locale === "en" ? "Open the first application" : "İlk başvuruyu aç",
        helper:
          locale === "en"
            ? "Connect the candidate to a job so AI screening and review can start."
            : "AI screening ve review akışının başlaması için adayı ilana bağlayın.",
        href: "/applications" as const,
        done: applications.length > 0
      },
      {
        key: "interview",
        label: locale === "en" ? "Schedule the first AI interview" : "İlk AI mülakatını planla",
        helper:
          locale === "en"
            ? "Create one interview session and check the candidate-facing experience."
            : "Bir mülakat oturumu oluşturup aday deneyimini test edin.",
        href: "/interviews" as const,
        done: interviews.length > 0
      },
      {
        key: "report",
        label: locale === "en" ? "Review the first AI report" : "İlk AI raporunu incele",
        helper:
          locale === "en"
            ? "Confirm the report, recommendation, and recruiter decision loop is understandable."
            : "Rapor, recommendation ve recruiter karar döngüsünün anlaşılır olduğunu doğrulayın.",
        href: "/reports" as const,
        done: applications.some(
          (application) => application.ai.hasReport || Boolean(application.ai.latestRecommendation)
        )
      }
    ];

    return steps;
  }, [applications, data?.kpis.publishedJobs, data?.kpis.totalCandidates, interviews.length, locale]);

  const onboardingCompletedCount = useMemo(
    () => onboardingSteps.filter((step) => step.done).length,
    [onboardingSteps]
  );
  const shouldShowOnboarding = onboardingCompletedCount < onboardingSteps.length;

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
          {shouldShowOnboarding ? (
            <section className="panel">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 16,
                  flexWrap: "wrap",
                  marginBottom: 14
                }}
              >
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>
                    {t("İlk Kurulum Kontrol Listesi")}
                  </h3>
                  <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                    {t("Yeni bir recruiter yardım istemeden ilk rapora kadar bu sırayla ilerleyebilmelidir.")}
                  </p>
                </div>
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    border: "1px solid var(--border)",
                    background:
                      onboardingCompletedCount > 0
                        ? "rgba(34,197,94,0.12)"
                        : "rgba(124,115,250,0.12)",
                    color:
                      onboardingCompletedCount > 0
                        ? "var(--success, #22c55e)"
                        : "var(--primary, #7c73fa)",
                    fontSize: 12,
                    fontWeight: 700
                  }}
                >
                  {locale === "en"
                    ? `${onboardingCompletedCount}/${onboardingSteps.length} completed`
                    : `${onboardingCompletedCount}/${onboardingSteps.length} tamamlandi`}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10
                }}
              >
                {onboardingSteps.map((step, index) => (
                  <Link
                    key={step.key}
                    href={step.href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      border: step.done ? "1px solid rgba(34,197,94,0.22)" : "1px solid var(--border)",
                      background: step.done ? "rgba(34,197,94,0.05)" : "var(--surface)",
                      borderRadius: 12,
                      padding: "14px 16px",
                      display: "block"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 8
                      }}
                    >
                      <strong style={{ fontSize: 13 }}>
                        {index + 1}. {step.label}
                      </strong>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: step.done ? "var(--success, #22c55e)" : "var(--text-dim)"
                        }}
                      >
                        {step.done ? (locale === "en" ? "Done" : "Tamam") : (locale === "en" ? "Open" : "Açık")}
                      </span>
                    </div>
                    <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                      {step.helper}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

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
                <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.01em" }}>
                  {t(kpi.label)}
                </p>
                <strong style={{ fontSize: 28, fontWeight: 700, color: kpi.color, letterSpacing: "-1px" }}>
                  {kpi.value}
                </strong>
              </Link>
            ))}
          </div>

          {/* Funnel + Hiring Status */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))",
              gap: 14,
              alignItems: "stretch"
            }}
          >
            <section className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{t("Aday Hunisi")}</h3>
                  <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                    {t("Adayların süreç aşamalarına göre yoğunluğu.")}
                  </p>
                </div>
                <strong style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                  {applications.length} {t("başvuru")}
                </strong>
              </div>

              {funnelRows.length === 0 ? (
                <EmptyState
                  message={
                    shouldShowOnboarding
                      ? t("İlk başvuru açıldığında huni yoğunluğu burada oluşacak.")
                      : t("Huni için gösterilecek başvuru bulunmuyor.")
                  }
                />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {funnelRows.map((row) => (
                    <FunnelRow key={row.stage} label={t(row.label)} count={row.count} share={row.share} color={row.color} />
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{t("İşe Alım Durumu")}</h3>
                <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                  {t("Filtrelenmiş başvuruların güncel sonuç dağılımı.")}
                </p>
              </div>

              <div
                style={{
                  borderRadius: 14,
                  padding: "18px 18px 16px",
                  background: "linear-gradient(135deg, rgba(16,185,129,0.16), rgba(59,130,246,0.12))",
                  border: "1px solid rgba(16,185,129,0.16)",
                  marginBottom: 12
                }}
              >
                <strong style={{ display: "block", fontSize: 34, lineHeight: 1, color: "var(--success, #10b981)" }}>
                  {hiringStatus.rate}%
                </strong>
                <span style={{ display: "block", marginTop: 8, fontSize: 12, fontWeight: 700 }}>
                  {t("İşe alım oranı")}
                </span>
                <span className="small" style={{ color: "var(--text-dim)" }}>
                  {hiringStatus.total > 0
                    ? `${hiringStatus.hired} / ${hiringStatus.total} ${t("başvuru")}`
                    : t("Henüz sonuç yok")}
                </span>
              </div>

              <div
                aria-hidden="true"
                style={{
                  display: "flex",
                  height: 10,
                  overflow: "hidden",
                  borderRadius: 999,
                  background: "var(--surface-muted)",
                  border: "1px solid var(--border)",
                  marginBottom: 12
                }}
              >
                {hiringStatus.segments.map((segment) => (
                  <span
                    key={segment.key}
                    style={{
                      width: `${hiringStatus.total > 0 ? Math.max((segment.count / hiringStatus.total) * 100, segment.count > 0 ? 4 : 0) : 0}%`,
                      background: segment.color
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                {hiringStatus.segments
                  .filter((segment) => segment.count > 0 || segment.key !== "active")
                  .map((segment) => (
                    <StatusSummaryRow
                      key={segment.key}
                      label={t(segment.label)}
                      detail={t(segment.detail)}
                      count={segment.count}
                      color={segment.color}
                    />
                  ))}
              </div>
            </section>
          </div>

          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{t("Kanal Performansı")}</h3>
                <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                  {t("Başvuru kaynaklarının hacim ve değerlendirme üretimi.")}
                </p>
              </div>
              <Link href="/candidates" className="ghost-button" style={{ fontSize: 12 }}>
                {t("Aday Havuzu")}
              </Link>
            </div>

            {sourcePerformance.length === 0 ? (
              <EmptyState message={t("Kaynak verisi oluştuğunda kanal performansı burada görünecek.")} />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 10
                }}
              >
                {sourcePerformance.map((source) => (
                  <SourcePerformanceCard
                    key={source.key}
                    label={t(source.label)}
                    count={source.count}
                    readyRate={source.readyRate}
                    advancedRate={source.advancedRate}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{t("Pozisyon Benchmark")}</h3>
                <p className="small" style={{ margin: 0, color: "var(--text-dim)" }}>
                  {t("Pozisyon bazında hacim, ortalama AI güveni, en güçlü kaynak ve sık görülen aşama.")}
                </p>
              </div>
              <Link href="/reports" className="ghost-button" style={{ fontSize: 12 }}>
                {t("Raporlar")}
              </Link>
            </div>

            {positionBenchmark.length === 0 ? (
              <EmptyState message={t("Başvuru verisi oluştukça pozisyon benchmarkı burada görünecek.")} />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10
                }}
              >
                {positionBenchmark.map((position) => (
                  <PositionBenchmarkCard
                    key={position.key}
                    title={position.title}
                    count={position.count}
                    avgScore={position.avgScore}
                    bestSource={t(position.bestSource)}
                    commonStage={t(position.commonStage)}
                  />
                ))}
              </div>
            )}
          </section>

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
                <EmptyState
                  message={
                    shouldShowOnboarding
                      ? t("Sıradaki ilk kurulum adımını tamamlayarak aksiyon listesini doldurabilirsiniz.")
                      : t("Şu anda öne çıkan aksiyon bulunmuyor.")
                  }
                  actions={
                    shouldShowOnboarding ? (
                      <Link href={onboardingSteps.find((step) => !step.done)?.href ?? "/jobs"} className="ghost-button">
                        {locale === "en" ? "Open next step" : "Sıradaki adımı aç"}
                      </Link>
                    ) : undefined
                  }
                />
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
                <EmptyState
                  message={
                    shouldShowOnboarding
                      ? t("İlk AI mülakatını planladığınızda burada aday oturumlarını göreceksiniz.")
                      : t("Yaklaşan planlı görüşme bulunmuyor.")
                  }
                  actions={
                    shouldShowOnboarding ? (
                      <Link href="/interviews" className="ghost-button" style={{ fontSize: 12 }}>
                        {t("İlk mülakatı planla")}
                      </Link>
                    ) : undefined
                  }
                />
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
              <EmptyState
                message={
                  shouldShowOnboarding
                    ? t("Başvuru akışı başladığında, recruiter kararı gerektiren adaylar burada listelenecek.")
                    : t("Şu anda aksiyon gerektiren başvuru bulunmuyor.")
                }
                actions={
                  shouldShowOnboarding ? (
                    <Link href="/applications" className="ghost-button" style={{ fontSize: 12 }}>
                      {locale === "en" ? "Open applications" : "Başvurulara git"}
                    </Link>
                  ) : undefined
                }
              />
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
  letterSpacing: "0.01em",
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
          letterSpacing: "0.01em"
        }}
      >
        {label}
      </div>
      <strong style={{ fontSize: 20, fontWeight: 700, color: current.color }}>{value}</strong>
    </div>
  );
}

function FunnelRow({
  label,
  count,
  share,
  color
}: {
  label: string;
  count: number;
  share: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(110px, 0.34fr) minmax(0, 1fr) 42px",
        gap: 10,
        alignItems: "center"
      }}
    >
      <div style={{ minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </strong>
        <span className="small" style={{ color: "var(--text-dim)" }}>
          %{share} pay
        </span>
      </div>
      <div
        style={{
          height: 34,
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--surface-muted)",
          border: "1px solid var(--border)",
          position: "relative"
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            width: `${Math.max(share, count > 0 ? 7 : 0)}%`,
            background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 12%, transparent))`
          }}
        />
      </div>
      <strong style={{ textAlign: "right", fontSize: 20, color }}>{count}</strong>
    </div>
  );
}

function StatusSummaryRow({
  label,
  detail,
  count,
  color
}: {
  label: string;
  detail: string;
  count: number;
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "9px 10px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--surface-muted)"
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 28, borderRadius: 999, background: color, flexShrink: 0 }} />
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: "block", fontSize: 12 }}>{label}</strong>
          <span className="small" style={{ color: "var(--text-dim)" }}>{detail}</span>
        </span>
      </span>
      <strong style={{ fontSize: 18, color: "var(--text)" }}>{count}</strong>
    </div>
  );
}

function SourcePerformanceCard({
  label,
  count,
  readyRate,
  advancedRate
}: {
  label: string;
  count: number;
  readyRate: number;
  advancedRate: number;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "13px 14px",
        background: "var(--surface-muted)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <strong style={{ fontSize: 13, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </strong>
        <strong style={{ color: "var(--primary, #7346e8)" }}>{count}</strong>
      </div>
      <div
        aria-hidden="true"
        style={{
          height: 8,
          borderRadius: 999,
          overflow: "hidden",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          marginBottom: 8
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${Math.max(advancedRate, count > 0 ? 5 : 0)}%`,
            background: "linear-gradient(90deg, var(--primary, #7346e8), var(--success, #10b981))"
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <span className="small" style={{ color: "var(--text-dim)" }}>%{advancedRate} ilerleme</span>
        <span className="small" style={{ color: "var(--text-dim)" }}>%{readyRate} rapor</span>
      </div>
    </div>
  );
}

function PositionBenchmarkCard({
  title,
  count,
  avgScore,
  bestSource,
  commonStage
}: {
  title: string;
  count: number;
  avgScore: number | null;
  bestSource: string;
  commonStage: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "14px 15px",
        background: "var(--surface-muted)"
      }}
    >
      <h4
        style={{
          margin: "0 0 10px",
          fontSize: 14,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {title}
      </h4>
      <BenchmarkMetric label="Aday" value={String(count)} />
      <BenchmarkMetric label="Ort. AI güveni" value={avgScore === null ? "-" : String(avgScore)} />
      <BenchmarkMetric label="En güçlü kaynak" value={bestSource} />
      <BenchmarkMetric label="Sık aşama" value={commonStage} />
    </div>
  );
}

function BenchmarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "7px 0",
        borderTop: "1px solid var(--border)"
      }}
    >
      <span className="small" style={{ color: "var(--text-dim)" }}>{label}</span>
      <strong
        style={{
          fontSize: 12,
          textAlign: "right",
          maxWidth: "55%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }}
      >
        {value}
      </strong>
    </div>
  );
}
