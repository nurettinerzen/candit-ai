"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties, FormEvent } from "react";
import { Suspense, useEffect, useState } from "react";
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
      return "Bu davet daha once kullanilmis.";
    case "revoked":
      return "Bu davet iptal edilmis.";
    case "expired":
      return "Bu davetin suresi dolmus.";
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
    <main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Daveti Kabul Et</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Hesabinizi aktiflestirmek icin sifrenizi belirleyin.
      </p>

      <section className="panel">
        {loading ? (
          <p style={{ margin: 0 }}>Davet bilgisi yukleniyor...</p>
        ) : error ? (
          <p style={{ color: "#c2410c", margin: 0 }}>{error}</p>
        ) : invitation ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 6px" }}>
                <strong>Sirket:</strong> {invitation.tenantName}
              </p>
              <p style={{ margin: "0 0 6px" }}>
                <strong>E-posta:</strong> {invitation.email}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Rol:</strong> {getRoleLabel(invitation.role)}
              </p>
            </div>

            {invitation.status !== "pending" ? (
              <p style={{ color: "#c2410c", margin: 0 }}>{statusMessage(invitation.status)}</p>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
                <label style={{ display: "grid", gap: 8 }}>
                  <span style={fieldLabelStyle}>{t("Ad soyad")}</span>
                  <input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    style={inputStyle}
                  />
                </label>
                <PasswordField
                  label={t("Şifre")}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  inputStyle={inputStyle}
                />
                <PasswordField
                  label={t("Şifre tekrar")}
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                  inputStyle={inputStyle}
                />

                <PasswordRequirements password={password} />

                {error ? <p style={{ color: "#c2410c", marginBottom: 8 }}>{error}</p> : null}

                <button type="submit" className="button-link" disabled={submitting}>
                  {submitting ? "Hesap aktiflestiriliyor..." : "Hesabi Aktiflestir"}
                </button>
              </form>
            )}
          </>
        ) : (
          <p style={{ margin: 0 }}>{t("Davet bilgisi bulunamadı.")}</p>
        )}
      </section>

      <p style={{ marginTop: 14 }}>
        {t("Giriş ekranına dönmek için")} <Link href="/auth/login">{t("buraya")}</Link> {t("tıklayın.")}
      </p>
    </main>
  );
}

export default function AcceptInvitationPage() {
  const locale = getActiveSiteLocale();
  return (
    <Suspense fallback={<main style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>{translateUiText("Davet bilgisi yükleniyor...", locale)}</main>}>
      <AcceptInvitationContent />
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

const fieldLabelStyle: CSSProperties = {
  color: "#cbd5e1",
  fontSize: 14
};
