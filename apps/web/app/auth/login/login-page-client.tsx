"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { AuthNotice, AuthShell } from "../../../components/auth-shell";
import { PasswordField } from "../../../components/password-field";
import { useUiText } from "../../../components/site-language-provider";
import { formatAuthErrorMessage } from "../../../lib/auth/error";
import {
  getAuthProviders,
  getGoogleAuthAuthorizeUrl,
  loginWithPassword,
  requestEmailVerification,
  readAuthFlowError
} from "../../../lib/auth/session";

function resolveNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }

  return raw;
}

function LoginPageContent() {
  const { t } = useUiText();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams.get("returnTo")), [searchParams]);
  const oauthError = formatAuthErrorMessage(searchParams.get("oauth_error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");

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
    setLoading(true);
    setError("");
    setVerificationNotice("");
    setVerificationEmail("");

    try {
      await loginWithPassword({
        email,
        password
      });
      window.location.assign(nextPath);
    } catch (loginError) {
      const authFlowError = readAuthFlowError(loginError);
      if (authFlowError?.code === "EMAIL_VERIFICATION_REQUIRED") {
        setVerificationEmail(email.trim());
      }
      setError(authFlowError?.message ?? (loginError instanceof Error ? loginError.message : t("Giriş başarısız.")));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificationResend() {
    if (!verificationEmail) {
      return;
    }

    setVerificationBusy(true);
    setVerificationNotice("");
    setError("");

    try {
      await requestEmailVerification({
        email: verificationEmail
      });
      setVerificationNotice(
        t("Doğrulama e-postasını tekrar gönderdik. Gelen kutunuzu ve spam klasörünü kontrol edin.")
      );
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : t("Doğrulama e-postası tekrar gönderilemedi.")
      );
    } finally {
      setVerificationBusy(false);
    }
  }

  const googleUrl = getGoogleAuthAuthorizeUrl({
    intent: "login",
    returnTo: nextPath
  });

  return (
    <AuthShell
      badge={t("Giriş")}
      title={t("Hesabınıza giriş yapın")}
      description={t("E-posta ve şifrenizle veya Google hesabınızla oturum açın.")}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Ana sayfaya dön")}
          </Link>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link href="/auth/forgot-password" style={{ color: "inherit", textDecoration: "none" }}>
              {t("Şifremi unuttum")}
            </Link>
            <Link href="/auth/signup" style={{ color: "inherit", textDecoration: "none" }}>
              {t("Hesap oluştur")}
            </Link>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        {oauthError ? <AuthNotice tone="danger" message={oauthError} /> : null}
        {error ? <AuthNotice tone="danger" message={error} /> : null}
        {verificationNotice ? <AuthNotice tone="success" message={verificationNotice} /> : null}

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("E-posta")}</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
            style={inputStyle}
          />
        </label>

        <PasswordField
          label={t("Şifre")}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          inputStyle={inputStyle}
        />

        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? t("Giriş yapılıyor...") : t("Giriş Yap")}
        </button>

        {verificationEmail ? (
          <button
            type="button"
            onClick={handleVerificationResend}
            disabled={verificationBusy}
            style={secondaryButtonStyle}
          >
            {verificationBusy
              ? t("Doğrulama e-postası gönderiliyor...")
              : t("Doğrulama e-postasını tekrar gönder")}
          </button>
        ) : null}
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
            {t("Google ile giriş yap")}
          </a>
        </div>
      ) : null}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <LoginPageContent />
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
  width: "100%",
  border: "none",
  borderRadius: 16,
  background: "#5046e5",
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
