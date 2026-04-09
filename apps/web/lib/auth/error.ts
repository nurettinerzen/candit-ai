const AUTH_ERROR_LABELS: Record<string, string> = {
  google_auth_not_configured: "Google giriş ayarları henüz tamamlanmadı.",
  invalid_google_state: "Google oturum bilgisi doğrulanamadı. Lütfen tekrar deneyin.",
  missing_google_code_or_state: "Google oturum bilgisi eksik döndü. Lütfen tekrar deneyin.",
  google_access_token_missing: "Google erişim anahtarı alınamadı. Lütfen tekrar deneyin.",
  google_profile_incomplete: "Google hesabından gerekli profil bilgileri alınamadı.",
  google_auth_failed: "Google girişi tamamlanamadı."
};

export function formatAuthErrorMessage(raw: string | null | undefined) {
  if (!raw) {
    return "";
  }

  const normalized = raw.trim();
  if (!normalized) {
    return "";
  }

  return AUTH_ERROR_LABELS[normalized] ?? normalized.replace(/_/g, " ");
}
