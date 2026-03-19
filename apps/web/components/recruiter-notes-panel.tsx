"use client";

import { useState } from "react";
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
      <h4>Notlar ({notes.length})</h4>

      {canAdd ? (
        <div className="notes-add">
          <textarea
            className="form-textarea"
            rows={2}
            placeholder={placeholder}
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
            {submitting ? "Kaydediliyor..." : "Notu Kaydet"}
          </button>
        </div>
      ) : (
        <p className="small" style={{ marginTop: 0 }}>
          Not eklemek için ek yetki gerekiyor.
        </p>
      )}

      {loading ? (
        <p className="small">Yükleniyor...</p>
      ) : notes.length === 0 ? (
        <p className="small">Henüz not yok.</p>
      ) : (
        <ul className="notes-list">
          {notes.map((n) => (
            <li key={n.id} className="note-item">
              <p>{n.noteText}</p>
              <span className="small">{new Date(n.createdAt).toLocaleString("tr-TR")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
