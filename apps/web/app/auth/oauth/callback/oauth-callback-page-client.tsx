"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AuthNotice, AuthShell } from "../../../../components/auth-shell";
import { useUiText } from "../../../../components/site-language-provider";
import { exchangeGoogleOauthToken } from "../../../../lib/auth/session";

const oauthExchangeTasks = new Map<string, Promise<void>>();

function resolveNextPath(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }

  return raw;
}

function getOauthExchangeTask(token: string) {
  const existingTask = oauthExchangeTasks.get(token);
  if (existingTask) {
    return existingTask;
  }

  const nextTask = exchangeGoogleOauthToken(token).then(() => undefined);
  oauthExchangeTasks.set(token, nextTask);
  nextTask.finally(() => {
    oauthExchangeTasks.delete(token);
  });
  return nextTask;
}

function OauthCallbackPageContent() {
  const { t } = useUiText();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const nextPath = useMemo(() => resolveNextPath(searchParams.get("returnTo")), [searchParams]);

  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function finalize() {
      if (!token) {
        setError(t("OAuth tokenı bulunamadı."));
        return;
      }

      try {
        await getOauthExchangeTask(token);

        if (active) {
          window.location.assign(nextPath);
        }
      } catch (finalizeError) {
        if (active) {
          setError(
            finalizeError instanceof Error
              ? finalizeError.message
              : t("Google oturumu tamamlanamadı.")
          );
        }
      }
    }

    void finalize();

    return () => {
      active = false;
    };
  }, [nextPath, t, token]);

  return (
    <AuthShell
      badge={t("Google oturumu")}
      title={t("Google hesabın bağlanıyor")}
      description={t("Oturumu tamamlayıp seni şirket hesabına yönlendireceğiz.")}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/auth/login" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Giriş ekranı")}
          </Link>
          <Link href="/auth/signup" style={{ color: "inherit", textDecoration: "none" }}>
            {t("Kayıt ekranı")}
          </Link>
        </div>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {!error ? (
          <AuthNotice tone="info" message={t("Google profili doğrulanıyor ve oturum hazırlanıyor...")} />
        ) : null}
        {error ? <AuthNotice tone="danger" message={error} /> : null}
      </div>
    </AuthShell>
  );
}

export default function OauthCallbackPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <OauthCallbackPageContent />
    </Suspense>
  );
}
