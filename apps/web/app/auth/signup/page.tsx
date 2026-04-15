"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { AuthNotice, AuthShell } from "../../../components/auth-shell";
import { useUiText } from "../../../components/site-language-provider";
import { formatAuthErrorMessage } from "../../../lib/auth/error";
import {
  getAuthProviders,
  getGoogleAuthAuthorizeUrl,
  signupWithPassword
} from "../../../lib/auth/session";

function resolveNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }

  return raw;
}

function SignupPageContent() {
  const { locale, t } = useUiText();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams.get("returnTo")), [searchParams]);
  const oauthError = formatAuthErrorMessage(searchParams.get("oauth_error"));

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [error, setError] = useState("");
  const [createdState, setCreatedState] = useState<{
    email: string;
    previewUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProviders() {
      try {
        const providers = await getAuthProviders();
        if (!cancelled) {
          setGoogleEnabled(Boolean(providers.google?.enabled));
        }
      } catch {
        if (!cancelled) {
          setGoogleEnabled(false);
        }
      }
    }

    void loadProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(t("Şifre en az 8 karakter olmalıdır."));
      return;
    }

    if (password !== passwordConfirm) {
      setError(t("Şifre tekrar alanı eşleşmiyor."));
      return;
    }

    setLoading(true);

    try {
      const result = await signupWithPassword({
        companyName,
        fullName,
        email,
        password
      });

      setCreatedState({
        email,
        previewUrl: result.emailVerification?.previewUrl ?? null
      });
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : t("Hesap oluşturulamadı."));
    } finally {
      setLoading(false);
    }
  }

  const googleUrl = getGoogleAuthAuthorizeUrl({
    intent: "signup",
    companyName: companyName.trim() || undefined,
    returnTo: nextPath
  });
  const fullNamePlaceholder = locale === "en" ? "Your full name" : "Adınız Soyadınız";
  const companyPlaceholder = locale === "en" ? "Your company name" : "Şirketinizin adı";
  const emailPlaceholder = locale === "en" ? "name@company.com" : "is@sirketiniz.com";
  const passwordPlaceholder = locale === "en" ? "At least 8 characters" : "En az 8 karakter";
  const verificationSentMessage =
    locale === "en"
      ? `A verification email was sent to ${createdState?.email}.`
      : `${createdState?.email} adresi için doğrulama e-postası gönderildi.`;

  if (createdState) {
    return (
      <AuthShell
        badge={t("Hesap hazır")}
        title={t("Hesabınız oluşturuldu")}
        description={t("E-posta adresinizi doğrulayarak kurulumu tamamlayabilirsiniz.")}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <a href={nextPath} style={{ color: "inherit", textDecoration: "none" }}>
              {t("Panele git")}
            </a>
            <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
              {t("Giriş ekranı")}
            </Link>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <AuthNotice
            tone="success"
            message={verificationSentMessage}
          />
          {createdState.previewUrl ? (
            <AuthNotice
              tone="info"
              message={t("Geliştirme ortamı: Aşağıdaki bağlantıdan doğrulama ekranını açabilirsiniz.")}
            />
          ) : (
            <AuthNotice
              tone="info"
              message={t("E-posta kutunuzu kontrol edip doğrulama bağlantısına tıklayın.")}
            />
          )}

          {createdState.previewUrl ? (
            <a href={createdState.previewUrl} style={primaryButtonStyle}>
              {t("Doğrulama bağlantısını aç")}
            </a>
          ) : null}

          <a href={nextPath} style={secondaryButtonStyle}>
            {t("Panele devam et")}
          </a>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge={t("Yeni hesap")}
      title={t("Candit'e katılın")}
      description={t("Şirketiniz için bir hesap oluşturun ve ekibinizi davet etmeye başlayın.")}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Ana sayfa")}
          </Link>
          <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Zaten hesabınız var mı? Giriş yapın")}
          </Link>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        {oauthError ? <AuthNotice tone="danger" message={oauthError} /> : null}
        {error ? <AuthNotice tone="danger" message={error} /> : null}

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Ad soyad")}</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            placeholder={fullNamePlaceholder}
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Şirket adı")}</span>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder={companyPlaceholder}
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("E-posta")}</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder={emailPlaceholder}
            required
            style={inputStyle}
          />
          <span style={{ color: "#94a3b8", fontSize: 12 }}>
            {t("Şirket e-posta adresi önerilir")}
          </span>
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Şifre")}</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder={passwordPlaceholder}
              minLength={8}
              required
              style={inputStyle}
            />
          </label>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Şifre tekrar")}</span>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              minLength={8}
              required
              style={inputStyle}
            />
          </label>
        </div>

        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? t("Hesap oluşturuluyor...") : t("Hesap Oluştur")}
        </button>
      </form>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 12,
            color: "#64748b",
            fontSize: 12
          }}
        >
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
          <span>{t("veya")}</span>
          <div style={{ height: 1, background: "rgba(255,255,255,0.08)" }} />
        </div>

        <a
          href={googleEnabled ? googleUrl : undefined}
          aria-disabled={!googleEnabled}
          style={{
            ...secondaryButtonStyle,
            opacity: googleEnabled ? 1 : 0.55,
            cursor: googleEnabled ? "pointer" : "not-allowed",
            pointerEvents: googleEnabled ? "auto" : "none"
          }}
        >
          <span
            style={{
              display: "inline-flex",
              width: 22,
              height: 22,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              background: "#fff",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: 12
            }}
          >
            G
          </span>
          {t("Google ile kayıt ol")}
        </a>

        {!googleEnabled ? (
          <AuthNotice
            tone="info"
            message={t("Google ile kayıt yakında aktif olacak.")}
          />
        ) : null}
      </div>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <SignupPageContent />
    </Suspense>
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
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  border: "none",
  borderRadius: 16,
  background: "#5046e5",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  padding: "14px 18px",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none"
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
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
