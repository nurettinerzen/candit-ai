"use client";

import { useEffect, useState } from "react";
import { useUiText } from "./site-language-provider";
import {
  PROSPECT_FIT_LABELS,
  PROSPECT_FIT_TONES,
  SOURCING_STAGE_META,
  SUPPRESSION_LABELS,
  TALENT_SOURCE_LABELS
} from "../lib/constants";
import { formatDate } from "../lib/format";
import type {
  ContactSuppressionStatus,
  SourcingProspectStage,
  SourcingProspectView
} from "../lib/types";

type ProspectDrawerProps = {
  prospect: SourcingProspectView | null;
  onClose: () => void;
  onStageChange: (stage: SourcingProspectStage, note?: string) => Promise<void>;
  onAttach: () => Promise<void>;
  onComposeOutreach: () => void;
  onSuppressionChange: (
    status: ContactSuppressionStatus,
    reason?: string
  ) => Promise<void>;
};

export function ProspectDrawer({
  prospect,
  onClose,
  onStageChange,
  onAttach,
  onComposeOutreach,
  onSuppressionChange
}: ProspectDrawerProps) {
  const { t } = useUiText();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    setNoteDraft(prospect?.recruiterNote ?? "");
  }, [prospect?.id, prospect?.recruiterNote]);

  if (!prospect) {
    return null;
  }

  const fitTone = PROSPECT_FIT_TONES[prospect.fitLabel];
  const stageMeta = SOURCING_STAGE_META[prospect.stage];
  const discoveryTone =
    prospect.discoveryQuality.label === "HIGH"
      ? "#157f3b"
      : prospect.discoveryQuality.label === "MEDIUM"
        ? "#946200"
        : prospect.discoveryQuality.label === "LOW"
          ? "#9a3412"
          : "var(--text-secondary)";

  async function handleStageChange(stage: SourcingProspectStage, note?: string) {
    setBusyKey(stage);
    try {
      await onStageChange(stage, note);
    } finally {
      setBusyKey(null);
    }
  }

  async function handleAttach() {
    setBusyKey("attach");
    try {
      await onAttach();
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSuppression(status: ContactSuppressionStatus) {
    setBusyKey(status);
    try {
      await onSuppressionChange(
        status,
        status === "ALLOWED" ? undefined : "Recruiter sourcing drawer aksiyonu"
      );
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-header">
          <div>
            <h3>{prospect.fullName}</h3>
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
              <span>{TALENT_SOURCE_LABELS[prospect.sourceKind]}</span>
              {prospect.yearsOfExperience != null ? <span>{t(`${prospect.yearsOfExperience} yıl deneyim`)}</span> : null}
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-section">
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid color-mix(in srgb, ${fitTone} 25%, transparent)`,
                background: `color-mix(in srgb, ${fitTone} 10%, transparent)`
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("AI Fit")}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <strong style={{ color: fitTone, fontSize: 15 }}>{PROSPECT_FIT_LABELS[prospect.fitLabel]}</strong>
                <span style={{ color: fitTone, fontWeight: 700 }}>
                  {prospect.fitScore != null ? `${Math.round(prospect.fitScore)} / 100` : "—"}
                </span>
              </div>
              {prospect.summary ? (
                <p className="small" style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>
                  {prospect.summary}
                </p>
              ) : null}
            </div>
          </div>

          <div className="drawer-section">
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: `1px solid color-mix(in srgb, ${discoveryTone} 25%, transparent)`,
                background: `color-mix(in srgb, ${discoveryTone} 10%, transparent)`
              }}
            >
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("Discovery Kalitesi")}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                <strong style={{ color: discoveryTone, fontSize: 15 }}>{prospect.discoveryQuality.recruiterLabel}</strong>
                <span style={{ color: discoveryTone, fontWeight: 700 }}>
                  {prospect.discoveryQuality.score != null ? `${Math.round(prospect.discoveryQuality.score)} / 100` : "—"}
                </span>
              </div>
              <p className="small" style={{ margin: "8px 0 0", color: "var(--text-secondary)" }}>
                {prospect.discoveryQuality.summary}
              </p>
              {prospect.discoveryQuality.matchedCriteria.length > 0 ? (
                <div className="sourcing-chip-wrap" style={{ marginTop: 10 }}>
                  {prospect.discoveryQuality.matchedCriteria.map((item) => (
                    <span key={item} className="sourcing-chip muted">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              {prospect.discoveryQuality.warnings.length > 0 ? (
                <ul className="plain-list" style={{ marginTop: 10 }}>
                  {prospect.discoveryQuality.warnings.slice(0, 3).map((item) => (
                    <li key={item} className="list-row" style={{ alignItems: "flex-start" }}>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {prospect.discoveryQuality.pageType ? (
                <div className="small" style={{ marginTop: 10 }}>
                  {t("Sayfa tipi")}: {prospect.discoveryQuality.pageType}
                </div>
              ) : null}
            </div>
          </div>

          {prospect.suppressionStatus !== "ALLOWED" ? (
            <div className="drawer-section">
              <div className="badge danger" style={{ width: "100%", justifyContent: "center", padding: "10px 12px" }}>
                {SUPPRESSION_LABELS[prospect.suppressionStatus]}
              </div>
              {prospect.doNotContactReason ? (
                <p className="small" style={{ marginTop: 8 }}>
                  {prospect.doNotContactReason}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="drawer-section">
            <h4>{t("Özet Profil")}</h4>
            <div className="sourcing-drawer-grid">
              <InfoLine label={t("Headline")} value={prospect.headline ?? "—"} />
              <InfoLine label={t("Güncel rol")} value={prospect.currentTitle ?? "—"} />
              <InfoLine label={t("Şirket")} value={prospect.currentCompany ?? "—"} />
              <InfoLine label={t("Lokasyon")} value={prospect.locationText ?? "—"} />
              <InfoLine label={t("E-posta")} value={prospect.email ?? "—"} />
              <InfoLine label={t("Telefon")} value={prospect.phone ?? "—"} />
            </div>
          </div>

          <div className="drawer-section">
            <h4>{t("Neden Uygun?")}</h4>
            <ul className="plain-list">
              {prospect.strengths.length > 0 ? (
                prospect.strengths.map((item) => (
                  <li key={item} className="list-row" style={{ alignItems: "flex-start" }}>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="list-row">
                  <span className="small">{t("Henüz belirgin güçlü sinyal yok.")}</span>
                </li>
              )}
            </ul>
          </div>

          {(prospect.risks.length > 0 || prospect.missingInfo.length > 0) && (
            <div className="drawer-section">
              <h4>{t("Riskler ve Eksikler")}</h4>
              <ul className="plain-list">
                {prospect.risks.map((item) => (
                  <li key={item} className="list-row" style={{ alignItems: "flex-start" }}>
                    <span>{item}</span>
                  </li>
                ))}
                {prospect.missingInfo.map((item) => (
                  <li key={item} className="list-row" style={{ alignItems: "flex-start" }}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {prospect.evidence.length > 0 ? (
            <div className="drawer-section">
              <h4>Kanıtlar</h4>
              <div style={{ display: "grid", gap: 8 }}>
                {prospect.evidence.map((item, index) => (
                  <article
                    key={`${item.title}-${index}`}
                    className="nested-panel"
                    style={{ padding: "12px 14px" }}
                  >
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 13 }}>{item.text}</div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {(prospect.skills.length > 0 || prospect.languages.length > 0) && (
            <div className="drawer-section">
              <h4>{t("Beceriler ve Diller")}</h4>
              <div className="sourcing-chip-wrap">
                {prospect.skills.map((skill) => (
                  <span key={skill} className="sourcing-chip">
                    {skill}
                  </span>
                ))}
                {prospect.languages.map((language) => (
                  <span key={language} className="sourcing-chip muted">
                    {language}
                  </span>
                ))}
              </div>
            </div>
          )}

          {prospect.sourceRecords.length > 0 ? (
            <div className="drawer-section">
              <h4>{t("Kaynak Provenance")}</h4>
              <ul className="plain-list">
                {prospect.sourceRecords.map((record) => (
                  <li key={record.id} className="list-row">
                    <span>
                      {record.providerLabel} · {record.displayName}
                    </span>
                    {record.sourceUrl ? (
                      <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="small">
                        {t("Aç")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {prospect.outreachHistory.length > 0 ? (
            <div className="drawer-section">
              <h4>{t("Outreach Geçmişi")}</h4>
              <ul className="plain-list">
                {prospect.outreachHistory.map((item) => (
                  <li key={item.id} className="list-row">
                    <span>{item.subject}</span>
                    <span className="small">
                      {item.status === "REPLIED"
                        ? t("Yanıt geldi")
                        : item.status === "SENT"
                          ? t("Yanıt bekleniyor")
                          : item.status === "READY_TO_SEND"
                            ? t("Gönderime hazır")
                            : item.status === "DRAFT"
                              ? t("Taslak")
                              : item.sentAt
                                ? formatDate(item.sentAt)
                                : item.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="drawer-section">
            <h4>{t("Recruiter Notu")}</h4>
            <textarea
              className="textarea"
              rows={4}
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder={t(prospect.recruiterNote ?? "Hızlı değerlendirme notu...")}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button
                type="button"
                className="ghost-button"
                disabled={busyKey === "note"}
                onClick={async () => {
                  setBusyKey("note");
                  try {
                    await onStageChange(prospect.stage, noteDraft);
                    setNoteDraft("");
                  } finally {
                    setBusyKey(null);
                  }
                }}
              >
                {t("Notu Kaydet")}
              </button>
            </div>
          </div>
        </div>

        <div className="drawer-footer">
          <div className="drawer-action-row" style={{ flexWrap: "wrap" }}>
            <button
              type="button"
              className="drawer-action-btn drawer-action-interview"
              disabled={busyKey !== null}
              onClick={() => void handleStageChange("GOOD_FIT")}
            >
              {t("İyi Uyum")}
            </button>
            <button
              type="button"
              className="drawer-action-btn"
              disabled={busyKey !== null}
              onClick={() => void handleStageChange("SAVED")}
            >
              {t("Kaydet")}
            </button>
            <button
              type="button"
              className="drawer-action-btn"
              disabled={busyKey !== null || !prospect.email || prospect.suppressionStatus !== "ALLOWED"}
              onClick={onComposeOutreach}
            >
              {t("Outreach")}
            </button>
            <button
              type="button"
              className="drawer-action-btn"
              disabled={busyKey !== null || Boolean(prospect.attachedApplicationId)}
              onClick={() => void handleAttach()}
            >
              {prospect.attachedApplicationId ? t("Akışa Alındı") : t("İlana Ekle")}
            </button>
            <button
              type="button"
              className="drawer-action-btn drawer-action-reject"
              disabled={busyKey !== null}
              onClick={() => void handleStageChange("REJECTED")}
            >
              {t("Uygun Değil")}
            </button>
            <button
              type="button"
              className="drawer-action-btn"
              disabled={busyKey !== null}
              onClick={() =>
                void handleSuppression(
                  prospect.suppressionStatus === "ALLOWED" ? "DO_NOT_CONTACT" : "ALLOWED"
                )
              }
            >
              {prospect.suppressionStatus === "ALLOWED" ? t("Do Not Contact") : t("Temizle")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{value}</div>
    </div>
  );
}
