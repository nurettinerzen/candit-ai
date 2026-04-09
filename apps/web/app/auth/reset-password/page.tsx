"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { AuthNotice, AuthShell } from "../../../components/auth-shell";
import { useUiText } from "../../../components/site-language-provider";
import { resetPasswordWithToken, resolvePasswordReset } from "../../../lib/auth/session";

function ResetPasswordPageContent() {
  const { t } = useUiText();
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

    if (password.length < 8) {
      setError(t("Şifre en az 8 karakter olmalıdır."));
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
            message={
              pending
                ? `${resetInfo.email} ${t("hesabı için yeni parola belirleyebilirsin.")}`
                : t("Bu bağlantı artık kullanılamıyor. Yeni bir sıfırlama bağlantısı isteyebilirsin.")
            }
          />
        ) : null}

        {pending ? (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: "#cbd5e1", fontSize: 14 }}>{t("Yeni şifre")}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                minLength={8}
                required
                style={inputStyle}
              />
            </label>

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
