"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { PageTitleWithGuide } from "./page-guide";
import { useUiText } from "./site-language-provider";
import { ErrorState, LoadingState } from "./ui-states";
import { Field, SelectInput, TextArea, TextInput } from "./form-controls";
import { apiClient } from "../lib/api-client";
import {
  appendUniqueValue,
  createEmptyJobProfile,
  DEPARTMENT_SUGGESTIONS,
  DEFAULT_RESPONSE_SLA_DAYS,
  normalizeJobProfile,
  QUALIFICATION_PRESET_LIBRARY,
  TECHNICAL_PRESET_LIBRARY,
  TITLE_LEVEL_SUGGESTIONS
} from "../lib/job-profile";
import type {
  BillingOverviewReadModel,
  CompetencyCategory,
  CompetencyDefinition,
  Job,
  JobProfile,
  JobStatus,
  TenantHiringSettings
} from "../lib/types";

type RequirementDraft = {
  text: string;
  required: boolean;
};

type JobEditorFormProps = {
  mode: "create" | "edit";
  jobId?: string;
};

const WORK_MODELS = [
  { value: "", label: "Seçiniz" },
  { value: "onsite", label: "Ofis İçi" },
  { value: "hybrid", label: "Hibrit" },
  { value: "remote", label: "Uzaktan" }
];

const WORK_TYPES = [
  { value: "", label: "Seçiniz" },
  { value: "full_time", label: "Tam Zamanlı" },
  { value: "part_time", label: "Yarı Zamanlı" },
  { value: "shift", label: "Vardiyalı" },
  { value: "intern", label: "Stajyer" },
  { value: "contract", label: "Sözleşmeli" }
];

const DEPARTMENT_REQUIREMENTS: Record<string, RequirementDraft[]> = {
  Operasyon: [
    { text: "Vardiyalı çalışma düzenine uyum", required: true },
    { text: "Depo veya saha operasyonu deneyimi", required: false }
  ],
  Finans: [
    { text: "Muhasebe ve finans raporlama deneyimi", required: true },
    { text: "ERP sistemi kullanım bilgisi", required: false }
  ],
  "Bilgi Teknolojileri": [
    { text: "Yazılım geliştirme veya sistem yönetimi deneyimi", required: true },
    { text: "Versiyon kontrol ve CI/CD süreçleri bilgisi", required: false }
  ],
  "Yazılım Geliştirme": [
    { text: ".NET framework veya eşdeğer backend deneyimi", required: true },
    { text: "RESTful API tasarımı ve entegrasyon tecrübesi", required: true },
    { text: "Git ile sürüm kontrol deneyimi", required: true }
  ],
  "İnsan Kaynakları": [
    { text: "İşe alım süreçleri yönetimi", required: true },
    { text: "Referans araştırması ve aday iletişimi deneyimi", required: false }
  ]
};

function parseNumericInput(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function inferWorkSelections(shiftType: string | null | undefined) {
  const normalized = shiftType?.toLocaleLowerCase("tr-TR") ?? "";

  return {
    workModel:
      WORK_MODELS.find(
        (option) => option.value && normalized.includes(option.label.toLocaleLowerCase("tr-TR"))
      )?.value ?? "",
    workType:
      WORK_TYPES.find(
        (option) => option.value && normalized.includes(option.label.toLocaleLowerCase("tr-TR"))
      )?.value ?? ""
  };
}

function competencyKey(category: CompetencyCategory, name: string) {
  return `${category}:${name.trim().toLocaleLowerCase("tr-TR")}`;
}

function attachSelectedCompetencyDefinitions(
  profile: JobProfile,
  hiringSettings: TenantHiringSettings | null
) {
  const selected = new Set<string>();
  const addSelected = (category: CompetencyCategory, values: string[]) => {
    values.forEach((value) => selected.add(competencyKey(category, value)));
  };

  addSelected("core", profile.competencySets.core);
  addSelected("functional", profile.competencySets.functional);
  addSelected("technical", profile.competencySets.technical);
  addSelected("managerial", profile.competencySets.managerial);

  const definitions = new Map<string, CompetencyDefinition>();

  for (const definition of profile.competencyDefinitions) {
    const key = competencyKey(definition.category, definition.name);
    if (selected.has(key)) {
      definitions.set(key, definition);
    }
  }

  for (const definition of hiringSettings?.competencyDefinitions ?? []) {
    const key = competencyKey(definition.category, definition.name);
    if (selected.has(key)) {
      definitions.set(key, definition);
    }
  }

  return {
    ...profile,
    competencyDefinitions: [...definitions.values()]
  };
}

function StringListEditor({
  title,
  hint,
  values,
  onChange,
  addLabel,
  placeholder,
  presets
}: {
  title: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  addLabel?: string;
  placeholder?: string;
  presets?: readonly string[];
}) {
  const [draft, setDraft] = useState("");

  function addValue(nextValue: string) {
    const updated = appendUniqueValue(values, nextValue);
    if (updated !== values) {
      onChange(updated);
    }
    setDraft("");
  }

  function togglePreset(preset: string) {
    const selected = values.some(
      (value) => value.trim().toLocaleLowerCase("tr-TR") === preset.trim().toLocaleLowerCase("tr-TR")
    );

    if (selected) {
      onChange(values.filter((value) => value.trim().toLocaleLowerCase("tr-TR") !== preset.trim().toLocaleLowerCase("tr-TR")));
      return;
    }

    addValue(preset);
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.02)"
      }}
    >
      <div>
        <strong style={{ display: "block", marginBottom: 4 }}>{title}</strong>
        {hint ? <p className="small text-muted" style={{ margin: 0 }}>{hint}</p> : null}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder ?? "Yeni madde ekleyin"}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue(draft);
            }
          }}
        />
        <button type="button" className="ghost-button" onClick={() => addValue(draft)}>
          {addLabel ?? "Ekle"}
        </button>
      </div>
      {presets && presets.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {presets.map((preset) => {
            const selected = values.some(
              (value) => value.trim().toLocaleLowerCase("tr-TR") === preset.trim().toLocaleLowerCase("tr-TR")
            );

            return (
            <button
              key={preset}
              type="button"
              className={selected ? "button-link" : "ghost-button"}
              style={{
                fontSize: 12,
                padding: "4px 10px",
                boxShadow: selected ? "0 6px 18px rgba(80,70,229,0.18)" : undefined
              }}
              onClick={() => togglePreset(preset)}
              aria-pressed={selected}
            >
              {selected ? "✓ " : ""}{preset}{selected ? " ×" : ""}
            </button>
            );
          })}
        </div>
      ) : null}
      {values.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(values.filter((item) => item !== value))}
              style={{
                border: "1px solid color-mix(in srgb, var(--primary, #6366f1) 36%, var(--border) 64%)",
                background: "linear-gradient(135deg, rgba(99,102,241,0.14), rgba(14,165,233,0.08))",
                color: "var(--text)",
                borderRadius: 999,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
              title="Kaldır"
            >
              {value} ×
            </button>
          ))}
        </div>
      ) : (
        <p className="small text-muted" style={{ margin: 0 }}>Henüz madde eklenmedi.</p>
      )}
    </div>
  );
}

export function JobEditorForm({ mode, jobId }: JobEditorFormProps) {
  const { t, locale } = useUiText();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState<JobStatus>("DRAFT");
  const [locationText, setLocationText] = useState("");
  const [workModel, setWorkModel] = useState("");
  const [workType, setWorkType] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [jdText, setJdText] = useState("");
  const [requirements, setRequirements] = useState<RequirementDraft[]>([]);
  const [jobProfile, setJobProfile] = useState<JobProfile>(createEmptyJobProfile());
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [lastDraftInputSnapshot, setLastDraftInputSnapshot] = useState("");
  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [billingLoadError, setBillingLoadError] = useState("");
  const [pageLoading, setPageLoading] = useState(mode === "edit");
  const [loadError, setLoadError] = useState("");
  const [existingJob, setExistingJob] = useState<Job | null>(null);
  const [hiringSettings, setHiringSettings] = useState<TenantHiringSettings | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFormContext() {
      try {
        const billingPromise = apiClient.billingOverview().catch(() => null);
        const jobPromise = mode === "edit" && jobId ? apiClient.getJob(jobId) : Promise.resolve(null);
        const hiringSettingsPromise = apiClient.getTenantHiringSettings().catch(() => null);
        const [billingResult, jobResult, hiringSettingsResult] = await Promise.all([
          billingPromise,
          jobPromise,
          hiringSettingsPromise
        ]);

        if (cancelled) {
          return;
        }

        setBilling(billingResult);
        if (!billingResult) {
          setBillingLoadError(
            locale === "en"
              ? "Usage visibility is temporarily unavailable. You can keep editing the job."
              : "Kredi görünümü geçici olarak alınamadı. İlanı düzenlemeye devam edebilirsiniz."
          );
        } else {
          setBillingLoadError("");
        }

        if (jobResult) {
          setExistingJob(jobResult);
          setTitle(jobResult.title);
          setDepartment(jobResult.roleFamily);
          setStatus(jobResult.status);
          setLocationText(jobResult.locationText ?? "");
          setSalaryMin(jobResult.salaryMin ?? "");
          setSalaryMax(jobResult.salaryMax ?? "");
          setJdText(jobResult.jdText ?? "");
          setDraftText(jobResult.aiDraftText ?? "");
          setRequirements(
            jobResult.requirements.map((item) => ({
              text: item.value,
              required: item.required
            }))
          );
          setJobProfile(normalizeJobProfile(jobResult.jobProfile));
          const inferredSelections = inferWorkSelections(jobResult.shiftType);
          setWorkModel(inferredSelections.workModel);
          setWorkType(inferredSelections.workType);
        }

        if (hiringSettingsResult) {
          setHiringSettings(hiringSettingsResult.settings);

          if (mode === "create") {
            setJobProfile((current) => {
              const normalized = normalizeJobProfile(current);
              if (
                normalized.workflow.responseSlaDays === DEFAULT_RESPONSE_SLA_DAYS &&
                hiringSettingsResult.settings.notificationDefaults.responseSlaDays !==
                  DEFAULT_RESPONSE_SLA_DAYS
              ) {
                return normalizeJobProfile({
                  ...normalized,
                  workflow: {
                    ...normalized.workflow,
                    responseSlaDays: hiringSettingsResult.settings.notificationDefaults.responseSlaDays
                  }
                });
              }

              return normalized;
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : locale === "en"
                ? "Job form could not be loaded."
                : "İlan formu yüklenemedi."
          );
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    }

    void loadFormContext();

    return () => {
      cancelled = true;
    };
  }, [jobId, locale, mode]);

  useEffect(() => {
    if (requirements.length > 0) {
      return;
    }

    const suggested = DEPARTMENT_REQUIREMENTS[department];
    if (suggested) {
      setRequirements(suggested);
    }
  }, [department, requirements.length]);

  const shiftType = useMemo(() => {
    const parts: string[] = [];
    const modelLabel = WORK_MODELS.find((option) => option.value === workModel)?.label;
    const typeLabel = WORK_TYPES.find((option) => option.value === workType)?.label;
    if (modelLabel && workModel) parts.push(modelLabel);
    if (typeLabel && workType) parts.push(typeLabel);
    return parts.join(", ");
  }, [workModel, workType]);

  const normalizedRequirements = useMemo(
    () =>
      requirements
        .filter((item) => item.text.trim())
        .map((item) => ({
          key: item.text.trim(),
          value: item.text.trim(),
          required: item.required
        })),
    [requirements]
  );

  const normalizedJobProfile = useMemo(
    () => attachSelectedCompetencyDefinitions(normalizeJobProfile(jobProfile), hiringSettings),
    [hiringSettings, jobProfile]
  );
  const departmentSuggestions = useMemo(
    () =>
      Array.from(
        new Set([...(hiringSettings?.departments ?? []), ...DEPARTMENT_SUGGESTIONS])
      ),
    [hiringSettings]
  );
  const titleLevelSuggestions = useMemo(
    () =>
      Array.from(
        new Set([...(hiringSettings?.titleLevels ?? []), ...TITLE_LEVEL_SUGGESTIONS])
      ),
    [hiringSettings]
  );
  const functionalPresetLibrary = useMemo(
    () =>
      Array.from(
        new Set([
          ...(hiringSettings?.competencyLibrary.functional ?? []),
          "Süreç yönetimi",
          "Paydaş koordinasyonu",
          "Problem çözme"
        ])
      ),
    [hiringSettings]
  );
  const technicalPresetLibrary = useMemo(
    () =>
      Array.from(
        new Set([
          ...(hiringSettings?.competencyLibrary.technical ?? []),
          ...(hiringSettings?.evaluationPresets.tools ?? []),
          ...TECHNICAL_PRESET_LIBRARY
        ])
      ),
    [hiringSettings]
  );

  const draftInputSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: title.trim(),
        department: department.trim(),
        locationText: locationText.trim(),
        shiftType,
        salaryMin: salaryMin.trim(),
        salaryMax: salaryMax.trim(),
        jdText: jdText.trim(),
        requirements: normalizedRequirements,
        jobProfile: normalizedJobProfile
      }),
    [
      department,
      jdText,
      jobProfile,
      locationText,
      normalizedJobProfile,
      normalizedRequirements,
      salaryMax,
      salaryMin,
      shiftType,
      title
    ]
  );

  const activeJobsQuota = useMemo(
    () => billing?.usage.quotas.find((quota) => quota.key === "ACTIVE_JOBS") ?? null,
    [billing]
  );

  const hasPublishCapacity = activeJobsQuota ? activeJobsQuota.remaining > 0 : true;
  const canKeepPublished = existingJob?.status === "PUBLISHED";
  const canSelectPublished = hasPublishCapacity || canKeepPublished;
  const hasDraft = draftText.trim().length > 0;
  const isDraftOutdated =
    hasDraft && lastDraftInputSnapshot.length > 0 && draftInputSnapshot !== lastDraftInputSnapshot;

  function setProfile(nextProfile: JobProfile) {
    setJobProfile(normalizeJobProfile(nextProfile));
  }

  function updateRequirementText(index: number, nextText: string) {
    setRequirements((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, text: nextText } : item))
    );
  }

  function toggleRequirementRequired(index: number) {
    setRequirements((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, required: !item.required } : item
      )
    );
  }

  function addRequirement(nextText = "", required = true) {
    setRequirements((current) => [...current, { text: nextText, required }]);
  }

  function removeRequirement(index: number) {
    setRequirements((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function handleCopyDraft() {
    if (!draftText.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(draftText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      setCopySuccess(false);
    }
  }

  async function generateDraft() {
    setDraftError("");
    setDraftNotice("");
    setFieldError("");

    if (title.trim().length < 3) {
      setDraftError(t("Taslak oluşturmak için ilan başlığı en az 3 karakter olmalı."));
      return;
    }

    if (!department.trim() && !jdText.trim() && normalizedRequirements.length === 0) {
      setDraftError(t("Taslak oluşturmak için departman, iş tanımı veya en az bir nitelik girin."));
      return;
    }

    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setDraftError(t("Minimum maaş maksimum maaştan büyük olamaz."));
      return;
    }

    setDraftLoading(true);

    try {
      const generated = await apiClient.generateJobDraft({
        title: title.trim(),
        department: department.trim() || undefined,
        roleFamily: department.trim() || undefined,
        locationText: locationText.trim() || undefined,
        shiftType: shiftType || undefined,
        salaryMin: parseNumericInput(salaryMin),
        salaryMax: parseNumericInput(salaryMax),
        jdText: jdText.trim() || undefined,
        requirements: normalizedRequirements,
        jobProfile: normalizedJobProfile,
        existingDraft: draftText.trim() || undefined,
        rewriteInstruction: rewriteInstruction.trim() || undefined
      });

      setDraftText(generated.draftText);
      setDraftNotice(generated.notice ?? "");
      setLastDraftInputSnapshot(draftInputSnapshot);
    } catch (error) {
      setDraftError(
        error instanceof Error ? error.message : t("İlan taslağı oluşturulamadı.")
      );
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    setFieldError("");

    if (title.trim().length < 3) {
      setFieldError("İlan başlığı en az 3 karakter olmalıdır.");
      return;
    }

    if (!department.trim()) {
      setFieldError("Departman zorunludur.");
      return;
    }

    if (status === "PUBLISHED" && !canSelectPublished) {
      setFieldError("Yayın slotu dolu olduğu için ilanı önce taslak olarak kaydedin.");
      return;
    }

    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setFieldError("Minimum maaş maksimum maaştan büyük olamaz.");
      return;
    }

    setSubmitting(true);

    const payload = {
      title: title.trim(),
      department: department.trim(),
      roleFamily: department.trim(),
      status,
      locationText: locationText.trim() || undefined,
      shiftType: shiftType || undefined,
      salaryMin: parseNumericInput(salaryMin),
      salaryMax: parseNumericInput(salaryMax),
      jdText: jdText.trim() || undefined,
      aiDraftText: draftText.trim() || undefined,
      requirements: normalizedRequirements,
      jobProfile: normalizedJobProfile
    };

    try {
      const saved =
        mode === "edit" && jobId
          ? await apiClient.updateJob(jobId, payload)
          : await apiClient.createJob(payload);

      router.push(`/jobs/${saved.id}`);
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : t("İlan kaydedilemedi.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (pageLoading) {
    return <LoadingState message={mode === "edit" ? "İlan bilgileri yükleniyor..." : "Yükleniyor..."} />;
  }

  if (loadError) {
    return <ErrorState error={loadError} />;
  }

  return (
    <section className="page-grid">
      <section className="panel" style={{ display: "grid", gap: 18 }}>
        <div className="section-head" style={{ alignItems: "flex-start" }}>
          <div>
            <PageTitleWithGuide
              guideKey="jobs"
              title={mode === "edit" ? "İlanı Düzenle" : "Yeni İlan Hazırla"}
              subtitle={
                mode === "edit"
                  ? "İlan metnini, yetkinlik setlerini ve operasyon kurallarını aynı yerden güncelleyin."
                  : "Şirkete ve role özel beklentileri girin; AI taslağı bu bağlamla oluşsun."
              }
              subtitleClassName="small"
              style={{ margin: 0 }}
            />
          </div>
          <Link href={mode === "edit" && jobId ? `/jobs/${jobId}` : "/jobs"} className="ghost-button" style={{ textDecoration: "none" }}>
            {mode === "edit" ? "İlana Dön" : "İlan Merkezine Dön"}
          </Link>
        </div>

        {billingLoadError ? (
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.08)",
              color: "var(--warn, #f59e0b)",
              fontSize: 13
            }}
          >
            {billingLoadError}
          </div>
        ) : null}

        {fieldError ? <ErrorState error={fieldError} /> : null}
        {submitError ? <ErrorState error={submitError} /> : null}

        <form style={{ display: "grid", gap: 16 }} onSubmit={handleSubmit}>
          <div className="panel nested-panel" style={{ display: "grid", gap: 14 }}>
            <div className="inline-grid" style={{ gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14 }}>
              <Field label="Pozisyon Başlığı" htmlFor="job-title">
                <TextInput
                  id="job-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Örn: Yazılım Geliştirici"
                  required
                />
              </Field>
              <Field label="Departman" htmlFor="job-department" hint="Sabit listeye bağlı değilsiniz; önerileri seçebilir veya yeni departman yazabilirsiniz.">
                <TextInput
                  id="job-department"
                  list="job-department-options"
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Örn: Bilgi Teknolojileri"
                  required
                />
              </Field>
              <Field label="Rol Seviyesi" htmlFor="job-title-level" hint="Asistan, Uzman, Kıdemli Uzman, Müdür gibi iç seviye yapınızı yansıtın.">
                <TextInput
                  id="job-title-level"
                  list="job-title-level-options"
                  value={jobProfile.titleLevel ?? ""}
                  onChange={(event) =>
                    setProfile({ ...jobProfile, titleLevel: event.target.value || null })
                  }
                  placeholder="Örn: Kıdemli Uzman"
                />
              </Field>
            </div>

            <datalist id="job-department-options">
              {departmentSuggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
            <datalist id="job-title-level-options">
              {titleLevelSuggestions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>

            <div className="inline-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Field label="Lokasyon" htmlFor="job-location">
                <TextInput
                  id="job-location"
                  value={locationText}
                  onChange={(event) => setLocationText(event.target.value)}
                  placeholder="Örn: İstanbul / Hibrit"
                />
              </Field>
              <Field label="Çalışma Modeli" htmlFor="job-work-model">
                <SelectInput
                  id="job-work-model"
                  value={workModel}
                  onChange={(event) => setWorkModel(event.target.value)}
                >
                  {WORK_MODELS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Çalışma Tipi" htmlFor="job-work-type">
                <SelectInput
                  id="job-work-type"
                  value={workType}
                  onChange={(event) => setWorkType(event.target.value)}
                >
                  {WORK_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            <div className="inline-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Maaş Alt Sınır (iç kullanım)" htmlFor="job-salary-min">
                <TextInput
                  id="job-salary-min"
                  type="number"
                  min={0}
                  value={salaryMin}
                  onChange={(event) => setSalaryMin(event.target.value)}
                  placeholder="Örn: 50000"
                />
              </Field>
              <Field label="Maaş Üst Sınır (iç kullanım)" htmlFor="job-salary-max">
                <TextInput
                  id="job-salary-max"
                  type="number"
                  min={0}
                  value={salaryMax}
                  onChange={(event) => setSalaryMax(event.target.value)}
                  placeholder="Örn: 70000"
                />
              </Field>
            </div>
          </div>

          <div className="panel nested-panel" style={{ display: "grid", gap: 16 }}>
            <div>
              <strong style={{ display: "block", marginBottom: 6 }}>Şirkete Özel Rol Çerçevesi</strong>
              <p className="small text-muted" style={{ margin: 0 }}>
                Bu alanlar AI taslağına ve ilerideki screening / mülakat akışına doğrudan bağlanır.
              </p>
            </div>

            <Field label="Rol Notu" htmlFor="job-profile-notes" hint="Bu şirkette aynı unvandan ne beklendiğini, kritik farkları veya görev tanımının bağlamını yazın.">
              <TextArea
                id="job-profile-notes"
                rows={4}
                value={jobProfile.notes ?? ""}
                onChange={(event) => setProfile({ ...jobProfile, notes: event.target.value || null })}
                placeholder="Örn: Bu pozisyonda raporlama kadar süreç iyileştirme ve iç ekip iletişimi de kritik."
              />
            </Field>

            <StringListEditor
              title="Görev Tanımı Maddeleri"
              hint="Madde bazlı sorumluluklar ilan düzenleme ve vaka bazlı soru üretimi için kullanılacak."
              values={jobProfile.responsibilities}
              onChange={(values) => setProfile({ ...jobProfile, responsibilities: values })}
              placeholder="Örn: Günlük kapanış süreçlerini yürütmek"
            />

            <div className="panel nested-panel">
              <div className="section-head" style={{ marginBottom: 8 }}>
                <strong>Aranan Nitelikler</strong>
                <button type="button" className="ghost-button" onClick={() => addRequirement()}>
                  + Nitelik Ekle
                </button>
              </div>
              <p className="small text-muted" style={{ marginTop: 0 }}>
                Görev tanımının hemen altında tutulan nitelikler hem ilan metnini hem de AI screening bağlamını besler.
              </p>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {QUALIFICATION_PRESET_LIBRARY.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="ghost-button"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => addRequirement(preset, true)}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {requirements.map((item, index) => (
                <div
                  key={`req-${index}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    marginBottom: 8
                  }}
                >
                  <input
                    type="text"
                    className="input"
                    value={item.text}
                    onChange={(event) => updateRequirementText(index, event.target.value)}
                    placeholder="Nitelik yazın..."
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleRequirementRequired(index)}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: 999,
                      border: "1px solid var(--border)",
                      background: item.required ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                      color: item.required ? "var(--success, #22c55e)" : "var(--warn, #f59e0b)"
                    }}
                  >
                    {item.required ? "Zorunlu" : "Tercih Edilen"}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => removeRequirement(index)}>
                    Sil
                  </button>
                </div>
              ))}
            </div>

            <div className="inline-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <StringListEditor
                title="Temel / Davranışsal Yetkinlikler"
                hint="Örn: analitik düşünme, iletişim becerisi, organizasyon ve planlama"
                values={jobProfile.competencySets.core}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    competencySets: { ...jobProfile.competencySets, core: values }
                  })
                }
                presets={hiringSettings?.competencyLibrary.core ?? ["Analitik düşünme", "İletişim becerisi", "Sorumluluk bilinci"]}
              />
              <StringListEditor
                title="Fonksiyonel Yetkinlikler"
                hint="Örn: süreç yönetimi, bordro süreci, paydaş koordinasyonu"
                values={jobProfile.competencySets.functional}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    competencySets: { ...jobProfile.competencySets, functional: values }
                  })
                }
                presets={functionalPresetLibrary}
              />
              <StringListEditor
                title="Teknik Yetkinlikler"
                hint="Örn: .NET, REST API, MS SQL, Git"
                values={jobProfile.competencySets.technical}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    competencySets: { ...jobProfile.competencySets, technical: values }
                  })
                }
                presets={technicalPresetLibrary}
              />
              <StringListEditor
                title="Yönetsel Yetkinlikler"
                hint="Takım yönetimi veya karar verme beklentisi varsa ekleyin."
                values={jobProfile.competencySets.managerial}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    competencySets: { ...jobProfile.competencySets, managerial: values }
                  })
                }
                presets={hiringSettings?.competencyLibrary.managerial ?? ["Karar verme", "Takım koçluğu", "Önceliklendirme"]}
              />
            </div>

            <div className="inline-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <StringListEditor
                title="Okul / Bölüm Tercihi"
                values={jobProfile.evaluationCriteria.schoolDepartments}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    evaluationCriteria: { ...jobProfile.evaluationCriteria, schoolDepartments: values }
                  })
                }
                presets={
                  hiringSettings?.evaluationPresets.schoolDepartments ?? [
                    "Bilgisayar Mühendisliği",
                    "Yazılım Mühendisliği",
                    "İşletme",
                    "İktisat"
                  ]
                }
              />
              <StringListEditor
                title="Sertifika Tercihleri"
                values={jobProfile.evaluationCriteria.certificates}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    evaluationCriteria: { ...jobProfile.evaluationCriteria, certificates: values }
                  })
                }
                presets={hiringSettings?.evaluationPresets.certificates ?? []}
              />
              <StringListEditor
                title="Kullanılan Programlar"
                values={jobProfile.evaluationCriteria.tools}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    evaluationCriteria: { ...jobProfile.evaluationCriteria, tools: values }
                  })
                }
                presets={technicalPresetLibrary}
              />
              <StringListEditor
                title="Yabancı Dil / Dil Seviyesi"
                values={jobProfile.evaluationCriteria.languages}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    evaluationCriteria: { ...jobProfile.evaluationCriteria, languages: values }
                  })
                }
                presets={
                  hiringSettings?.evaluationPresets.languages ?? [
                    "İngilizce",
                    "İleri seviye İngilizce",
                    "Almanca",
                    "Arapça"
                  ]
                }
              />
            </div>

            <div className="inline-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Asgari Eğitim Seviyesi" htmlFor="job-education-level" hint="Örn: Lisans ve üstü gibi minimum kabul kriterini yazın.">
                <TextInput
                  id="job-education-level"
                  value={jobProfile.evaluationCriteria.educationLevel ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...jobProfile,
                      evaluationCriteria: {
                        ...jobProfile.evaluationCriteria,
                        educationLevel: event.target.value || null
                      }
                    })
                  }
                  placeholder="Örn: Lisans"
                />
              </Field>
              <Field label="Asgari Deneyim Süresi (yıl)" htmlFor="job-min-experience">
                <TextInput
                  id="job-min-experience"
                  type="number"
                  min={0}
                  value={jobProfile.evaluationCriteria.minimumExperienceYears ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...jobProfile,
                      evaluationCriteria: {
                        ...jobProfile.evaluationCriteria,
                        minimumExperienceYears: event.target.value ? Number(event.target.value) : null
                      }
                    })
                  }
                  placeholder="Örn: 3"
                />
              </Field>
            </div>

            <StringListEditor
              title="İlan Üzerinden Sorulacak Ek Sorular"
              hint="Örn: ücret beklentisi, aktif araç kullanımı, seyahat engeli, vardiya uygunluğu"
              values={jobProfile.applicantQuestions}
              onChange={(values) => setProfile({ ...jobProfile, applicantQuestions: values })}
            />

            <div
              style={{
                display: "grid",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)"
              }}
            >
              <strong>Logo ve İlan Görselleri</strong>
              <Field label="İlan Logo Bağlantısı" htmlFor="job-logo-url" hint="Boş bırakırsanız şirket profilindeki logo kullanılır.">
                <TextInput
                  id="job-logo-url"
                  value={jobProfile.branding.logoUrl ?? ""}
                  onChange={(event) =>
                    setProfile({
                      ...jobProfile,
                      branding: {
                        ...jobProfile.branding,
                        logoUrl: event.target.value || null
                      }
                    })
                  }
                  placeholder="https://..."
                />
              </Field>
              <StringListEditor
                title="İlan Metni İçinde Paylaşılacak Görseller"
                hint="Kariyer platformuna ekleyeceğiniz afiş, kampanya veya ekip görsellerinin bağlantılarını ekleyin."
                values={jobProfile.branding.imageUrls}
                onChange={(values) =>
                  setProfile({
                    ...jobProfile,
                    branding: {
                      ...jobProfile.branding,
                      imageUrls: values
                    }
                  })
                }
                placeholder="https://..."
              />
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                padding: "14px 16px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.02)"
              }}
            >
              <strong>Operasyon Kuralları</strong>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={jobProfile.workflow.hideCompensationOnPosting}
                  onChange={(event) =>
                    setProfile({
                      ...jobProfile,
                      workflow: {
                        ...jobProfile.workflow,
                        hideCompensationOnPosting: event.target.checked
                      }
                    })
                  }
                />
                <span>Maaş aralığını ilan metninde gösterme</span>
              </label>
              <Field label="Aday geri dönüş SLA (gün)" htmlFor="job-response-sla" hint="Aday kuyruğunda renkli uyarı üretmek için kullanılır. Varsayılan 15 gündür.">
                <TextInput
                  id="job-response-sla"
                  type="number"
                  min={1}
                  value={jobProfile.workflow.responseSlaDays ?? DEFAULT_RESPONSE_SLA_DAYS}
                  onChange={(event) =>
                    setProfile({
                      ...jobProfile,
                      workflow: {
                        ...jobProfile.workflow,
                        responseSlaDays: event.target.value ? Number(event.target.value) : DEFAULT_RESPONSE_SLA_DAYS
                      }
                    })
                  }
                />
              </Field>
            </div>
          </div>

          <div className="panel nested-panel">
            <Field
              label="Rol / İlan Açıklaması"
              htmlFor="job-jd-text"
              hint="Görev maddelerini tekrar etmek zorunda değilsiniz; rolün amacı, ekip bağlamı veya ilan metninde görünmesini istediğiniz ek açıklamaları yazın."
            >
              <TextArea
                id="job-jd-text"
                rows={5}
                value={jdText}
                onChange={(event) => setJdText(event.target.value)}
                placeholder="Pozisyonun genel amacı, ekip yapısı veya rolün bağlamı..."
              />
            </Field>
          </div>

          <div className="panel nested-panel" style={{ borderColor: "rgba(99,102,241,0.25)" }}>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <div>
                <strong>AI ile İlan Taslağı</strong>
                <p className="small text-muted" style={{ margin: "6px 0 0" }}>
                  Şirket profili, rol seviyesi, yetkinlikler ve nitelikler birlikte kullanılır.
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="ghost-button" onClick={() => void generateDraft()} disabled={draftLoading}>
                  {draftLoading ? "Taslak hazırlanıyor..." : hasDraft ? "Taslağı Yenile" : "Taslak Oluştur"}
                </button>
                <button type="button" className="button-link" onClick={() => void handleCopyDraft()} disabled={!hasDraft}>
                  {copySuccess ? "Kopyalandı" : "Kopyala"}
                </button>
              </div>
            </div>

            {draftError ? <ErrorState error={draftError} /> : null}
            {draftNotice ? <p className="small text-muted" style={{ marginTop: 0 }}>{draftNotice}</p> : null}
            {isDraftOutdated ? (
              <p className="small text-muted" style={{ marginTop: 0 }}>
                Formdaki bilgiler değişti; en doğru ilan metni için taslağı yeniden üretin.
              </p>
            ) : null}

            <Field
              label="Revizyon Notu"
              htmlFor="job-rewrite-instruction"
              hint="Örn: daha kurumsal yaz, gereksiz tekrarları temizle, yönetim beklentisini güçlendir"
            >
              <TextInput
                id="job-rewrite-instruction"
                value={rewriteInstruction}
                onChange={(event) => setRewriteInstruction(event.target.value)}
                placeholder="İsterseniz yeniden üretim için kısa yönlendirme yazın"
              />
            </Field>

            <Field label="İlan Taslağı" htmlFor="job-draft-text">
              <TextArea
                id="job-draft-text"
                rows={16}
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                placeholder="Taslak burada oluşacak."
              />
            </Field>
          </div>

          <div className="panel nested-panel" style={{ display: "grid", gap: 12 }}>
            <strong>İlan Durumu</strong>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {(["DRAFT", "PUBLISHED", "ARCHIVED"] as JobStatus[]).map((nextStatus) => {
                const isActive = status === nextStatus;
                const disabled = nextStatus === "PUBLISHED" && !canSelectPublished;
                return (
                  <button
                    key={nextStatus}
                    type="button"
                    onClick={() => !disabled && setStatus(nextStatus)}
                    disabled={disabled}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: isActive ? "1px solid var(--primary, #6366f1)" : "1px solid var(--border)",
                      background: isActive ? "rgba(99,102,241,0.12)" : "var(--surface)",
                      color: isActive ? "var(--primary, #6366f1)" : "var(--text)",
                      opacity: disabled ? 0.55 : 1,
                      cursor: disabled ? "not-allowed" : "pointer"
                    }}
                  >
                    {nextStatus === "DRAFT" ? "Taslak" : nextStatus === "PUBLISHED" ? "Yayında" : "Arşiv"}
                  </button>
                );
              })}
            </div>
            {!canSelectPublished ? (
              <p className="small text-muted" style={{ margin: 0 }}>
                Aktif ilan slotu dolu olduğu için bu kaydı önce taslak olarak tutabilirsiniz.
              </p>
            ) : null}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <Link href={mode === "edit" && jobId ? `/jobs/${jobId}` : "/jobs"} className="ghost-button" style={{ textDecoration: "none" }}>
              Vazgeç
            </Link>
            <button type="submit" className="button-link" disabled={submitting}>
              {submitting ? "Kaydediliyor..." : mode === "edit" ? "Değişiklikleri Kaydet" : "İlanı Kaydet"}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
