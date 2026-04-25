"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { Suspense, useEffect, useState } from "react";
import { AuthNotice, AuthShell } from "../../../../components/auth-shell";
import { PasswordField, PasswordRequirements } from "../../../../components/password-field";
import { useUiText } from "../../../../components/site-language-provider";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR_MESSAGE,
  getPasswordPolicyStatus
} from "../../../../lib/auth/password-policy";
import { getRoleLabel } from "../../../../lib/auth/policy";
import { acceptInvitation, resolveInvitation } from "../../../../lib/auth/session";
import { getActiveSiteLocale, translateUiText } from "../../../../lib/i18n";

type InvitationView = {
  tenantId: string;
  tenantName: string;
  email: string;
  fullName: string;
  role: string;
  expiresAt: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

function statusMessage(status: InvitationView["status"]) {
  switch (status) {
    case "accepted":
      return "Bu davet daha önce kullanılmış.";
    case "revoked":
      return "Bu davet iptal edilmiş.";
    case "expired":
      return "Bu davetin süresi dolmuş.";
    default:
      return "";
  }
}

function AcceptInvitationContent() {
  const { t } = useUiText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadInvitation() {
      if (!token) {
        setError(t("Davet tokeni bulunamadı."));
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await resolveInvitation(token);
        if (cancelled) {
          return;
        }

        setInvitation(data);
        setFullName(data.fullName);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : t("Davet bilgisi yüklenemedi."));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInvitation();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError(t("Davet tokeni bulunamadı."));
      return;
    }

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
      await acceptInvitation({
        token,
        password,
        fullName
      });

      router.push("/dashboard");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Davet kabul edilemedi."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      badge={t("Davet")}
      title={t("Daveti kabul et")}
      description={t("Hesabını etkinleştirmek için adını ve şifreni belirle.")}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Ana sayfa")}
          </Link>
          <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Giriş ekranı")}
          </Link>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {loading ? <AuthNotice tone="info" message={t("Davet bilgisi yükleniyor...")} /> : null}
        {!loading && error ? <AuthNotice tone="danger" message={error} /> : null}

        {!loading && invitation ? (
          <>
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid var(--border)",
                background: "var(--surface-muted)"
              }}
            >
              <p style={{ margin: 0 }}>
                <strong>{t("Şirket")}:</strong> {invitation.tenantName}
              </p>
              <p style={{ margin: 0 }}>
                <strong>{t("E-posta")}:</strong> {invitation.email}
              </p>
              <p style={{ margin: 0 }}>
                <strong>{t("Rol")}:</strong> {getRoleLabel(invitation.role)}
              </p>
            </div>

            {invitation.status !== "pending" ? (
              <AuthNotice tone="danger" message={t(statusMessage(invitation.status))} />
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={fieldLabelStyle}>{t("Ad soyad")}</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    autoComplete="name"
                    name="name"
                    required
                    style={inputStyle}
                  />
                </label>
                <PasswordField
                  label={t("Şifre")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  name="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  inputStyle={inputStyle}
                />
                <PasswordField
                  label={t("Şifre tekrar")}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                  name="confirm-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  inputStyle={inputStyle}
                />

                <PasswordRequirements password={password} />

                {error ? <AuthNotice tone="danger" message={error} /> : null}

                <button type="submit" disabled={submitting} style={primaryButtonStyle}>
                  {submitting ? t("Hesap etkinleştiriliyor...") : t("Hesabı etkinleştir")}
                </button>
              </form>
            )}
          </>
        ) : null}

        {!loading && !invitation && !error ? (
          <AuthNotice tone="danger" message={t("Davet bilgisi bulunamadı.")} />
        ) : null}
      </div>
    </AuthShell>
  );
}

export default function AcceptInvitationPage() {
  const locale = getActiveSiteLocale();
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }}>{translateUiText("Davet bilgisi yükleniyor...", locale)}</main>}>
      <AcceptInvitationContent />
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

const fieldLabelStyle: CSSProperties = {
  color: "var(--text-secondary)",
  fontSize: 14
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
