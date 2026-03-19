"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { apiClient } from "../../../lib/api-client";
import { formatDate } from "../../../lib/format";
import type { InterviewSessionStatus, InterviewSessionView } from "../../../lib/types";

const INTERVIEW_STATUS_LABELS: Record<InterviewSessionStatus, string> = {
  SCHEDULED: "Planlandı",
  RUNNING: "Devam Ediyor",
  COMPLETED: "Tamamlandı",
  FAILED: "Başarısız",
  NO_SHOW: "Katılım Yok",
  CANCELLED: "İptal Edildi",
};

type TabKey = "INCELEME_BEKLEYEN" | "BEKLEYEN" | "BUGUN" | "AKTIF" | "SORUNLU" | "TUMU";

const TABS: { key: TabKey; label: string }[] = [
  { key: "INCELEME_BEKLEYEN", label: "İnceleme Bekleyen" },
  { key: "BEKLEYEN", label: "Randevu Bekleyen" },
  { key: "BUGUN", label: "Bugün" },
  { key: "AKTIF", label: "Devam Eden" },
  { key: "SORUNLU", label: "Sorunlu" },
  { key: "TUMU", label: "Tümü" },
];

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function filterByTab(sessions: InterviewSessionView[], tab: TabKey): InterviewSessionView[] {
  switch (tab) {
    case "INCELEME_BEKLEYEN":
      return sessions.filter((s) => s.status === "COMPLETED");
    case "BEKLEYEN":
      return sessions.filter((s) => s.status === "SCHEDULED");
    case "BUGUN":
      return sessions.filter((s) =>
        (s.status === "SCHEDULED" || s.status === "RUNNING") && isToday(s.scheduledAt)
      );
    case "AKTIF":
      return sessions.filter((s) => s.status === "RUNNING");
    case "SORUNLU":
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

function renderProgress(session: InterviewSessionView): string {
  if (session.status === "RUNNING") {
    if (session.progress && session.progress.totalBlocks > 0) {
      return `${session.progress.answeredBlocks}/${session.progress.totalBlocks} (${Math.round(session.progress.ratio * 100)}%)`;
    }
    return "Devam Ediyor";
  }
  if (session.status === "COMPLETED") {
    return "Tamamlandı";
  }
  return "—";
}

function renderNextAction(session: InterviewSessionView) {
  switch (session.status) {
    case "SCHEDULED":
      return <span className="text-muted">Aday bekleniyor</span>;
    case "RUNNING":
      return <span style={{ color: "var(--warn-text)" }}>Görüşme devam ediyor</span>;
    case "COMPLETED":
      return (
        <Link href={`/applications/${session.applicationId}`} className="table-action-link">
          Sonuçları İncele
        </Link>
      );
    case "FAILED":
      return <span style={{ color: "var(--risk)" }}>Yeniden planlanmalı</span>;
    case "NO_SHOW":
      return <span style={{ color: "var(--warn-text)" }}>Aday katılmadı</span>;
    case "CANCELLED":
      return <span className="text-muted">İptal edildi</span>;
    default:
      return "—";
  }
}

export default function InterviewsPage() {
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
    const reviewPending = allSessions.filter((s) => s.status === "COMPLETED").length;
    const scheduled = allSessions.filter((s) => s.status === "SCHEDULED").length;
    const today = allSessions.filter((s) =>
      (s.status === "SCHEDULED" || s.status === "RUNNING") && isToday(s.scheduledAt)
    ).length;
    const running = allSessions.filter((s) => s.status === "RUNNING").length;
    const problematic = allSessions.filter((s) => s.status === "FAILED" || s.status === "NO_SHOW" || s.status === "CANCELLED").length;
    return { total, reviewPending, scheduled, today, running, problematic };
  }, [allSessions]);

  const sessions = useMemo(() => filterByTab(allSessions, activeTab), [allSessions, activeTab]);

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>Mülakatlar</h1>
          <p className="small" style={{ margin: 0 }}>
            Planlanan, devam eden ve tamamlanan görüşmeleri takip edin. İnceleme bekleyenlere öncelik verin.
          </p>
          <p className="text-xs text-muted" style={{ margin: "6px 0 0" }}>
            Voice görüşmelerde açılan bağlantı adayın gerçek mülakat ekranıdır; recruiter tarafında önizleme amacıyla da kullanılabilir.
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadSessions()}>
          Yenile
        </button>
      </div>

      {/* KPI Stats Bar */}
      {!loading && !error && (
        <div className="inbox-stats">
          <div className="inbox-stat">
            <span className="inbox-stat-value">{counts.total}</span>
            <span className="inbox-stat-label">Toplam</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value" style={{ color: counts.reviewPending > 0 ? "var(--success)" : undefined }}>{counts.reviewPending}</span>
            <span className="inbox-stat-label">İnceleme Bekleyen</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value">{counts.scheduled}</span>
            <span className="inbox-stat-label">Planlanmış</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value">{counts.today}</span>
            <span className="inbox-stat-label">Bugün</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value">{counts.running}</span>
            <span className="inbox-stat-label">Devam Eden</span>
          </div>
          <div className="inbox-stat">
            <span className="inbox-stat-value" style={{ color: counts.problematic > 0 ? "var(--risk)" : undefined }}>{counts.problematic}</span>
            <span className="inbox-stat-label">Sorunlu</span>
          </div>
        </div>
      )}

      {/* Tab Filter Pills */}
      {!loading && !error && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const count = filterByTab(allSessions, tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
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
              >
                {tab.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* States */}
      {loading ? (
        <section className="panel">
          <LoadingState message="Mülakat oturumları yükleniyor..." />
        </section>
      ) : null}
      {!loading && error ? (
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadSessions()}>
                Tekrar dene
              </button>
            }
          />
        </section>
      ) : null}
      {!loading && !error && sessions.length === 0 ? (
        <section className="panel">
          <EmptyState message="Bu filtreye uygun mülakat oturumu bulunamadı." />
        </section>
      ) : null}

      {/* Table */}
      {!loading && !error && sessions.length > 0 ? (
        <section className="panel">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Başvuru</th>
                  <th>Durum</th>
                  <th>Planlanan Tarih</th>
                  <th>İlerleme</th>
                  <th>Sonraki Adım</th>
                  <th>Aday Görüşme Ekranı</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <Link href={`/applications/${session.applicationId}`}>
                        {session.applicationId.slice(0, 8)}...
                      </Link>
                    </td>
                    <td>
                      <span className={statusBadgeClass(session.status)}>
                        {INTERVIEW_STATUS_LABELS[session.status]}
                      </span>
                    </td>
                    <td>{session.scheduledAt ? formatDate(session.scheduledAt) : "—"}</td>
                    <td>{renderProgress(session)}</td>
                    <td>{renderNextAction(session)}</td>
                    <td>
                      {session.candidateInterviewUrl ? (
                        <a href={session.candidateInterviewUrl} target="_blank" rel="noreferrer" className="table-action-link">
                          Önizle
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
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
