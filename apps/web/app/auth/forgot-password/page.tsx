"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import { AuthNotice, AuthShell } from "../../../components/auth-shell";
import { useUiText } from "../../../components/site-language-provider";
import { requestPasswordReset } from "../../../lib/auth/session";

export default function ForgotPasswordPage() {
  const { t } = useUiText();
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    previewUrl?: string | null;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await requestPasswordReset({
        email,
        tenantId: tenantId.trim() || undefined
      });
      setResult({
        previewUrl: response.previewUrl ?? null
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("Şifre sıfırlama talebi gönderilemedi.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      badge={t("Şifre sıfırlama")}
      title={t("Yeni parola bağlantısı iste")}
      description={t("E-posta adresini yaz, varsa tenant kodunu ekle; sana yeni şifre oluşturma bağlantısı hazırlayalım.")}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Giriş ekranına dön")}
          </Link>
          <Link href="/auth/signup" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Yeni hesap oluştur")}
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        {error ? <AuthNotice tone="danger" message={error} /> : null}
        {result ? (
          <AuthNotice
            tone="success"
            message={t("Bağlantı hazırlandı. Hesabın varsa e-posta kutuna veya lokal preview linkine bakabilirsin.")}
          />
        ) : null}

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>E-posta</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Tenant kodu")} <span style={{ color: "#64748b" }}>({t("opsiyonel")})</span></span>
          <input
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
            placeholder="ten_demo"
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? t("Hazırlanıyor...") : t("Şifre sıfırlama bağlantısı gönder")}
        </button>

        {result?.previewUrl ? (
          <a href={result.previewUrl} style={secondaryButtonStyle}>
            {t("Lokal reset bağlantısını aç")}
          </a>
        ) : null}
      </form>
    </AuthShell>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.9)",
  color: "#f8fafc",
  padding: "14px 16px",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit"
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 16,
  background: "linear-gradient(135deg, #0ea5e9, #f97316)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  padding: "14px 18px",
  cursor: "pointer",
  fontFamily: "inherit"
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.56)",
  color: "#e2e8f0",
  fontSize: 15,
  fontWeight: 600,
  padding: "14px 18px",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none"
};
