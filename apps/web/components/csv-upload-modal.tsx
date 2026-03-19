"use client";

import { useState, useRef } from "react";
import { SOURCE_LABELS } from "../lib/constants";
import type { BulkImportCandidate } from "../lib/types";

type CsvUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (candidates: BulkImportCandidate[], source: string) => Promise<void>;
};

function parseCsv(text: string): BulkImportCandidate[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0]!.toLowerCase();
  const sep = header.includes("\t") ? "\t" : header.includes(";") ? ";" : ",";
  const cols = header.split(sep).map((c) => c.trim());

  const colIdx = {
    name: cols.findIndex((c) => /^(ad|name|full.?name|isim)/.test(c)),
    phone: cols.findIndex((c) => /^(tel|phone|telefon)/.test(c)),
    email: cols.findIndex((c) => /^(e?.?mail|eposta)/.test(c)),
    location: cols.findIndex((c) => /^(loc|konum|şehir|sehir|il)/.test(c)),
    experience: cols.findIndex((c) => /^(exp|den|yıl|yil|tecrübe|tecrube)/.test(c))
  };

  if (colIdx.name === -1) return [];

  return lines.slice(1).map((line) => {
    const vals = line.split(sep).map((v) => v.trim());
    return {
      fullName: vals[colIdx.name] ?? "",
      phone: colIdx.phone >= 0 ? vals[colIdx.phone] || undefined : undefined,
      email: colIdx.email >= 0 ? vals[colIdx.email] || undefined : undefined,
      locationText: colIdx.location >= 0 ? vals[colIdx.location] || undefined : undefined,
      yearsOfExperience: colIdx.experience >= 0 && vals[colIdx.experience] ? Number(vals[colIdx.experience]) : undefined
    };
  }).filter((c) => c.fullName.length >= 2);
}

export function CsvUploadModal({ open, onClose, onSubmit }: CsvUploadModalProps) {
  const [candidates, setCandidates] = useState<BulkImportCandidate[]>([]);
  const [source, setSource] = useState("csv_import");
  const [fileName, setFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setCandidates(parsed);
      if (parsed.length === 0) setError("Geçerli aday bulunamadı. Başlık satırında 'Ad' veya 'Name' kolonu olmalı.");
      else setError("");
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (candidates.length === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(candidates, source);
      setCandidates([]);
      setFileName("");
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
          <h3>CSV Yükle</h3>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm">
            CSV, TSV veya noktalı virgülle ayrılmış dosya yükleyin. Başlıklar: Ad, Telefon, Email, Lokasyon, Deneyim
          </p>

          <input type="file" ref={fileRef} accept=".csv,.tsv,.txt" onChange={handleFile} style={{ display: "none" }} />
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
            {fileName || "Dosya Seç"}
          </button>

          {candidates.length > 0 && (
            <div className="csv-preview">
              <p className="text-sm">{candidates.length} aday algılandı</p>
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Ad</th><th>Telefon</th><th>E-posta</th><th>Lokasyon</th><th>Den.</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.slice(0, 5).map((c, i) => (
                    <tr key={i}>
                      <td>{c.fullName}</td>
                      <td>{c.phone ?? "-"}</td>
                      <td>{c.email ?? "-"}</td>
                      <td>{c.locationText ?? "-"}</td>
                      <td>{c.yearsOfExperience ?? "-"}</td>
                    </tr>
                  ))}
                  {candidates.length > 5 && <tr><td colSpan={5} className="text-muted">...ve {candidates.length - 5} daha</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-row">
            <label>Kaynak</label>
            <select className="form-select" value={source} onChange={(e) => setSource(e.target.value)}>
              {["csv_import", "kariyer_net", "linkedin", "eleman_net", "agency", "other"].map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>
              ))}
            </select>
          </div>

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
