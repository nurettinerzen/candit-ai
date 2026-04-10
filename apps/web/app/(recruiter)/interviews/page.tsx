"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUiText } from "../../../components/site-language-provider";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { applicationDetailHref } from "../../../lib/entity-routes";
import { formatDate } from "../../../lib/format";
import { getInterviewInvitationMeta } from "../../../lib/interview-invitation";
import type { InterviewSessionStatus, InterviewSessionView } from "../../../lib/types";

const INTERVIEW_STATUS_LABELS: Record<InterviewSessionStatus, string> = {
  SCHEDULED: "Bekleniyor",
  RUNNING: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  NO_SHOW: "Katılım Yok",
  CANCELLED: "İptal Edildi",
};

type TabKey = "HAZIR" | "DEVAM" | "DIKKAT" | "TUMU";

type StatCard = {
  key: TabKey;
  label: string;
  color: string;
  activeColor: string;
};

const STAT_CARDS: StatCard[] = [
  { key: "HAZIR", label: "Hazır", color: "var(--success, #22c55e)", activeColor: "rgba(34,197,94,0.12)" },
  { key: "DEVAM", label: "Devam Eden", color: "var(--warn, #f59e0b)", activeColor: "rgba(245,158,11,0.12)" },
  { key: "DIKKAT", label: "Dikkat", color: "var(--risk, #ef4444)", activeColor: "rgba(239,68,68,0.12)" },
  { key: "TUMU", label: "Tümü", color: "var(--text-secondary)", activeColor: "var(--primary-light, rgba(124,115,250,0.12))" },
];


function filterByTab(sessions: InterviewSessionView[], tab: TabKey): InterviewSessionView[] {
  switch (tab) {
    case "HAZIR":
      return sessions.filter((s) => s.status === "COMPLETED");
    case "DEVAM":
      return sessions.filter((s) => s.status === "RUNNING" || s.status === "SCHEDULED");
    case "DIKKAT":
      return sessions.filter((s) => s.status === "FAILED" || s.status === "NO_SHOW" || s.status === "CANCELLED");
    case "TUMU":
    default:
      return sessions;
  }
}

function statusBadgeClass(status: InterviewSessionStatus): string {
  switch (status) {
    case "SCHEDULED":
      return "badge info";
    case "RUNNING":
      return "badge warn";
    case "COMPLETED":
      return "badge success";
    case "FAILED":
      return "badge danger";
    case "NO_SHOW":
      return "badge risk";
    case "CANCELLED":
      return "badge";
    default:
      return "badge";
  }
}


export default function InterviewsPage() {
  const { t } = useUiText();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("TUMU");
  const [allSessions, setAllSessions] = useState<InterviewSessionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await apiClient.listInterviewSessions({});
      setAllSessions(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Mülakat listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const counts = useMemo(() => {
    const total = allSessions.length;
    const ready = allSessions.filter((s) => s.status === "COMPLETED").length;
    const ongoing = allSessions.filter((s) => s.status === "RUNNING" || s.status === "SCHEDULED").length;
    const attention = allSessions.filter((s) => s.status === "FAILED" || s.status === "NO_SHOW" || s.status === "CANCELLED").length;
    return { total, ready, ongoing, attention };
  }, [allSessions]);

  const countForCard = (key: TabKey): number => {
    switch (key) {
      case "HAZIR": return counts.ready;
      case "DEVAM": return counts.ongoing;
      case "DIKKAT": return counts.attention;
      case "TUMU": return counts.total;
    }
  };

  const sessions = useMemo(() => filterByTab(allSessions, activeTab), [allSessions, activeTab]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{t("Mülakatlar")}</h1>
          <p className="small" style={{ margin: 0 }}>
            {t("Tek linkli AI görüşme davetlerini, devam eden oturumları ve tamamlanan görüşmeleri takip edin.")}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadSessions()}>
          {t("Yenile")}
        </button>
      </div>

      {/* Filter Cards */}
      {!loading && !error && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {STAT_CARDS.map((card) => {
            const isActive = activeTab === card.key;
            const count = countForCard(card.key);
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => setActiveTab(card.key)}
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
      )}

      {/* States */}
      {loading ? (
        <section className="panel">
          <LoadingState message={t("Mülakat oturumları yükleniyor...")} />
        </section>
      ) : null}
      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadSessions()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        </section>
      ) : null}
      {!loading && !error && sessions.length === 0 ? (
        <section className="panel">
          <EmptyState message={t("Bu filtreye uygun mülakat oturumu bulunamadı.")} />
        </section>
      ) : null}

      {/* Table */}
      {!loading && !error && sessions.length > 0 ? (
        <section className="panel">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Aday")}</th>
                  <th>{t("İlan")}</th>
                  <th>{t("Durum")}</th>
                  <th>{t("Tarih")}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const displayDate = session.endedAt ?? session.startedAt ?? session.scheduledAt;
                  return (
                    <tr
                      key={session.id}
                      onClick={() => router.push(applicationDetailHref(session.applicationId))}
                      style={{ cursor: "pointer" }}
                    >
                      <td style={{ fontWeight: 500 }}>
                        {session.candidateName ?? "—"}
                      </td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {session.jobTitle ?? "—"}
                      </td>
                      <td>
                        <span className={statusBadgeClass(session.status)}>
                          {session.invitation
                            ? t(getInterviewInvitationMeta(session.invitation, session.status).label)
                            : t(INTERVIEW_STATUS_LABELS[session.status])}
                        </span>
                      </td>
                      <td>
                        {displayDate ? formatDate(displayDate) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </section>
  );
}
