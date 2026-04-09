"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import { API_BASE_URL } from "../../../lib/auth/runtime";
import { getRoleLabel } from "../../../lib/auth/policy";
import { resendEmailVerification, resolveActiveSession, saveSession } from "../../../lib/auth/session";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { formatDate } from "../../../lib/format";
import { getActiveLocaleTag } from "../../../lib/i18n";
import type {
  AiSupportCenterReadModel,
  BillingAddonKey,
  BillingOverviewReadModel,
  BillingPlanKey,
  FeatureFlag,
  InfrastructureReadinessReadModel,
  MemberDirectoryItem,
  ProviderHealthDashboard
} from "../../../lib/types";

const FLAG_DISPLAY: Record<string, { name: string; desc: string }> = {
  "ai.cv_parsing.enabled": { name: "CV Analizi", desc: "Yüklenen CV'leri otomatik inceler ve özet çıkarır." },
  "ai.screening_support.enabled": { name: "Ön Değerlendirme Desteği", desc: "Başvuru geldiğinde AI ön eleme yapar." },
  "ai.report_generation.enabled": { name: "Rapor Oluşturma", desc: "Aday değerlendirme raporu üretir." },
  "ai.recommendation_generation.enabled": { name: "Öneri Oluşturma", desc: "Uygunluk önerisi ve skor hesaplar." },
  "ai.system_triggers.application_created.screening_support.enabled": { name: "Otomatik Ön Değerlendirme", desc: "Yeni başvurularda otomatik ön eleme başlatır." },
  "ai.system_triggers.stage_review_pack.enabled": { name: "Aşama Değişiminde AI İncelemesi", desc: "Aşama geçişlerinde otomatik AI incelemesi yapar." },
  "ai.auto_reject.enabled": { name: "Otomatik Red", desc: "Kural gereği kapalı tutulur." }
};

const DEMO_FLAG_KEYS = [
  "ai.cv_parsing.enabled",
  "ai.screening_support.enabled",
  "ai.report_generation.enabled",
  "ai.recommendation_generation.enabled",
  "ai.system_triggers.application_created.screening_support.enabled",
  "ai.system_triggers.stage_review_pack.enabled",
  "ai.auto_reject.enabled"
] as const;

type TabId = "plan" | "ekip" | "entegrasyonlar" | "ai" | "sistem";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "ekip", label: "Ekip ve Yetkiler" },
  { id: "entegrasyonlar", label: "Entegrasyonlar" },
  { id: "ai", label: "AI Özellikleri" },
  { id: "sistem", label: "Sistem" }
];

const ROLE_OPTIONS: Array<{ value: "manager" | "staff"; label: string }> = [
  { value: "manager", label: getRoleLabel("manager") },
  { value: "staff", label: getRoleLabel("staff") }
];

function toBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "enabled" in value) {
    return Boolean((value as { enabled: unknown }).enabled);
  }
  return null;
}

function connectionStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case "ACTIVE":
      return { label: "Bağlı", color: "var(--success, #22c55e)" };
    case "INACTIVE":
      return { label: "Pasif", color: "var(--muted, #94a3b8)" };
    case "DEGRADED":
      return { label: "Sorunlu", color: "var(--warn, #f59e0b)" };
    case "ERROR":
      return { label: "Hata", color: "var(--risk, #ef4444)" };
    default:
      return { label: status, color: "var(--muted, #94a3b8)" };
  }
}

function friendlyWarning(raw: string): string {
  if (raw.includes("Calendly") && raw.includes("OAuth")) return "Calendly henüz yapılandırılmamış.";
  if (raw.includes("not_configured")) return "Henüz yapılandırılmamış.";
  return raw;
}

function statusBadge(status: MemberDirectoryItem["status"]) {
  switch (status) {
    case "ACTIVE":
      return { label: "Aktif", ready: true };
    case "INVITED":
      return { label: "Davet Bekliyor", ready: false };
    case "DISABLED":
    default:
      return { label: "Pasif", ready: false };
  }
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value) : "—";
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function SettingsPage() {
  const { t, locale } = useUiText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleConnected = searchParams.get("google_connected") === "true";
  const oauthError = searchParams.get("error");
  const billingState = searchParams.get("billing");
  const tabParam = searchParams.get("tab");
  const requestedTab =
    tabParam === "plan" ||
    tabParam === "ekip" ||
    tabParam === "entegrasyonlar" ||
    tabParam === "ai" ||
    tabParam === "sistem"
      ? (tabParam as TabId)
      : null;

  const [activeTab, setActiveTab] = useState<TabId>(requestedTab ?? "ekip");
  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, "manager" | "staff">>({});
  const [health, setHealth] = useState<ProviderHealthDashboard | null>(null);
  const [aiData, setAiData] = useState<AiSupportCenterReadModel | null>(null);
  const [infra, setInfra] = useState<InfrastructureReadinessReadModel | null>(null);
  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memberLoadError, setMemberLoadError] = useState("");
  const [healthLoadError, setHealthLoadError] = useState("");
  const [aiLoadError, setAiLoadError] = useState("");
  const [infraLoadError, setInfraLoadError] = useState("");
  const [billingLoadError, setBillingLoadError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [billingActionNotice, setBillingActionNotice] = useState("");
  const [memberActionNotice, setMemberActionNotice] = useState("");
  const [memberActionPreviewUrl, setMemberActionPreviewUrl] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [verificationPreviewUrl, setVerificationPreviewUrl] = useState("");
  const [checkoutEmailDrafts, setCheckoutEmailDrafts] = useState<Record<string, string>>({});
  const [inviteForm, setInviteForm] = useState({
    fullName: "",
    email: "",
    role: "staff" as "manager" | "staff"
  });
  const [enterpriseForm, setEnterpriseForm] = useState({
    billingEmail: "",
    monthlyAmountCents: 199900,
    seatsIncluded: 20,
    activeJobsIncluded: 25,
    candidateProcessingIncluded: 2000,
    aiInterviewsIncluded: 300,
    advancedReporting: true,
    calendarIntegrations: true,
    brandedCandidateExperience: true,
    customIntegrations: true,
    note: ""
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    setMemberLoadError("");
    setHealthLoadError("");
    setAiLoadError("");
    setInfraLoadError("");
    setBillingLoadError("");

    try {
      const [memberResult, healthResult, aiResult, infraResult, billingResult] = await Promise.allSettled([
        apiClient.listMembers(),
        apiClient.getProviderHealth().catch(() => null),
        apiClient.aiSupportCenterReadModel().catch(() => null),
        apiClient.infrastructureReadinessReadModel().catch(() => null),
        apiClient.billingOverview()
      ]);

      if (memberResult.status === "fulfilled") {
        setMembers(memberResult.value);
        setMemberRoleDrafts(
          Object.fromEntries(
            memberResult.value
              .filter((member) => member.role !== "owner")
              .map((member) => [member.userId, member.role === "manager" ? "manager" : "staff"])
          )
        );
      } else {
        setMembers([]);
        setMemberRoleDrafts({});
        setMemberLoadError(toErrorMessage(memberResult.reason, "Ekip bilgileri yuklenemedi."));
      }

      if (healthResult.status === "fulfilled") {
        setHealth(healthResult.value);
      } else {
        setHealth(null);
        setHealthLoadError(toErrorMessage(healthResult.reason, "Entegrasyon durumu yuklenemedi."));
      }

      if (aiResult.status === "fulfilled") {
        setAiData(aiResult.value);
        setFlags(aiResult.value?.flags ?? []);
      } else {
        setAiData(null);
        setFlags([]);
        setAiLoadError(toErrorMessage(aiResult.reason, "AI ayarlari yuklenemedi."));
      }

      if (infraResult.status === "fulfilled") {
        setInfra(infraResult.value);
      } else {
        setInfra(null);
        setInfraLoadError(toErrorMessage(infraResult.reason, "Sistem durumu yuklenemedi."));
      }

      if (billingResult.status === "fulfilled") {
        setBilling(billingResult.value);
        setCheckoutEmailDrafts((prev) => {
          const next = { ...prev };
          for (const checkout of billingResult.value?.recentCheckouts ?? []) {
            if (!next[checkout.id]) {
              next[checkout.id] =
                checkout.billingEmail ??
                billingResult.value?.account.billingEmail ??
                "";
            }
          }

          return next;
        });
        setEnterpriseForm((prev) => ({
          ...prev,
          billingEmail: prev.billingEmail || billingResult.value?.account.billingEmail || ""
        }));
      } else {
        setBilling(null);
        setBillingLoadError(toErrorMessage(billingResult.reason, "Plan ve kullanim bilgileri yuklenemedi."));
      }
    } catch (loadError) {
      setError(toErrorMessage(loadError, t("Ayarlar yüklenemedi.")));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const demoFlags = useMemo(
    () =>
      DEMO_FLAG_KEYS.map((key) => flags.find((flag) => flag.key === key)).filter(
        (flag): flag is FeatureFlag => Boolean(flag)
      ),
    [flags]
  );
  const currentSession = useMemo(() => resolveActiveSession(), []);

  async function handleResendOwnVerification() {
    setBusyKey("verify-email");
    setError("");
    setVerificationNotice("");
    setVerificationPreviewUrl("");

    try {
      const result = await resendEmailVerification(currentSession);
      setVerificationNotice(
        result.previewUrl
          ? "Dogrulama e-postasi yeniden hazirlandi. Lokal preview linki olusturuldu."
          : "Dogrulama e-postasi yeniden gonderildi."
      );
      setVerificationPreviewUrl(result.previewUrl ?? "");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : t("Doğrulama e-postası tekrar gönderilemedi.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function toggleFlag(flag: FeatureFlag, nextValue: boolean) {
    setBusyKey(`flag:${flag.key}`);
    try {
      const updated = await apiClient.updateFeatureFlag(flag.key, {
        value: nextValue,
        type: flag.type,
        description: flag.description ?? undefined
      });
      setFlags((prev) => prev.map((item) => (item.key === updated.key ? updated : item)));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : t("Feature flag güncellenemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("invite");
    setError("");
    setMemberActionNotice("");
    setMemberActionPreviewUrl("");

    try {
      const result = await apiClient.inviteMember(inviteForm);
      setInviteForm({
        fullName: "",
        email: "",
        role: "staff"
      });
      setMemberActionNotice(
        result.invitationUrl
          ? "Davet olusturuldu. Lokal preview linki hazir."
          : "Davet olusturuldu ve e-posta akisi tetiklendi."
      );
      setMemberActionPreviewUrl(result.invitationUrl ?? "");
      await loadAll();
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : t("Davet gönderilemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleResendInvitation(userId: string) {
    setBusyKey(`resend:${userId}`);
    setError("");
    setMemberActionNotice("");
    setMemberActionPreviewUrl("");

    try {
      const result = await apiClient.resendMemberInvitation(userId);
      setMemberActionNotice(
        result.invitationUrl
          ? "Davet yeniden gonderildi. Yeni lokal preview linki hazir."
          : "Davet yeniden gonderildi."
      );
      setMemberActionPreviewUrl(result.invitationUrl ?? "");
      await loadAll();
    } catch (resendError) {
      setError(resendError instanceof Error ? resendError.message : t("Davet tekrar gönderilemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleRoleUpdate(member: MemberDirectoryItem) {
    const nextRole = memberRoleDrafts[member.userId];
    if (!nextRole || nextRole === member.role) {
      return;
    }

    setBusyKey(`role:${member.userId}`);
    setError("");

    try {
      await apiClient.updateMemberRole(member.userId, { role: nextRole });
      await loadAll();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : t("Rol güncellenemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleStatusUpdate(member: MemberDirectoryItem) {
    const nextStatus = member.status === "DISABLED" ? "ACTIVE" : "DISABLED";

    if (
      nextStatus === "DISABLED" &&
      !window.confirm(`${member.fullName} ${t("kullanıcısını pasifleştirmek istiyor musunuz?")}`)
    ) {
      return;
    }

    setBusyKey(`status:${member.userId}`);
    setError("");

    try {
      await apiClient.updateMemberStatus(member.userId, { status: nextStatus });
      await loadAll();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : t("Durum güncellenemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleTransferOwnership(member: MemberDirectoryItem) {
    if (!window.confirm(`${member.fullName} ${t("kullanıcısını yeni hesap sahibi yapmak istiyor musunuz?")}`)) {
      return;
    }

    setBusyKey(`owner:${member.userId}`);
    setError("");

    try {
      const result = await apiClient.transferOwnership(member.userId);
      const currentSession = resolveActiveSession();

      if (currentSession && currentSession.userId === result.previousOwnerUserId) {
        saveSession({
          ...currentSession,
          roles: "manager"
        });
        router.push("/dashboard");
        router.refresh();
        return;
      }

      await loadAll();
    } catch (transferError) {
      setError(transferError instanceof Error ? transferError.message : t("Sahiplik devredilemedi."));
    } finally {
      setBusyKey("");
    }
  }

  async function handlePlanCheckout(planKey: Exclude<BillingPlanKey, "ENTERPRISE">) {
    setBusyKey(`billing-plan:${planKey}`);
    setError("");
    setBillingActionNotice("");

    try {
      const result = await apiClient.createPlanCheckout({
        planKey,
        billingEmail: billing?.account.billingEmail ?? undefined
      });
      await loadAll();

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      }

      setBillingActionNotice(t("Plan ödeme linki hazırlandı."));
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : t("Plan ödeme bağlantısı oluşturulamadı.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleAddOnCheckout(addOnKey: BillingAddonKey) {
    setBusyKey(`billing-addon:${addOnKey}`);
    setError("");
    setBillingActionNotice("");

    try {
      const result = await apiClient.createAddOnCheckout({
        addOnKey,
        billingEmail: billing?.account.billingEmail ?? undefined
      });
      await loadAll();

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      }

      setBillingActionNotice(t("Add-on ödeme linki hazırlandı."));
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error ? checkoutError.message : t("Add-on ödeme bağlantısı oluşturulamadı.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleCustomerPortal() {
    setBusyKey("billing-portal");
    setError("");
    setBillingActionNotice("");

    try {
      const result = await apiClient.createBillingCustomerPortal();
      window.open(result.portalUrl, "_blank", "noopener,noreferrer");
      setBillingActionNotice(t("Stripe müşteri portalı açıldı."));
    } catch (portalError) {
      setError(portalError instanceof Error ? portalError.message : t("Müşteri portalı açılamadı."));
    } finally {
      setBusyKey("");
    }
  }

  async function handleEnterpriseCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("billing-enterprise");
    setError("");
    setBillingActionNotice("");

    try {
      const result = await apiClient.createEnterpriseCheckout(enterpriseForm);
      await loadAll();

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      }

      setBillingActionNotice(t("Enterprise teklif ödeme linki hazırlandı."));
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : t("Enterprise teklif bağlantısı oluşturulamadı.")
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleSendCheckoutLink(checkoutSessionId: string) {
    const email = checkoutEmailDrafts[checkoutSessionId]?.trim();
    if (!email) {
      setError(t("Ödeme linki göndermek için e-posta giriniz."));
      return;
    }

    setBusyKey(`billing-send:${checkoutSessionId}`);
    setError("");
    setBillingActionNotice("");

    try {
      await apiClient.sendBillingCheckoutLink({
        checkoutSessionId,
        email
      });
      setBillingActionNotice(t(`Ödeme bağlantısı ${email} adresine gönderildi.`));
      await loadAll();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : t("Ödeme linki gönderilemedi."));
    } finally {
      setBusyKey("");
    }
  }

  return (
    <section className="page-grid">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{t("Ayarlar")}</h1>
          <p className="small" style={{ margin: 0 }}>
            {t("Hesap sahipliği, ekip yetkileri, entegrasyonlar ve AI sistem davranışları.")}
          </p>
        </div>
        <button type="button" className="ghost-button" onClick={() => void loadAll()}>
          {t("Yenile")}
        </button>
      </div>

      {googleConnected ? (
        <NoticeBox tone="success" message={t("Google Calendar başarıyla bağlandı!")} />
      ) : null}
      {oauthError ? (
        <NoticeBox tone="danger" message={t(`Bağlantı hatası: ${oauthError}`)} />
      ) : null}
      {billingState === "success" ? (
        <NoticeBox tone="success" message={t("Ödeme işlemi başarıyla tamamlandı.")} />
      ) : null}
      {billingState === "cancel" ? (
        <NoticeBox tone="danger" message={t("Ödeme akışı iptal edildi.")} />
      ) : null}
      {billingActionNotice ? <NoticeBox tone="success" message={billingActionNotice} /> : null}
      {memberActionNotice ? <NoticeBox tone="success" message={memberActionNotice} /> : null}
      {verificationNotice ? <NoticeBox tone="success" message={verificationNotice} /> : null}
      {memberActionPreviewUrl ? (
        <a
          href={memberActionPreviewUrl}
          target="_blank"
          rel="noreferrer"
          className="ghost-button"
          style={{ justifySelf: "start", textDecoration: "none" }}
        >
          {t("Davet preview bağlantısını aç")}
        </a>
      ) : null}
      {verificationPreviewUrl ? (
        <a
          href={verificationPreviewUrl}
          target="_blank"
          rel="noreferrer"
          className="ghost-button"
          style={{ justifySelf: "start", textDecoration: "none" }}
        >
          {t("Doğrulama preview bağlantısını aç")}
        </a>
      ) : null}

      {currentSession?.email && !currentSession.emailVerifiedAt ? (
        <section className="panel" style={{ display: "grid", gap: 10 }}>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>{t("E-posta doğrulaması bekleniyor")}</h3>
            <p className="small text-muted" style={{ margin: 0 }}>
              {t("Bu hesap doğrulanmadan bazı müşteri akışlarını yayına almak istemeyebilirsiniz. Maili tekrar gönderebilirsiniz.")}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="ghost-button"
              disabled={busyKey === "verify-email"}
              onClick={() => void handleResendOwnVerification()}
            >
              {busyKey === "verify-email" ? t("Hazırlanıyor...") : t("Doğrulama mailini tekrar gönder")}
            </button>
          </div>
        </section>
      ) : null}

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab.id
                  ? "2px solid var(--primary, #7c73fa)"
                  : "2px solid transparent",
              color:
                activeTab === tab.id
                  ? "var(--primary, #7c73fa)"
                  : "var(--text-secondary, #64748b)",
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: "pointer",
              fontSize: 14,
              fontFamily: "inherit",
              transition: "all 0.15s"
            }}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {loading ? <section className="panel"><LoadingState message={t("Ayarlar yükleniyor...")} /></section> : null}
      {!loading && error ? <section className="panel"><ErrorState error={error} /></section> : null}

      {!loading ? (
        <>
          {activeTab === "plan" ? (
            <>
              {billingLoadError ? (
                <section className="panel">
                  <ErrorState
                    error={billingLoadError}
                    actions={
                      <button type="button" className="ghost-button" onClick={() => void loadAll()}>
                        {t("Tekrar dene")}
                      </button>
                    }
                  />
                </section>
              ) : null}

              {billing ? (
                <>
                  <section className="panel">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t("Mevcut plan")}</h3>
                        <p className="small text-muted" style={{ marginTop: 4 }}>
                          {t("Seat limiti aktif ve davet bekleyen ekip kullanıcılarını kapsar. AI interview kotası davet oluştuğunda tüketilir.")}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <StatusBadge
                          ready={billing.account.status === "ACTIVE" || billing.account.status === "TRIALING"}
                          label={billing.account.status}
                        />
                        <button type="button" className="ghost-button" onClick={() => void loadAll()}>
                          {t("Kullanımı yenile")}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!billing.account.stripeCustomerId || busyKey === "billing-portal"}
                          onClick={() => void handleCustomerPortal()}
                        >
                          {busyKey === "billing-portal" ? t("Açılıyor...") : t("Stripe Portalı")}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 16 }}>
                      <div
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: 16,
                          background: "rgba(255,255,255,0.02)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 18, fontWeight: 700 }}>{billing.currentPlan.label}</div>
                            <p className="small text-muted" style={{ margin: "6px 0 0" }}>
                              {billing.currentPlan.description}
                            </p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 22, fontWeight: 700 }}>
                              {formatPlanPrice(billing.currentPlan.monthlyAmountCents, billing.currentPlan.currency)}
                            </div>
                            <div className="small text-muted">{t("aylık")}</div>
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginTop: 16 }}>
                          <UsageMiniStat label={t("Kullanıcı")} value={String(billing.currentPlan.seatsIncluded)} hint={t("Aktif + davet bekleyen ekip hesabı")} />
                          <UsageMiniStat label={t("Aktif ilan")} value={String(billing.currentPlan.activeJobsIncluded)} />
                          <UsageMiniStat label={t("Aday işleme")} value={String(billing.currentPlan.candidateProcessingIncluded)} />
                          <UsageMiniStat label={t("AI mülakat")} value={String(billing.currentPlan.aiInterviewsIncluded)} />
                        </div>
                      </div>

                      <div
                        style={{
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: 16,
                          background: "rgba(255,255,255,0.02)"
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 10 }}>{t("Dönem bilgisi")}</div>
                        <div className="small text-muted" style={{ display: "grid", gap: 8 }}>
                          <span>{t("Başlangıç")}: {formatDate(billing.account.currentPeriodStart)}</span>
                          <span>{t("Bitiş")}: {formatDate(billing.account.currentPeriodEnd)}</span>
                          <span>{t("Faturalama e-postası")}: {billing.account.billingEmail ?? "—"}</span>
                          <span>{t("Stripe hazırlığı")}: {billing.stripeReady ? t("Hazır") : t("Eksik ayar")}</span>
                        </div>

                        {billing.warnings.length > 0 ? (
                          <div
                            style={{
                              marginTop: 14,
                              padding: 12,
                              borderRadius: 10,
                              border: "1px solid rgba(245,158,11,0.22)",
                              background: "rgba(245,158,11,0.08)"
                            }}
                          >
                            <strong style={{ fontSize: 13, color: "var(--warn, #f59e0b)" }}>{t("Dikkat")}</strong>
                            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                              {billing.warnings.map((warning) => (
                                <li key={warning} className="small text-muted">
                                  {warning}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </section>

                  <section className="panel">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t("Kullanım ve limitler")}</h3>
                        <p className="small text-muted" style={{ marginTop: 4 }}>
                          {t("Limitler tek merkezden izlenir. Kritik noktalarda sistem blok koyar ve upgrade / add-on önerir.")}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                      {billing.usage.quotas.map((quota) => (
                        <QuotaCard key={quota.key} quota={quota} />
                      ))}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t("Planlar")}</h3>
                        <p className="small text-muted" style={{ marginTop: 4 }}>
                          {t("Starter giriş paketi, Growth ise asıl satış paketi olarak konumlandı.")}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
                      {billing.planCatalog.map((plan) => (
                        <div
                          key={plan.key}
                          style={{
                            border: plan.recommended ? "1px solid rgba(124,115,250,0.48)" : "1px solid var(--border)",
                            borderRadius: 14,
                            padding: 16,
                            background: plan.key === billing.account.currentPlanKey ? "rgba(124,115,250,0.08)" : "rgba(255,255,255,0.02)"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                            <div>
                              <div style={{ fontSize: 18, fontWeight: 700 }}>{t(plan.label)}</div>
                              <p className="small text-muted" style={{ margin: "6px 0 0" }}>{t(plan.description)}</p>
                            </div>
                            {plan.key === billing.account.currentPlanKey ? (
                              <StatusBadge ready label={t("Aktif plan")} />
                            ) : plan.recommended ? (
                              <StatusBadge ready label={t("Önerilen")} />
                            ) : null}
                          </div>

                          <div style={{ marginTop: 14, fontSize: 24, fontWeight: 700 }}>
                            {formatPlanPrice(plan.monthlyAmountCents, plan.currency)}
                            <span className="small text-muted" style={{ marginLeft: 6 }}>{locale === "en" ? "/ mo" : "/ ay"}</span>
                          </div>

                          <div style={{ display: "grid", gap: 6, marginTop: 14 }} className="small">
                            <span>{t("Kullanıcı")}: {plan.seatsIncluded || t("Özel")}</span>
                            <span>{t("Aktif ilan")}: {plan.activeJobsIncluded || t("Özel")}</span>
                            <span>{t("Aday işleme")}: {plan.candidateProcessingIncluded || t("Özel")}</span>
                            <span>{t("AI mülakat")}: {plan.aiInterviewsIncluded || t("Özel")}</span>
                            <span>{t("Takvim entegrasyonu")}: {plan.features.calendarIntegrations ? t("Açık") : t("Yok")}</span>
                            <span>{t("Gelişmiş raporlama")}: {plan.features.advancedReporting ? t("Açık") : t("Yok")}</span>
                          </div>

                          <div style={{ marginTop: 16 }}>
                            {plan.key === "ENTERPRISE" ? (
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => document.getElementById("enterprise-offer")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                              >
                                {t("Teklif oluştur")}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={!billing.stripeReady || billing.account.currentPlanKey === plan.key || busyKey === `billing-plan:${plan.key}`}
                                onClick={() =>
                                  void handlePlanCheckout(
                                    plan.key as Exclude<BillingPlanKey, "ENTERPRISE">
                                  )
                                }
                              >
                                {busyKey === `billing-plan:${plan.key}`
                                  ? t("Hazırlanıyor...")
                                  : billing.account.currentPlanKey === plan.key
                                    ? t("Aktif plan")
                                    : t(`${plan.label} seç`)}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="panel">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t("Add-onlar")}</h3>
                        <p className="small text-muted" style={{ marginTop: 4 }}>
                          {t("Limit asmadan once ek interview, ek aday isleme veya servis odakli paket satin alabilirsiniz.")}
                        </p>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                      {billing.addOnCatalog.map((addon) => (
                        <div
                          key={addon.key}
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: 12,
                            padding: 16,
                            background: "rgba(255,255,255,0.02)"
                          }}
                        >
                          <div style={{ fontWeight: 700 }}>{t(addon.label)}</div>
                          <p className="small text-muted" style={{ margin: "6px 0 0" }}>
                            {t(addon.description)}
                          </p>
                          <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700 }}>
                            {formatPlanPrice(addon.amountCents, addon.currency)}
                          </div>
                          <div className="small text-muted" style={{ marginTop: 4 }}>
                            {addon.quotaKey && addon.quantity ? `+${addon.quantity} ${t(addon.quotaKey)}` : t("Servis paketi")}
                          </div>
                          <button
                            type="button"
                            className="ghost-button"
                            style={{ marginTop: 14 }}
                            disabled={!billing.stripeReady || busyKey === `billing-addon:${addon.key}`}
                            onClick={() => void handleAddOnCheckout(addon.key)}
                          >
                            {busyKey === `billing-addon:${addon.key}` ? t("Hazırlanıyor...") : t("Ödeme linki oluştur")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="panel" id="enterprise-offer">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t("Enterprise teklif oluştur")}</h3>
                        <p className="small text-muted" style={{ marginTop: 4 }}>
                          {t("Owner burada custom limitleri belirler, ödeme linkini oluşturur ve isterse kullanıcıya e-posta ile gönderir.")}
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleEnterpriseCheckout} style={{ display: "grid", gap: 12 }}>
                      <div className="inline-grid" style={{ gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
                        <input
                          className="input"
                          type="email"
                          value={enterpriseForm.billingEmail}
                          onChange={(event) =>
                            setEnterpriseForm((prev) => ({ ...prev, billingEmail: event.target.value }))
                          }
                          placeholder={t("Fatura / teklif e-postası")}
                          required
                        />
                        <input
                          className="input"
                          type="number"
                          min={100}
                          step={100}
                          value={enterpriseForm.monthlyAmountCents}
                          onChange={(event) =>
                            setEnterpriseForm((prev) => ({
                              ...prev,
                              monthlyAmountCents: Number(event.target.value || 0)
                            }))
                          }
                          placeholder={t("Aylık tutar (cent)")}
                          required
                        />
                      </div>

                      <div className="inline-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
                        <input className="input" type="number" min={1} value={enterpriseForm.seatsIncluded} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, seatsIncluded: Number(event.target.value || 1) }))} placeholder={t("Kullanıcı")} required />
                        <input className="input" type="number" min={1} value={enterpriseForm.activeJobsIncluded} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, activeJobsIncluded: Number(event.target.value || 1) }))} placeholder={t("Aktif ilan")} required />
                        <input className="input" type="number" min={1} value={enterpriseForm.candidateProcessingIncluded} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, candidateProcessingIncluded: Number(event.target.value || 1) }))} placeholder={t("Aday işleme")} required />
                        <input className="input" type="number" min={1} value={enterpriseForm.aiInterviewsIncluded} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, aiInterviewsIncluded: Number(event.target.value || 1) }))} placeholder={t("AI mülakat")} required />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={enterpriseForm.advancedReporting} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, advancedReporting: event.target.checked }))} />
                          {t("Gelişmiş raporlama")}
                        </label>
                        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={enterpriseForm.calendarIntegrations} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, calendarIntegrations: event.target.checked }))} />
                          {t("Calendar / Meet entegrasyonu")}
                        </label>
                        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={enterpriseForm.brandedCandidateExperience} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, brandedCandidateExperience: event.target.checked }))} />
                          {t("Branded candidate experience")}
                        </label>
                        <label className="small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input type="checkbox" checked={enterpriseForm.customIntegrations} onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, customIntegrations: event.target.checked }))} />
                          {t("Özel entegrasyon yetkisi")}
                        </label>
                      </div>

                      <textarea
                        className="input"
                        rows={3}
                        value={enterpriseForm.note}
                        onChange={(event) => setEnterpriseForm((prev) => ({ ...prev, note: event.target.value }))}
                        placeholder={t("Teklif notu / SLA / onboarding kapsamı")}
                      />

                      <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button type="submit" className="ghost-button" disabled={!billing.stripeReady || busyKey === "billing-enterprise"}>
                          {busyKey === "billing-enterprise" ? t("Hazırlanıyor...") : t("Enterprise ödeme linki oluştur")}
                        </button>
                      </div>
                    </form>
                  </section>

                  <section className="panel">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t("Ödeme bağlantıları")}</h3>
                        <p className="small text-muted" style={{ marginTop: 4 }}>
                          {t("Oluşan checkout linklerini buradan izleyebilir ve kullanıcıya tekrar gönderebilirsiniz.")}
                        </p>
                      </div>
                    </div>

                    {billing.recentCheckouts.length === 0 ? (
                      <EmptyState message={t("Henüz ödeme bağlantısı oluşturulmadı.")} />
                    ) : (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>{t("Tür")}</th>
                            <th>{t("Etiket")}</th>
                            <th>{t("Tutar")}</th>
                            <th>{t("Durum")}</th>
                            <th>{t("Bağlantı / Gönderim")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {billing.recentCheckouts.map((checkout) => (
                            <tr key={checkout.id}>
                              <td>{checkout.checkoutType}</td>
                              <td>
                                <div style={{ fontWeight: 600 }}>{t(checkout.label ?? checkout.planKey ?? checkout.addOnKey ?? "Checkout")}</div>
                                <div className="small text-muted">{formatDate(checkout.createdAt)}</div>
                              </td>
                              <td>{formatPlanPrice(checkout.amountCents, checkout.currency)}</td>
                              <td>{t(checkout.status)}</td>
                              <td>
                                <div style={{ display: "grid", gap: 8 }}>
                                  {checkout.checkoutUrl ? (
                                    <a href={checkout.checkoutUrl} target="_blank" rel="noreferrer" className="small" style={{ color: "var(--primary, #7c73fa)", textDecoration: "none" }}>
                                      {t("Ödeme linkini aç")}
                                    </a>
                                  ) : (
                                    <span className="small text-muted">{t("Link hazır değil")}</span>
                                  )}
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <input
                                      className="input"
                                      style={{ minWidth: 220 }}
                                      type="email"
                                      value={checkoutEmailDrafts[checkout.id] ?? ""}
                                      onChange={(event) =>
                                        setCheckoutEmailDrafts((prev) => ({
                                          ...prev,
                                          [checkout.id]: event.target.value
                                        }))
                                      }
                                      placeholder={t("Ödeme linki gönderilecek e-posta")}
                                    />
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      disabled={!checkout.checkoutUrl || busyKey === `billing-send:${checkout.id}`}
                                      onClick={() => void handleSendCheckoutLink(checkout.id)}
                                    >
                                      {busyKey === `billing-send:${checkout.id}` ? t("Gönderiliyor...") : t("Linki gönder")}
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </section>
                </>
              ) : null}
            </>
          ) : null}

          {activeTab === "ekip" ? (
            <>
              {memberLoadError ? (
                <section className="panel">
                  <ErrorState
                    error={memberLoadError}
                    actions={
                      <button type="button" className="ghost-button" onClick={() => void loadAll()}>
                        {t("Tekrar dene")}
                      </button>
                    }
                  />
                </section>
              ) : (
                <>
                  <section className="panel">
                    <h3 style={{ marginTop: 0, marginBottom: 6 }}>{t("Yeni Üye Davet Et")}</h3>
                    <p className="small text-muted" style={{ marginBottom: 12 }}>
                          {t("Owner olarak sisteme yeni menajer veya personel ekleyebilirsiniz.")}
                    </p>

                    <form className="inline-grid" style={{ gridTemplateColumns: "1.2fr 1.2fr 0.8fr auto", gap: 12 }} onSubmit={handleInviteSubmit}>
                      <input
                        className="input"
                        value={inviteForm.fullName}
                        onChange={(event) => setInviteForm((prev) => ({ ...prev, fullName: event.target.value }))}
                        placeholder={t("Ad Soyad")}
                        required
                      />
                      <input
                        className="input"
                        type="email"
                        value={inviteForm.email}
                        onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder={t("E-posta")}
                        required
                      />
                      <select
                        className="input"
                        value={inviteForm.role}
                        onChange={(event) =>
                          setInviteForm((prev) => ({
                            ...prev,
                            role: event.target.value as "manager" | "staff"
                          }))
                        }
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.label)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="ghost-button" disabled={busyKey === "invite"}>
                        {busyKey === "invite" ? t("Gönderiliyor...") : t("Davet Gönder")}
                      </button>
                    </form>
                  </section>

                  <section className="panel">
                    <div className="section-head" style={{ marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{t("Üye Listesi")}</h3>
                        <p className="small text-muted" style={{ marginTop: 4 }}>
                          {t("Hesapta tek bir owner bulunur. Menajer operasyonu yönetir, personel günlük iş akışında çalışır.")}
                        </p>
                      </div>
                    </div>

                    {members.length === 0 ? (
                      <EmptyState message={t("Henüz ekip üyesi bulunmuyor.")} />
                    ) : (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>{t("Kullanıcı")}</th>
                            <th>{t("Rol")}</th>
                            <th>{t("Durum")}</th>
                            <th>{t("Davet / Son Giriş")}</th>
                            <th>{t("Aksiyonlar")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((member) => {
                            const status = statusBadge(member.status);
                            const roleDraft = memberRoleDrafts[member.userId] ?? (member.role === "manager" ? "manager" : "staff");

                            return (
                              <tr key={member.userId}>
                                <td>
                                  <div style={{ fontWeight: 600 }}>{member.fullName}</div>
                                  <div className="small text-muted">{member.email}</div>
                                </td>
                                <td>
                                  {member.role === "owner" ? (
                                    <span>{t(getRoleLabel(member.role))}</span>
                                  ) : (
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                      <select
                                        className="input"
                                        style={{ minWidth: 180 }}
                                        value={roleDraft}
                                        onChange={(event) =>
                                          setMemberRoleDrafts((prev) => ({
                                            ...prev,
                                            [member.userId]: event.target.value as "manager" | "staff"
                                          }))
                                        }
                                      >
                                        {ROLE_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {t(option.label)}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        className="ghost-button"
                                        disabled={busyKey === `role:${member.userId}` || roleDraft === member.role}
                                        onClick={() => void handleRoleUpdate(member)}
                                      >
                                        {busyKey === `role:${member.userId}` ? t("Kaydediliyor...") : t("Kaydet")}
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <StatusBadge ready={status.ready} label={status.label} />
                                </td>
                                <td>
                                  <div className="small">
                                    {t("Davet:")} {formatOptionalDate(member.invitedAt)}
                                  </div>
                                  <div className="small text-muted">
                                    {t("Son giriş:")} {formatOptionalDate(member.lastLoginAt)}
                                  </div>
                                  <div className="small text-muted">
                                    {t("E-posta doğrulama:")}{" "}
                                    {member.emailVerifiedAt ? formatOptionalDate(member.emailVerifiedAt) : t("Bekliyor")}
                                  </div>
                                </td>
                                <td>
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {member.role !== "owner" ? (
                                      <button
                                        type="button"
                                        className="ghost-button"
                                        disabled={busyKey === `status:${member.userId}`}
                                        onClick={() => void handleStatusUpdate(member)}
                                      >
                                        {busyKey === `status:${member.userId}`
                                          ? t("İşleniyor...")
                                          : member.status === "DISABLED"
                                            ? t("Aktifleştir")
                                            : t("Pasifleştir")}
                                      </button>
                                    ) : null}
                                    {member.status === "INVITED" || member.hasPendingInvitation ? (
                                      <button
                                        type="button"
                                        className="ghost-button"
                                        disabled={busyKey === `resend:${member.userId}`}
                                        onClick={() => void handleResendInvitation(member.userId)}
                                      >
                                        {busyKey === `resend:${member.userId}` ? t("Gönderiliyor...") : t("Daveti Tekrar Gönder")}
                                      </button>
                                    ) : null}
                                    {member.role !== "owner" && member.status === "ACTIVE" ? (
                                      <button
                                        type="button"
                                        className="ghost-button"
                                        disabled={busyKey === `owner:${member.userId}`}
                                        onClick={() => void handleTransferOwnership(member)}
                                      >
                                        {busyKey === `owner:${member.userId}` ? t("Devrediliyor...") : t("Owner Yap")}
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </section>
                </>
              )}
            </>
          ) : null}

          {activeTab === "entegrasyonlar" ? (
            <>
              {healthLoadError ? (
                <section className="panel">
                  <ErrorState
                    error={healthLoadError}
                    actions={
                      <button type="button" className="ghost-button" onClick={() => void loadAll()}>
                        {t("Tekrar dene")}
                      </button>
                    }
                  />
                </section>
              ) : null}

              <section className="panel">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background:
                        health?.overall === "healthy"
                          ? "var(--success, #22c55e)"
                          : "var(--warn, #f59e0b)"
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 16 }}>
                    {health?.overall === "healthy" ? t("Tüm sistemler aktif") : t("Bazı bağlantılarda sorun var")}
                  </span>
                </div>

                {health && health.warnings.length > 0 ? (
                  <div
                    style={{
                      background: "rgba(245,158,11,0.08)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 13,
                      marginBottom: 16
                    }}
                  >
                    <strong style={{ color: "var(--warn, #f59e0b)" }}>{t("Dikkat gerektiren konular:")}</strong>
                    <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--text-secondary)" }}>
                      {health.warnings.map((warning, index) => (
                        <li key={index}>{t(friendlyWarning(warning))}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <h3 style={{ fontSize: 14, marginBottom: 8 }}>{t("Bağlı Servisler")}</h3>
                {health && health.integrations.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {health.integrations.map((integration) => {
                      const statusInfo = connectionStatusLabel(integration.status);
                      return (
                        <div
                          key={integration.provider}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            background: "rgba(255,255,255,0.02)",
                            borderRadius: 8,
                            border: "1px solid var(--border)"
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>
                              {integration.displayName || integration.provider}
                            </span>
                          </div>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12,
                              color: statusInfo.color,
                              fontWeight: 500
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: statusInfo.color,
                                display: "inline-block"
                              }}
                            />
                            {t(statusInfo.label)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="small text-muted" style={{ marginBottom: 16 }}>
                    {t("Henüz entegrasyon bağlantısı yapılmamış.")}
                  </p>
                )}

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                  <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>{t("Google Calendar Bağlantısı")}</h3>
                  <p className="small text-muted" style={{ margin: "0 0 12px" }}>
                    {t("Görüşmeleri takvime otomatik yansıtmak için bağlayabilirsiniz.")}
                  </p>
                  <a
                    href={`${API_BASE_URL}/integrations/google/authorize`}
                    style={{
                      display: "inline-block",
                      padding: "8px 20px",
                      background: "var(--primary, #7c73fa)",
                      color: "#fff",
                      borderRadius: 6,
                      textDecoration: "none",
                      fontWeight: 500,
                      fontSize: 13
                    }}
                  >
                    {t("Google Calendar Bağla")}
                  </a>
                </div>
              </section>
            </>
          ) : null}

          {activeTab === "ai" ? (
            <>
              <section className="panel">
                <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 6 }}>{t("AI Davranış Kuralları")}</h3>
                <p className="small text-muted" style={{ marginBottom: 12 }}>
                  {t("AI yardımcı rolde kalır, kritik kararlar insanda olur.")}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <RuleRow label={t("AI sadece yardımcı rol üstlenir")} value={t("Evet")} positive />
                  <RuleRow label={t("Otomatik red")} value={t("Kapalı")} />
                  <RuleRow label={t("Kritik aksiyonlarda insan onayı")} value={t("Zorunlu")} positive />
                </div>
              </section>

              <section className="panel">
                <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 6 }}>{t("AI Özellikleri")}</h3>
                <p className="small text-muted" style={{ marginBottom: 12 }}>
                  {t("Owner hesabıyla AI destek özelliklerini açıp kapatabilirsiniz.")}
                </p>

                {aiLoadError ? (
                  <ErrorState
                    error={aiLoadError}
                    actions={
                      <button type="button" className="ghost-button" onClick={() => void loadAll()}>
                        {t("Tekrar dene")}
                      </button>
                    }
                  />
                ) : demoFlags.length === 0 ? (
                  <EmptyState message={t("Özellik kaydı bulunamadı.")} />
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t("Özellik")}</th>
                        <th>{t("Durum")}</th>
                        <th>{t("İşlem")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoFlags.map((flag) => {
                        const boolValue = toBoolean(flag.value);
                        const display = FLAG_DISPLAY[flag.key];
                        const isLocked = flag.key === "ai.auto_reject.enabled";

                        return (
                          <tr key={flag.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{display?.name ?? flag.key}</div>
                              <div className="small text-muted">{display?.desc ?? flag.description ?? ""}</div>
                            </td>
                            <td>{boolValue ? t("Açık") : t("Kapalı")}</td>
                            <td>
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={busyKey === `flag:${flag.key}` || isLocked}
                                onClick={() => void toggleFlag(flag, !Boolean(boolValue))}
                              >
                                {isLocked
                                  ? t("Kilitli")
                                  : busyKey === `flag:${flag.key}`
                                    ? t("Güncelleniyor...")
                                    : boolValue
                                      ? t("Kapat")
                                      : t("Aç")}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </section>

              {aiData ? (
                <section className="panel">
                  <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 6 }}>{t("Son AI Görevleri")}</h3>
                  {aiData.taskRuns.length === 0 ? (
                    <EmptyState message={t("Son AI görevi bulunmuyor.")} />
                  ) : (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("Görev")}</th>
                          <th>{t("Durum")}</th>
                          <th>{t("Kapsam")}</th>
                          <th>{t("Zaman")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiData.taskRuns.slice(0, 8).map((run) => (
                          <tr key={run.id}>
                            <td>{run.taskType}</td>
                            <td>{run.status}</td>
                            <td>{run.scope}</td>
                            <td>{formatDate(run.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              ) : null}
            </>
          ) : null}

          {activeTab === "sistem" ? (
            <section className="panel">
              <h3 style={{ fontSize: 14, marginTop: 0, marginBottom: 6 }}>{t("Sistem Özeti")}</h3>
              <p className="small text-muted" style={{ marginBottom: 12 }}>
                {t("Teknik bileşenlerin genel durumu ve servis hazırlığı.")}
              </p>

              {healthLoadError && infraLoadError ? (
                <ErrorState
                  error={`${healthLoadError} ${infraLoadError}`.trim()}
                  actions={
                    <button type="button" className="ghost-button" onClick={() => void loadAll()}>
                      {t("Tekrar dene")}
                    </button>
                  }
                />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("Bileşen")}</th>
                      <th>{t("Durum")}</th>
                      <th>{t("Detay")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {health?.runtimeProviders.map((provider) => (
                      <tr key={provider.key}>
                        <td>{provider.key}</td>
                        <td><StatusBadge ready={provider.ready} /></td>
                        <td>{!provider.ready && provider.reason ? provider.reason : t("Hazır")}</td>
                      </tr>
                    ))}
                    {infra ? (
                      <>
                        <tr>
                          <td>{t("Speech Runtime")}</td>
                          <td><StatusBadge ready={infra.runtime.speech.providerMode !== "none"} /></td>
                          <td>{infra.runtime.speech.providerMode}</td>
                        </tr>
                        <tr>
                          <td>{t("Google Calendar")}</td>
                          <td><StatusBadge ready={infra.runtime.googleCalendar.oauthConfigured} /></td>
                          <td>{infra.runtime.googleCalendar.oauthConfigured ? t("Bağlı") : t("Yapılandırılmadı")}</td>
                        </tr>
                        <tr>
                          <td>{t("Email Provider")}</td>
                          <td><StatusBadge ready={infra.runtime.notifications.ready} /></td>
                          <td>{infra.runtime.notifications.emailProvider}</td>
                        </tr>
                      </>
                    ) : null}
                  </tbody>
                </table>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function formatPlanPrice(amountCents: number | null, currency: string) {
  if (amountCents === null) {
    return "Teklif";
  }

  return new Intl.NumberFormat(getActiveLocaleTag(), {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

function UsageMiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const { t } = useUiText();
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: 12,
        background: "rgba(255,255,255,0.02)"
      }}
    >
      <div className="small text-muted">{t(label)}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {hint ? (
        <div className="small text-muted" style={{ marginTop: 4 }}>
          {t(hint)}
        </div>
      ) : null}
    </div>
  );
}

function QuotaCard({
  quota
}: {
  quota: BillingOverviewReadModel["usage"]["quotas"][number];
}) {
  const { t } = useUiText();
  const accent =
    quota.warningState === "exceeded"
      ? "var(--danger, #ef4444)"
      : quota.warningState === "warning"
        ? "var(--warn, #f59e0b)"
        : "var(--success, #22c55e)";

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 16,
        background: "rgba(255,255,255,0.02)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700 }}>{t(quota.label)}</div>
          <div className="small text-muted">
            {t("Dahil")}: {quota.included} {quota.addOn > 0 ? t(`+ add-on ${quota.addOn}`) : ""}
          </div>
        </div>
        <StatusBadge
          ready={quota.warningState === "healthy"}
          label={
            quota.warningState === "healthy"
              ? "Sağlıklı"
              : quota.warningState === "warning"
                ? "Yaklaşıyor"
                : "Limit doldu"
          }
        />
      </div>

      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 700 }}>
        {quota.used} / {quota.limit}
      </div>

      <div
        style={{
          marginTop: 10,
          height: 8,
          borderRadius: 999,
          background: "rgba(255,255,255,0.08)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            width: `${Math.min(100, quota.utilizationPercent)}%`,
            height: "100%",
            background: accent
          }}
        />
      </div>

      <div className="small text-muted" style={{ marginTop: 10 }}>
        {t("Kalan")}: {quota.remaining} • {t("Kullanım")}: %{quota.utilizationPercent}
      </div>
    </div>
  );
}

function NoticeBox({ message, tone }: { message: string; tone: "success" | "danger" }) {
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

function StatusBadge({ ready, label }: { ready: boolean; label?: string }) {
  const { t } = useUiText();
  const text = t(label ?? (ready ? "Hazır" : "Sorunlu"));
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 10px",
        borderRadius: 10,
        fontWeight: 600,
        background: ready ? "rgba(34,197,94,0.12)" : "rgba(113,113,122,0.12)",
        color: ready ? "var(--success, #22c55e)" : "var(--text-dim)"
      }}
    >
      {text}
    </span>
  );
}

function RuleRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  const { t } = useUiText();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.02)",
        borderRadius: 8,
        border: "1px solid var(--border)"
      }}
    >
      <span style={{ fontSize: 13 }}>{t(label)}</span>
      <span
        style={{
          fontSize: 11,
          padding: "2px 10px",
          borderRadius: 10,
          fontWeight: 600,
          background: positive ? "rgba(34,197,94,0.12)" : "rgba(113,113,122,0.12)",
          color: positive ? "var(--success, #22c55e)" : "var(--text-dim)"
        }}
      >
        {t(value)}
      </span>
    </div>
  );
}
