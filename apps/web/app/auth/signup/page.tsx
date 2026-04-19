"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { AuthNotice, AuthShell } from "../../../components/auth-shell";
import { PasswordField, PasswordRequirements } from "../../../components/password-field";
import { useUiText } from "../../../components/site-language-provider";
import { formatAuthErrorMessage } from "../../../lib/auth/error";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_ERROR_MESSAGE, getPasswordPolicyStatus } from "../../../lib/auth/password-policy";
import {
  type AuthEmailVerificationPayload,
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
    emailVerification?: AuthEmailVerificationPayload;
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

    if (!getPasswordPolicyStatus(password).isValid) {
      setError(t(PASSWORD_POLICY_ERROR_MESSAGE));
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
        emailVerification: result.emailVerification
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
  if (createdState) {
    const emailVerification = createdState.emailVerification;
    const verificationEnabled = Boolean(emailVerification?.enabled);
    const verificationRequired = Boolean(emailVerification?.required);
    const verificationDeliveryEnabled = Boolean(emailVerification?.deliveryEnabled);
    const title = verificationEnabled ? t("Hesabınız oluşturuldu") : t("Hesap hazır");
    const description = verificationRequired
      ? locale === "en"
        ? "Verify your email address to unlock workspace access."
        : "Çalışma alanı erişimini açmak için e-posta adresinizi doğrulayın."
      : verificationEnabled
        ? locale === "en"
          ? "Your account is ready. You can optionally verify your email now."
          : "Hesabınız hazır. İsterseniz e-posta adresinizi şimdi doğrulayabilirsiniz."
        : locale === "en"
          ? "Your account is ready."
          : "Hesabınız hazır.";
    const successMessage = !verificationEnabled
      ? locale === "en"
        ? "Account created successfully. You can continue directly to the panel."
        : "Hesap başarıyla oluşturuldu. Doğrudan panele geçebilirsiniz."
      : verificationDeliveryEnabled
        ? locale === "en"
          ? `A verification email was sent to ${createdState.email}.`
          : `${createdState.email} adresine doğrulama e-postası gönderildi.`
        : locale === "en"
          ? "A verification link was prepared for this account."
          : "Bu hesap için doğrulama bağlantısı hazırlandı.";
    const infoMessage = verificationEnabled ? t("E-posta kutunuzu kontrol edip doğrulama bağlantısına tıklayın.") : "";

    return (
      <AuthShell
        badge={t("Hesap hazır")}
        title={title}
        description={description}
        footer={
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            {!verificationRequired ? (
              <a href={nextPath} style={{ color: "inherit", textDecoration: "none" }}>
                {t("Panele git")}
              </a>
            ) : (
              <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
                {t("Ana sayfa")}
              </Link>
            )}
            <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
              {t("Giriş ekranı")}
            </Link>
          </div>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <AuthNotice
            tone="success"
            message={successMessage}
          />
          {verificationEnabled && infoMessage ? (
            <AuthNotice
              tone="info"
              message={infoMessage}
            />
          ) : null}

          {!verificationRequired ? (
            <a href={nextPath} style={secondaryButtonStyle}>
              {t("Panele devam et")}
            </a>
          ) : null}
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
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Ad Soyad")}</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Şirket adı")}</span>
          <input
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
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
            required
            style={inputStyle}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <PasswordField
            label={t("Şifre")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            required
            inputStyle={inputStyle}
          />
          <PasswordField
            label={t("Şifre tekrar")}
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            required
            inputStyle={inputStyle}
          />
        </div>

        <PasswordRequirements password={password} />

        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? t("Hesap oluşturuluyor...") : t("Hesap Oluştur")}
        </button>
      </form>

      {googleEnabled ? (
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

          <a href={googleUrl} style={secondaryButtonStyle}>
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
        </div>
      ) : null}
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
