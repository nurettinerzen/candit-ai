"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FormEvent } from "react";
import { Suspense, useEffect, useState } from "react";
import { useUiText } from "../../../../components/site-language-provider";
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
              <form onSubmit={handleSubmit}>
                <label className="field">
                  <span className="small">Ad Soyad</span>
                  <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </label>
                <label className="field">
                  <span className="small">Sifre</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </label>
                <label className="field">
                  <span className="small">Sifre Tekrar</span>
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    required
                    minLength={8}
                  />
                </label>

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
