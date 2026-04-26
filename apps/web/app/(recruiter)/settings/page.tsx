"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { PasswordField, PasswordRequirements } from "../../../components/password-field";
import { ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import { isInternalAdminSession } from "../../../lib/auth/policy";
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_ERROR_MESSAGE,
  getPasswordPolicyStatus
} from "../../../lib/auth/password-policy";
import {
  changePasswordForCurrentSession,
  deleteCurrentAccount,
  resolveActiveSession,
  resolveSessionFromServer
} from "../../../lib/auth/session";
import type { TenantProfileReadModel } from "../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function SettingsPage() {
  const { t, locale } = useUiText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentSession, setCurrentSession] = useState(() => resolveActiveSession());
  const isInternalAdmin = isInternalAdminSession(currentSession);
  const isOwner = Boolean(
    currentSession?.roles
      .split(",")
      .map((role) => role.trim())
      .includes("owner")
  );

  const [profile, setProfile] = useState<TenantProfileReadModel | null>(null);
  const [profileForm, setProfileForm] = useState({
    companyName: "",
    websiteUrl: "",
    profileSummary: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [securityNotice, setSecurityNotice] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [deleteAccountForm, setDeleteAccountForm] = useState({
    currentPassword: "",
    confirmationText: ""
  });
  const profileLooksComplete = Boolean(
    profileForm.companyName.trim() && (profileForm.websiteUrl.trim() || profileForm.profileSummary.trim())
  );

  const deleteAccountConfirmationPlaceholder =
    locale === "en" ? 'Type: "delete my account"' : 'Şunu yazın: "hesabımı sil"';

  useEffect(() => {
    let cancelled = false;

    async function syncSession() {
      const resolved = await resolveSessionFromServer(resolveActiveSession());
      if (!cancelled) {
        setCurrentSession(resolved);
      }
    }

    void syncSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestedTab = searchParams.get("tab");

    if (!requestedTab) {
      return;
    }

    if (requestedTab === "plan") {
      router.replace("/subscription");
      return;
    }

    if (requestedTab === "team") {
      router.replace("/team" as Route);
      return;
    }

    if (requestedTab === "ai" || requestedTab === "sistem") {
      router.replace(isInternalAdmin ? "/admin/settings" : "/settings");
    }
  }, [isInternalAdmin, router, searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError("");

      try {
        const nextProfile = await apiClient.getTenantProfile();

        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setProfileForm({
          companyName: nextProfile.companyName,
          websiteUrl: nextProfile.websiteUrl ?? "",
          profileSummary: nextProfile.profileSummary ?? ""
        });
      } catch (loadError) {
        if (!cancelled) {
          setProfile(null);
          setError(
            toErrorMessage(
              loadError,
              locale === "en" ? "Settings could not be loaded." : "Ayarlar yüklenemedi."
            )
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("profile:save");
    setError("");
    setProfileNotice("");

    try {
      const nextProfile = await apiClient.updateTenantProfile({
        companyName: profileForm.companyName,
        websiteUrl: profileForm.websiteUrl || undefined,
        profileSummary: profileForm.profileSummary || undefined
      });

      setProfile(nextProfile);
      setProfileForm({
        companyName: nextProfile.companyName,
        websiteUrl: nextProfile.websiteUrl ?? "",
        profileSummary: nextProfile.profileSummary ?? ""
      });
      setProfileNotice(
        locale === "en"
          ? "Company profile updated."
          : "Şirket profili güncellendi."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : t("Şirket profili kaydedilemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!getPasswordPolicyStatus(passwordForm.newPassword).isValid) {
      setError(t(PASSWORD_POLICY_ERROR_MESSAGE));
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError(locale === "en" ? "Password confirmation does not match." : "Şifre tekrarı eşleşmiyor.");
      return;
    }

    setBusyKey("password:change");
    setError("");
    setSecurityNotice("");

    try {
      const nextSession = await changePasswordForCurrentSession(currentSession, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });

      setCurrentSession(nextSession);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setSecurityNotice(
        locale === "en"
          ? "Your password was updated. Other active sessions were signed out."
          : "Şifreniz güncellendi. Diğer aktif oturumlar kapatıldı."
      );
    } catch (changeError) {
      setError(
        changeError instanceof Error ? changeError.message : t("Şifre değiştirilemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOwner) {
      setError(
        locale === "en"
          ? "Only the account owner can delete the workspace."
          : "Çalışma alanını yalnızca hesap sahibi silebilir."
      );
      return;
    }

    if (
      !window.confirm(
        locale === "en"
          ? "This will permanently delete the entire workspace, all members, candidates, interviews, uploaded CVs, and billing data. Continue?"
          : "Bu işlem tüm çalışma alanını, üyeleri, adayları, mülakatları, yüklenen CV dosyalarını ve faturalandırma verilerini kalıcı olarak silecek. Devam etmek istiyor musunuz?"
      )
    ) {
      return;
    }

    setBusyKey("account:delete");
    setError("");
    setSecurityNotice("");

    try {
      await deleteCurrentAccount(currentSession, deleteAccountForm);
      window.location.assign("/");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : t("Hesap silinemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  const title = locale === "en" ? "Settings" : "Ayarlar";
  const subtitle =
    locale === "en"
      ? "Manage company profile and security settings."
      : "Şirket profili ve güvenlik ayarlarını yönetin.";

  if (loading) {
    return (
      <section className="page-grid">
        <section className="panel">
          <LoadingState message={t("Ayarlar yükleniyor...")} />
        </section>
      </section>
    );
  }

  if (error && !profile) {
    return (
      <section className="page-grid">
        <section className="panel">
          <ErrorState error={error} />
        </section>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide guideKey="settings" title={title} subtitle={subtitle} style={{ margin: 0 }} />
        </div>
      </div>

      {error ? <NoticeBox tone="danger" message={error} /> : null}
      {profileNotice ? <NoticeBox tone="success" message={profileNotice} /> : null}
      {securityNotice ? <NoticeBox tone="success" message={securityNotice} /> : null}

      <section className="panel" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>
              {locale === "en" ? "Next setup steps" : "Sonraki kurulum adımları"}
            </h2>
            <p className="small text-muted" style={{ margin: 0 }}>
              {locale === "en"
                ? "A new company should be able to complete these surfaces without asking us what comes next."
                : "Yeni bir firma sonraki adımı bize sormadan bu yüzeylerden ilerleyebilmelidir."}
            </p>
          </div>
          <StatusBadge
            ready={profileLooksComplete}
            label={
              profileLooksComplete
                ? locale === "en"
                  ? "Profile ready"
                  : "Profil hazır"
                : locale === "en"
                  ? "Complete profile"
                  : "Profili tamamla"
            }
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <QuickLinkCard
            href={"/team" as Route}
            title={locale === "en" ? "Team access" : "Ekip erişimi"}
            description={
              locale === "en"
                ? "Invite at least one teammate and verify role boundaries."
                : "En az bir ekip arkadaşı davet edin ve rol sınırlarını kontrol edin."
            }
          />
          <QuickLinkCard
            href={"/subscription" as Route}
            title={locale === "en" ? "Package and limits" : "Paket ve limitler"}
            description={
              locale === "en"
                ? "Review user, job, and interview limits before your team grows."
                : "Ekip büyümeden önce kullanıcı, ilan ve mülakat limitlerini gözden geçirin."
            }
          />
          <QuickLinkCard
            href={(isInternalAdmin ? "/admin/settings" : "/ai-support") as Route}
            title={locale === "en" ? "AI defaults" : "AI varsayılanları"}
            description={
              locale === "en"
                ? "Review prompts, rubrics, and AI service readiness from one place."
                : "Prompt, rubric ve AI servis hazırlığını tek yerden gözden geçirin."
            }
          />
        </div>
      </section>

      <section className="panel" style={{ display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>{locale === "en" ? "General" : "Genel"}</h2>
          <p className="small text-muted" style={{ margin: 0 }}>
            {locale === "en"
              ? "Set the company information used across the workspace and in new job draft preparation."
              : "Çalışma alanında ve yeni ilan taslağı hazırlığında kullanılan şirket bilgilerini yönetin."}
          </p>
        </div>

        <form style={{ display: "grid", gap: 14 }} onSubmit={handleProfileSave}>
          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <input
                className="input"
                value={profileForm.companyName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, companyName: event.target.value }))
                }
                placeholder={locale === "en" ? "Company name" : "Şirket adı"}
                required
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "Appears as the default company name in the workspace."
                  : "Çalışma alanında varsayılan şirket adı olarak görünür."}
              </span>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <input
                className="input"
                value={profileForm.websiteUrl}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, websiteUrl: event.target.value }))
                }
                placeholder={locale === "en" ? "Website URL" : "Web sitesi bağlantısı"}
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "Used as supporting context when preparing a new job draft."
                  : "Yeni ilan taslağı hazırlanırken destekleyici bilgi olarak kullanılır."}
              </span>
            </label>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <textarea
              className="input"
              rows={5}
              value={profileForm.profileSummary}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, profileSummary: event.target.value }))
              }
              placeholder={
                locale === "en"
                  ? "Short company summary"
                  : "Kısa şirket tanımı"
              }
            />
            <span className="small text-muted">
              {locale === "en"
                ? "Used as background context while creating new job drafts."
                : "Yeni ilan taslakları oluşturulurken arka plan bilgisi olarak kullanılır."}
            </span>
          </label>

          <div
            style={{
              display: "grid",
              gap: 10,
              padding: 14,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)"
            }}
          >
            <strong>{locale === "en" ? "Current profile" : "Mevcut profil"}</strong>
            <div className="small text-muted" style={{ display: "grid", gap: 4 }}>
              <span>
                {locale === "en" ? "Company name" : "Şirket adı"}:{" "}
                <strong style={{ color: "var(--text)" }}>{profileForm.companyName || "—"}</strong>
              </span>
              <span>
                {locale === "en" ? "Website" : "Web sitesi"}:{" "}
                {profileForm.websiteUrl ? (
                  <a href={profileForm.websiteUrl} target="_blank" rel="noreferrer">
                    {profileForm.websiteUrl}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button type="submit" className="ghost-button" disabled={busyKey === "profile:save"}>
              {busyKey === "profile:save"
                ? t("Kaydediliyor...")
                : locale === "en"
                  ? "Save profile"
                  : "Profili kaydet"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ display: "grid", gap: 16 }}>
        <div>
          <h2 style={{ margin: "0 0 6px" }}>{locale === "en" ? "Security" : "Güvenlik"}</h2>
          <p className="small text-muted" style={{ margin: 0 }}>
            {locale === "en"
              ? "Update your password from one place."
              : "Şifrenizi tek yerden güncelleyin."}
          </p>
        </div>

        <form style={{ display: "grid", gap: 12 }} onSubmit={handlePasswordChange}>
          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}
          >
            <PasswordField
              label={locale === "en" ? "Current password" : "Mevcut şifre"}
              showLabel={false}
              value={passwordForm.currentPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
              }
              autoComplete="current-password"
              placeholder={locale === "en" ? "Current password" : "Mevcut şifre"}
              required
              inputClassName="input"
              useDefaultInputStyle={false}
            />
            <PasswordField
              label={locale === "en" ? "New password" : "Yeni şifre"}
              showLabel={false}
              value={passwordForm.newPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
              }
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder={locale === "en" ? "New password" : "Yeni şifre"}
              required
              inputClassName="input"
              useDefaultInputStyle={false}
            />
            <PasswordField
              label={locale === "en" ? "Repeat new password" : "Yeni şifre tekrar"}
              showLabel={false}
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
              }
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              placeholder={locale === "en" ? "Repeat new password" : "Yeni şifre tekrar"}
              required
              inputClassName="input"
              useDefaultInputStyle={false}
            />
          </div>

          <PasswordRequirements password={passwordForm.newPassword} />

          <button type="submit" className="ghost-button" disabled={busyKey === "password:change"}>
            {busyKey === "password:change"
              ? t("Hazırlanıyor...")
              : locale === "en"
                ? "Update password"
                : "Şifreyi güncelle"}
          </button>
        </form>
      </section>

      {isOwner ? (
        <section className="panel" style={{ display: "grid", gap: 16, borderColor: "rgba(239,68,68,0.24)" }}>
          <div>
            <h2 style={{ margin: "0 0 6px", color: "var(--danger, #ef4444)" }}>
              {locale === "en" ? "Delete workspace" : "Hesabı sil"}
            </h2>
            <p className="small text-muted" style={{ margin: 0 }}>
              {locale === "en"
                ? "This permanently removes the full workspace, members, uploaded files, interviews, and billing records from the application."
                : "Bu işlem tüm çalışma alanını, üyeleri, yüklenen dosyaları, mülakatları ve uygulamadaki faturalandırma kayıtlarını kalıcı olarak siler."}
            </p>
            <p className="small text-muted" style={{ margin: "8px 0 0" }}>
              {locale === "en"
                ? 'To confirm, enter your current password and type "delete my account" in the field on the right.'
                : 'Onaylamak için mevcut şifrenizi yazın ve sağ taraftaki alana "hesabımı sil" yazın.'}
            </p>
          </div>

          <form
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}
            onSubmit={handleDeleteAccount}
          >
            <PasswordField
              label={locale === "en" ? "Current password" : "Mevcut şifre"}
              showLabel={false}
              value={deleteAccountForm.currentPassword}
              onChange={(event) =>
                setDeleteAccountForm((prev) => ({
                  ...prev,
                  currentPassword: event.target.value
                }))
              }
              autoComplete="current-password"
              placeholder={locale === "en" ? "Current password" : "Mevcut şifre"}
              required
              inputClassName="input"
              useDefaultInputStyle={false}
            />
            <input
              className="input"
              value={deleteAccountForm.confirmationText}
              onChange={(event) =>
                setDeleteAccountForm((prev) => ({
                  ...prev,
                  confirmationText: event.target.value
                }))
              }
              placeholder={deleteAccountConfirmationPlaceholder}
              required
            />
            <button type="submit" className="danger-button" disabled={busyKey === "account:delete"}>
              {busyKey === "account:delete"
                ? t("Hazırlanıyor...")
                : locale === "en"
                  ? "Delete permanently"
                  : "Kalıcı olarak sil"}
            </button>
          </form>
        </section>
      ) : null}
    </section>
  );
}

function NoticeBox({
  message,
  tone
}: {
  message: string;
  tone: "success" | "danger";
}) {
  const { t } = useUiText();
  const color = tone === "success" ? "34,197,94" : "239,68,68";

  return (
    <div
      style={{
        padding: "12px 16px",
        background: `rgba(${color},0.08)`,
        border: `1px solid rgba(${color},0.2)`,
        borderRadius: 8,
        color: tone === "success" ? "var(--success, #22c55e)" : "var(--danger, #ef4444)",
        fontSize: 14
      }}
    >
      {t(message)}
    </div>
  );
}

function StatusBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <span className={`status-badge status-${ready ? "success" : "brand"}`}>
      {label}
    </span>
  );
}

function QuickLinkCard({
  href,
  title,
  description
}: {
  href: Route;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="ghost-button"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        gap: 8,
        textAlign: "left",
        minHeight: 112,
        width: "100%",
        minWidth: 0,
        padding: "16px 18px",
        whiteSpace: "normal",
        lineHeight: 1.45,
        overflow: "visible"
      }}
    >
      <strong style={{ whiteSpace: "normal", lineHeight: 1.35 }}>{title}</strong>
      <span
        className="small text-muted"
        style={{ whiteSpace: "normal", lineHeight: 1.5, overflowWrap: "anywhere" }}
      >
        {description}
      </span>
    </Link>
  );
}
