"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState, useEffect } from "react";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { useUiText } from "../../../../components/site-language-provider";
import { Field, SelectInput, TextArea, TextInput } from "../../../../components/form-controls";
import { ErrorState } from "../../../../components/ui-states";
import { apiClient } from "../../../../lib/api-client";
import type { BillingOverviewReadModel, JobStatus } from "../../../../lib/types";

/* ── Types ── */

type RequirementDraft = {
  text: string;
  required: boolean;
};

/* ── Department options ── */

const DEPARTMENTS = [
  "Operasyon",
  "Satış",
  "Pazarlama",
  "İnsan Kaynakları",
  "Finans",
  "Bilgi Teknolojileri",
  "Müşteri Hizmetleri",
  "Üretim",
  "Lojistik",
  "Diğer",
];

const WORK_MODELS = [
  { value: "", label: "Seçiniz" },
  { value: "onsite", label: "Ofisten (On-site)" },
  { value: "hybrid", label: "Hibrit" },
  { value: "remote", label: "Uzaktan" },
];

const WORK_TYPES = [
  { value: "", label: "Seçiniz" },
  { value: "full_time", label: "Tam Zamanlı" },
  { value: "part_time", label: "Yarı Zamanlı" },
  { value: "shift", label: "Vardiyalı" },
  { value: "intern", label: "Stajyer" },
  { value: "contract", label: "Sözleşmeli" },
];

/* ── Auto-suggested requirements per department ── */

const DEPARTMENT_REQUIREMENTS: Record<string, RequirementDraft[]> = {
  Operasyon: [
    { text: "Vardiyalı çalışma düzenine uyum", required: true },
    { text: "Depo veya saha operasyonu deneyimi", required: false },
    { text: "Ağır yük kaldırma kapasitesi", required: false },
  ],
  Satış: [
    { text: "Satış hedeflerine yönelik çalışma deneyimi", required: true },
    { text: "CRM araçları kullanım bilgisi", required: false },
    { text: "Aktif müşteri portföyü yönetimi", required: false },
  ],
  Pazarlama: [
    { text: "Dijital pazarlama kampanya yönetimi", required: true },
    { text: "Sosyal medya platformlarında içerik üretimi", required: false },
    { text: "Google Analytics veya benzeri araç deneyimi", required: false },
  ],
  "İnsan Kaynakları": [
    { text: "İşe alım süreçleri yönetimi", required: true },
    { text: "SGK ve bordro mevzuatı bilgisi", required: false },
    { text: "Çalışan ilişkileri ve oryantasyon deneyimi", required: false },
  ],
  Finans: [
    { text: "Muhasebe ve finans raporlama deneyimi", required: true },
    { text: "ERP sistemi kullanım bilgisi (SAP, Logo vb.)", required: false },
    { text: "Bütçe planlama ve maliyet analizi", required: false },
  ],
  "Bilgi Teknolojileri": [
    { text: "Yazılım geliştirme veya sistem yönetimi deneyimi", required: true },
    { text: "Versiyon kontrol ve CI/CD süreçleri bilgisi", required: false },
    { text: "Ağ ve sunucu altyapısı yönetimi", required: false },
  ],
  "Müşteri Hizmetleri": [
    { text: "Çağrı merkezi veya müşteri destek deneyimi", required: true },
    { text: "Şikayet yönetimi ve çözüm odaklı yaklaşım", required: false },
    { text: "Çoklu iletişim kanallarında hizmet deneyimi", required: false },
  ],
  Üretim: [
    { text: "Üretim hattı operasyon deneyimi", required: true },
    { text: "İş sağlığı ve güvenliği sertifikası", required: false },
    { text: "Kalite kontrol süreçleri bilgisi", required: false },
  ],
  Lojistik: [
    { text: "Sevkiyat ve depo yönetimi deneyimi", required: true },
    { text: "Rota planlama ve filo takibi bilgisi", required: false },
    { text: "Tedarik zinciri süreçlerine hakimiyet", required: false },
  ],
};

/* ── Page ── */

export default function NewJobPage() {
  const { t } = useUiText();
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
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftAction, setDraftAction] = useState<"fresh" | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [lastDraftInputSnapshot, setLastDraftInputSnapshot] = useState("");
  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [billingLoadError, setBillingLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBillingOverview() {
      try {
        const overview = await apiClient.billingOverview();
        if (!cancelled) {
          setBilling(overview);
          setBillingLoadError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setBilling(null);
          setBillingLoadError(loadError instanceof Error ? loadError.message : t("Abonelik kullanımı şu an yüklenemedi."));
        }
      }
    }

    void loadBillingOverview();

    return () => {
      cancelled = true;
    };
  }, [t]);

  // Departman değişince otomatik nitelik önerisi
  useEffect(() => {
    const suggested = DEPARTMENT_REQUIREMENTS[department];
    if (suggested) {
      setRequirements(suggested.map((r) => ({ ...r, text: t(r.text) })));
    } else {
      setRequirements([]);
    }
  }, [department, t]);

  // shiftType = workModel + workType birleşimi (backend uyumluluğu)
  const shiftType = useMemo(() => {
    const parts: string[] = [];
    const modelLabel = WORK_MODELS.find((m) => m.value === workModel)?.label;
    const typeLabel = WORK_TYPES.find((t) => t.value === workType)?.label;
    if (modelLabel && workModel) parts.push(modelLabel);
    if (typeLabel && workType) parts.push(typeLabel);
    return parts.join(", ");
  }, [workModel, workType]);

  const normalizedRequirements = useMemo(
    () =>
      requirements
        .filter((r) => r.text.trim())
        .map((r) => ({
          key: r.text.trim(),
          value: r.text.trim(),
          required: r.required,
        })),
    [requirements]
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
      }),
    [department, normalizedRequirements, jdText, locationText, salaryMax, salaryMin, shiftType, title]
  );

  const activeJobsQuota = useMemo(
    () => billing?.usage.quotas.find((quota) => quota.key === "ACTIVE_JOBS") ?? null,
    [billing]
  );

  const hasPublishCapacity = activeJobsQuota ? activeJobsQuota.remaining > 0 : true;

  const hasDraft = draftText.trim().length > 0;
  const isDraftOutdated =
    hasDraft && lastDraftInputSnapshot.length > 0 && draftInputSnapshot !== lastDraftInputSnapshot;

  const handleCopyDraft = async () => {
    if (!draftText.trim()) return;
    try {
      await navigator.clipboard.writeText(draftText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = draftText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    }
  };

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
    setDraftAction("fresh");

    // Revizyon notu varsa ve mevcut taslak varsa rewrite modunda çalış
    const isRewrite = hasDraft && rewriteInstruction.trim().length > 0;

    try {
      const response = await apiClient.generateJobDraft({
        title: title.trim(),
        department: department.trim() || undefined,
        locationText: locationText.trim() || undefined,
        shiftType: shiftType || undefined,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        jdText: jdText.trim() || undefined,
        requirements: normalizedRequirements.length ? normalizedRequirements : undefined,
        existingDraft: isRewrite ? draftText.trim() : undefined,
        rewriteInstruction: isRewrite ? rewriteInstruction.trim() : undefined,
      });

      setDraftText(response.draftText);
      setDraftNotice(
        response.notice ??
          (response.source === "llm"
            ? t("Taslak AI ile oluşturuldu. Dilerseniz düzenleyip kopyalayabilirsiniz.")
            : "")
      );
      setLastDraftInputSnapshot(draftInputSnapshot);
      setCopySuccess(false);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : t("İlan taslağı oluşturulamadı."));
    } finally {
      setDraftLoading(false);
      setDraftAction(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    setSubmitError("");

    if (title.trim().length < 3) {
      setFieldError(t("İlan başlığı en az 3 karakter olmalı."));
      return;
    }

    if (!department.trim()) {
      setFieldError(t("Departman zorunludur."));
      return;
    }

    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setFieldError(t("Minimum maaş maksimum maaştan büyük olamaz."));
      return;
    }

    if (status === "PUBLISHED" && !hasPublishCapacity) {
      setFieldError(
        t("Aktif ilan kotanız dolu. İlanı taslak olarak kaydedebilir, daha sonra slot açıldığında yayına alabilirsiniz.")
      );
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.createJob({
        title: title.trim(),
        department: department.trim(),
        status,
        locationText: locationText.trim() || undefined,
        shiftType: shiftType || undefined,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        jdText: jdText.trim() || undefined,
        requirements: normalizedRequirements.length ? normalizedRequirements : undefined,
      });
      router.push("/jobs");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("İlan oluşturulamadı."));
    } finally {
      setSubmitting(false);
    }
  }

  const addRequirement = () => {
    setRequirements((prev) => [...prev, { text: "", required: false }]);
  };

  const removeRequirement = (index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRequirementText = (index: number, text: string) => {
    setRequirements((prev) =>
      prev.map((r, i) => (i === index ? { ...r, text } : r))
    );
  };

  const toggleRequirementRequired = (index: number) => {
    setRequirements((prev) =>
      prev.map((r, i) => (i === index ? { ...r, required: !r.required } : r))
    );
  };

  return (
    <div className="page-grid">
      <section className="panel form-panel">
        <div className="section-head">
          <div>
            <Link href="/jobs" className="text-muted text-sm" style={{ textDecoration: "none" }}>
              ← {t("İlan Merkezi")}
            </Link>
            <PageTitleWithGuide
              as="h2"
              guideKey="jobCreate"
              title={t("Yeni İlan Hazırla")}
              style={{ marginBottom: 4, marginTop: 8 }}
            />
            <p className="small" style={{ marginTop: 0 }}>
              {t("Pozisyon bilgilerini girin. AI taslak oluşturup harici platformlara kopyalayabilirsiniz.")}
            </p>
          </div>
        </div>

        {submitError ? <ErrorState error={submitError} /> : null}
        {fieldError ? <ErrorState title={t("Form doğrulama")} error={fieldError} /> : null}

        <form onSubmit={handleSubmit} className="form-grid">
          {activeJobsQuota ? (
            <div
              className="panel nested-panel"
              style={{
                borderColor:
                  activeJobsQuota.warningState === "exceeded"
                    ? "rgba(239,68,68,0.35)"
                    : activeJobsQuota.warningState === "warning"
                      ? "rgba(245,158,11,0.35)"
                      : "var(--border)"
              }}
            >
              <strong style={{ display: "block", marginBottom: 8 }}>{t("Aktif ilan kotası")}</strong>
              <p className="small" style={{ margin: 0 }}>
                {t(`Bu dönem ${activeJobsQuota.used} / ${activeJobsQuota.limit} aktif ilan kullanıyorsunuz.`)}
                {" "}
                {hasPublishCapacity
                  ? t("Bu ilanı taslak veya yayında olarak kaydedebilirsiniz.")
                  : t("Şu anda yalnızca taslak oluşturabilirsiniz. Yayına almak için önce bir ilanı arşivleyin ya da planınızı yükseltin.")}
              </p>
            </div>
          ) : null}

          {billingLoadError ? (
            <div className="panel nested-panel">
              <ErrorState title={t("Abonelik görünürlüğü")} error={billingLoadError} />
            </div>
          ) : null}

          {/* ── Temel Bilgiler ── */}
          <div className="panel nested-panel">
            <strong style={{ display: "block", marginBottom: 12 }}>{t("Temel Bilgiler")}</strong>

            <Field label={t("İlan Başlığı")} htmlFor="job-title">
              <TextInput
                id="job-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("Örn: Depo Operasyon Personeli")}
                required
              />
            </Field>

            <Field label={t("Departman / Birim")} htmlFor="job-department">
              <SelectInput
                id="job-department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
                required
              >
                <option value="" disabled>{t("Seçiniz")}</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{t(d)}</option>
                ))}
              </SelectInput>
            </Field>

            <Field label={t("Lokasyon")} htmlFor="job-location">
              <TextInput
                id="job-location"
                value={locationText}
                onChange={(event) => setLocationText(event.target.value)}
                placeholder={t("Örn: İstanbul, Ankara, Bursa")}
              />
            </Field>
          </div>

          {/* ── Çalışma Koşulları ── */}
          <div className="panel nested-panel">
            <strong style={{ display: "block", marginBottom: 12 }}>{t("Çalışma Koşulları")}</strong>

            <div className="inline-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label={t("Çalışma Modeli")} htmlFor="job-work-model">
                <SelectInput
                  id="job-work-model"
                  value={workModel}
                  onChange={(event) => setWorkModel(event.target.value)}
                >
                  {WORK_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{t(m.label)}</option>
                  ))}
                </SelectInput>
              </Field>

              <Field label={t("Çalışma Şekli")} htmlFor="job-work-type">
                <SelectInput
                  id="job-work-type"
                  value={workType}
                  onChange={(event) => setWorkType(event.target.value)}
                >
                  {WORK_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>{t(option.label)}</option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            <div className="inline-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label={t("Maaş Alt Sınır (₺)")} htmlFor="job-salary-min">
                <TextInput
                  id="job-salary-min"
                  type="number"
                  min={0}
                  value={salaryMin}
                  onChange={(event) => setSalaryMin(event.target.value)}
                  placeholder={t("Örn: 28000")}
                />
              </Field>

              <Field label={t("Maaş Üst Sınır (₺)")} htmlFor="job-salary-max">
                <TextInput
                  id="job-salary-max"
                  type="number"
                  min={0}
                  value={salaryMax}
                  onChange={(event) => setSalaryMax(event.target.value)}
                  placeholder={t("Örn: 36000")}
                />
              </Field>
            </div>
          </div>

          {/* ── Aranan Nitelikler ── */}
          <div className="panel nested-panel">
            <div className="section-head" style={{ marginBottom: 8 }}>
              <strong>{t("Aranan Nitelikler")}</strong>
              <button type="button" className="ghost-button" onClick={addRequirement}>
                {t("+ Nitelik Ekle")}
              </button>
            </div>

            {requirements.length === 0 && (
              <p className="text-xs text-muted" style={{ margin: "8px 0" }}>
                {t("Departman seçtiğinizde önerilen nitelikler otomatik eklenir. Dilediğiniz gibi düzenleyebilirsiniz.")}
              </p>
            )}

            {requirements.map((item, index) => (
              <div
                key={`req-${index}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: "var(--bg-base, #0f1117)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  marginBottom: 8,
                }}
              >
                <input
                  type="text"
                  className="input"
                  value={item.text}
                  onChange={(e) => updateRequirementText(index, e.target.value)}
                  placeholder={t("Nitelik yazın...")}
                  style={{ flex: 1, border: "none", background: "transparent", padding: "4px 0" }}
                />
                <button
                  type="button"
                  onClick={() => toggleRequirementRequired(index)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 4,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    background: item.required
                      ? "rgba(99,102,241,0.12)"
                      : "rgba(255,255,255,0.05)",
                    color: item.required
                      ? "var(--primary, #6366f1)"
                      : "var(--muted, #6b7280)",
                  }}
                >
                  {item.required ? t("Zorunlu") : t("Tercih Edilen")}
                </button>
                <button
                  type="button"
                  onClick={() => removeRequirement(index)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--muted, #6b7280)",
                    cursor: "pointer",
                    fontSize: 16,
                    padding: "2px 4px",
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* ── İlan Durumu ── */}
          <div className="panel nested-panel">
            <strong style={{ display: "block", marginBottom: 12 }}>{t("İlan Durumu")}</strong>
            <div style={{ display: "flex", gap: 10 }}>
              {(["DRAFT", "PUBLISHED", "ARCHIVED"] as JobStatus[]).map((s) => {
                const meta = {
                  DRAFT: { label: "Taslak", desc: "Henüz yayınlanmadı", color: "var(--muted, #6b7280)" },
                  PUBLISHED: { label: "Yayında", desc: "Başvuru kabul ediliyor", color: "var(--success, #22c55e)" },
                  ARCHIVED: { label: "Arşiv", desc: "Başvuru kapatıldı", color: "var(--warn, #f59e0b)" },
                }[s];
                const isActive = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      if (s === "PUBLISHED" && !hasPublishCapacity) {
                        return;
                      }
                      setStatus(s);
                    }}
                    disabled={s === "PUBLISHED" && !hasPublishCapacity}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: isActive ? "rgba(99,102,241,0.06)" : "var(--bg-base, #0f1117)",
                      border: `1px solid ${isActive ? "var(--primary, #6366f1)" : "var(--border)"}`,
                      borderRadius: 8,
                      cursor: s === "PUBLISHED" && !hasPublishCapacity ? "not-allowed" : "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      color: "var(--text)",
                      opacity: s === "PUBLISHED" && !hasPublishCapacity ? 0.55 : 1
                    }}
                  >
                    <span style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: meta.color,
                      flexShrink: 0,
                    }} />
                    <span>
                      <span style={{ fontSize: 13, fontWeight: 500, display: "block" }}>{t(meta.label)}</span>
                      <span style={{ fontSize: 12, color: "var(--muted, #6b7280)" }}>{t(meta.desc)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {!hasPublishCapacity ? (
              <p className="small" style={{ marginTop: 10, marginBottom: 0 }}>
                {t("Yayında slotunuz dolu olduğu için bu ilanı önce taslak olarak hazırlayabilirsiniz.")}
              </p>
            ) : null}
          </div>

          {/* ── İş Tanımı ── */}
          <div className="panel nested-panel">
            <strong style={{ display: "block", marginBottom: 12 }}>{t("İş Tanımı")}</strong>
            <Field label={t("Pozisyon Açıklaması")} htmlFor="job-jd-text" hint={t("AI taslak oluştururken bu açıklamayı temel alır.")}>
              <TextArea
                id="job-jd-text"
                rows={3}
                value={jdText}
                onChange={(event) => setJdText(event.target.value)}
                placeholder={t("Pozisyonun temel sorumlulukları ve beklentiler...")}
              />
            </Field>
          </div>

          {/* ── AI İlan Taslağı ── */}
          <div className="panel nested-panel" style={{ borderColor: "rgba(99,102,241,0.2)" }}>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong>{t("AI ile İlan Taslağı")}</strong>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--primary, #6366f1)",
                  background: "rgba(99,102,241,0.12)",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}>AI</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void generateDraft()}
                  disabled={draftLoading}
                  style={{ fontSize: 13 }}
                >
                  {draftLoading
                    ? t("Taslak hazırlanıyor...")
                    : hasDraft
                      ? t("Yeniden Oluştur")
                      : `✨ ${t("Taslak Oluştur")}`}
                </button>
                <button
                  type="button"
                  className="button-link"
                  onClick={() => void handleCopyDraft()}
                  disabled={!hasDraft}
                  style={{ fontSize: 13, padding: "4px 14px", minWidth: 90, textAlign: "center" }}
                >
                  {copySuccess ? t("Kopyalandı!") : t("Kopyala")}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted" style={{ margin: "0 0 12px" }}>
              {t("Yukarıdaki bilgilere göre profesyonel ilan metni oluşturur. Taslağı düzenleyip harici platformlara kopyalayabilirsiniz.")}
            </p>

            {draftError ? <ErrorState title={t("İlan taslağı")} error={draftError} /> : null}

            {draftNotice && (
              <p className="text-xs text-muted" style={{ margin: draftError ? "8px 0 0" : "0 0 8px" }}>
                {draftNotice}
              </p>
            )}

            {isDraftOutdated && (
              <p className="text-xs text-muted" style={{ margin: "0 0 8px" }}>
                {t("Taslak güncel değil. Form bilgilerinde değişiklik yaptınız; en doğru metin için yeniden oluşturun.")}
              </p>
            )}

            <TextArea
              id="job-draft-text"
              rows={12}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder={t("Taslak oluşturduğunuzda ilan metni burada görünecek.")}
            />

            <div style={{ marginTop: 14 }}>
              <Field label={t("Revizyon Notu")} htmlFor="job-draft-instruction" hint={t("Taslağı beğenmediyseniz notunuzu yazıp tekrar oluşturun.")}>
                <TextInput
                  id="job-draft-instruction"
                  value={rewriteInstruction}
                  onChange={(event) => setRewriteInstruction(event.target.value)}
                  placeholder={t("Örn: Daha samimi bir dil kullan, maaş bilgisini vurgula")}
                />
              </Field>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="row-actions">
            <button type="submit" className="button-link" disabled={submitting}>
              {submitting ? t("Oluşturuluyor...") : t("İlanı Kaydet")}
            </button>
            <Link href="/jobs" className="ghost-button">
              {t("Vazgeç")}
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
