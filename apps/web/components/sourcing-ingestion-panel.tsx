"use client";

import { useId, useMemo, useRef, useState } from "react";
import { SOURCE_LABELS } from "../lib/constants";
import { useUiText } from "./site-language-provider";
import type {
  SourcingImportedLead,
  SourcingImportSourceType,
  SourcingLeadImportSummary
} from "../lib/types";

type SourcingIngestionPanelProps = {
  jobImportHref?: string | null;
  onImportLeads: (payload: {
    sourceType: SourcingImportSourceType;
    sourceLabel?: string;
    leads: SourcingImportedLead[];
  }) => Promise<SourcingLeadImportSummary>;
  onImportUrls: (payload: {
    urls: string[];
    note?: string;
  }) => Promise<SourcingLeadImportSummary>;
};

type ParsedTable = {
  headers: string[];
  rows: string[][];
};

type LeadFieldKey =
  | "ignore"
  | "fullName"
  | "headline"
  | "currentTitle"
  | "currentCompany"
  | "locationText"
  | "email"
  | "phone"
  | "yearsOfExperience"
  | "sourceUrl"
  | "skills"
  | "languages"
  | "notes"
  | "externalRef";

type ImportPresetKey =
  | "general_lead_list"
  | "job_board_export"
  | "referral_agency_list";

const IMPORT_SOURCE_OPTIONS: SourcingImportSourceType[] = [
  "recruiter_import",
  "job_board_export",
  "agency_upload",
  "referral"
];

const IMPORT_PRESETS: Record<ImportPresetKey, {
  label: string;
  sourceType: SourcingImportSourceType;
  sourceLabel: string;
}> = {
  general_lead_list: {
    label: "Genel Lead Listesi",
    sourceType: "recruiter_import",
    sourceLabel: "Genel Lead Listesi"
  },
  job_board_export: {
    label: "İş panosu dışa aktarımı",
    sourceType: "job_board_export",
    sourceLabel: "İş panosu dışa aktarımı"
  },
  referral_agency_list: {
    label: "Referans / ajans listesi",
    sourceType: "agency_upload",
    sourceLabel: "Referans / ajans listesi"
  }
};

const FIELD_OPTIONS: Array<{ value: LeadFieldKey; label: string }> = [
  { value: "ignore", label: "Yoksay" },
  { value: "fullName", label: "Ad Soyad" },
  { value: "headline", label: "Profil başlığı" },
  { value: "currentTitle", label: "Unvan" },
  { value: "currentCompany", label: "Şirket" },
  { value: "locationText", label: "Lokasyon" },
  { value: "email", label: "E-posta" },
  { value: "phone", label: "Telefon" },
  { value: "yearsOfExperience", label: "Deneyim Yılı" },
  { value: "sourceUrl", label: "Açık profil URL'si" },
  { value: "skills", label: "Yetenek etiketleri" },
  { value: "languages", label: "Diller" },
  { value: "notes", label: "Not" },
  { value: "externalRef", label: "Harici referans" }
];

function detectSeparator(headerLine: string) {
  const candidates: Array<"," | ";" | "\t"> = [",", ";", "\t"];
  const scored = candidates.map((separator) => ({
    separator,
    count: headerLine.split(separator).length
  }));
  return scored.sort((left, right) => right.count - left.count)[0]?.separator ?? ",";
}

function parseDelimitedLine(line: string, separator: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function parseDelimitedText(text: string): ParsedTable | null {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return null;
  }

  const separator = detectSeparator(lines[0] ?? "");
  const headers = parseDelimitedLine(lines[0] ?? "", separator).map((item) => item.trim());
  const rows = lines.slice(1).map((line) => parseDelimitedLine(line, separator));

  if (headers.length === 0 || rows.length === 0) {
    return null;
  }

  return { headers, rows };
}

function inferField(header: string): LeadFieldKey {
  const normalized = header.toLocaleLowerCase("tr-TR");
  if (/^(ad|isim|name|full.?name)/.test(normalized)) return "fullName";
  if (/^(headline|profil|summary)/.test(normalized)) return "headline";
  if (/^(title|unvan|position|rol)/.test(normalized)) return "currentTitle";
  if (/^(company|şirket|sirket|employer)/.test(normalized)) return "currentCompany";
  if (/^(loc|konum|şehir|sehir|il|location)/.test(normalized)) return "locationText";
  if (/^(e.?mail|eposta|email)/.test(normalized)) return "email";
  if (/^(tel|telefon|phone|gsm|mobile)/.test(normalized)) return "phone";
  if (/^(exp|deneyim|tecrübe|tecrube|yıl|yil)/.test(normalized)) return "yearsOfExperience";
  if (/^(url|link|profil.?url|source.?url|website|site)/.test(normalized)) return "sourceUrl";
  if (/^(skill|skills|yetkinlik|beceri)/.test(normalized)) return "skills";
  if (/^(lang|dil|languages)/.test(normalized)) return "languages";
  if (/^(note|not|açıklama|aciklama|comment)/.test(normalized)) return "notes";
  if (/^(ref|external.?ref|aday.?id|lead.?id)/.test(normalized)) return "externalRef";
  return "ignore";
}

function splitListValue(value: string) {
  return [...new Set(value.split(/[,\n|/]/).map((item) => item.trim()).filter(Boolean))];
}

function buildLeadsFromTable(table: ParsedTable, mapping: LeadFieldKey[]) {
  return table.rows
    .map((row) => {
      const lead: SourcingImportedLead = {
        fullName: ""
      };

      mapping.forEach((field, columnIndex) => {
        const value = row[columnIndex]?.trim();
        if (!value || field === "ignore") {
          return;
        }

        switch (field) {
          case "yearsOfExperience":
            lead.yearsOfExperience = Number(value);
            break;
          case "skills":
            lead.skills = splitListValue(value);
            break;
          case "languages":
            lead.languages = splitListValue(value);
            break;
          default:
            (lead as Record<string, unknown>)[field] = value;
            break;
        }
      });

      return lead;
    })
    .filter((lead) => lead.fullName.trim().length >= 2);
}

function mappingStorageKey(preset: ImportPresetKey, headers: string[]) {
  return `sourcing-import-mapping:${preset}:${headers.map((header) => header.toLocaleLowerCase("tr-TR")).join("|")}`;
}

function SummaryBlock({ summary }: { summary: SourcingLeadImportSummary }) {
  const { t } = useUiText();
  return (
    <div className="nested-panel" style={{ marginTop: 12 }}>
      <strong>{summary.sourceLabel}</strong>
      <ul className="plain-list" style={{ marginTop: 10 }}>
        <li className="list-row">
          <span>{t("İşlenen kayıt")}</span>
          <strong>
            {summary.processedRecords} / {summary.totalRecords}
          </strong>
        </li>
        <li className="list-row">
          <span>{t("Yeni profil / Yeni aday adayı")}</span>
          <strong>
            {summary.newProfiles} / {summary.newProspects}
          </strong>
        </li>
        <li className="list-row">
          <span>{t("Birleştirilen / Yinelenen")}</span>
          <strong>
            {summary.mergedProfiles} / {summary.duplicateProspects}
          </strong>
        </li>
        <li className="list-row">
          <span>{t("Mevcut aday eşleşmesi")}</span>
          <strong>{summary.existingCandidateMatches}</strong>
        </li>
        <li className="list-row">
          <span>{t("Hata")}</span>
          <strong>{summary.errorCount}</strong>
        </li>
      </ul>
      {summary.errors.length > 0 ? (
        <p className="small" style={{ margin: "8px 0 0" }}>
          {t("İlk hata")}: {summary.errors[0]?.reason}
        </p>
      ) : null}
    </div>
  );
}

export function SourcingIngestionPanel({
  jobImportHref,
  onImportLeads,
  onImportUrls
}: SourcingIngestionPanelProps) {
  const { t } = useUiText();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();
  const [selectedPreset, setSelectedPreset] = useState<ImportPresetKey>("general_lead_list");
  const [importSourceType, setImportSourceType] = useState<SourcingImportSourceType>("recruiter_import");
  const [importSourceLabel, setImportSourceLabel] = useState("");
  const [fileName, setFileName] = useState("");
  const [parsedTable, setParsedTable] = useState<ParsedTable | null>(null);
  const [fieldMapping, setFieldMapping] = useState<LeadFieldKey[]>([]);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [csvSummary, setCsvSummary] = useState<SourcingLeadImportSummary | null>(null);

  const [urlText, setUrlText] = useState("");
  const [urlNote, setUrlNote] = useState("");
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [urlSummary, setUrlSummary] = useState<SourcingLeadImportSummary | null>(null);

  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState("");
  const [manualSummary, setManualSummary] = useState<SourcingLeadImportSummary | null>(null);
  const [manualLead, setManualLead] = useState<SourcingImportedLead>({
    fullName: "",
    currentTitle: "",
    currentCompany: "",
    locationText: "",
    email: "",
    phone: "",
    sourceUrl: "",
    skills: [],
    notes: ""
  });

  const previewLeads = useMemo(
    () => (parsedTable ? buildLeadsFromTable(parsedTable, fieldMapping).slice(0, 5) : []),
    [fieldMapping, parsedTable]
  );

  function openFilePicker() {
    const input = fileRef.current;
    if (!input) {
      return;
    }

    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {
      // Fall back to click below.
    }

    input.click();
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setCsvSummary(null);
    setCsvError("");
    const reader = new FileReader();
    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const table = parseDelimitedText(raw);
      if (!table) {
        setParsedTable(null);
        setFieldMapping([]);
        setCsvError(t("CSV/TSV dosyası çözümlenemedi. Başlık satırı ve en az bir veri satırı gerekli."));
        return;
      }

      setParsedTable(table);
      const inferredMapping = table.headers.map((header) => inferField(header));
      let resolvedMapping = inferredMapping;

      try {
        const stored = window.localStorage.getItem(mappingStorageKey(selectedPreset, table.headers));
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length === table.headers.length) {
            resolvedMapping = parsed as LeadFieldKey[];
          }
        }
      } catch {
        // localStorage is best-effort only
      }

      setFieldMapping(resolvedMapping);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function handleCsvImport() {
    if (!parsedTable) {
      return;
    }

    const leads = buildLeadsFromTable(parsedTable, fieldMapping);
    if (leads.length === 0) {
      setCsvError(t("Mapping sonrası geçerli lead bulunamadı."));
      return;
    }

    setCsvBusy(true);
    setCsvError("");
    try {
      const summary = await onImportLeads({
        sourceType: importSourceType,
        sourceLabel: importSourceLabel.trim() || undefined,
        leads
      });
      try {
        window.localStorage.setItem(
          mappingStorageKey(selectedPreset, parsedTable.headers),
          JSON.stringify(fieldMapping)
        );
      } catch {
        // localStorage is best-effort only
      }
      setCsvSummary(summary);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : t("Import tamamlanamadı."));
    } finally {
      setCsvBusy(false);
    }
  }

  async function handleUrlImport() {
    const urls = [...new Set(urlText.split(/\n|,/).map((item) => item.trim()).filter(Boolean))];
    if (urls.length === 0) {
      setUrlError(t("En az bir açık profil URL'si girin."));
      return;
    }

    setUrlBusy(true);
    setUrlError("");
    try {
      const summary = await onImportUrls({
        urls,
        note: urlNote.trim() || undefined
      });
      setUrlSummary(summary);
      setUrlText("");
      setUrlNote("");
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : t("URL içe alımı tamamlanamadı."));
    } finally {
      setUrlBusy(false);
    }
  }

  async function handleManualLeadCreate() {
    if (!manualLead.fullName?.trim()) {
      setManualError(t("Ad soyad zorunlu."));
      return;
    }

    setManualBusy(true);
    setManualError("");
    try {
      const summary = await onImportLeads({
        sourceType: "recruiter_import",
        leads: [
          {
            ...manualLead,
            skills: manualLead.skills
          }
        ]
      });
      setManualSummary(summary);
      setManualLead({
        fullName: "",
        currentTitle: "",
        currentCompany: "",
        locationText: "",
        email: "",
        phone: "",
        sourceUrl: "",
        skills: [],
        notes: ""
      });
    } catch (error) {
      setManualError(error instanceof Error ? error.message : t("Kayıt oluşturulamadı."));
    } finally {
      setManualBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="nested-panel">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <strong>{t("İşe alımcı destekli aday içe aktarımı")}</strong>
            <p className="small" style={{ marginTop: 6 }}>
              {t("CSV / iş panosu dışa aktarımı, açık profil URL'si ve tekil kayıt oluşturma ile sourcing projesine gerçek aday ekleyin.")}
            </p>
          </div>
        </div>
        {jobImportHref ? (
          <p className="small" style={{ margin: 0 }}>
            {t("CV paketi elinizdeyse başvuru akışına geçirmek için")}{" "}
            <a href={jobImportHref}>{t("İlan Merkezi üzerindeki toplu CV yükleme")}</a>{" "}
            {t("akışını kullanın.")}
          </p>
        ) : null}
      </div>

      <div className="nested-panel">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <strong>{t("CSV / iş panosu dışa aktarımı")}</strong>
            <p className="small" style={{ marginTop: 6 }}>
              {t("CSV, TSV veya dış iş panosu dışa aktarma dosyasını yükleyin; alan eşlemesini gözden geçirip projeye alın.")}
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div className="small" style={{ marginBottom: 8 }}>{t("Hızlı preset")}</div>
            <div className="sourcing-chip-wrap">
              {(Object.entries(IMPORT_PRESETS) as Array<[ImportPresetKey, (typeof IMPORT_PRESETS)[ImportPresetKey]]>).map(([key, preset]) => (
                <button
                  key={key}
                  type="button"
                  className={`sourcing-chip interactive${selectedPreset === key ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedPreset(key);
                    setImportSourceType(preset.sourceType);
                    setImportSourceLabel(t(preset.sourceLabel));
                  }}
                >
                  {t(preset.label)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 10 }}>
            <select
              className="select"
              value={importSourceType}
              onChange={(event) => setImportSourceType(event.target.value as SourcingImportSourceType)}
            >
              {IMPORT_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(SOURCE_LABELS[option] ?? option)}
                </option>
              ))}
            </select>
            <input
              className="input"
              value={importSourceLabel}
              onChange={(event) => setImportSourceLabel(event.target.value)}
              placeholder={t("Opsiyonel kaynak etiketi")}
            />
          </div>

          <input
            id={fileInputId}
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileSelect}
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: "hidden",
              clip: "rect(0, 0, 0, 0)",
              whiteSpace: "nowrap",
              border: 0
            }}
          />
          <button type="button" className="ghost-button" onClick={openFilePicker}>
            {fileName || t("CSV / Export Dosyası Seç")}
          </button>

          {parsedTable ? (
            <>
              <div className="small">
                {t(`${parsedTable.rows.length} satır algılandı. Alan eşlemesini kontrol edin; sonraki aynı format import’larda mapping otomatik hatırlanır.`)}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {parsedTable.headers.map((header, index) => (
                  <div key={`${header}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div className="small">{header}</div>
                    <select
                      className="select"
                      value={fieldMapping[index] ?? "ignore"}
                      onChange={(event) => {
                        setFieldMapping((current) => {
                          const next = [...current];
                          next[index] = event.target.value as LeadFieldKey;
                          return next;
                        });
                      }}
                    >
                      {FIELD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {t(option.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {previewLeads.length > 0 ? (
                <div className="nested-panel">
                  <strong>{t("Önizleme")}</strong>
                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    {previewLeads.map((lead, index) => (
                      <div key={`${lead.fullName}-${index}`} className="list-row" style={{ alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{lead.fullName}</div>
                          <div className="small">
                            {lead.currentTitle ?? t("Unvan yok")}
                            {lead.currentCompany ? ` · ${lead.currentCompany}` : ""}
                            {lead.locationText ? ` · ${lead.locationText}` : ""}
                          </div>
                        </div>
                        <span className="small">{lead.email ?? lead.phone ?? t("İletişim yok")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}

          {csvError ? <p className="small" style={{ color: "var(--danger)" }}>{csvError}</p> : null}
          <button
            type="button"
            className="button-link"
            onClick={() => void handleCsvImport()}
            disabled={csvBusy || !parsedTable}
          >
            {csvBusy ? t("İçe aktarma çalışıyor...") : t("Aday listesini projeye al")}
          </button>
          {csvSummary ? <SummaryBlock summary={csvSummary} /> : null}
        </div>
      </div>

      <div className="nested-panel">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <strong>{t("Açık profil URL yapıştırma")}</strong>
            <p className="small" style={{ marginTop: 6 }}>
              {t("Kişisel site, portfolyo, GitHub benzeri açık profil URL'lerini yapıştırın. Sistem kişi profilini doğrularsa projeye alır.")}
            </p>
          </div>
        </div>
        <textarea
          className="input"
          value={urlText}
          onChange={(event) => setUrlText(event.target.value)}
          placeholder={"https://example.com/profile/jane-doe\nhttps://portfolio.example.com"}
          style={{ minHeight: 90, resize: "vertical" }}
        />
        <textarea
          className="input"
          value={urlNote}
          onChange={(event) => setUrlNote(event.target.value)}
          placeholder={t("İşe alımcı notu / bu URL'leri neden ekliyorum?")}
          style={{ minHeight: 70, resize: "vertical", marginTop: 10 }}
        />
        {urlError ? <p className="small" style={{ color: "var(--danger)" }}>{urlError}</p> : null}
        <button
          type="button"
          className="button-link"
          style={{ marginTop: 10 }}
          onClick={() => void handleUrlImport()}
          disabled={urlBusy}
        >
          {urlBusy ? t("URL'ler işleniyor...") : t("URL'leri aday adayı olarak işle")}
        </button>
        {urlSummary ? <SummaryBlock summary={urlSummary} /> : null}
      </div>

      <div className="nested-panel">
        <div className="section-head" style={{ marginBottom: 10 }}>
          <div>
            <strong>{t("Tekil manuel kayıt")}</strong>
            <p className="small" style={{ marginTop: 6 }}>
              {t("İşe alımcının dışarıda bulduğu tekil kaydı hızlıca sourcing projesine ekleyin.")}
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <input
            className="input"
            value={manualLead.fullName}
            onChange={(event) => setManualLead((current) => ({ ...current, fullName: event.target.value }))}
            placeholder={t("Ad soyad")}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              className="input"
              value={manualLead.currentTitle ?? ""}
              onChange={(event) => setManualLead((current) => ({ ...current, currentTitle: event.target.value }))}
              placeholder={t("Unvan")}
            />
            <input
              className="input"
              value={manualLead.currentCompany ?? ""}
              onChange={(event) => setManualLead((current) => ({ ...current, currentCompany: event.target.value }))}
              placeholder={t("Şirket")}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              className="input"
              value={manualLead.locationText ?? ""}
              onChange={(event) => setManualLead((current) => ({ ...current, locationText: event.target.value }))}
              placeholder={t("Lokasyon")}
            />
            <input
              className="input"
              value={manualLead.yearsOfExperience?.toString() ?? ""}
              onChange={(event) =>
                setManualLead((current) => ({
                  ...current,
                  yearsOfExperience: event.target.value ? Number(event.target.value) : undefined
                }))
              }
              placeholder={t("Deneyim yılı")}
              inputMode="numeric"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              className="input"
              value={manualLead.email ?? ""}
              onChange={(event) => setManualLead((current) => ({ ...current, email: event.target.value }))}
              placeholder={t("E-posta")}
            />
            <input
              className="input"
              value={manualLead.phone ?? ""}
              onChange={(event) => setManualLead((current) => ({ ...current, phone: event.target.value }))}
              placeholder={t("Telefon")}
            />
          </div>
          <input
            className="input"
            value={manualLead.sourceUrl ?? ""}
            onChange={(event) => setManualLead((current) => ({ ...current, sourceUrl: event.target.value }))}
            placeholder={t("Açık profil URL'si")}
          />
          <input
            className="input"
            value={Array.isArray(manualLead.skills) ? manualLead.skills.join(", ") : ""}
            onChange={(event) =>
              setManualLead((current) => ({
                ...current,
                skills: splitListValue(event.target.value)
              }))
            }
            placeholder={t("Yetenek etiketleri")}
          />
          <textarea
            className="input"
            value={manualLead.notes ?? ""}
            onChange={(event) => setManualLead((current) => ({ ...current, notes: event.target.value }))}
            placeholder={t("İşe alımcı notu")}
            style={{ minHeight: 70, resize: "vertical" }}
          />
          {manualError ? <p className="small" style={{ color: "var(--danger)" }}>{manualError}</p> : null}
          <button
            type="button"
            className="button-link"
            onClick={() => void handleManualLeadCreate()}
            disabled={manualBusy}
          >
            {manualBusy ? t("Kayıt ekleniyor...") : t("Tekil kayıt oluştur")}
          </button>
          {manualSummary ? <SummaryBlock summary={manualSummary} /> : null}
        </div>
      </div>
    </div>
  );
}
