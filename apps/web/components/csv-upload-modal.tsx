"use client";

import { useState } from "react";
import { SOURCE_LABELS } from "../lib/constants";
import { parseBulkImportCsv, type ParsedBulkImportCsv } from "../lib/csv-import";
import type { BulkImportCandidate } from "../lib/types";
import { useUiText } from "./site-language-provider";

type CsvUploadModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (candidates: BulkImportCandidate[], source: string, externalSource?: string) => Promise<void>;
};

export function CsvUploadModal({ open, onClose, onSubmit }: CsvUploadModalProps) {
  const { locale, t } = useUiText();
  const [candidates, setCandidates] = useState<BulkImportCandidate[]>([]);
  const [parsedFile, setParsedFile] = useState<ParsedBulkImportCsv | null>(null);
  const [source, setSource] = useState("csv_import");
  const [externalSource, setExternalSource] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceTouched, setSourceTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const labels =
    locale === "en"
      ? {
          title: "Upload CSV",
          intro:
            "Upload a CSV, TSV, or semicolon-delimited file. Expected headers: Name, Phone, Email, Location, Experience.",
          invalidCandidates:
            "No valid candidates were found. The header row must include a 'Name' or 'Full Name' column.",
          genericError: "Something went wrong.",
          selectFile: "Select File",
          autoSource: "Detected source",
          fieldMapping: "Detected field mapping",
          noMapping: "No field mapping found yet.",
          reference: "Reference",
          delimiter: "Delimiter",
          delimiters: {
            ",": "Comma",
            ";": "Semicolon",
            "\t": "Tab"
          },
          detected: `${candidates.length} candidates detected`,
          headers: {
            name: "Name",
            phone: "Phone",
            email: "Email",
            location: "Location",
            experience: "Exp.",
            reference: "Reference"
          },
          more: `...and ${Math.max(candidates.length - 5, 0)} more`,
          source: "Source",
          cancel: "Cancel",
          submitting: "Importing...",
          submit: `${candidates.length} Candidate${candidates.length === 1 ? "" : "s"}`
        }
      : {
          title: "CSV Yükle",
          intro:
            "CSV, TSV veya noktalı virgülle ayrılmış dosya yükleyin. Başlıklar: Ad, Telefon, E-posta, Lokasyon, Deneyim.",
          invalidCandidates:
            "Geçerli aday bulunamadı. Başlık satırında 'Ad' veya 'Name' kolonu olmalı.",
          genericError: "Bir hata oluştu.",
          selectFile: "Dosya Seç",
          autoSource: "Algılanan kaynak",
          fieldMapping: "Algılanan alan eşleşmesi",
          noMapping: "Henüz bir alan eşleşmesi bulunamadı.",
          reference: "Referans",
          delimiter: "Ayraç",
          delimiters: {
            ",": "Virgül",
            ";": "Noktalı virgül",
            "\t": "Tab"
          },
          detected: `${candidates.length} aday algılandı`,
          headers: {
            name: "Ad",
            phone: "Telefon",
            email: "E-posta",
            location: "Lokasyon",
            experience: "Den.",
            reference: "Referans"
          },
          more: `...ve ${Math.max(candidates.length - 5, 0)} daha`,
          source: "Kaynak",
          cancel: "İptal",
          submitting: "İçe aktarılıyor...",
          submit: `${candidates.length} Aday Ekle`
        };

  if (!open) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseBulkImportCsv(text, file.name);
      setParsedFile(parsed);
      setCandidates(parsed.candidates);
      if (!sourceTouched && parsed.detectedSource !== "csv_import") {
        setSource(parsed.detectedSource);
        setExternalSource("");
      }
      if (parsed.candidates.length === 0) setError(labels.invalidCandidates);
      else setError("");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (candidates.length === 0) return;
    if (source === "other" && !externalSource.trim()) {
      setError(t("Diğer kaynak seçildiğinde kaynak adı zorunludur."));
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(candidates, source, source === "other" ? externalSource.trim() || undefined : undefined);
      setCandidates([]);
      setParsedFile(null);
      setFileName("");
      setExternalSource("");
      setSource("csv_import");
      setSourceTouched(false);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : labels.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{labels.title}</h3>
          <button type="button" className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p className="text-muted text-sm">{labels.intro}</p>

          <div style={{ position: "relative", display: "inline-flex" }}>
            <button type="button" className="btn btn-secondary" tabIndex={-1} aria-hidden="true">
              {fileName || labels.selectFile}
            </button>
            <input
              aria-label={labels.selectFile}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFile}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "pointer"
              }}
            />
          </div>

          {candidates.length > 0 && (
            <div className="csv-preview">
              <p className="text-sm">{labels.detected}</p>
              {parsedFile ? (
                <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
                  <div className="text-xs text-muted">
                    {labels.autoSource}: <strong>{t(SOURCE_LABELS[parsedFile.detectedSource] ?? parsedFile.detectedSource)}</strong>
                    {" · "}
                    {labels.delimiter}: <strong>{labels.delimiters[parsedFile.delimiter]}</strong>
                  </div>
                  <div className="text-xs text-muted">{labels.fieldMapping}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Object.entries(parsedFile.mappedHeaders)
                      .filter(([, value]) => Boolean(value))
                      .map(([key, value]) => (
                        <span
                          key={key}
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "5px 10px",
                            borderRadius: 999,
                            color: "var(--text-secondary)",
                            background: "rgba(255,255,255,0.06)"
                          }}
                        >
                          {key === "fullName"
                            ? labels.headers.name
                            : key === "phone"
                              ? labels.headers.phone
                              : key === "email"
                                ? labels.headers.email
                                : key === "locationText"
                                  ? labels.headers.location
                                  : key === "yearsOfExperience"
                                    ? labels.headers.experience
                                    : labels.headers.reference}
                          {" ← "}
                          {value}
                        </span>
                      ))}
                  </div>
                  {Object.values(parsedFile.mappedHeaders).every((value) => !value) ? (
                    <div className="text-xs text-muted">{labels.noMapping}</div>
                  ) : null}
                </div>
              ) : null}
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{labels.headers.name}</th>
                    <th>{labels.headers.phone}</th>
                    <th>{labels.headers.email}</th>
                    <th>{labels.headers.location}</th>
                    <th>{labels.headers.experience}</th>
                    <th>{labels.headers.reference}</th>
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
                      <td>{c.externalRef ?? "-"}</td>
                    </tr>
                  ))}
                  {candidates.length > 5 ? (
                    <tr>
                      <td colSpan={6} className="text-muted">
                        {labels.more}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}

          <div className="form-row">
            <label>{labels.source}</label>
            <select
              className="form-select"
              value={source}
              onChange={(e) => {
                const nextSource = e.target.value;
                setSourceTouched(true);
                setSource(nextSource);
                if (nextSource !== "other") {
                  setExternalSource("");
                }
              }}
            >
              {["csv_import", "kariyer_net", "linkedin", "eleman_net", "agency", "other"].map((s) => (
                <option key={s} value={s}>
                  {t(SOURCE_LABELS[s] ?? s)}
                </option>
              ))}
            </select>
          </div>

          {source === "other" ? (
            <div className="form-row">
              <label>{t("Dış Kaynak Adı")}</label>
              <input
                className="form-input"
                value={externalSource}
                onChange={(e) => setExternalSource(e.target.value)}
                placeholder={t("Kaynak adı")}
              />
            </div>
          ) : null}

          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {labels.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting || candidates.length === 0}>
            {submitting ? labels.submitting : labels.submit}
          </button>
        </div>
      </div>
    </div>
  );
}
