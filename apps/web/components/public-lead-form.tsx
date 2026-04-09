"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { publicContactApi } from "../lib/api/public-client";
import styles from "./public-site.module.css";

type PublicLeadFormProps = {
  title: string;
  body: string;
  submitLabel: string;
  sourcePage: string;
  successTitle: string;
  successBody: string;
};

type FormState = {
  fullName: string;
  email: string;
  company: string;
  role: string;
  phone: string;
  message: string;
  website: string;
};

const INITIAL_STATE: FormState = {
  fullName: "",
  email: "",
  company: "",
  role: "",
  phone: "",
  message: "",
  website: ""
};

function getUtmValue(url: URL, key: string) {
  const value = url.searchParams.get(key);
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function PublicLeadForm({
  title,
  body,
  submitLabel,
  sourcePage,
  successTitle,
  successBody
}: PublicLeadFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function handleChange(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value
      }));
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const currentUrl = typeof window !== "undefined" ? new URL(window.location.href) : null;
      const result = await publicContactApi.submit({
        fullName: form.fullName,
        email: form.email,
        company: form.company || undefined,
        role: form.role || undefined,
        phone: form.phone || undefined,
        message: form.message,
        sourcePage,
        landingUrl: currentUrl?.toString(),
        referrerUrl:
          typeof document !== "undefined" && document.referrer.trim().length > 0
            ? document.referrer
            : undefined,
        locale:
          typeof navigator !== "undefined" && navigator.language.trim().length > 0
            ? navigator.language
            : undefined,
        utmSource: currentUrl ? getUtmValue(currentUrl, "utm_source") : undefined,
        utmMedium: currentUrl ? getUtmValue(currentUrl, "utm_medium") : undefined,
        utmCampaign: currentUrl ? getUtmValue(currentUrl, "utm_campaign") : undefined,
        utmTerm: currentUrl ? getUtmValue(currentUrl, "utm_term") : undefined,
        utmContent: currentUrl ? getUtmValue(currentUrl, "utm_content") : undefined,
        website: form.website || undefined
      });

      setSuccessMessage(result.message);
      setForm(INITIAL_STATE);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Mesaj gönderilemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      <span className={styles.eyebrow}>{title}</span>
      <h3>{title}</h3>
      <p>{body}</p>

      {successMessage ? (
        <div className={`${styles.formAlert} ${styles.formAlertSuccess}`}>
          <strong>{successTitle}</strong>
          <span>{successBody}</span>
          <small>{successMessage}</small>
        </div>
      ) : null}

      {error ? (
        <div className={`${styles.formAlert} ${styles.formAlertError}`}>
          <strong>Gönderim başarısız oldu</strong>
          <span>{error}</span>
        </div>
      ) : null}

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Ad Soyad</span>
          <input
            type="text"
            placeholder="Örn: Nurettin Erzen"
            value={form.fullName}
            onChange={handleChange("fullName")}
            required
            autoComplete="name"
          />
        </label>

        <label className={styles.field}>
          <span>E-posta</span>
          <input
            type="email"
            placeholder="ornek@sirket.com"
            value={form.email}
            onChange={handleChange("email")}
            required
            autoComplete="email"
          />
        </label>

        <label className={styles.field}>
          <span>Şirket</span>
          <input
            type="text"
            placeholder="Şirket adı"
            value={form.company}
            onChange={handleChange("company")}
            autoComplete="organization"
          />
        </label>

        <label className={styles.field}>
          <span>Rol / Ekip</span>
          <input
            type="text"
            placeholder="İK, kurucu, işe alım lideri..."
            value={form.role}
            onChange={handleChange("role")}
          />
        </label>

        <label className={styles.field}>
          <span>Telefon</span>
          <input
            type="tel"
            placeholder="+90 5xx xxx xx xx"
            value={form.phone}
            onChange={handleChange("phone")}
            autoComplete="tel"
          />
        </label>

        <label className={`${styles.field} ${styles.visuallyHidden}`} aria-hidden="true">
          <span>Website</span>
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={handleChange("website")}
          />
        </label>

        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span>Mesaj</span>
          <textarea
            rows={5}
            placeholder="İşe alım süreçleriniz, pilot hedefiniz ve ihtiyacınız olan akışlar hakkında kısa bilgi verin."
            value={form.message}
            onChange={handleChange("message")}
            required
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonBlock}`}
      >
        <span>{submitting ? "Gönderiliyor..." : submitLabel}</span>
      </button>
    </form>
  );
}
