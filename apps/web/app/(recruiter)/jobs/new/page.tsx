"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Field, SelectInput, TextArea, TextInput } from "../../../../components/form-controls";
import { ErrorState } from "../../../../components/ui-states";
import { apiClient } from "../../../../lib/api-client";
import { JOB_STATUSES } from "../../../../lib/constants";
import type { JobStatus } from "../../../../lib/types";

type RequirementDraft = {
  key: string;
  value: string;
  required: boolean;
};

const initialRequirement: RequirementDraft = { key: "", value: "", required: true };

function normalizeDraftRequirement(item: RequirementDraft) {
  const key = item.key.trim();
  const value = item.value.trim();

  if (!key && !value) {
    return null;
  }

  return {
    key: key || value,
    value: value || key,
    required: item.required
  };
}

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState<JobStatus>("PUBLISHED");
  const [workspaceId, setWorkspaceId] = useState("wrk_demo_ops");
  const [locationText, setLocationText] = useState("İstanbul");
  const [shiftType, setShiftType] = useState("vardiyalı");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [jdText, setJdText] = useState("");
  const [requirements, setRequirements] = useState<RequirementDraft[]>([initialRequirement]);
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftError, setDraftError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftAction, setDraftAction] = useState<"fresh" | "rewrite" | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [rewriteInstruction, setRewriteInstruction] = useState("");
  const [lastDraftInputSnapshot, setLastDraftInputSnapshot] = useState("");

  const normalizedRequirements = useMemo(
    () =>
      requirements
        .map((item) => ({
          key: item.key.trim(),
          value: item.value.trim(),
          required: item.required
        }))
        .filter((item) => item.key && item.value),
    [requirements]
  );

  const draftRequirements = useMemo(
    () =>
      requirements
        .map(normalizeDraftRequirement)
        .filter(
          (
            item
          ): item is {
            key: string;
            value: string;
            required: boolean;
          } => Boolean(item)
        ),
    [requirements]
  );

  const draftInputSnapshot = useMemo(
    () =>
      JSON.stringify({
        title: title.trim(),
        department: department.trim(),
        locationText: locationText.trim(),
        shiftType: shiftType.trim(),
        salaryMin: salaryMin.trim(),
        salaryMax: salaryMax.trim(),
        jdText: jdText.trim(),
        requirements: draftRequirements
      }),
    [department, draftRequirements, jdText, locationText, salaryMax, salaryMin, shiftType, title]
  );

  const hasDraft = draftText.trim().length > 0;
  const isDraftOutdated =
    hasDraft && lastDraftInputSnapshot.length > 0 && draftInputSnapshot !== lastDraftInputSnapshot;

  const handleCopyDraft = async () => {
    if (!draftText.trim()) {
      return;
    }

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

  async function generateDraft(mode: "fresh" | "rewrite") {
    setDraftError("");
    setDraftNotice("");
    setFieldError("");

    if (title.trim().length < 3) {
      setDraftError("Taslak oluşturmak için ilan başlığı en az 3 karakter olmalı.");
      return;
    }

    if (!department.trim() && !jdText.trim() && draftRequirements.length === 0) {
      setDraftError("Taslak oluşturmak için departman, iş tanımı veya en az bir nitelik girin.");
      return;
    }

    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setDraftError("Minimum maaş maksimum maaştan büyük olamaz.");
      return;
    }

    setDraftLoading(true);
    setDraftAction(mode);

    try {
      const response = await apiClient.generateJobDraft({
        title: title.trim(),
        department: department.trim() || undefined,
        locationText: locationText.trim() || undefined,
        shiftType: shiftType.trim() || undefined,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        jdText: jdText.trim() || undefined,
        requirements: draftRequirements.length ? draftRequirements : undefined,
        existingDraft: mode === "rewrite" && draftText.trim() ? draftText.trim() : undefined,
        rewriteInstruction: mode === "rewrite" ? rewriteInstruction.trim() || undefined : undefined
      });

      setDraftText(response.draftText);
      setDraftNotice(
        response.notice ??
          (response.source === "llm"
            ? "Taslak AI ile oluşturuldu. Dilerseniz düzenleyip kopyalayabilirsiniz."
            : "")
      );
      setLastDraftInputSnapshot(draftInputSnapshot);
      setCopySuccess(false);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "İlan taslağı oluşturulamadı.");
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
      setFieldError("İlan başlığı en az 3 karakter olmalı.");
      return;
    }

    if (!department.trim()) {
      setFieldError("Departman zorunludur.");
      return;
    }

    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) {
      setFieldError("Minimum maaş maksimum maaştan büyük olamaz.");
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.createJob({
        title: title.trim(),
        department: department.trim(),
        status,
        workspaceId: workspaceId.trim() || undefined,
        locationText: locationText.trim() || undefined,
        shiftType: shiftType.trim() || undefined,
        salaryMin: salaryMin ? Number(salaryMin) : undefined,
        salaryMax: salaryMax ? Number(salaryMax) : undefined,
        jdText: jdText.trim() || undefined,
        requirements: normalizedRequirements.length ? normalizedRequirements : undefined
      });
      router.push("/jobs");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "İlan oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-grid">
      <section className="panel form-panel">
        <div className="section-head">
          <div>
            <Link href="/jobs" className="text-muted text-sm" style={{ textDecoration: "none" }}>
              ← İlan Merkezi
            </Link>
            <h2 style={{ marginBottom: 4, marginTop: 8 }}>Yeni İlan Hazırla</h2>
            <p className="small" style={{ marginTop: 0 }}>
              Pozisyon bilgilerini girin. İsterseniz kaydetmeden önce AI ile ilan taslağı üretip düzenleyebilir,
              ardından harici platformlara kopyalayabilirsiniz.
            </p>
          </div>
        </div>

        {submitError ? <ErrorState error={submitError} /> : null}
        {fieldError ? <ErrorState title="Form doğrulama" error={fieldError} /> : null}

        <form onSubmit={handleSubmit} className="form-grid">
          <Field label="İlan Başlığı" htmlFor="job-title">
            <TextInput
              id="job-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Depo Operasyon Personeli"
              required
            />
          </Field>

          <Field label="Departman" htmlFor="job-department" hint="Örnek: Operasyon, Mağaza, Çağrı Merkezi">
            <TextInput
              id="job-department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              placeholder="Operasyon"
              required
            />
          </Field>

          <Field label="Durum" htmlFor="job-status">
            <SelectInput
              id="job-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as JobStatus)}
            >
              {JOB_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item === "DRAFT" ? "Taslak" : item === "PUBLISHED" ? "Yayında" : "Arşivlendi"}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Departman / Birim" htmlFor="job-workspace-id" hint="İlgili çalışma alanı">
            <TextInput
              id="job-workspace-id"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              placeholder="wrk_demo_ops"
            />
          </Field>

          <Field label="Lokasyon" htmlFor="job-location">
            <TextInput
              id="job-location"
              value={locationText}
              onChange={(event) => setLocationText(event.target.value)}
              placeholder="İstanbul"
            />
          </Field>

          <Field label="Çalışma Modeli / Vardiya" htmlFor="job-shift">
            <TextInput
              id="job-shift"
              value={shiftType}
              onChange={(event) => setShiftType(event.target.value)}
              placeholder="vardiyalı, tam zamanlı, yarı zamanlı..."
            />
          </Field>

          <Field label="Maaş Alt Sınır (TRY)" htmlFor="job-salary-min">
            <TextInput
              id="job-salary-min"
              type="number"
              min={0}
              value={salaryMin}
              onChange={(event) => setSalaryMin(event.target.value)}
            />
          </Field>

          <Field label="Maaş Üst Sınır (TRY)" htmlFor="job-salary-max">
            <TextInput
              id="job-salary-max"
              type="number"
              min={0}
              value={salaryMax}
              onChange={(event) => setSalaryMax(event.target.value)}
            />
          </Field>

          <Field label="İş Tanımı" htmlFor="job-jd-text">
            <TextArea
              id="job-jd-text"
              rows={5}
              value={jdText}
              onChange={(event) => setJdText(event.target.value)}
              placeholder="Pozisyonun temel sorumlulukları, vardiya koşulları ve gerekli beklentiler..."
            />
          </Field>

          <div className="panel nested-panel">
            <div className="section-head" style={{ marginBottom: 8 }}>
              <strong>Aranan Nitelikler</strong>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  setRequirements((prev) => [...prev, { key: "", value: "", required: true }])
                }
              >
                Nitelik Ekle
              </button>
            </div>

            {requirements.map((item, index) => (
              <div className="inline-grid requirement-grid" key={`req-${index}`}>
                <TextInput
                  value={item.key}
                  onChange={(event) =>
                    setRequirements((prev) =>
                      prev.map((requirement, reqIndex) =>
                        reqIndex === index ? { ...requirement, key: event.target.value } : requirement
                      )
                    )
                  }
                  placeholder="Nitelik adı (örnek: vardiya_uygunluğu)"
                />
                <TextInput
                  value={item.value}
                  onChange={(event) =>
                    setRequirements((prev) =>
                      prev.map((requirement, reqIndex) =>
                        reqIndex === index ? { ...requirement, value: event.target.value } : requirement
                      )
                    )
                  }
                  placeholder="Açıklama (örnek: gece vardiyası çalışabilmeli)"
                />
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={item.required}
                    onChange={(event) =>
                      setRequirements((prev) =>
                        prev.map((requirement, reqIndex) =>
                          reqIndex === index
                            ? { ...requirement, required: event.target.checked }
                            : requirement
                        )
                      )
                    }
                  />
                  Zorunlu
                </label>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() =>
                    setRequirements((prev) => prev.filter((_, reqIndex) => reqIndex !== index))
                  }
                  disabled={requirements.length === 1}
                >
                  Sil
                </button>
              </div>
            ))}
          </div>

          <div className="panel nested-panel" style={{ background: "var(--surface-muted, #f9fafb)" }}>
            <div className="section-head" style={{ marginBottom: 10 }}>
              <div>
                <strong>AI Destekli İlan Taslağı</strong>
                <p className="text-xs text-muted" style={{ margin: "6px 0 0" }}>
                  Bilgileri girdikten sonra Taslak Oluştur diyerek modelden ilan metni üretin. Oluşan taslağı
                  burada düzenleyebilir ve harici platformlara kopyalayabilirsiniz.
                </p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void generateDraft("fresh")}
                  disabled={draftLoading}
                  style={{ fontSize: 13 }}
                >
                  {draftLoading && draftAction === "fresh"
                    ? "Taslak hazırlanıyor..."
                    : hasDraft
                      ? "Yeniden Oluştur"
                      : "Taslak Oluştur"}
                </button>
                {hasDraft ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void generateDraft("rewrite")}
                    disabled={draftLoading || !rewriteInstruction.trim()}
                    style={{ fontSize: 13 }}
                  >
                    {draftLoading && draftAction === "rewrite"
                      ? "Yeniden yazılıyor..."
                      : "Nota Göre Yeniden Yaz"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="button-link"
                  onClick={() => void handleCopyDraft()}
                  disabled={!hasDraft}
                  style={{ fontSize: 13, padding: "4px 14px" }}
                >
                  {copySuccess ? "Kopyalandı!" : "Taslağı Kopyala"}
                </button>
              </div>
            </div>

            <Field
              label="Revizyon Notu"
              htmlFor="job-draft-instruction"
              hint="İsterseniz beğenmediğiniz taslağı burada vereceğiniz notla yeniden yazdırabilirsiniz."
            >
              <TextArea
                id="job-draft-instruction"
                rows={3}
                value={rewriteInstruction}
                onChange={(event) => setRewriteInstruction(event.target.value)}
                placeholder="Örnek: Daha kurumsal bir ton kullan, vardiya bilgisini daha net vurgula, nitelikleri daha kısa yaz."
              />
            </Field>

            {draftError ? <ErrorState title="İlan taslağı" error={draftError} /> : null}

            {draftNotice ? (
              <p className="text-xs text-muted" style={{ margin: draftError ? "8px 0 0" : "0 0 8px" }}>
                {draftNotice}
              </p>
            ) : null}

            {isDraftOutdated ? (
              <p className="text-xs text-muted" style={{ margin: "0 0 8px" }}>
                Taslak güncel değil. Form bilgilerinde değişiklik yaptınız; en doğru metin için yeniden oluşturun.
              </p>
            ) : null}

            <TextArea
              id="job-draft-text"
              rows={16}
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Taslak oluşturduğunuzda ilan metni burada görünecek."
            />
          </div>

          <div className="row-actions">
            <button type="submit" className="button-link" disabled={submitting}>
              {submitting ? "Oluşturuluyor..." : "İlanı Kaydet"}
            </button>
            <Link href="/jobs" className="ghost-button">
              Vazgeç
            </Link>
          </div>
        </form>
      </section>
    </div>
  );
}
