"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { PageTitleWithGuide } from "../../../../components/page-guide";
import { useUiText } from "../../../../components/site-language-provider";
import { Field, TextInput } from "../../../../components/form-controls";
import { ErrorState } from "../../../../components/ui-states";
import { apiClient } from "../../../../lib/api-client";
import { candidateDetailHref } from "../../../../lib/entity-routes";

export default function NewCandidatePage() {
  const { t } = useUiText();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("manual");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentMeta, setConsentMeta] = useState({
    noticeVersion: "kvkk_data_processing_tr_v1_2026_04",
    policyVersion: "policy_v1",
    summary: "",
    explicitText: ""
  });
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConsentMeta() {
      try {
        const result = await apiClient.getTenantHiringSettings();

        if (cancelled) {
          return;
        }

        setConsentMeta({
          noticeVersion: result.settings.dataProcessingConsent.noticeVersion,
          policyVersion: result.settings.dataProcessingConsent.policyVersion ?? "policy_v1",
          summary: result.settings.dataProcessingConsent.summary,
          explicitText: result.settings.dataProcessingConsent.explicitText
        });
      } catch {
        // Settings are optional here; we keep safe defaults.
      }
    }

    void loadConsentMeta();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    setSubmitError("");

    if (fullName.trim().length < 2) {
      setFieldError(t("Aday adı en az 2 karakter olmalı."));
      return;
    }

    if (!consentAccepted) {
      setFieldError(t("KVKK açık rızası alınmadan aday kaydı açılamaz."));
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.createCandidate({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: source.trim() || undefined,
        consentAccepted: true,
        consentNoticeVersion: consentMeta.noticeVersion,
        consentPolicyVersion: consentMeta.policyVersion
      });
      router.push(candidateDetailHref(response.candidate.id));
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("Aday oluşturulamadı."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel form-panel">
      <div className="section-head">
        <div>
          <PageTitleWithGuide
            as="h2"
            guideKey="candidateCreate"
            title={t("Yeni Aday Kaydı")}
            subtitle={t("Aday kaydı oluşturulduğunda duplicate kontrolü otomatik uygulanır.")}
            subtitleClassName="small"
            style={{ margin: 0 }}
          />
        </div>
        <Link href="/candidates" className="ghost-button">
          {t("Aday Havuzuna Dön")}
        </Link>
      </div>

      {submitError ? <ErrorState error={submitError} /> : null}
      {fieldError ? <ErrorState title={t("Form doğrulama")} error={fieldError} /> : null}

      <form className="form-grid" onSubmit={handleSubmit}>
        <Field label={t("Ad Soyad")} htmlFor="candidate-name">
          <TextInput
            id="candidate-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t("Ahmet Kaya")}
            required
          />
        </Field>

        <Field label={t("Telefon")} htmlFor="candidate-phone">
          <TextInput
            id="candidate-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("0555 111 22 33")}
          />
        </Field>

        <Field label={t("E-posta")} htmlFor="candidate-email">
          <TextInput
            id="candidate-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("ahmet@example.com")}
          />
        </Field>

        <Field label={t("Kaynak")} htmlFor="candidate-source" hint={t("manual, referral, kariyer-portali vb.")}>
          <TextInput
            id="candidate-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder={t("manual")}
          />
        </Field>

        <div
          style={{
            gridColumn: "1 / -1",
            display: "grid",
            gap: 12,
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.02)"
          }}
        >
          <div>
            <strong>{t("KVKK açık rıza kaydı")}</strong>
            <p className="small text-muted" style={{ margin: "6px 0 0" }}>
              {consentMeta.summary || t("Aday verisi işe alım sürecinde değerlendirme, iletişim ve referans araştırması için işlenir.")}
            </p>
          </div>

          {consentMeta.explicitText ? (
            <div
              className="small text-muted"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)"
              }}
            >
              {consentMeta.explicitText}
            </div>
          ) : null}

          <div className="small text-muted">
            {t("Metin versiyonu")}: {consentMeta.noticeVersion}
            {consentMeta.policyVersion ? ` · ${consentMeta.policyVersion}` : ""}
          </div>

          <label style={{ display: "inline-flex", alignItems: "flex-start", gap: 10 }}>
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              {t("Adaydan KVKK açık rızası alınmıştır ve sistemde kaydedilmesi onaylanmıştır.")}
            </span>
          </label>
        </div>

        <div className="row-actions">
          <button type="submit" className="button-link" disabled={submitting}>
            {submitting ? t("Kaydediliyor...") : t("Adayı Kaydet")}
          </button>
          <Link href="/candidates" className="ghost-button">
            {t("Vazgeç")}
          </Link>
        </div>
      </form>
    </section>
  );
}
