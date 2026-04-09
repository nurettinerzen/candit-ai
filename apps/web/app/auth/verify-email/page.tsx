"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthNotice, AuthShell } from "../../../components/auth-shell";
import { useUiText } from "../../../components/site-language-provider";
import {
  confirmEmailVerification,
  resolveActiveSession,
  saveSession
} from "../../../lib/auth/session";

type EmailVerificationPayload = Awaited<ReturnType<typeof confirmEmailVerification>>;

const emailVerificationTasks = new Map<string, Promise<EmailVerificationPayload>>();

function VerifyEmailPageContent() {
  const { t } = useUiText();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!token) {
        setError(t("Doğrulama tokenı bulunamadı."));
        setLoading(false);
        return;
      }

      try {
        const existingTask = emailVerificationTasks.get(token);
        const verificationTask = existingTask ?? confirmEmailVerification(token);
        if (!existingTask) {
          emailVerificationTasks.set(token, verificationTask);
          verificationTask.finally(() => {
            emailVerificationTasks.delete(token);
          });
        }

        const result = await verificationTask;

        if (!active) {
          return;
        }

        const session = resolveActiveSession();
        if (session && result.user?.emailVerifiedAt) {
          saveSession({
            ...session,
            emailVerifiedAt: result.user.emailVerifiedAt
          });
        }

        setVerified(true);
      } catch (verifyError) {
        if (active) {
          setError(
            verifyError instanceof Error ? verifyError.message : t("E-posta doğrulanamadı.")
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void verify();

    return () => {
      active = false;
    };
  }, [token, t]);

  return (
    <AuthShell
      badge={t("E-posta doğrulama")}
      title={t("Hesabın doğrulanıyor")}
      description={t("Bağlantı geçerliyse e-posta adresini onaylayıp hesabı hazır hale getireceğiz.")}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Panele git")}
          </Link>
          <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Giriş ekranı")}
          </Link>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {loading ? <AuthNotice tone="info" message={t("Doğrulama bağlantısı kontrol ediliyor...")} /> : null}
        {verified ? <AuthNotice tone="success" message={t("E-posta adresin başarıyla doğrulandı.")} /> : null}
        {error ? <AuthNotice tone="danger" message={error} /> : null}
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
