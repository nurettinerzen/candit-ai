import {
  BILLING_PLAN_CATALOG,
  FREE_TRIAL_DEFINITION,
  type BillingPlanDefinition,
  type BillingPlanKey,
  type BillingTrialDefinition
} from "@ai-interviewer/domain";
import type { SiteLocale } from "./i18n";

type BillingFeaturePlan = Pick<
  BillingPlanDefinition,
  | "key"
  | "seatsIncluded"
  | "activeJobsIncluded"
  | "candidateProcessingIncluded"
  | "aiInterviewsIncluded"
  | "supportLabel"
>;

type BillingPricePlan = Pick<
  BillingPlanDefinition,
  "billingModel" | "monthlyAmountCents" | "recommended"
> & {
  currency: string;
};

type BillingPresentationPlan = BillingFeaturePlan & BillingPricePlan;

export type BillingPlanCardModel = {
  key: BillingPlanKey;
  title: string;
  featureList: string[];
  priceAmount: string;
  priceSuffix: string | null;
  priceDisplay: "numeric" | "text";
  isRecommended: boolean;
};

function formatMarketingPrice(amountCents: number, currency: string, locale: SiteLocale) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "tr-TR", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0
  }).format(amountCents / 100);
}

export const PUBLIC_PRICING_PLAN_ORDER: BillingPlanKey[] = [
  "FLEX",
  "STARTER",
  "GROWTH",
  "ENTERPRISE"
];

export function formatBillingPlanLabel(planKey: BillingPlanKey, locale: SiteLocale) {
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

export function formatBillingTrialPlanLabel(planKey: BillingPlanKey, locale: SiteLocale) {
  const planLabel = formatBillingPlanLabel(planKey, locale);
  return locale === "en" ? `${planLabel} trial` : `${planLabel} denemesi`;
}

export function buildBillingPlanFeatureList(plan: BillingFeaturePlan) {
  if (plan.key === "FLEX") {
    return [
      "1 kullanıcı",
      "İhtiyaca göre ilan kredisi",
      "İhtiyaca göre aday değerlendirme",
      "İhtiyaca göre AI mülakat",
      "CV analizi + fit score",
      "AI rapor + öneri çıktıları",
      "İnsan onaylı karar akışı",
      "Aday ve başvuru takibi",
      "Temel raporlama",
      plan.supportLabel
    ];
  }

  if (plan.key === "ENTERPRISE") {
    return [
      "Özel kullanıcı limiti",
      "Özel ilan kredisi",
      "Özel aday değerlendirme kredisi",
      "Özel AI mülakat kredisi",
      "CV analizi + fit score",
      "AI rapor + öneri çıktıları",
      "İnsan onaylı karar akışı",
      "Aday ve başvuru takibi",
      "Gelişmiş raporlama",
      "Öncelikli destek",
      "Aday havuzu ve süreç panosu",
      "Audit log görünürlüğü",
      "Kuruma özel onboarding + SLA"
    ];
  }

  const basePlanFeatures = [
    `${plan.seatsIncluded} kullanıcı`,
    `${plan.activeJobsIncluded} ilan kredisi`,
    `${plan.candidateProcessingIncluded} aday değerlendirme kredisi`,
    `${plan.aiInterviewsIncluded} AI mülakat kredisi`,
    "CV analizi + fit score",
    "AI rapor + öneri çıktıları",
    "İnsan onaylı karar akışı",
    "Aday ve başvuru takibi",
    plan.key === "GROWTH" ? "Gelişmiş raporlama" : "Temel raporlama",
    plan.supportLabel
  ];

  if (plan.key === "GROWTH") {
    return [
      ...basePlanFeatures,
      "Aday havuzu ve süreç panosu",
      "Audit log görünürlüğü"
    ];
  }

  return basePlanFeatures;
}

export function buildBillingPlanCardModel(
  plan: BillingPresentationPlan,
  locale: SiteLocale,
  options: { enterprisePriceLabel?: string } = {}
): BillingPlanCardModel {
  if (plan.billingModel === "prepaid") {
    return {
      key: plan.key,
      title: formatBillingPlanLabel(plan.key, locale),
      featureList: buildBillingPlanFeatureList(plan),
      priceAmount: locale === "en" ? "Pay as you go" : "Kullandıkça öde",
      priceSuffix: null,
      priceDisplay: "text",
      isRecommended: Boolean(plan.recommended)
    };
  }

  if (plan.monthlyAmountCents === null) {
    return {
      key: plan.key,
      title: formatBillingPlanLabel(plan.key, locale),
      featureList: buildBillingPlanFeatureList(plan),
      priceAmount:
        options.enterprisePriceLabel ??
        (locale === "en" ? "Contact Us" : "İletişime geçin"),
      priceSuffix: null,
      priceDisplay: "text",
      isRecommended: Boolean(plan.recommended)
    };
  }

  return {
    key: plan.key,
    title: formatBillingPlanLabel(plan.key, locale),
    featureList: buildBillingPlanFeatureList(plan),
    priceAmount: formatMarketingPrice(plan.monthlyAmountCents, plan.currency, locale),
    priceSuffix: locale === "en" ? "/mo" : "/ay",
    priceDisplay: "numeric",
    isRecommended: Boolean(plan.recommended)
  };
}

export function buildBillingPlanCatalogCards(
  locale: SiteLocale,
  options: { enterprisePriceLabel?: string } = {}
) {
  return PUBLIC_PRICING_PLAN_ORDER.map((planKey) =>
    buildBillingPlanCardModel(BILLING_PLAN_CATALOG[planKey], locale, options)
  );
}

export function buildBillingTrialSummary(
  trial: BillingTrialDefinition = FREE_TRIAL_DEFINITION,
  locale: SiteLocale = "tr"
) {
  if (locale === "en") {
    return `Test your live workflow with ${trial.activeJobsIncluded} job credit, ${trial.candidateProcessingIncluded} candidate evaluation credits, and ${trial.aiInterviewsIncluded} AI interview credits. No credit card required.`;
  }

  return `${trial.activeJobsIncluded} ilan kredisi, ${trial.candidateProcessingIncluded} aday değerlendirme kredisi ve ${trial.aiInterviewsIncluded} AI mülakat kredisiyle hesabınızı canlı akışta test edin. Kredi kartı gerekmez.`;
}
