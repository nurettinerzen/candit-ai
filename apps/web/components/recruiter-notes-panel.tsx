"use client";

import { useState } from "react";
import { useUiText } from "./site-language-provider";
import { formatDate } from "../lib/format";
import type { RecruiterNote } from "../lib/types";

type RecruiterNotesPanelProps = {
  notes: RecruiterNote[];
  onAdd: (text: string) => Promise<void>;
  loading?: boolean;
  canAdd?: boolean;
  placeholder?: string;
};

export function RecruiterNotesPanel({
  notes,
  onAdd,
  loading,
  canAdd = true,
  placeholder = "Not ekle..."
}: RecruiterNotesPanelProps) {
  const { t } = useUiText();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="notes-panel">
      <h4>{t("Notlar")} ({notes.length})</h4>

      {canAdd ? (
        <div className="notes-add">
          <textarea
            className="form-textarea"
            rows={2}
            placeholder={t(placeholder)}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={submitting}
          />
          <button
            type="button"
            className="button-link"
            onClick={handleSubmit}
            disabled={submitting || !text.trim()}
          >
            {submitting ? t("Kaydediliyor...") : t("Notu Kaydet")}
          </button>
        </div>
      ) : (
        <p className="small" style={{ marginTop: 0 }}>
          {t("Not eklemek için ek yetki gerekiyor.")}
        </p>
      )}

      {loading ? (
        <p className="small">{t("Yükleniyor...")}</p>
      ) : notes.length === 0 ? (
        <p className="small">{t("Henüz not yok.")}</p>
      ) : (
        <ul className="notes-list">
          {notes.map((n) => (
            <li key={n.id} className="note-item">
              <p>{n.noteText}</p>
              <span className="small">{formatDate(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
