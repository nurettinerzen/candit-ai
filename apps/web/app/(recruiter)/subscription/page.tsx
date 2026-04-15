"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageTitleWithGuide } from "../../../components/page-guide";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import { formatDateOnly } from "../../../lib/format";
import { getLocaleTag } from "../../../lib/i18n";
import type { BillingOverviewReadModel, BillingPlanKey } from "../../../lib/types";

type BillingQuotaKeyWithAddOns = Exclude<
  BillingOverviewReadModel["addOnCatalog"][number]["quotaKey"],
  undefined | null
>;

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

function formatPlanPrice(
  plan: BillingOverviewReadModel["planCatalog"][number],
  localeTag: string
) {
  if (plan.billingModel === "prepaid") {
    return localeTag.startsWith("en") ? "Pay as you go" : "Kullandıkça öde";
  }

  if (plan.monthlyAmountCents === null) {
    return localeTag.startsWith("en") ? "Custom quote" : "Özel teklif";
  }

  return formatMoney(plan.monthlyAmountCents, plan.currency, localeTag);
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

function formatBillingStatus(status: string) {
  switch (status) {
    case "TRIALING":
      return "Deneme";
    case "ACTIVE":
      return "Aktif";
    case "PAST_DUE":
      return "Ödeme gecikti";
    case "INCOMPLETE":
      return "Eksik kurulum";
    case "CANCELED":
      return "İptal";
    default:
      return status;
  }
}

function formatPackageLabel(planKey: BillingPlanKey, locale: "tr" | "en") {
  if (locale === "en") {
    return planKey === "FLEX"
      ? "Flex"
      : planKey === "STARTER"
        ? "Starter"
        : planKey === "GROWTH"
          ? "Growth"
          : "Enterprise";
  }

  return planKey === "FLEX"
    ? "Esnek"
    : planKey === "STARTER"
      ? "Başlangıç"
      : planKey === "GROWTH"
        ? "Büyüme"
        : "Kurumsal";
}

function formatLifecycleLabel(
  billing: BillingOverviewReadModel,
  t: (value: string) => string,
  locale: "tr" | "en"
) {
  if (billing.trial.isActive) {
    return locale === "en" ? "Active Trial" : "Aktif Deneme";
  }

  if (billing.trial.isExpired) {
    return locale === "en" ? "Trial Ended" : "Deneme Süresi Bitti";
  }

  if (!billing.trial.isEligible) {
    return locale === "en" ? "Upgrade Required" : "Yükseltme Gerekli";
  }

  return t(formatBillingStatus(billing.account.status));
}

function planActionLabel(
  currentPlanKey: BillingPlanKey,
  nextPlanKey: Exclude<BillingPlanKey, "ENTERPRISE">,
  locale: "tr" | "en",
  options?: {
    trialContext?: boolean;
  }
) {
  const targetLabel = formatPackageLabel(nextPlanKey, locale);

  if (options?.trialContext) {
    return locale === "en" ? `Switch to ${targetLabel}` : `${targetLabel} Pakete Geç`;
  }

  if (currentPlanKey === nextPlanKey) {
    return locale === "en" ? "Current Plan" : "Mevcut Plan";
  }

  if (locale === "en") {
    return `Switch to ${targetLabel}`;
  }

  return nextPlanKey === "FLEX"
    ? "Esnek Pakete Geç"
    : nextPlanKey === "GROWTH"
      ? "Büyüme Paketine Geç"
      : "Başlangıç Paketine Dön";
}

export default function SubscriptionPage() {
  const { t, locale } = useUiText();
  const localeTag = getLocaleTag(locale);
  const searchParams = useSearchParams();
  const billingState = searchParams.get("billing");

  const [billing, setBilling] = useState<BillingOverviewReadModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [activeAddOnQuotaKey, setActiveAddOnQuotaKey] = useState<BillingQuotaKeyWithAddOns | null>(null);
  const [selectedAddOnKey, setSelectedAddOnKey] = useState<
    BillingOverviewReadModel["addOnCatalog"][number]["key"] | null
  >(null);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const overview = await apiClient.billingOverview();
      setBilling(overview);
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
    if (!activeAddOnQuotaKey) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveAddOnQuotaKey(null);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeAddOnQuotaKey]);

  async function handlePlanCheckout(planKey: Exclude<BillingPlanKey, "ENTERPRISE">) {
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
        setActionNotice(t("Stripe ödeme sayfası yeni sekmede açıldı."));
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

  async function handleAddOnCheckout(addOnKey: BillingOverviewReadModel["addOnCatalog"][number]["key"]) {
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
        setActionNotice(t("Ek paket satın alma akışı tamamlandı."));
      }
      return true;
    } catch (checkoutError) {
      setError(toErrorMessage(checkoutError, t("Ek paket satın alma akışı başlatılamadı.")));
      return false;
    } finally {
      setBusyKey("");
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

  const hasTrialContext = billing
    ? billing.trial.isActive || billing.trial.isExpired || !billing.trial.isEligible
    : false;
  const packageLabel = billing ? formatPackageLabel(billing.account.currentPlanKey, locale) : "";
  const lifecycleLabel = billing ? formatLifecycleLabel(billing, t, locale) : "";
  const summaryDateLabel = billing?.trial.isActive || billing?.trial.isExpired ? t("Deneme Bitişi") : t("Sonraki Fatura");
  const summaryDateValue = billing
    ? formatDateOnly(billing.trial.endsAt ?? billing.account.currentPeriodEnd)
    : "";
  const pageSubtitle =
    locale === "en"
      ? "Track your package and usage from one place."
      : "Paketinizi ve kullanım durumunuzu tek yerden takip edin.";
  const packageHeading = locale === "en" ? "Package" : "Paket";
  const lifecycleHeading = locale === "en" ? "Lifecycle" : "Yaşam Döngüsü";
  const plansHeading = locale === "en" ? "Packages" : "Paketler";
  const addOnsHeading = locale === "en" ? "Credit Packs" : "Kredi Paketleri";
  const planSectionHint = hasTrialContext
    ? locale === "en"
      ? "You can switch directly to a paid package during the trial."
      : "Deneme sırasında isterseniz doğrudan ücretli pakete geçebilirsiniz."
    : locale === "en"
      ? "You can upgrade or downgrade your package based on your needs."
      : "İhtiyacınıza göre paketinizi yükseltebilir veya düşürebilirsiniz.";
  const addOnSectionHint =
    locale === "en"
      ? "Included monthly usage resets every period. Purchased credit packs stay active for 90 days."
      : "Paket içindeki aylık kullanım her dönemde sıfırlanır. Satın aldığınız kredi paketleri 90 gün geçerlidir.";
  const enterpriseCta = locale === "en" ? "Request Enterprise Quote" : "Kurumsal Teklif İste";

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

      {!billing ? (
        <section className="panel">
          <EmptyState message={t("Abonelik verisi bulunamadı.")} />
        </section>
      ) : (
        <>
          <section className="panel subscription-summary-panel">
            <div className="subscription-section-head">
              <h2>{t("Abonelik Özeti")}</h2>
              {hasTrialContext ? <span className="subscription-summary-badge">{lifecycleLabel}</span> : null}
            </div>
            <div className="subscription-summary-grid">
              <div className="subscription-summary-item">
                <span>{packageHeading}</span>
                <strong>{packageLabel}</strong>
              </div>
              <div className="subscription-summary-item">
                <span>{lifecycleHeading}</span>
                <strong>{lifecycleLabel}</strong>
              </div>
              <div className="subscription-summary-item">
                <span>{summaryDateLabel}</span>
                <strong>{summaryDateValue}</strong>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="tlx-section-header">
                <h3 className="tlx-section-title">{t("Kullanım Durumu")}</h3>
                <span className="tlx-plan-strip-name">{packageLabel}</span>
              </div>

            <div className="tlx-usage-list">
              {billing.usage.quotas.map((quota) => (
                <QuotaRow
                  key={quota.key}
                  quota={quota}
                  canBuyAddOn={billing.addOnCatalog.some((addOn) => addOn.quotaKey === quota.key)}
                  onOpenAddOn={() => setActiveAddOnQuotaKey(quota.key as BillingQuotaKeyWithAddOns)}
                />
              ))}
              <div className="tlx-usage-period">
                <span>{billing.trial.isActive ? t("Deneme sonu") : t("Dönem sonu")}:</span>
                <strong>{formatDateOnly(billing.trial.endsAt ?? billing.account.currentPeriodEnd)}</strong>
              </div>
            </div>
          </section>

          <section>
            <div className="subscription-section-head" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="tlx-section-title">{plansHeading}</h3>
                <p className="small text-muted" style={{ margin: "6px 0 0" }}>{planSectionHint}</p>
              </div>
            </div>

            <div className="tlx-plan-grid">
              {billing.planCatalog.map((plan) => {
                const isCurrent = !hasTrialContext && plan.key === billing.account.currentPlanKey;
                const planName = formatPackageLabel(plan.key, locale);
                return (
                  <article
                    key={plan.key}
                    className={`tlx-plan-card${isCurrent ? " tlx-plan-current" : ""}`}
                  >
                    {isCurrent ? <div className="tlx-plan-current-label">{t("Mevcut Plan")}</div> : null}
                    <div className="tlx-plan-card-head">
                      <div className="tlx-plan-card-name">{planName}</div>
                      <div
                        className={`tlx-plan-card-price${
                          plan.billingModel !== "subscription" || plan.monthlyAmountCents === null
                            ? " tlx-plan-card-price-text"
                            : ""
                        }`}
                      >
                        <strong>{formatPlanPrice(plan, localeTag)}</strong>
                        {plan.billingModel === "subscription" && plan.monthlyAmountCents !== null ? (
                          <span> /{locale === "en" ? "mo" : "ay"}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="tlx-plan-card-features">
                      <span>{plan.seatsIncluded || t("Özel")} {t("kullanıcı")}</span>
                      <span>{plan.activeJobsIncluded || t("Özel")} {t("ilan kredisi")}</span>
                      <span>{plan.candidateProcessingIncluded || t("Özel")} {t("aday değerlendirme kredisi")}</span>
                      <span>{plan.aiInterviewsIncluded || t("Özel")} {t("AI mülakat kredisi")}</span>
                      <span>{plan.features.calendarIntegrations ? t("Takvim entegrasyonları") : t("Takvim entegrasyonu yok")}</span>
                      <span>{plan.features.advancedReporting ? t("Gelişmiş raporlama") : t("Temel raporlama")}</span>
                      <span>{t(plan.supportLabel)}</span>
                    </div>

                    <div className="tlx-plan-card-action">
                      {plan.key === "ENTERPRISE" ? (
                        <Link href={"/contact" as Route} className="tlx-plan-btn">
                          {enterpriseCta}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="tlx-plan-btn"
                          disabled={
                            (plan.billingModel !== "prepaid" && !billing.stripeReady) ||
                            isCurrent ||
                            busyKey === `plan:${plan.key}`
                          }
                          onClick={() => void handlePlanCheckout(plan.key as Exclude<BillingPlanKey, "ENTERPRISE">)}
                        >
                          {busyKey === `plan:${plan.key}`
                            ? t("Hazırlanıyor...")
                            : isCurrent
                              ? t("Mevcut Plan")
                              : planActionLabel(
                                  billing.account.currentPlanKey,
                                  plan.key as Exclude<BillingPlanKey, "ENTERPRISE">,
                                  locale,
                                  { trialContext: hasTrialContext }
                                )}
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
                <p className="small text-muted" style={{ margin: "6px 0 0" }}>
                  {locale === "en"
                    ? "Open a relevant pack directly from the usage row or pick one of the compact options below."
                    : "İlgili paketi kullanım satırından açabilir veya aşağıdaki kompakt seçeneklerden seçebilirsiniz."}
                </p>
              </div>
            </div>

            <div className="billing-addon-compact-list">
              {billing.usage.quotas
                .filter((quota) => billing.addOnCatalog.some((addOn) => addOn.quotaKey === quota.key))
                .map((quota) => {
                  const addOns = billing.addOnCatalog.filter((addOn) => addOn.quotaKey === quota.key);
                  const summary = addOns
                    .map((addOn) => formatAddOnHeadline(addOn, t))
                    .join(locale === "en" ? " or " : " veya ");

                  return (
                    <article key={quota.key} className="billing-addon-compact-row">
                      <div className="billing-addon-compact-copy">
                        <strong>{t(quota.label)}</strong>
                        <span>
                          {summary} •{" "}
                          {addOns
                            .map((addOn) => formatAddOnPrice(addOn, localeTag))
                            .join(" / ")}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="ghost-button billing-addon-compact-button"
                        onClick={() => setActiveAddOnQuotaKey(quota.key as BillingQuotaKeyWithAddOns)}
                      >
                        {locale === "en" ? "Buy add-on" : "Ek paket al"}
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
                    ×
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

                <div className="billing-modal-footnote">
                  {locale === "en"
                    ? "Dynamic custom quantity is not enabled yet, so checkout uses the ready-made packs above."
                    : "Dinamik adet girişi henüz açık değil; ödeme akışı yukarıdaki hazır paketlerle çalışıyor."}
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
                      !billing.stripeReady ||
                      !selectedAddOnKey ||
                      busyKey === selectedAddOnKey ||
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
  quota,
  canBuyAddOn,
  onOpenAddOn
}: {
  quota: BillingOverviewReadModel["usage"]["quotas"][number];
  canBuyAddOn: boolean;
  onOpenAddOn: () => void;
}) {
  const { t } = useUiText();
  const accent =
    quota.warningState === "exceeded"
      ? "var(--danger, #ef4444)"
      : quota.warningState === "warning"
        ? "var(--warn, #f59e0b)"
        : "var(--primary, #5046e5)";

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
      {canBuyAddOn ? (
        <div className="tlx-usage-row-action">
          <button type="button" className="ghost-button tlx-usage-buy-button" onClick={onOpenAddOn}>
            {t("Ek paket al")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NoticeBox({ message, tone }: { message: string; tone: "success" | "danger" }) {
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
  variant?: "success" | "warning" | "danger" | "muted";
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
