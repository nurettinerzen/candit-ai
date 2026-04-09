"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui-states";
import { useUiText } from "../../../components/site-language-provider";
import { apiClient } from "../../../lib/api-client";
import { formatDate } from "../../../lib/format";
import { getLocaleTag } from "../../../lib/i18n";
import type {
  BillingAddonKey,
  BillingOverviewReadModel,
  BillingPlanKey
} from "../../../lib/types";

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

function planActionLabel(
  currentPlanKey: BillingPlanKey,
  nextPlanKey: Exclude<BillingPlanKey, "ENTERPRISE">,
  options?: {
    trialContext?: boolean;
  }
) {
  if (options?.trialContext) {
    return nextPlanKey === "GROWTH" ? "Growth'a geç" : "Starter'a geç";
  }

  if (currentPlanKey === nextPlanKey) {
    return "Mevcut Plan";
  }

  return nextPlanKey === "GROWTH" ? "Growth'a geç" : "Starter'a dön";
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

  async function handleAddOnCheckout(addOnKey: BillingAddonKey) {
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
      }

      setActionNotice(t("Ek paket ödeme sayfası yeni sekmede açıldı."));
    } catch (checkoutError) {
      setError(toErrorMessage(checkoutError, t("Ek paket satın alma akışı başlatılamadı.")));
    } finally {
      setBusyKey("");
    }
  }

  async function handleCustomerPortal() {
    setBusyKey("portal");
    setError("");
    setActionNotice("");

    try {
      const result = await apiClient.createBillingCustomerPortal();
      window.open(result.portalUrl, "_blank", "noopener,noreferrer");
      setActionNotice(t("Fatura ve ödeme yönetimi yeni sekmede açıldı."));
    } catch (portalError) {
      setError(toErrorMessage(portalError, t("Müşteri portalı açılamadı.")));
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
  const planCycleLabel = billing?.trial.isActive
    ? t("Deneme")
    : billing?.trial.isExpired
      ? t("Süresi doldu")
      : billing && !billing.trial.isEligible
        ? t("Yükseltme gerekli")
        : t("Aylık");
  const periodLabel = billing?.trial.isActive
    ? t("Deneme Bitişi")
    : billing?.trial.isExpired
      ? t("Deneme Durumu")
      : billing && !billing.trial.isEligible
        ? t("Hesap Durumu")
        : t("Sonraki Fatura");
  const periodValue = billing?.trial.isActive
    ? formatDate(billing.trial.endsAt ?? billing.account.currentPeriodEnd)
    : billing?.trial.isExpired
      ? t("Deneme süresi doldu")
      : billing && !billing.trial.isEligible
        ? t("Ücretli plan seçin")
        : billing
          ? formatDate(billing.account.currentPeriodEnd)
          : "";

  return (
    <section className="page-grid">
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1>{t("Abonelik")}</h1>
            <p>
              {t("Mevcut planınızı, kullanım durumunuzu ve ek paket satın alma akışlarını tek merkezden yönetin.")}
            </p>
          </div>
          <button type="button" className="btn-primary-sm" onClick={() => void loadBilling()}>
            {t("Yenile")}
          </button>
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
          {!billing.stripeReady ? (
            <NoticeBox
              tone="danger"
              message={t("Stripe kurulumu tamamlanmadığı için self servis satın alma işlemleri şu an pasif durumda.")}
            />
          ) : null}

          {/* ── Plan info strip ── */}
          <div className="tlx-plan-strip">
            <span className="tlx-plan-strip-name">{t(billing.currentPlan.label)}</span>
            <span className="tlx-plan-strip-sep">{"\u00B7"}</span>
            <span>{t("Aylık Maliyet")}: <strong>{formatPlanPrice(billing.currentPlan.monthlyAmountCents, billing.currentPlan.currency, localeTag)}</strong></span>
            <span className="tlx-plan-strip-sep">{"\u00B7"}</span>
            <span>{t("Faturalandırma")}: <strong>{planCycleLabel}</strong></span>
            <span className="tlx-plan-strip-sep">{"\u00B7"}</span>
            <span>{periodLabel}: <strong>{periodValue}</strong></span>
            <div className="tlx-plan-strip-actions">
              <button
                type="button"
                className="ghost-button"
                disabled={!billing.account.stripeCustomerId || busyKey === "portal"}
                onClick={() => void handleCustomerPortal()}
              >
                {busyKey === "portal" ? t("Açılıyor...") : t("Faturaları yönet")}
              </button>
              {billing.viewer.isInternalBillingAdmin ? (
                <Link href={"/admin" as Route} className="ghost-button">
                  {t("Admin")}
                </Link>
              ) : null}
            </div>
          </div>

          {billing.warnings.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {billing.warnings.map((warning) => (
                <div key={warning} className="billing-warning-row">
                  {t(warning)}
                </div>
              ))}
            </div>
          ) : null}

          {/* ── Candit-style usage section ── */}
          <section className="panel">
            <div className="tlx-section-header">
              <h3 className="tlx-section-title">{t("Kullanım Durumu")}</h3>
              <span className="tlx-plan-strip-name">{t(billing.currentPlan.label)}</span>
            </div>

            <div className="tlx-usage-list">
              {billing.usage.quotas.map((quota) => (
                <QuotaRow key={quota.key} quota={quota} />
              ))}
              <div className="tlx-usage-period">
                <span>{billing.trial.isActive ? t("Deneme sonu") : t("Dönem sonu")}:</span>
                <strong>
                  {billing.trial.isActive
                    ? formatDate(billing.trial.endsAt ?? billing.account.currentPeriodEnd)
                    : formatDate(billing.account.currentPeriodEnd)}
                </strong>
              </div>
            </div>
          </section>

          {/* ── Candit-style addon section ── */}
          <section className="panel">
            <h3 className="tlx-section-title">{t("Ek Paket Satın Al")}</h3>
            <p className="small text-muted" style={{ margin: "-4px 0 16px" }}>
              {hasTrialContext
                ? t("Ek paketler ücretli abonelik başladıktan sonra açılır.")
                : t("Dahil kullanımınız bittiğinde ek paketler devreye girer.")}
            </p>

            <div className="tlx-addon-grid">
              {billing.addOnCatalog.map((addon) => (
                <div key={addon.key} className="tlx-addon-item">
                  <div className="tlx-addon-item-info">
                    <strong>{t(addon.label)}</strong>
                    <span className="text-muted">{formatPlanPrice(addon.amountCents, addon.currency, localeTag)}</span>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={hasTrialContext || !billing.stripeReady || busyKey === `addon:${addon.key}`}
                    onClick={() => void handleAddOnCheckout(addon.key)}
                  >
                    {busyKey === `addon:${addon.key}` ? t("...") : t("Satın Al")}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ── Candit-style plan cards ── */}
          <section>
            <h3 className="tlx-section-title" style={{ marginBottom: 16 }}>{t("Planlar")}</h3>

            <div className="tlx-plan-grid">
              {billing.planCatalog.map((plan) => {
                const isCurrent = !hasTrialContext && plan.key === billing.account.currentPlanKey;
                const isTrialStarter = hasTrialContext && plan.key === "STARTER";
                return (
                  <article
                    key={plan.key}
                    className={`tlx-plan-card${isCurrent ? " tlx-plan-current" : ""}`}
                  >
                    {isCurrent ? <div className="tlx-plan-current-label">{t("Mevcut Plan")}</div> : null}
                    {isTrialStarter ? <div className="tlx-plan-current-label">{t("Deneme Planı")}</div> : null}
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
                        billing.viewer.isInternalBillingAdmin ? (
                          <Link href={"/admin#kurumsal" as Route} className="tlx-plan-btn">
                            {t("İç teklif akışını aç")}
                          </Link>
                        ) : (
                          <button type="button" className="tlx-plan-btn" disabled>
                            {t("Bize Ulaşın")}
                          </button>
                        )
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
                              : t(
                                  planActionLabel(
                                    billing.account.currentPlanKey,
                                    plan.key as Exclude<BillingPlanKey, "ENTERPRISE">,
                                    { trialContext: hasTrialContext }
                                  )
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
