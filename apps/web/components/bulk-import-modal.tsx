"use client";

import { useState } from "react";
import { SOURCE_LABELS } from "../lib/constants";
import type { BulkImportCandidate } from "../lib/types";

type BulkImportModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (candidates: BulkImportCandidate[], source: string, externalSource?: string) => Promise<void>;
};

const IMPORT_SOURCES = ["kariyer_net", "linkedin", "eleman_net", "agency", "referral", "csv_import", "other"] as const;

function parseCandidates(raw: string): BulkImportCandidate[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;\t]/).map((p) => p.trim());
      return {
        fullName: parts[0] ?? "",
        phone: parts[1] || undefined,
        email: parts[2] || undefined,
        locationText: parts[3] || undefined,
        yearsOfExperience: parts[4] ? Number(parts[4]) : undefined
      };
    })
    .filter((c) => c.fullName.length >= 2);
}

export function BulkImportModal({ open, onClose, onSubmit }: BulkImportModalProps) {
  const [raw, setRaw] = useState("");
  const [source, setSource] = useState("kariyer_net");
  const [externalSource, setExternalSource] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const candidates = parseCandidates(raw);

  const handleSubmit = async () => {
    if (candidates.length === 0) {
      setError("En az 1 geçerli aday gerekli.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(candidates, source, externalSource || undefined);
      setRaw("");
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Toplu Aday Ekle</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm">
            Her satıra bir aday. Alanlar noktalı virgül veya tab ile ayrılır:<br />
            <code>Ad Soyad; Telefon; E-posta; Lokasyon; Deneyim (yıl)</code>
          </p>

          <textarea
            className="form-textarea"
            rows={8}
            placeholder={"Ayşe Doğan; 0532 111 2233; ayse@email.com; İstanbul; 4\nAli Yılmaz; 0533 222 3344; ali@email.com; İstanbul; 3"}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />

          <p className="text-sm">{candidates.length} aday algılandı</p>

          <div className="form-row">
            <label>Kaynak</label>
            <select className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
              {IMPORT_SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>

          {source === "other" && (
            <div className="form-row">
              <label>Dış Kaynak Adı</label>
              <input className="form-input" value={externalSource} onChange={(e) => setExternalSource(e.target.value)} placeholder="Kaynak adı" />
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>İptal</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || candidates.length === 0}>
            {submitting ? "İçe aktarılıyor..." : `${candidates.length} Aday Ekle`}
          </button>
        </div>
      </div>
    </div>
  );
}
