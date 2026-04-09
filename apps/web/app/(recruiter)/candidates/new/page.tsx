"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
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
  const [fieldError, setFieldError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldError("");
    setSubmitError("");

    if (fullName.trim().length < 2) {
      setFieldError(t("Aday adı en az 2 karakter olmalı."));
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.createCandidate({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: source.trim() || undefined
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
          <h2 style={{ marginBottom: 4 }}>{t("Yeni Aday Kaydı")}</h2>
          <p className="small" style={{ marginTop: 0 }}>
            {t("Aday kaydı oluşturulduğunda duplicate kontrolü otomatik uygulanır.")}
          </p>
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
