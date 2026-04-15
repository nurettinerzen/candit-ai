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
  loginWithPassword
} from "../../../lib/auth/session";

function resolveNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }

  return raw;
}

function LoginPageContent() {
  const { locale, t } = useUiText();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveNextPath(searchParams.get("returnTo")), [searchParams]);
  const oauthError = formatAuthErrorMessage(searchParams.get("oauth_error"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [error, setError] = useState("");

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

    try {
      await loginWithPassword({
        email,
        password
      });
      window.location.assign(nextPath);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t("Giriş başarısız."));
    } finally {
      setLoading(false);
    }
  }

  const googleUrl = getGoogleAuthAuthorizeUrl({
    intent: "login",
    returnTo: nextPath
  });
  const emailPlaceholder = locale === "en" ? "name@company.com" : "is@sirketiniz.com";

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

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("E-posta")}</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            placeholder={emailPlaceholder}
            required
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Şifre")}</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            style={inputStyle}
          />
        </label>

        <button type="submit" disabled={loading} style={primaryButtonStyle}>
          {loading ? t("Giriş yapılıyor...") : t("Giriş Yap")}
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
          {t("Google ile giriş yap")}
        </a>

        {!googleEnabled ? (
          <AuthNotice
            tone="info"
            message={t("Google ile giriş yakında aktif olacak.")}
          />
        ) : null}

      </div>
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
