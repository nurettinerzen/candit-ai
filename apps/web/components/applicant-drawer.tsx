"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api/recruiter-client";
import type { ApplicantFitScoreView, JobInboxApplicant, QuickActionType, RecruiterNote } from "../lib/types";
import { FitScoreBreakdown } from "./fit-score-breakdown";
import { RecruiterNotesPanel } from "./recruiter-notes-panel";
import { QuickActionMenu } from "./quick-action-menu";
import { SourceChip } from "./source-chip";
import { StageChip } from "./stage-chip";
import type { ApplicationStage } from "../lib/types";

type ApplicantDrawerProps = {
  applicant: JobInboxApplicant | null;
  onClose: () => void;
  onActionDone: () => void;
};

/* ── helpers ── */

function interviewStatusLabel(status: string): string {
  switch (status) {
    case "SCHEDULED": return "\u{1F4C5} Planlandı";
    case "RUNNING": return "\u{1F504} Devam Ediyor";
    case "COMPLETED": return "\u2705 Tamamlandı";
    case "FAILED": return "\u274C Başarısız";
    case "NO_SHOW": return "\u26A0\uFE0F Katılmadı";
    case "CANCELLED": return "\u{1F6AB} İptal Edildi";
    default: return status;
  }
}

function schedulingStateLabel(state: string): string {
  switch (state) {
    case "PENDING": return "Beklemede";
    case "LINK_SENT": return "Bağlantı Gönderildi";
    case "CONFIRMED": return "Onaylandı";
    case "EXPIRED": return "Süresi Doldu";
    case "CANCELLED": return "İptal Edildi";
    default: return state;
  }
}

function recruiterDecisionLabel(decision: string): string {
  switch (decision) {
    case "ADVANCE": return "\u2705 İlerlet";
    case "HOLD": return "\u23F8\uFE0F Beklet";
    case "REVIEW": return "\u{1F50D} İncele";
    case "REJECT": return "\u274C Reddet";
    default: return decision;
  }
}

export function ApplicantDrawer({ applicant, onClose, onActionDone }: ApplicantDrawerProps) {
  const [fitScore, setFitScore] = useState<ApplicantFitScoreView | null>(null);
  const [notes, setNotes] = useState<RecruiterNote[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleAction = async (action: QuickActionType) => {
    await apiClient.quickAction(applicant.applicationId, { action });
    onActionDone();
  };

  const handleAddNote = async (text: string) => {
    const note = await apiClient.addRecruiterNote(applicant.applicationId, text);
    setNotes((prev) => [note, ...prev]);
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>{applicant.fullName}</h3>
            <div className="drawer-meta">
              <StageChip stage={applicant.stage as ApplicationStage} />
              <SourceChip source={applicant.source} />
              {applicant.yearsOfExperience != null && <span>{applicant.yearsOfExperience} yıl deneyim</span>}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <h4>İletişim</h4>
            <p>{applicant.email ?? "-"} &middot; {applicant.phone ?? "-"}</p>
            {applicant.locationText && <p>{applicant.locationText}</p>}
          </div>

          {/* Interview Status */}
          {applicant.interview && (
            <div className="drawer-section">
              <h4>Görüşme Durumu</h4>
              <p>
                <strong>Durum:</strong> {interviewStatusLabel(applicant.interview.status)}
              </p>
              <p>
                <strong>Görüşme Formatı:</strong> {applicant.interview.mode}
              </p>
              {applicant.interview.scheduledAt && (
                <p>
                  <strong>Tarih:</strong> {new Date(applicant.interview.scheduledAt).toLocaleString("tr-TR")}
                </p>
              )}
            </div>
          )}

          {/* Scheduling State */}
          {applicant.scheduling && (
            <div className="drawer-section">
              <h4>Planlama Durumu</h4>
              <p>
                <strong>Durum:</strong> {schedulingStateLabel(applicant.scheduling.state)}
              </p>
              <p>
                <strong>Süreç:</strong> {applicant.scheduling.status}
              </p>
            </div>
          )}

          {/* AI Recommendation */}
          {applicant.recruiterDecision && (
            <div className="drawer-section">
              <h4>AI Önerisi</h4>
              <p style={{ fontSize: "1.1em" }}>{recruiterDecisionLabel(applicant.recruiterDecision)}</p>
            </div>
          )}

          <div className="drawer-section">
            <h4>Hızlı İşlemler</h4>
            <QuickActionMenu onAction={handleAction} />
          </div>

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

              <div className="drawer-section">
                <RecruiterNotesPanel notes={notes} onAdd={handleAddNote} />
              </div>
            </>
          )}

          {/* Detail Link */}
          <div className="drawer-section" style={{ paddingTop: 8 }}>
            <Link
              href={`/applications/${applicant.applicationId}`}
              className="btn btn-secondary btn-sm"
              style={{ textDecoration: "none" }}
            >
              Detaylı İncele &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
