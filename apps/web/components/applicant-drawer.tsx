"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiClient } from "../lib/api/recruiter-client";
import { applicationDetailHref, withApiBaseOverride } from "../lib/entity-routes";
import type {
  ApplicantFitScoreView,
  ApplicationStage,
  JobInboxApplicant,
  QuickActionResult,
  QuickActionType,
  RecruiterNote
} from "../lib/types";
import { getStageMeta, getStageActions, SOURCE_LABELS } from "../lib/constants";
import { formatInterviewDeadline, getInterviewInvitationMeta } from "../lib/interview-invitation";
import { FitScoreBreakdown } from "./fit-score-breakdown";
import { InterviewInviteModal } from "./interview-invite-modal";
import { MatchIndicator } from "./match-indicator";
import { RecruiterNotesPanel } from "./recruiter-notes-panel";
import { useUiText } from "./site-language-provider";
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

function outreachOutcomeLabel(status: string | null | undefined) {
  switch (status) {
    case "REPLIED":
      return "Yanıt geldi";
    case "SENT":
      return "Yanıt bekleniyor";
    case "READY_TO_SEND":
      return "Gönderime hazır";
    case "DRAFT":
      return "Taslak oluşturuldu";
    case "FAILED":
      return "Gönderim başarısız";
    case "CANCELLED":
      return "Gönderim iptal edildi";
    default:
      return "Outreach bilgisi yok";
  }
}

function applicantNextAction(applicant: JobInboxApplicant) {
  const interviewMeta = getInterviewInvitationMeta(
    applicant.interview?.invitation ?? null,
    applicant.interview?.status ?? null
  );

  if (applicant.interview) {
    return {
      label: interviewMeta.label,
      detail: applicant.interview.invitation?.expiresAt
        ? `Son geçerlilik: ${formatInterviewDeadline(applicant.interview.invitation.expiresAt)}`
        : interviewMeta.detail
    };
  }

  if (applicant.stage === "RECRUITER_REVIEW") {
    return {
      label: "Mülakata Davet Et",
      detail: "Ön eleme tamamlandı; AI first interview daveti göndermeye hazır."
    };
  }

  if (applicant.stage === "INTERVIEW_COMPLETED") {
    return {
      label: "Karar Ver",
      detail: "AI mülakat tamamlandı; raporu inceleyip recruiter kararını verin."
    };
  }

  if (applicant.sourcing?.latestOutreach?.status === "SENT") {
    return {
      label: "Yanıt Bekleniyor",
      detail: "Sourcing outreach gönderildi; yanıt gelirse hızlıca değerlendirin."
    };
  }

  return {
    label: "AI Ön Eleme Bekleniyor",
    detail: "Applicant akışı screening ve fit score adımlarını sürdürüyor."
  };
}

function buildInviteSuccessMessage(result: { interviewLink: string | null; expiresAt: string | null }) {
  if (result.expiresAt) {
    return `AI mülakat daveti gönderildi. Link ${formatInterviewDeadline(result.expiresAt)} tarihine kadar aktif.`;
  }

  return result.interviewLink
    ? "AI mülakat daveti gönderildi. Direkt görüşme linki hazır."
    : "AI mülakat daveti gönderildi.";
}

function sourceLabel(source: string | null | undefined) {
  if (!source) {
    return "—";
  }

  return SOURCE_LABELS[source] ?? source;
}

export function ApplicantDrawer({ applicant, onClose, onActionDone }: ApplicantDrawerProps) {
  const { t } = useUiText();
  const searchParams = useSearchParams();
  const [fitScore, setFitScore] = useState<ApplicantFitScoreView | null>(null);
  const [notes, setNotes] = useState<RecruiterNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<QuickActionType | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteOutcome, setInviteOutcome] = useState<{ interviewLink: string | null; expiresAt: string | null } | null>(null);

  useEffect(() => {
    setInviteOutcome(null);
    setFitScore(null);
    setNotes([]);

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
    if (action === "invite_interview") {
      setInviteModalOpen(true);
      return;
    }

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
  const interviewMeta = getInterviewInvitationMeta(
    applicant.interview?.invitation ?? null,
    applicant.interview?.status ?? null
  );
  const nextAction = applicantNextAction(applicant);

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
                {t(stageMeta.label)}
              </span>
              <SourceChip source={applicant.source} />
              {applicant.yearsOfExperience != null && <span>{applicant.yearsOfExperience} {t("yıl deneyim")}</span>}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        {/* ── Body ── */}
        <div className="drawer-body">
          {/* İletişim */}
          <div className="drawer-section">
            <h4>{t("İletişim")}</h4>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: "var(--text-secondary)" }}>{t("E-posta")}</span>
              <span>{applicant.email ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
              <span style={{ color: "var(--text-secondary)" }}>{t("Telefon")}</span>
              <span>{applicant.phone ?? "—"}</span>
            </div>
            {applicant.locationText && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--text-secondary)" }}>{t("Lokasyon")}</span>
                <span>{applicant.locationText}</span>
              </div>
            )}
          </div>

          <div className="drawer-section">
            <h4>{t("Kaynak ve Handoff")}</h4>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--text-secondary)" }}>{t("Kaynak")}</span>
                <span>{t(sourceLabel(applicant.source))}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--text-secondary)" }}>{t("Kaynak etiketi")}</span>
                <span>{applicant.externalSource ?? applicant.sourcing?.primarySourceLabel ?? "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--text-secondary)" }}>{t("Sourcing projesi")}</span>
                <span>{applicant.sourcing?.projectName ?? t("Bağlı değil")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span style={{ color: "var(--text-secondary)" }}>{t("Son outreach")}</span>
                <span>{t(outreachOutcomeLabel(applicant.sourcing?.latestOutreach?.status ?? null))}</span>
              </div>
            </div>
            {applicant.sourcing?.sourceLabels.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {applicant.sourcing.sourceLabels.map((label) => (
                  <span key={label} className="sourcing-chip muted">
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            {applicant.sourcing?.latestOutreach?.subject ? (
              <p className="small" style={{ margin: "10px 0 0" }}>
                {t("Son outreach konusu:")} {applicant.sourcing.latestOutreach.subject}
              </p>
            ) : null}
          </div>

          <div className="drawer-section">
            <h4>{t("Sonraki Adım")}</h4>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)"
              }}
            >
              <div style={{ fontWeight: 700 }}>{t(nextAction.label)}</div>
              <p className="small" style={{ margin: "8px 0 0" }}>{t(nextAction.detail)}</p>
              {applicant.interview ? (
                <p className="small" style={{ margin: "8px 0 0" }}>
                  {t("Davet durumu:")} {t(interviewMeta.label)}
                </p>
              ) : null}
              {applicant.interview?.candidateInterviewUrl ? (
                <a
                  href={applicant.interview.candidateInterviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="small"
                  style={{ display: "inline-block", marginTop: 8 }}
                >
                  {t("Gönderilen AI mülakat linkini aç")}
                </a>
              ) : null}
              {inviteOutcome ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: "12px 14px",
                    borderRadius: 10,
                    border: "1px solid var(--success-border, rgba(16, 185, 129, 0.24))",
                    background: "var(--success-light, rgba(16, 185, 129, 0.08))",
                    display: "grid",
                    gap: 6
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--success-text, #16a34a)" }}>
                    {t("Davet hazır")}
                  </div>
                  <p className="small" style={{ margin: 0 }}>
                    {buildInviteSuccessMessage(inviteOutcome)}
                  </p>
                  {inviteOutcome.interviewLink ? (
                    <a
                      href={inviteOutcome.interviewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="small"
                      style={{ display: "inline-block" }}
                    >
                      {t("Yeni AI mülakat linkini aç")}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* AI Önerisi */}
          {aiRec && (
            <div className="drawer-section">
              <h4>{t("AI Önerisi")}</h4>
              <div style={{
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: aiRec.color,
                background: `color-mix(in srgb, ${aiRec.color} 10%, transparent)`,
                border: `1px solid color-mix(in srgb, ${aiRec.color} 25%, transparent)`,
              }}>
                {t(aiRec.label)}
              </div>
            </div>
          )}

          {/* Uyum Skoru & Detaylar */}
          {loading ? (
            <p className="text-muted">{t("Yükleniyor...")}</p>
          ) : (
            <>
              {fitScore && (
                <div className="drawer-section">
                  <div style={{ marginBottom: 12 }}>
                    <MatchIndicator score={fitScore.overallScore} />
                  </div>
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
              href={withApiBaseOverride(applicationDetailHref(applicant.applicationId), searchParams)}
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
                  {a.icon} {t(a.label)}
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
                {confirmAction === "invite_interview" ? t("Mülakata Davet Et") : t("Adayı Reddet")}
              </p>
              <p className="confirm-body">
                {confirmAction === "invite_interview"
                  ? `${applicant.fullName} ${t("adayına tek linkli AI mülakat daveti gönderilecek. Bu akışta slot seçimi yoktur.")}`
                  : `${applicant.fullName} ${t("adayı reddedilecek.")}`}
              </p>
            <div className="confirm-actions">
              <button type="button" className="confirm-btn confirm-btn-cancel" onClick={() => setConfirmAction(null)}>
                {t("Vazgeç")}
                </button>
                <button
                  type="button"
                  className={`confirm-btn ${confirmAction === "reject" ? "confirm-btn-danger" : "confirm-btn-primary"}`}
                  onClick={() => void executeAction()}
                >
                  {confirmAction === "invite_interview" ? t("Evet, Davet Gönder") : t("Evet, Reddet")}
                </button>
              </div>
            </div>
          </div>
        )}

        <InterviewInviteModal
          open={inviteModalOpen}
          applicationId={applicant.applicationId}
          candidateName={applicant.fullName}
          jobTitle={t("Seçili ilan")}
          roleFamily={null}
          onClose={() => setInviteModalOpen(false)}
          onSubmitted={(result) => {
            setInviteModalOpen(false);
            setInviteOutcome({
              interviewLink: result.interviewLink ?? null,
              expiresAt: result.expiresAt ?? null
            });
            onActionDone();
          }}
        />
      </div>
    </div>
  );
}
