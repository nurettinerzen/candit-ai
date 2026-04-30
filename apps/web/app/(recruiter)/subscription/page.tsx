"use client";

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import { publicContactApi } from "../../../lib/api/public-client";
import {
  buildBillingPlanCardModel,
  formatBillingPackageLabel,
  formatBillingPlanLabel,
  formatBillingTrialLabel
} from "../../../lib/billing-presentation";
import { formatDateOnly } from "../../../lib/format";
import { getLocaleTag } from "../../../lib/i18n";
import type {
  BillingOverviewReadModel,
  BillingPlanKey,
  TenantRuntimeConfigurationReadModel
} from "../../../lib/types";

type BillingQuotaKeyWithAddOns = Exclude<
  BillingOverviewReadModel["addOnCatalog"][number]["quotaKey"],
  undefined | null
>;
type PlanActionMode = "current" | "upgrade" | "downgrade" | "select";
type EnterpriseQuoteFormState = {
  fullName: string;
  company: string;
  email: string;
  phone: string;
  seats: string;
  activeJobs: string;
  candidateProcessing: string;
  aiInterviews: string;
  note: string;
};

type EnterpriseRequestPrefill = Partial<
  Pick<
    EnterpriseQuoteFormState,
    "company" | "phone" | "seats" | "activeJobs" | "candidateProcessing" | "aiInterviews" | "note"
  >
>;

const INITIAL_ENTERPRISE_QUOTE_FORM: EnterpriseQuoteFormState = {
  fullName: "",
  company: "",
  email: "",
  phone: "",
  seats: "",
  activeJobs: "",
  candidateProcessing: "",
  aiInterviews: "",
  note: ""
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatMoney(amountCents: number, currency: string, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

function formatAddOnPrice(
  addOn: BillingOverviewReadModel["addOnCatalog"][number],
  localeTag: string
) {
  return formatMoney(addOn.amountCents, addOn.currency, localeTag);
}

function formatAddOnHeadline(
  addOn: BillingOverviewReadModel["addOnCatalog"][number],
  t: (value: string) => string
) {
  if (addOn.quantity) {
    return `+${addOn.quantity} ${t(quotaUnitLabel(addOn.quotaKey))}`;
  }

  return t(addOn.label);
}

function planOrder(planKey: BillingPlanKey) {
  switch (planKey) {
    case "FLEX":
      return 0;
    case "STARTER":
      return 1;
    case "GROWTH":
      return 2;
    case "ENTERPRISE":
      return 3;
  }
}

function getPlanActionMode(currentPlanKey: BillingPlanKey | null, targetPlanKey: BillingPlanKey): PlanActionMode {
  if (!currentPlanKey) {
    return "select";
  }

  if (currentPlanKey === targetPlanKey) {
    return "current";
  }

  return planOrder(targetPlanKey) > planOrder(currentPlanKey) ? "upgrade" : "downgrade";
}

function planActionLabel(
  mode: PlanActionMode,
  locale: "tr" | "en"
) {
  if (locale === "en") {
    return mode === "current" ? "Current plan" : mode === "upgrade" ? "Upgrade" : mode === "downgrade" ? "Downgrade" : "Choose";
  }

  return mode === "current" ? "Mevcut Paket" : mode === "upgrade" ? "Yükselt" : mode === "downgrade" ? "Düşür" : "Seç";
}

function buildEnterpriseQuoteMessage(
  form: EnterpriseQuoteFormState,
  t: (value: string) => string
) {
  const lines = [
    t("Abonelik sayfasından kurumsal teklif talebi."),
    "",
    `${t("Düşünülen kullanıcı sayısı")}: ${form.seats}`,
    `${t("Düşünülen ilan kredisi")}: ${form.activeJobs}`,
    `${t("Düşünülen aday değerlendirme kredisi")}: ${form.candidateProcessing}`,
    `${t("Düşünülen AI mülakat")}: ${form.aiInterviews}`
  ];

  if (form.note.trim()) {
    lines.push("");
    lines.push(`${t("Ek not")}: ${form.note.trim()}`);
  }

  return lines.join("\n");
}

function formatCheckoutAccessLabel(
  selfServeReady: boolean,
  trialActive: boolean,
  productionRuntime: boolean,
  locale: "tr" | "en",
  options: { accessAllowed?: boolean; trialEligible?: boolean } = {}
) {
  if (selfServeReady) {
    return locale === "en" ? "Payment ready" : "Ödeme hazır";
  }

  if (options.accessAllowed === false || options.trialEligible === false) {
    return locale === "en" ? "Plan required" : "Plan gerekli";
  }

  if (trialActive) {
    const trialLabel = formatBillingTrialLabel(locale);
    return locale === "en" ? `${trialLabel} active` : `${trialLabel} aktif`;
  }

  if (productionRuntime) {
    return locale === "en" ? "Payment soon" : "Ödeme yakında";
  }

  return locale === "en" ? "Test mode" : "Test modu";
}

export default function SubscriptionPage() {
  const { t, locale } = useUiText();
  const localeTag = getLocaleTag(locale);
  const searchParams = useSearchParams();
  const billingState = searchParams.get("billing");

  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<TenantRuntimeConfigurationReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [activeAddOnQuotaKey, setActiveAddOnQuotaKey] = useState<BillingQuotaKeyWithAddOns | null>(null);
  const [selectedAddOnKey, setSelectedAddOnKey] = useState<
    BillingOverviewReadModel["addOnCatalog"][number]["key"] | null
  >(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [enterpriseForm, setEnterpriseForm] = useState<EnterpriseQuoteFormState>(INITIAL_ENTERPRISE_QUOTE_FORM);
  const [enterpriseError, setEnterpriseError] = useState("");
  const [enterpriseSubmitting, setEnterpriseSubmitting] = useState(false);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [billingResult, runtimeResult] = await Promise.allSettled([
        apiClient.billingOverview(),
        apiClient.getTenantRuntimeConfiguration()
      ]);

      if (billingResult.status === "fulfilled") {
        setBilling(billingResult.value);
      } else {
        setBilling(null);
        setError(toErrorMessage(billingResult.reason, t("Abonelik bilgileri yüklenemedi.")));
      }

      if (runtimeResult.status === "fulfilled") {
        setRuntimeConfig(runtimeResult.value);
      } else {
        setRuntimeConfig(null);
      }
    } catch (loadError) {
      setBilling(null);
      setError(toErrorMessage(loadError, t("Abonelik bilgileri yüklenemedi.")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const billingBoundary = runtimeConfig?.launchBoundaries.billing ?? null;
  const selfServeReady = billingBoundary?.selfServeEnabled ?? billing?.stripeReady ?? false;
  const productionRuntime = runtimeConfig?.runtime.appMode === "production";
  const selfServeBlocked = productionRuntime && !selfServeReady;
  const billingBlockedMessage =
    billing?.access.isAllowed === false && billing.access.blockReason
      ? billing.access.blockReason
      : billing?.trial.isEligible === false && billing.trial.blockReason
        ? billing.trial.blockReason
        : locale === "en"
          ? "Package changes and extra credit purchases will appear here when online payments are enabled."
          : "Paket değişikliği ve ek kredi satın alma adımları çevrimiçi ödeme açıldığında burada görünecek.";

  const activeQuotaAddOns =
    billing?.addOnCatalog.filter((addOn) => addOn.quotaKey === activeAddOnQuotaKey) ?? [];
  const activeUsageQuota =
    billing?.usage.quotas.find((quota) => quota.key === activeAddOnQuotaKey) ?? null;

  useEffect(() => {
    if (!activeAddOnQuotaKey || !billing) {
      setSelectedAddOnKey(null);
      return;
    }

    const nextAddOns = billing.addOnCatalog.filter((addOn) => addOn.quotaKey === activeAddOnQuotaKey);
    setSelectedAddOnKey((current) =>
      current && nextAddOns.some((addOn) => addOn.key === current) ? current : (nextAddOns[0]?.key ?? null)
    );
  }, [activeAddOnQuotaKey, billing]);

  useEffect(() => {
    if (!activeAddOnQuotaKey && !isEnterpriseModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (activeAddOnQuotaKey) {
          setActiveAddOnQuotaKey(null);
        } else {
          setIsEnterpriseModalOpen(false);
          setEnterpriseError("");
        }
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeAddOnQuotaKey, isEnterpriseModalOpen]);

  function handleEnterpriseFieldChange(field: keyof EnterpriseQuoteFormState) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setEnterpriseForm((current) => ({
        ...current,
        [field]: event.target.value
      }));
    };
  }

  function openEnterpriseModal(prefill?: EnterpriseRequestPrefill) {
    setEnterpriseError("");
    setActionNotice("");
    setEnterpriseForm((current) => {
      const preservedIdentity = {
        fullName: current.fullName,
        company: prefill?.company ?? current.company,
        email: current.email || billing?.account.billingEmail || "",
        phone: prefill?.phone ?? current.phone
      };

      return {
        ...INITIAL_ENTERPRISE_QUOTE_FORM,
        ...preservedIdentity,
        seats: prefill?.seats ?? "",
        activeJobs: prefill?.activeJobs ?? "",
        candidateProcessing: prefill?.candidateProcessing ?? "",
        aiInterviews: prefill?.aiInterviews ?? "",
        note: prefill?.note ?? ""
      };
    });
    setIsEnterpriseModalOpen(true);
  }

  function closeEnterpriseModal() {
    setIsEnterpriseModalOpen(false);
    setEnterpriseError("");
  }

  async function handlePlanCheckout(planKey: Exclude<BillingPlanKey, "ENTERPRISE">) {
    if (selfServeBlocked) {
      setError(billingBlockedMessage);
      return;
    }

    setBusyKey(`plan:${planKey}`);
    setError("");
    setActionNotice("");

    try {
      const result = await apiClient.createPlanCheckout({
        planKey,
        billingEmail: billing?.account.billingEmail ?? undefined
      });

      await loadBilling();

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        setActionNotice(
          result.flow === "customer_portal"
            ? t("Abonelik yönetim sayfası yeni sekmede açıldı.")
            : t("Ödeme sayfası yeni sekmede açıldı.")
        );
      } else if (result.flow === "scheduled") {
        setActionNotice(t("Plan değişikliği dönem sonuna planlandı."));
      } else if (planKey === "FLEX") {
        setActionNotice(t("Flex planı aktifleştirildi."));
      } else {
        setActionNotice(t("Plan değişikliği tamamlandı."));
      }
    } catch (checkoutError) {
      setError(toErrorMessage(checkoutError, t("Plan değişikliği başlatılamadı.")));
    } finally {
      setBusyKey("");
    }
  }

  async function handleBillingPortalOpen() {
    if (selfServeBlocked) {
      setError(billingBlockedMessage);
      return;
    }

    setBusyKey("portal");
    setError("");
    setActionNotice("");

    try {
      const result = await apiClient.createBillingCustomerPortal();
      window.open(result.portalUrl, "_blank", "noopener,noreferrer");
      setActionNotice(t("Faturalandırma portalı açıldı."));
    } catch (portalError) {
      setError(toErrorMessage(portalError, t("Müşteri portalı açılamadı.")));
    } finally {
      setBusyKey("");
    }
  }

  async function handleScheduleSubscriptionCancellation() {
    if (selfServeBlocked) {
      setError(billingBlockedMessage);
      return;
    }

    setBusyKey("subscription:cancel");
    setError("");
    setActionNotice("");

    try {
      await apiClient.scheduleBillingSubscriptionCancellation();
      await loadBilling();
      setActionNotice(t("Abonelik dönem sonunda iptal edilecek."));
    } catch (cancelError) {
      setError(toErrorMessage(cancelError, t("Abonelik iptali planlanamadı.")));
    } finally {
      setBusyKey("");
    }
  }

  async function handleResumeScheduledCancellation() {
    if (selfServeBlocked) {
      setError(billingBlockedMessage);
      return;
    }

    setBusyKey("subscription:resume");
    setError("");
    setActionNotice("");

    try {
      await apiClient.resumeBillingSubscriptionCancellation();
      await loadBilling();
      setActionNotice(t("Planlanan abonelik iptali kaldırıldı."));
    } catch (resumeError) {
      setError(toErrorMessage(resumeError, t("Planlanan iptal kaldırılamadı.")));
    } finally {
      setBusyKey("");
    }
  }

  async function handleAddOnCheckout(addOnKey: BillingOverviewReadModel["addOnCatalog"][number]["key"]) {
    if (selfServeBlocked) {
      setError(billingBlockedMessage);
      return false;
    }

    setBusyKey(`addon:${addOnKey}`);
    setError("");
    setActionNotice("");

    try {
      const result = await apiClient.createAddOnCheckout({
        addOnKey,
        billingEmail: billing?.account.billingEmail ?? undefined
      });

      await loadBilling();

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        setActionNotice(t("Ek paket ödeme sayfası yeni sekmede açıldı."));
      } else {
        setActionNotice(
          result.flow === "local_activation"
            ? t("Ek paket bakiyesi hemen hesabınıza tanımlandı.")
            : t("Ek paket satın alma akışı tamamlandı.")
        );
      }
      return true;
    } catch (checkoutError) {
      setError(toErrorMessage(checkoutError, t("Ek paket satın alma akışı başlatılamadı.")));
      return false;
    } finally {
      setBusyKey("");
    }
  }

  async function handleEnterpriseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnterpriseSubmitting(true);
    setEnterpriseError("");
    setError("");
    setActionNotice("");

    try {
      await publicContactApi.submit({
        fullName: enterpriseForm.fullName.trim(),
        email: enterpriseForm.email.trim(),
        company: enterpriseForm.company.trim() || undefined,
        phone: enterpriseForm.phone.trim() || undefined,
        message: buildEnterpriseQuoteMessage(enterpriseForm, t),
        sourcePage: "recruiter-subscription-enterprise-quote",
        landingUrl: typeof window !== "undefined" ? window.location.href : undefined,
        locale
      });

      setEnterpriseForm((current) => ({
        ...INITIAL_ENTERPRISE_QUOTE_FORM,
        email: current.email.trim()
      }));
      setIsEnterpriseModalOpen(false);
      setActionNotice(t("Kurumsal teklif talebiniz alındı."));
    } catch (submitError) {
      setEnterpriseError(
        toErrorMessage(
          submitError,
          t("Kurumsal teklif talebi gönderilemedi.")
        )
      );
    } finally {
      setEnterpriseSubmitting(false);
    }
  }

  async function handleSelectedAddOnCheckout() {
    if (!selectedAddOnKey) {
      return;
    }

    const success = await handleAddOnCheckout(selectedAddOnKey);
    if (success) {
      setActiveAddOnQuotaKey(null);
    }
  }

  if (loading) {
    return (
      <section className="page-grid">
        <section className="panel">
          <LoadingState message={t("Abonelik bilgileri yükleniyor...")} />
        </section>
      </section>
    );
  }

  if (error && !billing) {
    return (
      <section className="page-grid">
        <section className="panel">
          <ErrorState
            error={error}
            actions={
              <button type="button" className="ghost-button" onClick={() => void loadBilling()}>
                {t("Tekrar dene")}
              </button>
            }
          />
        </section>
      </section>
    );
  }

  const currentPlanKeyForUi = billing?.trial.isActive ? null : billing?.account.currentPlanKey ?? null;
  const packageLabel = billing ? formatBillingPlanLabel(billing.account.currentPlanKey, locale) : "";
  const packageSummaryLabel = billing
    ? formatBillingPackageLabel(billing.account.currentPlanKey, locale, { trialActive: billing.trial.isActive })
    : "";
  const summaryDateLabel =
    billing?.trial.isActive
      ? locale === "en"
        ? "Trial ends"
        : "Deneme bitişi"
      : locale === "en"
        ? "Period End"
        : "Dönem Sonu";
  const summaryDateValue = billing
    ? formatDateOnly(billing.trial.isActive && billing.trial.endsAt ? billing.trial.endsAt : billing.account.currentPeriodEnd)
    : "";
  const pendingPlanLabel = billing?.account.pendingChange
    ? formatBillingPlanLabel(billing.account.pendingChange.planKey, locale)
    : "";
  const scheduledCancellationDate = billing?.account.scheduledCancellation
    ? formatDateOnly(billing.account.scheduledCancellation.effectiveAt)
    : "";
  const hasStripeSubscription = Boolean(billing?.account.stripeSubscriptionId);
  const showScheduleCancellationButton = Boolean(
    hasStripeSubscription &&
      !billing?.account.pendingChange &&
      !billing?.account.scheduledCancellation
  );
  const showResumeCancellationButton = Boolean(
    billing?.account.scheduledCancellation?.canResume
  );
  const pageSubtitle =
    locale === "en"
      ? "Track the selected company's trial, package, and usage from one place."
      : "Seçili şirketin denemesini, paketini ve kullanım durumunu tek yerden takip edin.";
  const packageHeading = locale === "en" ? "Package" : "Paket";
  const plansHeading = locale === "en" ? "Packages" : "Paketler";
  const addOnsHeading = locale === "en" ? "Credit Packs" : "Kredi Paketleri";
  const planSectionHint =
    locale === "en"
      ? "Changes apply only to the selected company. Upgrades apply immediately; downgrades are scheduled for the period end."
      : "Değişiklikler yalnızca seçili şirkete uygulanır. Yükseltmeler hemen uygulanır; düşürmeler dönem sonunda planlanır.";
  const trialPlanSectionHint =
    locale === "en"
      ? "Your trial is active. When you are ready, you can move to any package from here."
      : "Denemeniz aktif. Hazır olduğunuzda buradan dilediğiniz pakete geçebilirsiniz.";
  const addOnSectionHint =
    locale === "en"
      ? "Included monthly usage resets every period for this company. Purchased credit packs stay active for 90 days."
      : "Bu şirkete ait aylık kullanım her dönemde sıfırlanır. Satın aldığınız kredi paketleri 90 gün geçerlidir.";
  const enterpriseCta = t("Kurumsal Teklif İste");
  const paymentStatusLabel = formatCheckoutAccessLabel(
    selfServeReady,
    Boolean(billing?.trial.isActive),
    productionRuntime,
    locale,
    {
      accessAllowed: billing?.access.isAllowed,
      trialEligible: billing?.trial.isEligible
    }
  );
  const paymentStatusDescription =
    billing?.access.isAllowed === false && billing.access.blockReason
      ? billing.access.blockReason
      : selfServeReady
      ? locale === "en"
        ? "Plan changes, extra credits, and billing updates are available for this company from this section."
        : "Bu şirkete ait plan değişikliği, ek kredi ve faturalandırma güncellemeleri bu bölümden yönetilir."
      : billingBlockedMessage;
  const trialStatusLabel =
    billing?.trial.isActive
      ? locale === "en"
        ? `Active · ${billing.trial.daysRemaining} days left`
        : `Aktif · ${billing.trial.daysRemaining} gün kaldı`
      : billing?.trial.isExpired
        ? locale === "en"
          ? "Expired"
          : "Sona erdi"
        : locale === "en"
          ? "Not started"
          : "Başlamadı";
  const trialSectionLabel = formatBillingTrialLabel(locale);
  const paymentActionLabel = locale === "en" ? "Payment soon" : "Ödeme yakında";

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide
            guideKey="subscription"
            title={t("Abonelik")}
            subtitle={pageSubtitle}
            style={{ margin: 0 }}
          />
        </div>
      </div>

      {billingState === "success" ? (
        <NoticeBox tone="success" message={t("Ödeme işlemi başarıyla tamamlandı.")} />
      ) : null}
      {billingState === "cancel" ? (
        <NoticeBox tone="danger" message={t("Ödeme akışı iptal edildi.")} />
      ) : null}
      {actionNotice ? <NoticeBox tone="success" message={actionNotice} /> : null}
      {error && billing ? <NoticeBox tone="danger" message={error} /> : null}
      {billing?.warnings.map((warning) => (
        <NoticeBox key={warning} tone="warning" message={warning} />
      ))}

      {!billing ? (
        <section className="panel">
          <EmptyState message={t("Abonelik verisi bulunamadı.")} />
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="subscription-section-head" style={{ marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0 }}>
                  {locale === "en" ? "Payment status" : "Ödeme durumu"}
                </h2>
                <p className="small text-muted" style={{ margin: "6px 0 0" }}>
                  {locale === "en"
                    ? "This billing state belongs only to the currently selected company. Other companies keep their own packages and credits."
                    : "Bu abonelik durumu yalnızca seçili şirkete aittir. Diğer şirketlerin paketleri ve kredileri ayrı kalır."}
                </p>
              </div>
              <StatusBadge
                ready={selfServeReady}
                variant={selfServeReady ? "success" : billing.trial.isActive ? "brand" : productionRuntime ? "muted" : "warning"}
                label={paymentStatusLabel}
              />
            </div>

            <div className="subscription-summary-grid">
              <div className="subscription-summary-item">
                <span>{trialSectionLabel}</span>
                <strong>{trialStatusLabel}</strong>
              </div>
              <div className="subscription-summary-item">
                <span>{locale === "en" ? "Online payment" : "Çevrimiçi ödeme"}</span>
                <strong>{selfServeReady ? t("Açık") : locale === "en" ? "Coming soon" : "Yakında"}</strong>
              </div>
            </div>

            <p className="small text-muted" style={{ marginTop: 14, marginBottom: 0 }}>
              {paymentStatusDescription}
            </p>
          </section>

          <section className="panel subscription-summary-panel">
            <div className="subscription-section-head">
              <h2>{t("Abonelik Özeti")}</h2>
              <div className="subscription-summary-actions">
                {billing.account.stripeCustomerId && selfServeReady ? (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={busyKey === "portal"}
                    onClick={() => void handleBillingPortalOpen()}
                  >
                    {busyKey === "portal"
                      ? t("Hazırlanıyor...")
                      : locale === "en"
                        ? "Manage billing"
                        : "Faturalandırmayı yönet"}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="subscription-summary-grid">
              <div className="subscription-summary-item">
                <span>{packageHeading}</span>
                <strong>{packageSummaryLabel}</strong>
              </div>
              <div className="subscription-summary-item">
                <span>{summaryDateLabel}</span>
                <strong>{summaryDateValue}</strong>
              </div>
              {billing.account.pendingChange ? (
                <div className="subscription-summary-item">
                  <span>{locale === "en" ? "Scheduled Change" : "Planlanan Geçiş"}</span>
                  <strong>
                    {pendingPlanLabel} · {formatDateOnly(billing.account.pendingChange.effectiveAt)}
                  </strong>
                </div>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <div className="tlx-section-header">
              <h3 className="tlx-section-title">
                {locale === "en" ? "Usage for this company" : "Bu şirketin kullanım durumu"}
              </h3>
            </div>

            <div className="tlx-usage-list">
              {billing.usage.quotas.map((quota) => (
                <QuotaRow
                  key={quota.key}
                  quota={quota}
                />
              ))}
              <div className="tlx-usage-period">
                <div className="subscription-period-summary">
                  <span>{t("Dönem sonu")}:</span>
                  <strong>{formatDateOnly(billing.account.currentPeriodEnd)}</strong>
                </div>
                {showResumeCancellationButton || showScheduleCancellationButton ? (
                  <div className="subscription-period-actions">
                    {billing.account.scheduledCancellation ? (
                      <div className="subscription-period-meta">
                        <span>{locale === "en" ? "Scheduled cancellation" : "Planlanan iptal"}</span>
                        <strong>{scheduledCancellationDate}</strong>
                      </div>
                    ) : null}
                    {showResumeCancellationButton ? (
                        <button
                          type="button"
                          className="subscription-danger-button"
                          disabled={busyKey === "subscription:resume" || selfServeBlocked}
                          onClick={() => void handleResumeScheduledCancellation()}
                        >
                        {busyKey === "subscription:resume"
                          ? t("Hazırlanıyor...")
                          : t("İptali geri çek")}
                      </button>
                    ) : showScheduleCancellationButton ? (
                        <button
                          type="button"
                          className="subscription-danger-button"
                          disabled={busyKey === "subscription:cancel" || selfServeBlocked}
                          onClick={() => void handleScheduleSubscriptionCancellation()}
                        >
                        {busyKey === "subscription:cancel"
                          ? t("Hazırlanıyor...")
                          : t("Aboneliği iptal et")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <section>
            <div className="subscription-section-head" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="tlx-section-title">{plansHeading}</h3>
                <p className="small text-muted" style={{ margin: "6px 0 0" }}>
                  {selfServeBlocked
                    ? locale === "en"
                      ? "Your trial is active. Package changes will open here as soon as online payments are available."
                      : "Denemeniz aktif. Çevrimiçi ödeme açıldığında paket değişiklikleri bu bölümden yapılacak."
                    : billing.trial.isActive
                      ? trialPlanSectionHint
                      : planSectionHint}
                </p>
              </div>
            </div>

            <div className="tlx-plan-grid">
              {billing.planCatalog.map((plan) => {
                const actionMode = getPlanActionMode(currentPlanKeyForUi, plan.key);
                const isCurrent = actionMode === "current";
                const planCard = buildBillingPlanCardModel(plan, locale, {
                  enterprisePriceLabel: locale === "en" ? "Contact Us" : "İletişime Geçin"
                });
                return (
                  <article
                    key={plan.key}
                    className={`tlx-plan-card${isCurrent ? " tlx-plan-current" : ""}`}
                  >
                    {isCurrent ? <div className="tlx-plan-current-label">{locale === "en" ? "Current Plan" : "Mevcut Plan"}</div> : null}
                    <div className="tlx-plan-card-head">
                      <div className="tlx-plan-card-name">{planCard.title}</div>
                      <div
                        className={`tlx-plan-card-price${
                          planCard.priceDisplay === "text"
                            ? " tlx-plan-card-price-text"
                            : ""
                        }`}
                      >
                        <strong>{planCard.priceAmount}</strong>
                        {planCard.priceDisplay === "numeric" && planCard.priceSuffix ? (
                          <span>{planCard.priceSuffix}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="tlx-plan-card-features">
                      {planCard.featureList.map((feature) => (
                        <span key={`${plan.key}-${feature}`}>{t(feature)}</span>
                      ))}
                    </div>

                    <div className="tlx-plan-card-action">
                      {plan.key === "ENTERPRISE" ? (
                        <button
                          type="button"
                          className="tlx-plan-btn"
                          onClick={() => openEnterpriseModal()}
                        >
                          {enterpriseCta}
                        </button>
                      ) : actionMode === "current" ? (
                        <span className="tlx-plan-btn tlx-plan-btn-static">
                          {planActionLabel(actionMode, locale)}
                        </span>
                      ) : actionMode === "downgrade" ? (
                        <button
                          type="button"
                          className="tlx-plan-btn"
                          disabled={selfServeBlocked || busyKey === `plan:${plan.key}`}
                          onClick={() => void handlePlanCheckout(plan.key as Exclude<BillingPlanKey, "ENTERPRISE">)}
                        >
                          {selfServeBlocked
                            ? paymentActionLabel
                            : busyKey === `plan:${plan.key}`
                            ? t("Hazırlanıyor...")
                            : planActionLabel(actionMode, locale)}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tlx-plan-btn"
                          disabled={selfServeBlocked || busyKey === `plan:${plan.key}`}
                          onClick={() => void handlePlanCheckout(plan.key as Exclude<BillingPlanKey, "ENTERPRISE">)}
                        >
                          {selfServeBlocked
                            ? paymentActionLabel
                            : busyKey === `plan:${plan.key}`
                            ? t("Hazırlanıyor...")
                            : planActionLabel(actionMode, locale)}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel">
            <div className="subscription-section-head" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="tlx-section-title">{addOnsHeading}</h3>
              </div>
            </div>

            <div className="billing-addon-compact-list">
              {billing.usage.quotas
                .filter((quota) => billing.addOnCatalog.some((addOn) => addOn.quotaKey === quota.key))
                .map((quota) => {
                  return (
                    <article key={quota.key} className="billing-addon-compact-row">
                      <div className="billing-addon-compact-copy">
                        <strong>{t(quota.label)}</strong>
                      </div>

                        <button
                          type="button"
                          className="ghost-button billing-addon-compact-button"
                          disabled={selfServeBlocked}
                          onClick={() => setActiveAddOnQuotaKey(quota.key as BillingQuotaKeyWithAddOns)}
                        >
                        {selfServeBlocked
                          ? paymentActionLabel
                          : locale === "en"
                            ? "Buy add-on"
                            : "Ek paket al"}
                      </button>
                    </article>
                  );
                })}
            </div>
          </section>

          {activeAddOnQuotaKey ? (
            <div
              className="billing-modal-backdrop"
              role="presentation"
              onClick={() => setActiveAddOnQuotaKey(null)}
            >
              <div
                className="billing-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="billing-add-on-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="billing-modal-head">
                  <div>
                    <h3 id="billing-add-on-modal-title">
                      {locale === "en" ? "Buy add-on credits" : "Ek kredi paketi al"}
                    </h3>
                    <p>
                      {activeUsageQuota
                        ? locale === "en"
                          ? `Choose a ready-made pack for ${t(activeUsageQuota.label).toLowerCase()}.`
                          : `${t(activeUsageQuota.label)} için hazır paketlerden birini seçin.`
                        : addOnSectionHint}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="billing-modal-close"
                    onClick={() => setActiveAddOnQuotaKey(null)}
                    aria-label={locale === "en" ? "Close modal" : "Pencereyi kapat"}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>

                <div className="billing-modal-option-list">
                  {activeQuotaAddOns.map((addOn) => (
                    <button
                      type="button"
                      key={addOn.key}
                      className={`billing-modal-option${selectedAddOnKey === addOn.key ? " is-selected" : ""}`}
                      onClick={() => setSelectedAddOnKey(addOn.key)}
                    >
                      <div className="billing-modal-option-copy">
                        <strong>{formatAddOnHeadline(addOn, t)}</strong>
                        <span>{t(addOn.description)}</span>
                      </div>
                      <div className="billing-modal-option-price">{formatAddOnPrice(addOn, localeTag)}</div>
                    </button>
                  ))}
                </div>

                <div className="billing-modal-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setActiveAddOnQuotaKey(null)}
                  >
                    {locale === "en" ? "Cancel" : "Vazgeç"}
                  </button>
                  <button
                    type="button"
                    className="tlx-plan-btn billing-modal-submit"
                    disabled={
                      !selectedAddOnKey ||
                      busyKey === `addon:${selectedAddOnKey}`
                    }
                    onClick={() => void handleSelectedAddOnCheckout()}
                  >
                    {selectedAddOnKey && busyKey === `addon:${selectedAddOnKey}`
                      ? t("Hazırlanıyor...")
                      : locale === "en"
                        ? "Continue to payment"
                        : "Ödemeye geç"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {isEnterpriseModalOpen ? (
            <div
              className="billing-modal-backdrop"
              role="presentation"
              onClick={closeEnterpriseModal}
            >
              <div
                className="billing-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="enterprise-quote-modal-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="billing-modal-head">
                  <div>
                    <h3 id="enterprise-quote-modal-title">
                      {t("Kurumsal Teklif İste")}
                    </h3>
                    <p>
                      {t("Ekibinizi ve kullanım ihtiyacınızı paylaşın, size özel teklif hazırlayalım.")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="billing-modal-close"
                    onClick={closeEnterpriseModal}
                    aria-label={t("Pencereyi kapat")}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>

                {enterpriseError ? (
                  <div className="billing-modal-alert billing-modal-alert-error">
                    {t(enterpriseError)}
                  </div>
                ) : null}

                <form className="billing-modal-form" onSubmit={(event) => void handleEnterpriseSubmit(event)}>
                  <div className="billing-modal-form-grid">
                    <label className="field">
                      <span className="field-label">{t("Ad soyad")}</span>
                      <input
                        type="text"
                        className="input"
                        value={enterpriseForm.fullName}
                        onChange={handleEnterpriseFieldChange("fullName")}
                        placeholder={t("Örn: Ayşe Kaya")}
                        autoComplete="name"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">{t("Şirket adı")}</span>
                      <input
                        type="text"
                        className="input"
                        value={enterpriseForm.company}
                        onChange={handleEnterpriseFieldChange("company")}
                        placeholder={t("Şirket adı")}
                        autoComplete="organization"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">{t("E-posta")}</span>
                      <input
                        type="email"
                        className="input"
                        value={enterpriseForm.email}
                        onChange={handleEnterpriseFieldChange("email")}
                        placeholder="ornek@sirket.com"
                        autoComplete="email"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">{t("Telefon")}</span>
                      <input
                        type="tel"
                        className="input"
                        value={enterpriseForm.phone}
                        onChange={handleEnterpriseFieldChange("phone")}
                        placeholder="+90 5xx xxx xx xx"
                        autoComplete="tel"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">{t("Kullanıcı sayısı")}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="input"
                        value={enterpriseForm.seats}
                        onChange={handleEnterpriseFieldChange("seats")}
                        placeholder="10"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">{t("İlan kredisi")}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="input"
                        value={enterpriseForm.activeJobs}
                        onChange={handleEnterpriseFieldChange("activeJobs")}
                        placeholder="25"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">{t("Aday değerlendirme kredisi")}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="input"
                        value={enterpriseForm.candidateProcessing}
                        onChange={handleEnterpriseFieldChange("candidateProcessing")}
                        placeholder="500"
                        required
                      />
                    </label>

                    <label className="field">
                      <span className="field-label">{t("AI mülakat")}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="input"
                        value={enterpriseForm.aiInterviews}
                        onChange={handleEnterpriseFieldChange("aiInterviews")}
                        placeholder="100"
                        required
                      />
                    </label>

                    <label className="field billing-modal-field-wide">
                      <span className="field-label">{t("Ek not")}</span>
                      <textarea
                        rows={4}
                        className="textarea"
                        value={enterpriseForm.note}
                        onChange={handleEnterpriseFieldChange("note")}
                        placeholder={t("Ekip yapınızı, geçiş takviminizi veya özel ihtiyaçlarınızı kısaca yazın.")}
                      />
                    </label>
                  </div>

                  <div className="billing-modal-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={closeEnterpriseModal}
                    >
                      {t("Vazgeç")}
                    </button>
                    <button
                      type="submit"
                      className="tlx-plan-btn billing-modal-submit"
                      disabled={enterpriseSubmitting}
                    >
                      {enterpriseSubmitting
                        ? t("Hazırlanıyor...")
                        : t("Talebi gönder")}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function quotaUnitLabel(quotaKey: BillingOverviewReadModel["addOnCatalog"][number]["quotaKey"]) {
  switch (quotaKey) {
    case "ACTIVE_JOBS":
      return "ilan kredisi";
    case "CANDIDATE_PROCESSING":
      return "aday değerlendirme kredisi";
    case "AI_INTERVIEWS":
      return "AI mülakat kredisi";
    default:
      return "kredi";
  }
}

function QuotaRow({
  quota
}: {
  quota: BillingOverviewReadModel["usage"]["quotas"][number];
}) {
  const { t } = useUiText();
  const accent =
    quota.warningState === "exceeded"
      ? "var(--risk)"
      : quota.warningState === "warning"
        ? "var(--warn)"
        : "var(--primary)";

  return (
    <div className="tlx-usage-row">
      <div className="tlx-usage-row-label">
        <span style={{ fontWeight: 600 }}>{t(quota.label)}</span>
        {quota.addOn > 0 ? <span className="small text-muted">{t("+ ek paket")}</span> : null}
      </div>
      <div className="tlx-usage-row-bar">
        <div className="tlx-usage-bar-track">
          <div
            className="tlx-usage-bar-fill"
            style={{ width: `${Math.min(100, quota.utilizationPercent)}%`, background: accent }}
          />
        </div>
      </div>
      <div className="tlx-usage-row-value">
        <strong>{quota.used}</strong>/{quota.limit}
      </div>
    </div>
  );
}

function NoticeBox({ message, tone }: { message: string; tone: "success" | "warning" | "danger" }) {
  const { t } = useUiText();
  return (
    <div className={`notice-box notice-${tone}`}>
      <span>{tone === "success" ? "\u2705" : "\u26A0\uFE0F"}</span>
      {t(message)}
    </div>
  );
}

function StatusBadge({
  ready,
  label,
  variant
}: {
  ready: boolean;
  label?: string;
  variant?: "success" | "warning" | "danger" | "muted" | "brand";
}) {
  const { t } = useUiText();
  const text = t(label ?? (ready ? "Hazır" : "Sorunlu"));
  const resolvedVariant = variant ?? (ready ? "success" : "muted");
  return (
    <span className={`status-badge status-${resolvedVariant}`}>
      {text}
    </span>
  );
}
