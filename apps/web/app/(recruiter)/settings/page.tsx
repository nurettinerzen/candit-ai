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
  createManagedCompany,
  changePasswordForCurrentSession,
  deleteCurrentAccount,
  listAccessibleCompanies,
  resolveActiveSession,
  resolveSessionFromServer,
  switchCompanySession
} from "../../../lib/auth/session";
import type {
  AccessibleCompany,
  CompetencyDefinition,
  TenantHiringSettings,
  TenantMessageTemplate,
  TenantProfileReadModel
} from "../../../lib/types";

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function linesToText(values: string[]) {
  return values.join("\n");
}

function textToLines(value: string) {
  return value
    .split(/\r?\n/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

const COMPETENCY_CATEGORY_LABELS: Record<CompetencyDefinition["category"], string> = {
  core: "Temel/Davranışsal",
  functional: "Fonksiyonel",
  technical: "Teknik",
  managerial: "Yönetsel"
};

function competencyDefinitionsToText(values: CompetencyDefinition[]) {
  return values
    .map((item) =>
      [
        item.category,
        item.name,
        item.definition,
        item.expectedBehavior ?? ""
      ].join(" | ")
    )
    .join("\n");
}

function textToCompetencyDefinitions(value: string): CompetencyDefinition[] {
  return value
    .split(/\r?\n/g)
    .map((line) => {
      const [categoryRaw, nameRaw, definitionRaw, expectedRaw] = line.split("|").map((part) => part.trim());
      const category = categoryRaw as CompetencyDefinition["category"];

      if (
        !["core", "functional", "technical", "managerial"].includes(category) ||
        !nameRaw ||
        !definitionRaw
      ) {
        return null;
      }

      return {
        category,
        name: nameRaw,
        definition: definitionRaw,
        expectedBehavior: expectedRaw || null
      };
    })
    .filter((item): item is CompetencyDefinition => Boolean(item));
}

const MESSAGE_TEMPLATE_ORDER = [
  "application_received_v1",
  "application_shortlisted_v1",
  "application_advanced_v1",
  "application_on_hold_v1",
  "application_rejected_v1",
  "interview_invitation_on_demand_v1",
  "interview_invitation_reminder_v1"
];

function messageTemplatesToText(values: Record<string, TenantMessageTemplate>) {
  const orderedKeys = [
    ...MESSAGE_TEMPLATE_ORDER,
    ...Object.keys(values).filter((key) => !MESSAGE_TEMPLATE_ORDER.includes(key))
  ];

  return orderedKeys
    .filter((key, index, arr) => values[key] && arr.indexOf(key) === index)
    .map((key) => {
      const template = values[key];
      if (!template) {
        return "";
      }
      return [
        `### ${key}`,
        `subject: ${template.subject}`,
        template.ctaLabel ? `cta: ${template.ctaLabel}` : "cta:",
        "body:",
        template.body
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function textToMessageTemplates(value: string): Record<string, TenantMessageTemplate> {
  const templates: Record<string, TenantMessageTemplate> = {};
  const blocks = value
    .split(/^###\s+/gm)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/g);
    const key = lines.shift()?.trim();
    if (!key) {
      continue;
    }

    const subjectLineIndex = lines.findIndex((line) => line.toLocaleLowerCase("tr-TR").startsWith("subject:"));
    const ctaLineIndex = lines.findIndex((line) => line.toLocaleLowerCase("tr-TR").startsWith("cta:"));
    const bodyLineIndex = lines.findIndex((line) => line.toLocaleLowerCase("tr-TR") === "body:");
    const subject = subjectLineIndex >= 0 ? (lines[subjectLineIndex] ?? "").replace(/^subject:/i, "").trim() : "";
    const ctaLabel = ctaLineIndex >= 0 ? (lines[ctaLineIndex] ?? "").replace(/^cta:/i, "").trim() : "";
    const body = bodyLineIndex >= 0 ? lines.slice(bodyLineIndex + 1).join("\n").trim() : "";

    if (!subject || !body) {
      continue;
    }

    templates[key] = {
      subject,
      body,
      ctaLabel: ctaLabel || null
    };
  }

  return templates;
}

function createHiringSettingsFormState(settings: TenantHiringSettings) {
  return {
    departments: linesToText(settings.departments),
    titleLevels: linesToText(settings.titleLevels),
    competencyCore: linesToText(settings.competencyLibrary.core),
    competencyFunctional: linesToText(settings.competencyLibrary.functional),
    competencyTechnical: linesToText(settings.competencyLibrary.technical),
    competencyManagerial: linesToText(settings.competencyLibrary.managerial),
    competencyDefinitions: competencyDefinitionsToText(settings.competencyDefinitions),
    schoolDepartments: linesToText(settings.evaluationPresets.schoolDepartments),
    certificates: linesToText(settings.evaluationPresets.certificates),
    tools: linesToText(settings.evaluationPresets.tools),
    languages: linesToText(settings.evaluationPresets.languages),
    referenceClosedEndedQuestions: linesToText(settings.referenceCheckTemplate.closedEndedQuestions),
    referenceOpenEndedQuestions: linesToText(settings.referenceCheckTemplate.openEndedQuestions),
    consentNoticeVersion: settings.dataProcessingConsent.noticeVersion,
    consentPolicyVersion: settings.dataProcessingConsent.policyVersion ?? "",
    consentSummary: settings.dataProcessingConsent.summary,
    consentExplicitText: settings.dataProcessingConsent.explicitText,
    approvalEnabled: settings.approvalFlow.enabled,
    approverRole: settings.approvalFlow.approverRole,
    approvalStages: linesToText(settings.approvalFlow.stages),
    approvalNotes: settings.approvalFlow.notes ?? "",
    responseSlaDays: String(settings.notificationDefaults.responseSlaDays),
    messageTemplates: messageTemplatesToText(settings.messageTemplates)
  };
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
    logoUrl: "",
    profileSummary: ""
  });
  const [hiringSettings, setHiringSettings] = useState<TenantHiringSettings | null>(null);
  const [hiringSettingsForm, setHiringSettingsForm] = useState(() =>
    createHiringSettingsFormState({
      departments: [],
      titleLevels: [],
      competencyLibrary: {
        core: [],
        functional: [],
        technical: [],
        managerial: []
      },
      competencyDefinitions: [],
      evaluationPresets: {
        schoolDepartments: [],
        certificates: [],
        tools: [],
        languages: []
      },
      referenceCheckTemplate: {
        closedEndedQuestions: [],
        openEndedQuestions: []
      },
      dataProcessingConsent: {
        noticeVersion: "kvkk_data_processing_tr_v1_2026_04",
        policyVersion: "policy_v1",
        summary: "",
        explicitText: ""
      },
      approvalFlow: {
        enabled: false,
        approverRole: "MANAGER",
        stages: ["OFFER", "HIRED"],
        notes: null
      },
      notificationDefaults: {
        responseSlaDays: 15
      },
      messageTemplates: {}
    })
  );
  const [accessibleCompanies, setAccessibleCompanies] = useState<AccessibleCompany[]>([]);
  const [companyDraft, setCompanyDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const [companyNotice, setCompanyNotice] = useState("");
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
    profileForm.companyName.trim() &&
      (profileForm.websiteUrl.trim() || profileForm.logoUrl.trim() || profileForm.profileSummary.trim())
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
    if (!currentSession) {
      setAccessibleCompanies([]);
      return;
    }

    let cancelled = false;

    async function loadCompanies() {
      try {
        const companies = await listAccessibleCompanies(currentSession);

        if (!cancelled) {
          setAccessibleCompanies(companies);
        }
      } catch {
        if (!cancelled) {
          setAccessibleCompanies([]);
        }
      }
    }

    void loadCompanies();

    return () => {
      cancelled = true;
    };
  }, [currentSession]);

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
        const [nextProfile, nextHiringSettings] = await Promise.all([
          apiClient.getTenantProfile(),
          apiClient.getTenantHiringSettings()
        ]);

        if (cancelled) {
          return;
        }

        setProfile(nextProfile);
        setProfileForm({
          companyName: nextProfile.companyName,
          websiteUrl: nextProfile.websiteUrl ?? "",
          logoUrl: nextProfile.logoUrl ?? "",
          profileSummary: nextProfile.profileSummary ?? ""
        });
        setHiringSettings(nextHiringSettings.settings);
        setHiringSettingsForm(createHiringSettingsFormState(nextHiringSettings.settings));
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
        logoUrl: profileForm.logoUrl || undefined,
        profileSummary: profileForm.profileSummary || undefined
      });

      setProfile(nextProfile);
      setProfileForm({
        companyName: nextProfile.companyName,
        websiteUrl: nextProfile.websiteUrl ?? "",
        logoUrl: nextProfile.logoUrl ?? "",
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

  async function handleHiringSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("hiring-settings:save");
    setError("");
    setProfileNotice("");

    try {
      const payload: TenantHiringSettings = {
        departments: textToLines(hiringSettingsForm.departments),
        titleLevels: textToLines(hiringSettingsForm.titleLevels),
        competencyLibrary: {
          core: textToLines(hiringSettingsForm.competencyCore),
          functional: textToLines(hiringSettingsForm.competencyFunctional),
          technical: textToLines(hiringSettingsForm.competencyTechnical),
          managerial: textToLines(hiringSettingsForm.competencyManagerial)
        },
        competencyDefinitions: textToCompetencyDefinitions(hiringSettingsForm.competencyDefinitions),
        evaluationPresets: {
          schoolDepartments: textToLines(hiringSettingsForm.schoolDepartments),
          certificates: textToLines(hiringSettingsForm.certificates),
          tools: textToLines(hiringSettingsForm.tools),
          languages: textToLines(hiringSettingsForm.languages)
        },
        referenceCheckTemplate: {
          closedEndedQuestions: textToLines(hiringSettingsForm.referenceClosedEndedQuestions),
          openEndedQuestions: textToLines(hiringSettingsForm.referenceOpenEndedQuestions)
        },
        dataProcessingConsent: {
          noticeVersion: hiringSettingsForm.consentNoticeVersion.trim() || "kvkk_data_processing_tr_v1_2026_04",
          policyVersion: hiringSettingsForm.consentPolicyVersion.trim() || null,
          summary: hiringSettingsForm.consentSummary.trim(),
          explicitText: hiringSettingsForm.consentExplicitText.trim()
        },
        approvalFlow: {
          enabled: hiringSettingsForm.approvalEnabled,
          approverRole: hiringSettingsForm.approverRole,
          stages: textToLines(hiringSettingsForm.approvalStages),
          notes: hiringSettingsForm.approvalNotes.trim() || null
        },
        notificationDefaults: {
          responseSlaDays: Math.max(1, Number(hiringSettingsForm.responseSlaDays) || 15)
        },
        messageTemplates: textToMessageTemplates(hiringSettingsForm.messageTemplates)
      };

      const nextSettings = await apiClient.updateTenantHiringSettings(payload);
      setHiringSettings(nextSettings.settings);
      setHiringSettingsForm(createHiringSettingsFormState(nextSettings.settings));
      setProfileNotice(
        locale === "en"
          ? "Hiring settings updated."
          : "İşe alım ayarları güncellendi."
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : t("İşe alım ayarları kaydedilemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyDraft.trim()) {
      setError(locale === "en" ? "Company name is required." : "Şirket adı zorunludur.");
      return;
    }

    setBusyKey("company:create");
    setError("");
    setCompanyNotice("");

    try {
      const createdCompany = await createManagedCompany(currentSession, {
        companyName: companyDraft.trim()
      });
      const companies = await listAccessibleCompanies(currentSession);
      setAccessibleCompanies(companies);
      setCompanyDraft("");
      setCompanyNotice(
        locale === "en"
          ? `${createdCompany.tenantName} created. You can switch to it below.`
          : `${createdCompany.tenantName} oluşturuldu. Aşağıdan bu şirkete geçebilirsiniz.`
      );
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : t("Şirket oluşturulamadı.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleCompanySwitch(targetTenantId: string) {
    setBusyKey(`company:switch:${targetTenantId}`);
    setError("");

    try {
      await switchCompanySession(currentSession, targetTenantId);
      window.location.assign("/dashboard");
    } catch (switchError) {
      setError(
        switchError instanceof Error ? switchError.message : t("Şirket değiştirilemedi.")
      );
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
          ? "Only the account owner can delete the company account."
          : "Şirket hesabını yalnızca hesap sahibi silebilir."
      );
      return;
    }

    if (
      !window.confirm(
        locale === "en"
          ? "This will permanently delete the entire company account, all members, candidates, interviews, uploaded CVs, and billing data. Continue?"
          : "Bu işlem tüm şirket hesabını, üyeleri, adayları, mülakatları, yüklenen CV dosyalarını ve faturalandırma verilerini kalıcı olarak silecek. Devam etmek istiyor musunuz?"
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
      {companyNotice ? <NoticeBox tone="success" message={companyNotice} /> : null}
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
              ? "Set the company information used across this company account and in new job draft preparation."
              : "Şirket hesabında ve yeni ilan taslağı hazırlığında kullanılan şirket bilgilerini yönetin."}
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
                  ? "Appears as the default company name in this company account."
                  : "Şirket hesabında varsayılan şirket adı olarak görünür."}
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

            <label style={{ display: "grid", gap: 8 }}>
              <input
                className="input"
                value={profileForm.logoUrl}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, logoUrl: event.target.value }))
                }
                placeholder={locale === "en" ? "Logo URL" : "Logo bağlantısı"}
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "Use a hosted logo URL for company-specific branding."
                  : "Şirkete özel marka görünümü için barındırılan logo bağlantısını kullanın."}
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
            {profileForm.logoUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                  src={profileForm.logoUrl}
                  alt={profileForm.companyName || "Şirket logosu"}
                  style={{
                    width: 56,
                    height: 56,
                    objectFit: "contain",
                    padding: 8,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)"
                  }}
                />
                <span className="small text-muted">
                  {locale === "en" ? "Logo preview" : "Logo önizlemesi"}
                </span>
              </div>
            ) : null}
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
              <span>
                {locale === "en" ? "Logo" : "Logo"}:{" "}
                {profileForm.logoUrl ? profileForm.logoUrl : "—"}
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>
              {locale === "en" ? "Managed companies" : "Yönetilen şirketler"}
            </h2>
            <p className="small text-muted" style={{ margin: 0 }}>
              {locale === "en"
                ? "Use one login to manage multiple companies. Each company keeps its own subscription, limits, jobs, candidates, and branding."
                : "Tek girişle birden fazla şirket yönetin. Her şirketin aboneliği, limitleri, ilanları, adayları ve marka görünümü ayrı tutulur."}
            </p>
          </div>
          <StatusBadge
            ready={accessibleCompanies.length > 1}
            label={
              accessibleCompanies.length > 1
                ? locale === "en"
                  ? `${accessibleCompanies.length} companies`
                  : `${accessibleCompanies.length} şirket`
                : locale === "en"
                  ? "Single company"
                  : "Tek şirket"
            }
          />
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {accessibleCompanies.map((company) => {
            const isActive = company.tenantId === currentSession?.tenantId;

            return (
              <div
                key={company.tenantId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  background: isActive ? "rgba(124,115,250,0.08)" : "rgba(255,255,255,0.02)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  {company.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={company.logoUrl}
                      alt=""
                      style={{
                        width: 42,
                        height: 42,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid var(--border)"
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        color: "var(--primary, #7c73fa)"
                      }}
                    >
                      {company.tenantName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{company.tenantName}</div>
                    <div className="small text-muted">
                      {company.role} · {company.status}
                      {isActive ? ` · ${locale === "en" ? "active company" : "aktif şirket"}` : ""}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="ghost-button"
                  disabled={isActive || busyKey === `company:switch:${company.tenantId}`}
                  onClick={() => void handleCompanySwitch(company.tenantId)}
                >
                  {isActive
                    ? locale === "en"
                      ? "Active"
                      : "Aktif"
                    : busyKey === `company:switch:${company.tenantId}`
                      ? t("Hazırlanıyor...")
                      : locale === "en"
                        ? "Switch to company"
                        : "Şirkete geç"}
                </button>
              </div>
            );
          })}
        </div>

        <form
          style={{
            display: "grid",
            gap: 12,
            padding: 16,
            borderRadius: 14,
            border: "1px dashed var(--border)",
            background: "rgba(255,255,255,0.02)"
          }}
          onSubmit={handleCreateCompany}
        >
          <div>
            <strong>{locale === "en" ? "Create another company" : "Yeni şirket oluştur"}</strong>
            <p className="small text-muted" style={{ margin: "4px 0 0" }}>
              {locale === "en"
                ? "This creates a separate company account with its own billing boundary. Your existing plan and credits are not shared with the new company."
                : "Ayrı faturalandırma sınırına sahip yeni bir şirket hesabı açılır. Mevcut şirketinizin planı ve kredileri yeni şirketle paylaşılmaz."}
            </p>
          </div>
          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "minmax(220px, 1fr) auto", gap: 12, alignItems: "start" }}
          >
            <input
              className="input"
              value={companyDraft}
              onChange={(event) => setCompanyDraft(event.target.value)}
              placeholder={locale === "en" ? "New company name" : "Yeni şirket adı"}
            />
            <button type="submit" className="ghost-button" disabled={busyKey === "company:create"}>
              {busyKey === "company:create"
                ? t("Kaydediliyor...")
                : locale === "en"
                  ? "Create company"
                  : "Şirket oluştur"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel" style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: "0 0 6px" }}>
              {locale === "en" ? "Hiring catalog and KVKK" : "İşe alım kataloğu ve KVKK"}
            </h2>
            <p className="small text-muted" style={{ margin: 0 }}>
              {locale === "en"
                ? "Company-specific departments, title ladders, competency libraries, reference questions, and consent text used by job creation and recruiter operations."
                : "İlan oluşturma ve recruiter operasyonlarında kullanılan departman, unvan seviyesi, yetkinlik kütüphanesi, referans soruları ve KVKK metinlerini şirket bazında yönetin."}
            </p>
          </div>
          <StatusBadge
            ready={Boolean(hiringSettings?.departments.length || hiringSettings?.titleLevels.length)}
            label={
              locale === "en"
                ? `${hiringSettings?.departments.length ?? 0} departments`
                : `${hiringSettings?.departments.length ?? 0} departman`
            }
          />
        </div>

        <form style={{ display: "grid", gap: 18 }} onSubmit={handleHiringSettingsSave}>
          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Departments" : "Departmanlar"}</span>
              <textarea
                className="input"
                rows={6}
                value={hiringSettingsForm.departments}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, departments: event.target.value }))
                }
                placeholder={locale === "en" ? "Finance\nOperations\nSoftware" : "Finans\nOperasyon\nYazılım"}
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "One department per line. Authorized users can curate job departments from here."
                  : "Her satıra bir departman yazın. Yetkili kullanıcılar ilan departmanlarını buradan yönetir."}
              </span>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Title levels" : "Unvan seviyeleri"}</span>
              <textarea
                className="input"
                rows={6}
                value={hiringSettingsForm.titleLevels}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, titleLevels: event.target.value }))
                }
                placeholder={locale === "en" ? "Assistant\nSpecialist\nSenior Specialist\nManager" : "Asistan\nUzman Yardımcısı\nUzman\nKıdemli Uzman\nMüdür"}
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "These appear as the position seniority ladder in the job form."
                  : "İlan formunda pozisyon seviyesi olarak bu unvan merdiveni görünür."}
              </span>
            </label>
          </div>

          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Core / behavioral competencies" : "Temel / davranışsal yetkinlikler"}</span>
              <textarea
                className="input"
                rows={6}
                value={hiringSettingsForm.competencyCore}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, competencyCore: event.target.value }))
                }
                placeholder={locale === "en" ? "Communication\nOwnership\nAnalytical thinking" : "İletişim becerisi\nSorumluluk bilinci\nAnalitik düşünme"}
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "Behavioral signals such as communication, planning, ownership, and flexibility."
                  : "İletişim, planlama, sahiplenme, esneklik gibi davranışsal göstergeler."}
              </span>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Functional competencies" : "Fonksiyonel yetkinlikler"}</span>
              <textarea
                className="input"
                rows={6}
                value={hiringSettingsForm.competencyFunctional}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, competencyFunctional: event.target.value }))
                }
                placeholder={locale === "en" ? "Process management\nStakeholder coordination\nPayroll process" : "Süreç yönetimi\nPaydaş koordinasyonu\nBordro süreci"}
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "Role/function-specific capabilities, separate from tools and technologies."
                  : "Araç ve teknolojiden ayrı, iş fonksiyonuna özgü kabiliyetler."}
              </span>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Technical competencies" : "Teknik yetkinlikler"}</span>
              <textarea
                className="input"
                rows={6}
                value={hiringSettingsForm.competencyTechnical}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, competencyTechnical: event.target.value }))
                }
                placeholder=".NET\nREST API\nMS SQL\nGit"
              />
              <span className="small text-muted">
                {locale === "en"
                  ? "Tools, technologies, platforms, and hard skills."
                  : "Araçlar, teknolojiler, platformlar ve ölçülebilir teknik beceriler."}
              </span>
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Managerial competencies" : "Yönetsel yetkinlikler"}</span>
              <textarea
                className="input"
                rows={6}
                value={hiringSettingsForm.competencyManagerial}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, competencyManagerial: event.target.value }))
                }
                placeholder={locale === "en" ? "Coaching\nTeam leadership\nDecision making" : "Koçluk\nEkip yönetimi\nKarar alma"}
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <span>{locale === "en" ? "Competency definitions" : "Yetkinlik tanımları"}</span>
            <textarea
              className="input"
              rows={8}
              value={hiringSettingsForm.competencyDefinitions}
              onChange={(event) =>
                setHiringSettingsForm((prev) => ({ ...prev, competencyDefinitions: event.target.value }))
              }
              placeholder={"core | Analitik düşünme | Veriyi ve problemi parçalarına ayırarak neden-sonuç kurabilme | Adaydan somut problem çözme örneği beklenir"}
            />
            <span className="small text-muted">
              {locale === "en"
                ? "One row per competency: category | name | definition | expected behavior. Categories: core, functional, technical, managerial."
                : `Her satır: kategori | yetkinlik | tanım | beklenen davranış. Kategoriler: ${Object.entries(COMPETENCY_CATEGORY_LABELS).map(([key, label]) => `${key}=${label}`).join(", ")}.`}
            </span>
          </label>

          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Preferred school departments" : "Tercih edilen okul / bölüm"}</span>
              <textarea
                className="input"
                rows={5}
                value={hiringSettingsForm.schoolDepartments}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, schoolDepartments: event.target.value }))
                }
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Certificates" : "Sertifikalar"}</span>
              <textarea
                className="input"
                rows={5}
                value={hiringSettingsForm.certificates}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, certificates: event.target.value }))
                }
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Tools and programs" : "Programlar ve araçlar"}</span>
              <textarea
                className="input"
                rows={5}
                value={hiringSettingsForm.tools}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, tools: event.target.value }))
                }
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Languages" : "Yabancı diller"}</span>
              <textarea
                className="input"
                rows={5}
                value={hiringSettingsForm.languages}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, languages: event.target.value }))
                }
              />
            </label>
          </div>

          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Closed-ended reference questions" : "Kapalı uçlu referans soruları"}</span>
              <textarea
                className="input"
                rows={5}
                value={hiringSettingsForm.referenceClosedEndedQuestions}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({
                    ...prev,
                    referenceClosedEndedQuestions: event.target.value
                  }))
                }
                placeholder={locale === "en" ? "Would you rehire this person?" : "Bu kişiyi tekrar işe alır mıydınız?"}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Open-ended reference questions" : "Açık uçlu referans soruları"}</span>
              <textarea
                className="input"
                rows={5}
                value={hiringSettingsForm.referenceOpenEndedQuestions}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({
                    ...prev,
                    referenceOpenEndedQuestions: event.target.value
                  }))
                }
                placeholder={locale === "en" ? "What was the strongest contribution?" : "En güçlü katkısı neydi?"}
              />
            </label>
          </div>

          <div
            className="inline-grid"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}
          >
            <label style={{ display: "grid", gap: 8 }}>
              <span>KVKK notice version</span>
              <input
                className="input"
                value={hiringSettingsForm.consentNoticeVersion}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, consentNoticeVersion: event.target.value }))
                }
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Policy version" : "Politika versiyonu"}</span>
              <input
                className="input"
                value={hiringSettingsForm.consentPolicyVersion}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, consentPolicyVersion: event.target.value }))
                }
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Default response SLA (days)" : "Varsayılan geri dönüş SLA (gün)"}</span>
              <input
                className="input"
                type="number"
                min={1}
                value={hiringSettingsForm.responseSlaDays}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, responseSlaDays: event.target.value }))
                }
              />
            </label>
          </div>

          <label style={{ display: "grid", gap: 8 }}>
            <span>{locale === "en" ? "Consent summary" : "Açık rıza özeti"}</span>
            <textarea
              className="input"
              rows={4}
              value={hiringSettingsForm.consentSummary}
              onChange={(event) =>
                setHiringSettingsForm((prev) => ({ ...prev, consentSummary: event.target.value }))
              }
              placeholder={locale === "en" ? "Explain why candidate data is processed." : "Aday verisinin neden işlendiğini özetleyin."}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span>{locale === "en" ? "Explicit consent text" : "Açık rıza metni"}</span>
            <textarea
              className="input"
              rows={5}
              value={hiringSettingsForm.consentExplicitText}
              onChange={(event) =>
                setHiringSettingsForm((prev) => ({ ...prev, consentExplicitText: event.target.value }))
              }
              placeholder={locale === "en" ? "I consent to the processing of my personal data..." : "Kişisel verilerimin işe alım süreçleri kapsamında işlenmesini kabul ediyorum..."}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span>{locale === "en" ? "Candidate message templates" : "Adaya iletilecek mesaj şablonları"}</span>
            <textarea
              className="input"
              rows={14}
              value={hiringSettingsForm.messageTemplates}
              onChange={(event) =>
                setHiringSettingsForm((prev) => ({ ...prev, messageTemplates: event.target.value }))
              }
            />
            <span className="small text-muted">
              {locale === "en"
                ? "These templates are tenant-specific. Variables: {{candidateName}}, {{companyName}}, {{jobTitle}}, {{interviewLink}}, {{deadline}}."
                : "Bu şablonlar şirket bazlıdır. Değişkenler: {{candidateName}}, {{companyName}}, {{jobTitle}}, {{interviewLink}}, {{deadline}}."}
            </span>
          </label>

          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 16,
              borderRadius: 14,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.02)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={hiringSettingsForm.approvalEnabled}
                  onChange={(event) =>
                    setHiringSettingsForm((prev) => ({ ...prev, approvalEnabled: event.target.checked }))
                  }
                />
                <span>{locale === "en" ? "Enable approval flow notes" : "Onay akışı notlarını etkinleştir"}</span>
              </label>

              <select
                className="select"
                value={hiringSettingsForm.approverRole}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, approverRole: event.target.value as "OWNER" | "MANAGER" | "STAFF" }))
                }
                style={{ maxWidth: 220 }}
              >
                <option value="OWNER">OWNER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
              </select>
            </div>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Approval stages" : "Onay aşamaları"}</span>
              <textarea
                className="input"
                rows={3}
                value={hiringSettingsForm.approvalStages}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, approvalStages: event.target.value }))
                }
                placeholder={"OFFER\nHIRED"}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span>{locale === "en" ? "Approval notes" : "Onay akışı notları"}</span>
              <textarea
                className="input"
                rows={3}
                value={hiringSettingsForm.approvalNotes}
                onChange={(event) =>
                  setHiringSettingsForm((prev) => ({ ...prev, approvalNotes: event.target.value }))
                }
                placeholder={locale === "en" ? "Describe how the hiring approval should run." : "İşe alım onayının nasıl ilerlemesi gerektiğini not edin."}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <button
              type="submit"
              className="ghost-button"
              disabled={busyKey === "hiring-settings:save"}
            >
              {busyKey === "hiring-settings:save"
                ? t("Kaydediliyor...")
                : locale === "en"
                  ? "Save hiring catalog"
                  : "İşe alım kataloğunu kaydet"}
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
              {locale === "en" ? "Delete company account" : "Hesabı sil"}
            </h2>
            <p className="small text-muted" style={{ margin: 0 }}>
              {locale === "en"
                ? "This permanently removes the full company account, members, uploaded files, interviews, and billing records from the application."
                : "Bu işlem tüm şirket hesabını, üyeleri, yüklenen dosyaları, mülakatları ve uygulamadaki faturalandırma kayıtlarını kalıcı olarak siler."}
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
