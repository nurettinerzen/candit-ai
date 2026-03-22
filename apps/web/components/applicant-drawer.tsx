"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api/recruiter-client";
import type { ApplicantFitScoreView, ApplicationStage, JobInboxApplicant, QuickActionType, RecruiterNote } from "../lib/types";
import { getStageMeta, getStageActions } from "../lib/constants";
import { FitScoreBreakdown } from "./fit-score-breakdown";
import { RecruiterNotesPanel } from "./recruiter-notes-panel";
import { SourceChip } from "./source-chip";

type ApplicantDrawerProps = {
  applicant: JobInboxApplicant | null;
  onClose: () => void;
  onActionDone: () => void;
};

/* ── helpers ── */

function recruiterDecisionLabel(decision: string): { label: string; color: string } {
  switch (decision) {
    case "ADVANCE": return { label: "✓ İlerlet — Güçlü uyum tespit edildi", color: "var(--success, #22c55e)" };
    case "HOLD": return { label: "🔍 İncele — Detaylı değerlendirme önerilir", color: "var(--warn, #f59e0b)" };
    case "REVIEW": return { label: "🔍 İncele — Detaylı değerlendirme önerilir", color: "var(--warn, #f59e0b)" };
    case "REJECT": return { label: "✕ Reddet — Uyum düşük", color: "var(--danger, #ef4444)" };
    default: return { label: decision, color: "var(--text-secondary)" };
  }
}

const ACTION_BTN_CLASSES: Record<string, string> = {
  invite_interview: "drawer-action-btn drawer-action-interview",
  reject: "drawer-action-btn drawer-action-reject",
};

export function ApplicantDrawer({ applicant, onClose, onActionDone }: ApplicantDrawerProps) {
  const [fitScore, setFitScore] = useState<ApplicantFitScoreView | null>(null);
  const [notes, setNotes] = useState<RecruiterNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<QuickActionType | null>(null);

  useEffect(() => {
    if (!applicant) return;
    setLoading(true);
    Promise.all([
      apiClient.getLatestFitScore(applicant.applicationId).catch(() => null),
      apiClient.listRecruiterNotes(applicant.applicationId).catch(() => [])
    ]).then(([fs, n]) => {
      setFitScore(fs);
      setNotes(n);
    }).finally(() => setLoading(false));
  }, [applicant?.applicationId]);

  if (!applicant) return null;

  const stage = applicant.stage as ApplicationStage;
  const stageMeta = getStageMeta(stage);
  const actions = getStageActions(stage);

  const handleAction = (action: QuickActionType) => {
    setConfirmAction(action);
  };

  const executeAction = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    setActionLoading(action);
    try {
      await apiClient.quickAction(applicant.applicationId, { action });
      onActionDone();
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async (text: string) => {
    const note = await apiClient.addRecruiterNote(applicant.applicationId, text);
    setNotes((prev) => [note, ...prev]);
  };

  const aiRec = applicant.aiRecommendation ? recruiterDecisionLabel(applicant.aiRecommendation) : null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="drawer-header">
          <div>
            <h3>{applicant.fullName}</h3>
            <div className="drawer-meta">
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
              <SourceChip source={applicant.source} />
              {applicant.yearsOfExperience != null && <span>{applicant.yearsOfExperience} yıl deneyim</span>}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        {/* ── Body ── */}
        <div className="drawer-body">
          {/* İletişim */}
          <div className="drawer-section">
            <h4>İletişim</h4>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: "var(--text-secondary)" }}>E-posta</span>
              <span>{applicant.email ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: "var(--text-secondary)" }}>Telefon</span>
              <span>{applicant.phone ?? "—"}</span>
            </div>
            {applicant.locationText && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--text-secondary)" }}>Lokasyon</span>
                <span>{applicant.locationText}</span>
              </div>
            )}
          </div>

          {/* AI Önerisi */}
          {aiRec && (
            <div className="drawer-section">
              <h4>AI Önerisi</h4>
              <div style={{
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: aiRec.color,
                background: `color-mix(in srgb, ${aiRec.color} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${aiRec.color} 25%, transparent)`,
              }}>
                {aiRec.label}
              </div>
            </div>
          )}

          {/* Uyum Skoru & Detaylar */}
          {loading ? (
            <p className="text-muted">Yükleniyor...</p>
          ) : (
            <>
              {fitScore && (
                <div className="drawer-section">
                  <FitScoreBreakdown fitScore={fitScore} />
                </div>
              )}
              {!fitScore && (
                <div className="drawer-section">
                  <p className="text-muted">Uyum skoru henüz hesaplanmadı.</p>
                </div>
              )}

              {/* Notlar */}
              <div className="drawer-section">
                <RecruiterNotesPanel notes={notes} onAdd={handleAddNote} />
              </div>
            </>
          )}

          {/* Detail Link */}
          <div className="drawer-section" style={{ paddingTop: 8, borderTop: "1px solid var(--border)" }}>
            <Link
              href={`/applications/${applicant.applicationId}`}
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: "none" }}
            >
              Detaylı İncele &rarr;
            </Link>
          </div>
        </div>

        {/* ── Footer: Karar Butonları (stage'e göre dinamik) ── */}
        {actions.length > 0 && (
          <div className="drawer-footer">
            <div className="drawer-action-row">
              {actions.map((a) => (
                <button
                  key={a.key}
                  type="button"
                  className={ACTION_BTN_CLASSES[a.key] ?? "drawer-action-btn"}
                  onClick={() => void handleAction(a.key as QuickActionType)}
                  disabled={actionLoading !== null}
                >
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Onay Diyaloğu */}
        {confirmAction && (
          <div className="confirm-overlay" onClick={() => setConfirmAction(null)}>
            <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
              <p className="confirm-title">
                {confirmAction === "invite_interview" ? "Mülakata Davet Et" : "Adayı Reddet"}
              </p>
              <p className="confirm-body">
                {confirmAction === "invite_interview"
                  ? `${applicant.fullName} adayına AI mülakat daveti gönderilecek.`
                  : `${applicant.fullName} adayı reddedilecek.`}
              </p>
              <div className="confirm-actions">
                <button type="button" className="confirm-btn confirm-btn-cancel" onClick={() => setConfirmAction(null)}>
                  Vazgeç
                </button>
                <button
                  type="button"
                  className={`confirm-btn ${confirmAction === "reject" ? "confirm-btn-danger" : "confirm-btn-primary"}`}
                  onClick={() => void executeAction()}
                >
                  {confirmAction === "invite_interview" ? "Evet, Davet Gönder" : "Evet, Reddet"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
