"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiText } from "./site-language-provider";
import type { SourcingOutreachTemplate, SourcingProspectView } from "../lib/types";

type OutreachComposerModalProps = {
  open: boolean;
  prospects: SourcingProspectView[];
  templates: SourcingOutreachTemplate[];
  onClose: () => void;
  onSend: (payload: {
    prospectIds: string[];
    templateId?: string;
    subject?: string;
    body?: string;
    reviewNote?: string;
    sendNow?: boolean;
  }) => Promise<void>;
};

export function OutreachComposerModal({
  open,
  prospects,
  templates,
  onClose,
  onSend
}: OutreachComposerModalProps) {
  const { t } = useUiText();
  const defaultTemplate = useMemo(
    () => templates.find((template) => template.isDefault) ?? templates[0] ?? null,
    [templates]
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedTemplateId(defaultTemplate?.id ?? "");
    setSubject(defaultTemplate?.subjectTemplate ?? "");
    setBody(defaultTemplate?.bodyTemplate ?? "");
    setReviewNote("");
  }, [defaultTemplate, open]);

  if (!open) {
    return null;
  }

  const selectedTemplate =
    templates.find((template) => template.id === selectedTemplateId) ?? defaultTemplate;

  async function handleSubmit(sendNow: boolean) {
    setSending(true);
    try {
      await onSend({
        prospectIds: prospects.map((prospect) => prospect.id),
        templateId: selectedTemplate?.id,
        subject,
        body,
        reviewNote,
        sendNow
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content sourcing-outreach-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{t("Outreach Composer")}</h3>
            <p className="small" style={{ margin: "6px 0 0" }}>
              {t("Recruiter review sonrası tekli veya bulk e-posta gönderin.")}
            </p>
          </div>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ display: "grid", gap: 16 }}>
          <section className="nested-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong>{t("Alıcılar")}</strong>
              <span className="small">{t(`${prospects.length} kişi`)}</span>
            </div>
            <div className="sourcing-chip-wrap">
              {prospects.map((prospect) => (
                <span key={prospect.id} className="sourcing-chip">
                  {prospect.fullName}
                </span>
              ))}
            </div>
          </section>

          {templates.length > 0 ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span className="small">{t("Template")}</span>
              <select
                className="select"
                value={selectedTemplateId}
                onChange={(event) => {
                  const nextTemplate = templates.find((template) => template.id === event.target.value);
                  setSelectedTemplateId(event.target.value);
                  setSubject(nextTemplate?.subjectTemplate ?? "");
                  setBody(nextTemplate?.bodyTemplate ?? "");
                }}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">{t("Konu")}</span>
            <input
              className="input"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={t("Mail konusu")}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">{t("İçerik")}</span>
            <textarea
              className="textarea"
              rows={10}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("Template alanları: {{firstName}}, {{jobTitle}}, {{currentTitle}}, {{currentCompany}}")}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="small">{t("Recruiter Review Notu")}</span>
            <textarea
              className="textarea"
              rows={3}
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              placeholder={t("Bu mesaj neden uygun, hangi segment için gidiyor?")}
            />
          </label>

          {selectedTemplate?.sequence.length ? (
            <section className="nested-panel">
              <strong>{t("Sequence Foundation")}</strong>
              <ul className="plain-list" style={{ marginTop: 10 }}>
                {selectedTemplate.sequence.map((step) => (
                  <li key={`${step.label}-${step.dayOffset}`} className="list-row">
                    <span>{step.label}</span>
                    <span className="small">{t(`Gün ${step.dayOffset}`)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost-button" disabled={sending} onClick={() => void handleSubmit(false)}>
            {t("Taslak Olarak Kaydet")}
          </button>
          <button type="button" className="button-link" disabled={sending} onClick={() => void handleSubmit(true)}>
            {sending ? t("Gönderiliyor...") : t("Gönder")}
          </button>
        </div>
      </div>
    </div>
  );
}
