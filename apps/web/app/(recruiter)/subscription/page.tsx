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

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatPlanPrice(amountCents: number | null, currency: string, localeTag: string) {
  if (amountCents === null) {
    return localeTag.startsWith("en") ? "Custom pricing" : "Özel teklif";
  }

  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(amountCents / 100);
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
    return planKey === "STARTER" ? "Starter" : planKey === "GROWTH" ? "Growth" : "Enterprise";
  }

  return planKey === "STARTER" ? "Starter" : planKey === "GROWTH" ? "Growth" : "Kurumsal";
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
  if (options?.trialContext) {
    return locale === "en"
      ? nextPlanKey === "GROWTH"
        ? "Switch to Growth"
        : "Switch to Starter"
      : nextPlanKey === "GROWTH"
        ? "Growth Pakete Geç"
        : "Starter Pakete Geç";
  }

  if (currentPlanKey === nextPlanKey) {
    return locale === "en" ? "Current Plan" : "Mevcut Plan";
  }

  return locale === "en"
    ? nextPlanKey === "GROWTH"
      ? "Switch to Growth"
      : "Switch to Starter"
    : nextPlanKey === "GROWTH"
      ? "Growth'a Geç"
      : "Starter'a Dön";
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
      }

      setActionNotice(t("Stripe ödeme sayfası yeni sekmede açıldı."));
    } catch (checkoutError) {
      setError(toErrorMessage(checkoutError, t("Plan değişikliği başlatılamadı.")));
    } finally {
      setBusyKey("");
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
  const planSectionHint = hasTrialContext
    ? locale === "en"
      ? "You can switch directly to a paid package during the trial."
      : "Deneme sırasında isterseniz doğrudan ücretli pakete geçebilirsiniz."
    : locale === "en"
      ? "You can upgrade or downgrade your package based on your needs."
      : "İhtiyacınıza göre paketinizi yükseltebilir veya düşürebilirsiniz.";
  const enterpriseCta = locale === "en" ? "Request Enterprise Quote" : "Kurumsal Teklif İste";

  return (
    <section className="page-grid">
      <div className="page-header page-header-plain">
        <div className="page-header-copy">
          <PageTitleWithGuide guideKey="subscription" title={t("Abonelik")} />
          <p>{pageSubtitle}</p>
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
                <QuotaRow key={quota.key} quota={quota} />
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
                return (
                  <article
                    key={plan.key}
                    className={`tlx-plan-card${isCurrent ? " tlx-plan-current" : ""}`}
                  >
                    {isCurrent ? <div className="tlx-plan-current-label">{t("Mevcut Plan")}</div> : null}
                    <div className="tlx-plan-card-head">
                      <div className="tlx-plan-card-name">{t(plan.label)}</div>
                      <div className="tlx-plan-card-price">
                        <strong>{formatPlanPrice(plan.monthlyAmountCents, plan.currency, localeTag)}</strong>
                        {plan.monthlyAmountCents !== null ? <span> /{locale === "en" ? "mo" : "ay"}</span> : null}
                      </div>
                      {plan.description ? (
                        <div className="small text-muted" style={{ marginTop: 4 }}>{t(plan.description)}</div>
                      ) : null}
                    </div>

                    <div className="tlx-plan-card-features">
                      <span>{plan.seatsIncluded || t("Özel")} {t("kullanıcı")}</span>
                      <span>{plan.activeJobsIncluded || t("Özel")} {t("aktif ilan")}</span>
                      <span>{plan.candidateProcessingIncluded || t("Özel")} {t("aday işleme")}</span>
                      <span>{plan.aiInterviewsIncluded || t("Özel")} {t("AI mülakat")}</span>
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
                          disabled={!billing.stripeReady || isCurrent || busyKey === `plan:${plan.key}`}
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
        </>
      )}
    </section>
  );
}

function QuotaRow({
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
