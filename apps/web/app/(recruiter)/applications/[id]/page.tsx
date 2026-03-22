"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RecruiterNotesPanel } from "../../../../components/recruiter-notes-panel";
import { ErrorState, LoadingState } from "../../../../components/ui-states";
import { FitScoreBreakdown } from "../../../../components/fit-score-breakdown";
import { apiClient } from "../../../../lib/api-client";
import {
  getRecruiterStageMeta,
  getStageActions,
  STAGE_LABELS
} from "../../../../lib/constants";
import { formatDate } from "../../../../lib/format";
import type {
  ApplicantFitScoreView,
  ApplicationDetailReadModel,
  ApplicationStage,
  QuickActionType,
  RecruiterNote
} from "../../../../lib/types";

/* ── helpers ── */

function aiRecommendationBanner(rec: string | null): { label: string; detail: string; color: string } | null {
  if (!rec) return null;
  switch (rec) {
    case "ADVANCE":
      return { label: "AI Önerisi: İlerlet", detail: "Güçlü uyum tespit edildi", color: "var(--success, #22c55e)" };
    case "HOLD":
      return { label: "AI Önerisi: Beklet", detail: "İnceleme gerekiyor", color: "var(--warn, #f59e0b)" };
    case "REVIEW":
      return { label: "AI Önerisi: İncele", detail: "Detaylı değerlendirme önerilir", color: "var(--warn, #f59e0b)" };
    case "REJECT":
      return { label: "AI Önerisi: Reddet", detail: "Uyum düşük", color: "var(--danger, #ef4444)" };
    default:
      return null;
  }
}

function stageHistoryLabel(from: string | null, to: string): string {
  const fromLabel = from ? (STAGE_LABELS[from as ApplicationStage] ?? from) : null;
  const toLabel = STAGE_LABELS[to as ApplicationStage] ?? to;
  if (!fromLabel) return `Başvuru oluşturuldu`;
  return `${fromLabel} → ${toLabel}`;
}

function reasonLabel(code: string | null): string {
  if (!code) return "";
  const map: Record<string, string> = {
    application_created: "Sistem",
    shortlisted: "İlerletildi",
    advanced_by_recruiter: "Recruiter tarafından ilerletildi",
    rejected_by_recruiter: "Recruiter tarafından reddedildi",
    held_by_recruiter: "Bekletildi",
    manual_stage_transition: "Manuel geçiş",
    manual_recruiter_advance: "Manuel ilerletme",
    screening_triggered_by_recruiter: "Ön eleme başlatıldı",
    interview_approved: "Görüşmeye onaylandı",
  };
  return map[code] ?? code;
}

/* ── page ── */

export default function ApplicationDetailPage() {
  const params = useParams();
  const applicationId = params.id as string;

  const [data, setData] = useState<ApplicationDetailReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fitScore, setFitScore] = useState<ApplicantFitScoreView | null>(null);
  const [notes, setNotes] = useState<RecruiterNote[]>([]);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirmAction, setConfirmAction] = useState<QuickActionType | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiClient.applicationDetailReadModel(applicationId);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  const loadFitScore = useCallback(async () => {
    try {
      const fs = await apiClient.getLatestFitScore(applicationId);
      setFitScore(fs);
    } catch {
      // Fit score may not exist yet
    }
  }, [applicationId]);

  const loadNotes = useCallback(async () => {
    try {
      const n = await apiClient.listRecruiterNotes(applicationId);
      setNotes(n);
    } catch {
      // Notes may fail silently
    }
  }, [applicationId]);

  useEffect(() => {
    void loadData();
    void loadFitScore();
    void loadNotes();
  }, [loadData, loadFitScore, loadNotes]);

  const handleAction = (action: QuickActionType) => {
    setConfirmAction(action);
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    setActionLoading(action);
    setActionMessage("");
    setActionError("");
    try {
      await apiClient.quickAction(applicationId, { action });
      const messages: Record<string, string> = {
        reject: "Aday reddedildi.",
        invite_interview: "Görüşme daveti gönderildi.",
      };
      setActionMessage(messages[action] ?? "İşlem tamamlandı.");
      void loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async (text: string) => {
    const note = await apiClient.addRecruiterNote(applicationId, text);
    setNotes((prev) => [note, ...prev]);
  };

  if (loading) return <LoadingState message="Başvuru detayı yükleniyor..." />;
  if (error) return <ErrorState error={error} actions={<button className="ghost-button" onClick={() => void loadData()}>Tekrar dene</button>} />;
  if (!data) return null;

  const { summary, candidate, job } = data;
  const stageMeta = getRecruiterStageMeta(summary.stage as ApplicationStage, summary.humanDecision);
  const aiBanner = aiRecommendationBanner(summary.aiRecommendation);
  const stageHistory = data.timeline?.stageHistory ?? [];

  return (
    <div className="page-grid">
      {/* Breadcrumb */}
      <div style={{ marginBottom: 16 }}>
        <Link href={`/jobs/${job.id}`} className="text-muted text-sm" style={{ textDecoration: "none" }}>
          ← {job.title}
        </Link>
        <span className="text-muted text-sm"> / {candidate.fullName}</span>
      </div>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* ═══ LEFT COLUMN ═══ */}
        <div>

          {/* Candidate Card */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>{candidate.fullName}</h2>
                <p className="text-sm text-muted" style={{ marginTop: 2 }}>{job.title} başvurusu</p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, fontWeight: 600, color: stageMeta.color }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: stageMeta.color, display: "inline-block" }} />
                  {stageMeta.label}
                </div>
              </div>
              <button className="ghost-button" onClick={() => void loadData()}>Yenile</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid var(--border)" }}>
              <InfoCell label="E-posta" value={candidate.email ?? "—"} />
              <InfoCell label="Telefon" value={candidate.phone ?? "—"} />
              <InfoCell label="Lokasyon" value="—" />
              <InfoCell label="Kaynak" value={candidate.source ?? "—"} highlight />
              <InfoCell label="CV" value={candidate.cvFiles && candidate.cvFiles.length > 0 ? "✓ Mevcut" : "Yok"} success={candidate.cvFiles && candidate.cvFiles.length > 0} />
              <InfoCell label="Başvuru Tarihi" value={formatDate(summary.createdAt)} />
            </div>
          </section>

          {/* AI Recommendation Banner */}
          {aiBanner && (
            <div style={{
              padding: "12px 16px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: `color-mix(in srgb, ${aiBanner.color} 10%, transparent)`,
              border: `1px solid color-mix(in srgb, ${aiBanner.color} 25%, transparent)`,
              color: aiBanner.color,
            }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div style={{ flex: 1 }}>
                <div>{aiBanner.label}</div>
                <div style={{ fontSize: 12, fontWeight: 400, color: "var(--text-secondary)", marginTop: 2 }}>
                  {aiBanner.detail}
                </div>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Sadece öneridir</span>
            </div>
          )}

          {/* Fit Score */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <div className="section-head">
              <h3>Aday Uyum Skoru</h3>
              <span className="text-xs text-muted">Sadece öneridir</span>
            </div>
            <p className="small text-muted" style={{ marginBottom: 12 }}>AI tarafından otomatik hesaplanan uyum değerlendirmesi.</p>

            {fitScore ? (
              <FitScoreBreakdown fitScore={fitScore} />
            ) : (
              <p className="text-muted text-sm">Uyum skoru henüz hesaplanmadı.</p>
            )}
          </section>

          {/* AI Decision Summary */}
          {fitScore?.reasoning && (
            <section className="panel" style={{ marginBottom: 16 }}>
              <div className="section-head">
                <h3>AI Karar Özeti</h3>
                <span className="text-xs text-muted">Sadece öneridir</span>
              </div>
              <p className="small text-muted" style={{ marginBottom: 12 }}>Tüm AI kaynaklarından derlenen bütünsel değerlendirme.</p>
              <p style={{ fontSize: 14, lineHeight: 1.8 }}>{fitScore.reasoning}</p>
              <p className="text-xs text-muted" style={{ marginTop: 8, fontStyle: "italic" }}>
                V1 Güvenlik Kuralı: AI çıktısı otomatik karar uygulamaz. Tüm kararlar recruiter onayı ile tamamlanır.
              </p>
            </section>
          )}

          {/* Interview Status */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Görüşme</h3>
            <p className="small text-muted" style={{ marginBottom: 12 }}>Mülakat planlama ve durum takibi.</p>

            {data.interview?.latestSession ? (
              <div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 14px", borderRadius: 8,
                  background: "var(--primary-light, rgba(124,115,250,0.08))",
                  border: "1px solid rgba(124,115,250,0.2)",
                  fontSize: 13, marginBottom: 8,
                }}>
                  <span>📅</span>
                  <span style={{ fontWeight: 600 }}>
                    {interviewStatusText(data.interview.latestSession.status)}
                  </span>
                </div>
                {data.interview.latestSession.scheduledAt && (
                  <p className="text-sm" style={{ padding: "4px 0" }}>
                    <span className="text-muted">Tarih: </span>
                    {new Date(data.interview.latestSession.scheduledAt).toLocaleString("tr-TR")}
                  </p>
                )}
              </div>
            ) : (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
                fontSize: 13,
              }}>
                <span>📅</span>
                <span style={{ color: "var(--text-secondary)" }}>Henüz planlanmadı</span>
              </div>
            )}

            <p className="text-sm text-muted" style={{ marginTop: 8 }}>
              Görüşme daveti gönderildiğinde aday direkt AI görüşme linki alır.
            </p>
          </section>

          {/* Stage History Timeline */}
          {stageHistory.length > 0 && (
            <section className="panel" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 4 }}>Aşama Geçmişi</h3>
              <p className="small text-muted" style={{ marginBottom: 16 }}>Bu başvurunun aşamalar arası geçiş kaydı.</p>

              <div style={{ position: "relative", paddingLeft: 20 }}>
                <div style={{ position: "absolute", left: 5, top: 0, bottom: 0, width: 2, background: "var(--border)" }} />
                {stageHistory.map((entry: StageHistoryEntry, i: number) => (
                  <div key={i} style={{ position: "relative", paddingBottom: i < stageHistory.length - 1 ? 16 : 0 }}>
                    <span style={{
                      position: "absolute", left: -20, top: 2,
                      width: 12, height: 12, borderRadius: "50%",
                      background: i === 0 ? "var(--primary, #7c73fa)" : "var(--border)",
                      border: "2px solid var(--surface)",
                    }} />
                    <div className="text-xs text-muted">{formatDate(entry.changedAt)}</div>
                    <div style={{ fontSize: 13, marginTop: 2 }}>
                      {stageHistoryLabel(entry.fromStage, entry.toStage)}
                    </div>
                    {entry.reasonCode && (
                      <div className="text-xs text-muted">{reasonLabel(entry.reasonCode)}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ═══ RIGHT COLUMN (Sticky) ═══ */}
        <div style={{ position: "sticky", top: 24 }}>

          {/* Action Messages */}
          {actionMessage && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13,
              background: "color-mix(in srgb, var(--success, #22c55e) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--success, #22c55e) 25%, transparent)",
              color: "var(--success, #22c55e)",
            }}>
              {actionMessage}
            </div>
          )}
          {actionError && (
            <div style={{
              padding: "10px 14px", borderRadius: 8, marginBottom: 12, fontSize: 13,
              background: "color-mix(in srgb, var(--danger, #ef4444) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--danger, #ef4444) 25%, transparent)",
              color: "var(--danger, #ef4444)",
            }}>
              {actionError}
            </div>
          )}

          {/* Decision Card */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Karar Merkezi</h3>
            <p className="small text-muted" style={{ marginBottom: 14 }}>Bu başvuru için kararınızı verin.</p>
            {(() => {
              const actions = getStageActions(summary.stage as ApplicationStage);
              if (actions.length === 0) return <p className="text-sm text-muted">Bu aşamada işlem yapılamaz.</p>;
              return (
                <div style={{ display: "grid", gridTemplateColumns: actions.length > 1 ? "1fr 1fr" : "1fr", gap: 8 }}>
                  {actions.map((act) => (
                    <button
                      key={act.key}
                      type="button"
                      className={`drawer-action-btn drawer-action-${act.key === "invite_interview" ? "interview" : act.key}`}
                      style={{ padding: "10px 8px", fontSize: 13, borderRadius: 8, textAlign: "center" }}
                      onClick={() => handleAction(act.key as QuickActionType)}
                      disabled={actionLoading !== null}
                    >
                      {act.icon} {act.label}
                    </button>
                  ))}
                </div>
              );
            })()}
          </section>

          {/* Confirmation Dialog */}
          {confirmAction && (
            <div className="confirm-overlay" onClick={() => setConfirmAction(null)}>
              <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: 8, fontSize: 16 }}>
                  {confirmAction === "invite_interview" ? "Mülakata Davet Et" : "Adayı Reddet"}
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                  {confirmAction === "invite_interview"
                    ? "Adaya otomatik mülakat daveti e-postası gönderilecek. Bu işlem geri alınamaz."
                    : "Aday reddedilecek. Bu işlem geri alınamaz."}
                </p>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    className="confirm-btn confirm-btn-cancel"
                    onClick={() => setConfirmAction(null)}
                  >
                    Vazgeç
                  </button>
                  <button
                    className={`confirm-btn ${confirmAction === "reject" ? "confirm-btn-danger" : "confirm-btn-primary"}`}
                    onClick={() => void executeAction()}
                  >
                    {confirmAction === "invite_interview" ? "Daveti Gönder" : "Reddet"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <section className="panel" style={{ marginBottom: 16 }}>
            <RecruiterNotesPanel notes={notes} onAdd={handleAddNote} />
          </section>

          {/* CV */}
          {candidate.cvFiles && candidate.cvFiles.length > 0 && (
            <section className="panel" style={{ marginBottom: 16, padding: "16px 20px" }}>
              <h4 className="text-xs text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 8, fontWeight: 700 }}>
                Özgeçmiş
              </h4>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <span style={{ color: "var(--primary)" }}>CV mevcut ({candidate.cvFiles.length} dosya)</span>
              </div>
            </section>
          )}

          <Link
            href="/applications"
            className="text-xs text-muted"
            style={{ textDecoration: "none", display: "inline-block", marginTop: 4 }}
          >
            ← Başvuru listesine dön
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function InfoCell({ label, value, highlight, success }: { label: string; value: string; highlight?: boolean; success?: boolean }) {
  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-secondary)", fontWeight: 600, letterSpacing: "0.3px", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        color: highlight ? "var(--primary)" : success ? "var(--success, #22c55e)" : undefined,
        wordBreak: "break-all",
      }}>
        {value}
      </div>
    </div>
  );
}

function interviewStatusText(status: string): string {
  switch (status) {
    case "SCHEDULED": return "📅 Planlandı";
    case "RUNNING": return "🔄 Devam Ediyor";
    case "COMPLETED": return "✅ Tamamlandı";
    case "FAILED": return "❌ Başarısız";
    case "NO_SHOW": return "⚠️ Katılmadı";
    case "CANCELLED": return "🚫 İptal Edildi";
    default: return status;
  }
}

type StageHistoryEntry = {
  fromStage: string | null;
  toStage: string;
  changedAt: string;
  reasonCode: string | null;
  changedBy: string | null;
};
