"use client";

import { useEffect, useMemo, useState } from "react";
import { useUiText } from "./site-language-provider";
import { SOURCE_LABELS } from "../lib/constants";
import type { ScreeningMode } from "../lib/types";

type BulkCvUploadModalProps = {
  open: boolean;
  onClose: () => void;
  screeningMode: ScreeningMode;
  onSubmit: (
    files: File[],
    source: string,
    externalSource: string | undefined,
    screeningMode: ScreeningMode
  ) => Promise<void>;
};

const IMPORT_SOURCES = [
  "kariyer_net",
  "linkedin",
  "eleman_net",
  "agency",
  "referral",
  "manual",
  "other"
] as const;

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt"];

function dedupeFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function BulkCvUploadModal({
  open,
  onClose,
  onSubmit,
  screeningMode
}: BulkCvUploadModalProps) {
  const { locale, t } = useUiText();
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("kariyer_net");
  const [externalSource, setExternalSource] = useState("");
  const [selectedScreeningMode, setSelectedScreeningMode] = useState<ScreeningMode>(screeningMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const totalSizeMb = useMemo(
    () => (files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1),
    [files]
  );
  const labels =
    locale === "en"
      ? {
          title: "Bulk CV Upload",
          intro:
            "Drop resume files in bulk. The system creates candidate records, parses the CV, and queues the evaluation chain.",
          invalidType: "Only PDF, DOC, DOCX, or TXT files can be uploaded.",
          noFiles: "Add at least one CV file.",
          submitError: "CV upload could not be completed.",
          selectFile: "Select Files",
          dropTitle: "Drop CV files here",
          dropSubtitle: "Supported formats: PDF, DOC, DOCX, TXT",
          source: "Source",
          screeningMode: "Screening Mode",
          screeningModeHelp:
            "This setting changes how optimistic or selective the AI screening assistant behaves for the CVs you are about to queue.",
          externalSource: "External Source Name",
          externalSourcePlaceholder: "Source name",
          selectedFiles: `${files.length} files selected`,
          approxSize: `about ${totalSizeMb} MB`,
          remove: "Remove",
          cancel: "Cancel",
          submitBusy: "Queueing...",
          submitIdle: `Upload ${files.length} CV${files.length === 1 ? "" : "s"}`
        }
      : {
          title: "Toplu CV Yükle",
          intro:
            "PDF ve DOCX başta olmak üzere CV dosyalarını topluca bırakın. Sistem aday kaydını oluşturur, CV'yi parse eder ve değerlendirme zincirini kuyruğa alır.",
          invalidType: "Yalnızca PDF, DOC, DOCX veya TXT dosyaları yüklenebilir.",
          noFiles: "En az bir CV dosyası ekleyin.",
          submitError: "CV yükleme işlemi tamamlanamadı.",
          selectFile: "Dosya Seç",
          dropTitle: "CV dosyalarını buraya bırakın",
          dropSubtitle: "Desteklenen formatlar: PDF, DOC, DOCX, TXT",
          source: "Kaynak",
          screeningMode: "Screening Modu",
          screeningModeHelp:
            "Bu ayar, birazdan kuyruğa alacağınız CV'lerde AI screening asistanının ne kadar iyimser veya seçici davranacağını belirler.",
          externalSource: "Dış Kaynak Adı",
          externalSourcePlaceholder: "Kaynak adı",
          selectedFiles: `${files.length} dosya seçildi`,
          approxSize: `yaklaşık ${totalSizeMb} MB`,
          remove: "Kaldır",
          cancel: "İptal",
          submitBusy: "Kuyruğa alınıyor...",
          submitIdle: `${files.length} CV Yükle`
        };

  const screeningModeOptions =
    locale === "en"
      ? [
          {
            value: "WIDE_POOL" as ScreeningMode,
            label: "Wide Pool",
            description: "More optimistic. Keeps adjacent and promising candidates in play longer."
          },
          {
            value: "BALANCED" as ScreeningMode,
            label: "Balanced",
            description: "Balanced default. Protects against clear mismatches without over-filtering."
          },
          {
            value: "STRICT" as ScreeningMode,
            label: "Strict",
            description: "More selective. Advances only when role-fit and execution signals are clearer."
          }
        ]
      : [
          {
            value: "WIDE_POOL" as ScreeningMode,
            label: "Geniş Havuz",
            description: "Daha iyimser davranır. Yakın uyumlu ve umut veren adayları daha uzun süre oyunda tutar."
          },
          {
            value: "BALANCED" as ScreeningMode,
            label: "Dengeli",
            description: "Varsayılan dengeli moddur. Açık uyumsuzlukları ayıklar ama gereksiz sertleşmez."
          },
          {
            value: "STRICT" as ScreeningMode,
            label: "Sıkı Eleme",
            description: "Daha seçici davranır. Rol uyumu ve execution kanıtı daha net adayları öne çıkarır."
          }
        ];

  const selectedScreeningModeOption =
    screeningModeOptions.find((item) => item.value === selectedScreeningMode)
    ?? screeningModeOptions.find((item) => item.value === "BALANCED")
    ?? {
      value: "BALANCED" as ScreeningMode,
      label: locale === "en" ? "Balanced" : "Dengeli",
      description:
        locale === "en"
          ? "Balanced default. Protects against clear mismatches without over-filtering."
          : "Varsayılan dengeli moddur. Açık uyumsuzlukları ayıklar ama gereksiz sertleşmez."
    };

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedScreeningMode(screeningMode);
  }, [open, screeningMode]);

  if (!open) return null;

  const appendFiles = (nextFiles: FileList | File[]) => {
    const selected = Array.from(nextFiles).filter((file) =>
      ACCEPTED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
    );

    if (selected.length === 0) {
      setError(labels.invalidType);
      return;
    }

    setError("");
    setFiles((current) => dedupeFiles([...current, ...selected]));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError(labels.noFiles);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onSubmit(files, source, externalSource || undefined, selectedScreeningMode);
      setFiles([]);
      setExternalSource("");
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : labels.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()}>
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
              {labels.selectFile}
            </button>
            <input
              aria-label={labels.selectFile}
              type="file"
              multiple
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={(event) => {
                if (event.target.files?.length) {
                  appendFiles(event.target.files);
                }
                event.target.value = "";
              }}
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

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              if (event.dataTransfer.files?.length) {
                appendFiles(event.dataTransfer.files);
              }
            }}
            style={{
              marginTop: 12,
              borderRadius: 12,
              border: `1px dashed ${
                dragActive ? "var(--primary, #5046e5)" : "var(--border, rgba(148, 163, 184, 0.2))"
              }`,
              background: dragActive
                ? "var(--primary-muted, rgba(99, 102, 241, 0.08))"
                : "var(--surface-muted, rgba(15, 23, 42, 0.16))",
              padding: "22px 18px",
              textAlign: "center"
            }}
          >
            <strong style={{ display: "block", marginBottom: 6 }}>{labels.dropTitle}</strong>
            <span className="text-sm text-muted">{labels.dropSubtitle}</span>
          </div>

          <div className="form-row" style={{ marginTop: 16 }}>
            <label>{labels.source}</label>
            <select className="form-select" value={source} onChange={(event) => setSource(event.target.value)}>
              {IMPORT_SOURCES.map((item) => (
                <option key={item} value={item}>
                  {t(SOURCE_LABELS[item] ?? item)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row" style={{ marginTop: 16 }}>
            <label>{labels.screeningMode}</label>
            <select
              className="form-select"
              value={selectedScreeningMode}
              onChange={(event) => setSelectedScreeningMode(event.target.value as ScreeningMode)}
            >
              {screeningModeOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted" style={{ marginTop: 8 }}>
              {labels.screeningModeHelp} {selectedScreeningModeOption.description}
            </p>
          </div>

          {source === "other" ? (
            <div className="form-row">
              <label>{labels.externalSource}</label>
              <input
                className="form-input"
                value={externalSource}
                onChange={(event) => setExternalSource(event.target.value)}
                placeholder={labels.externalSourcePlaceholder}
              />
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <div className="text-sm" style={{ marginBottom: 8 }}>
              {labels.selectedFiles} · {labels.approxSize}
            </div>

            {files.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  maxHeight: 220,
                  overflowY: "auto"
                }}
              >
                {files.map((file) => (
                  <div
                    key={`${file.name}:${file.size}:${file.lastModified}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      border: "1px solid var(--border, rgba(148, 163, 184, 0.2))",
                      borderRadius: 10
                    }}
                  >
                    <span className="text-sm" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      className="ghost-button"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() =>
                        setFiles((current) =>
                          current.filter(
                            (item) =>
                              `${item.name}:${item.size}:${item.lastModified}` !==
                              `${file.name}:${file.size}:${file.lastModified}`
                          )
                        )
                      }
                    >
                      {labels.remove}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p className="text-danger text-sm">{error}</p> : null}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {labels.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting || files.length === 0}>
            {submitting ? labels.submitBusy : labels.submitIdle}
          </button>
        </div>
      </div>
    </div>
  );
}
