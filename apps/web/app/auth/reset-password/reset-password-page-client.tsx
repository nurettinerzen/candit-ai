"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { AuthNotice, AuthShell } from "../../../components/auth-shell";
import { PasswordField, PasswordRequirements } from "../../../components/password-field";
import { useUiText } from "../../../components/site-language-provider";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR_MESSAGE,
  getPasswordPolicyStatus
} from "../../../lib/auth/password-policy";
import { resetPasswordWithToken, resolvePasswordReset } from "../../../lib/auth/session";

function ResetPasswordPageContent() {
  const { locale, t } = useUiText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [resetInfo, setResetInfo] = useState<{
    email: string;
    fullName: string;
    status: "pending" | "used" | "revoked" | "expired";
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) {
        setError(t("Şifre sıfırlama tokenı bulunamadı."));
        setLoading(false);
        return;
      }

      try {
        const result = await resolvePasswordReset(token);
        if (!cancelled) {
          setResetInfo(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : t("Şifre sıfırlama bağlantısı doğrulanamadı.")
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!getPasswordPolicyStatus(password).isValid) {
      setError(t(PASSWORD_POLICY_ERROR_MESSAGE));
      return;
    }

    if (password !== passwordConfirm) {
      setError(t("Şifre tekrar alanı eşleşmiyor."));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await resetPasswordWithToken({ token, password });
      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : t("Şifre sıfırlanamadı.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  const pending = resetInfo?.status === "pending";
  const resetReadyMessage =
    resetInfo && pending
      ? locale === "en"
        ? `You can set a new password for ${resetInfo.email}.`
        : `${resetInfo.email} hesabı için yeni parola belirleyebilirsin.`
      : t("Bu bağlantı artık kullanılamıyor. Yeni bir sıfırlama bağlantısı isteyebilirsin.");

  return (
    <AuthShell
      badge={t("Parola yenile")}
      title={t("Yeni şifreni belirle")}
      description={t("Bağlantı geçerliyse yeni parolanı kaydedeceğiz ve hesabını tekrar açacağız.")}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Giriş ekranına dön")}
          </Link>
          <Link href="/auth/forgot-password" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Yeni bağlantı iste")}
          </Link>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {loading ? <AuthNotice tone="info" message={t("Bağlantı kontrol ediliyor...")} /> : null}
        {error ? <AuthNotice tone="danger" message={error} /> : null}

        {!loading && resetInfo ? (
          <AuthNotice
            tone={pending ? "info" : "danger"}
            message={resetReadyMessage}
          />
        ) : null}

        {pending ? (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <PasswordField
              label={t("Yeni şifre")}
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

            <PasswordRequirements password={password} />

            <button type="submit" disabled={submitting} style={primaryButtonStyle}>
              {submitting ? t("Kaydediliyor...") : t("Yeni şifreyi kaydet")}
            </button>
          </form>
        ) : null}
      </div>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid var(--border)",
  background: "var(--surface-raised)",
  color: "var(--text)",
  padding: "14px 16px",
  fontSize: 15,
  outline: "none",
  fontFamily: "inherit"
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 16,
  background: "var(--primary-gradient)",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  padding: "14px 18px",
  cursor: "pointer",
  fontFamily: "inherit"
};
