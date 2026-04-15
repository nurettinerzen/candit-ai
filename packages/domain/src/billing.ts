export const BILLING_ADDON_ROLLOVER_DAYS = 90;

export const BILLING_PLAN_KEYS = [
  "FLEX",
  "STARTER",
  "GROWTH",
  "ENTERPRISE"
] as const;

export type BillingPlanKey = (typeof BILLING_PLAN_KEYS)[number];

export const BILLING_QUOTA_KEYS = [
  "SEATS",
  "ACTIVE_JOBS",
  "CANDIDATE_PROCESSING",
  "AI_INTERVIEWS"
] as const;

export type BillingQuotaKey = (typeof BILLING_QUOTA_KEYS)[number];

export const BILLING_ADDON_KEYS = [
  "JOB_CREDIT_PACK_1",
  "JOB_CREDIT_PACK_3",
  "CANDIDATE_PROCESSING_PACK_50",
  "CANDIDATE_PROCESSING_PACK_100",
  "INTERVIEW_PACK_10",
  "INTERVIEW_PACK_25"
] as const;

export type BillingAddonKey = (typeof BILLING_ADDON_KEYS)[number];

export type BillingFeatureKey =
  | "advancedReporting"
  | "calendarIntegrations"
  | "brandedCandidateExperience"
  | "customIntegrations";

export type BillingFeatureSet = Record<BillingFeatureKey, boolean>;

export type BillingPlanDefinition = {
  key: BillingPlanKey;
  label: string;
  description: string;
  monthlyAmountCents: number | null;
  currency: "usd" | "try";
  billingModel: "prepaid" | "subscription" | "custom";
  priceLabel?: string;
  seatsIncluded: number;
  activeJobsIncluded: number;
  candidateProcessingIncluded: number;
  aiInterviewsIncluded: number;
  features: BillingFeatureSet;
  supportLabel: string;
  recommended?: boolean;
};

export type BillingTrialDefinition = {
  label: string;
  description: string;
  durationDays: number;
  monthlyAmountCents: number;
  currency: "usd" | "try";
  seatsIncluded: number;
  activeJobsIncluded: number;
  candidateProcessingIncluded: number;
  aiInterviewsIncluded: number;
  features: BillingFeatureSet;
  supportLabel: string;
};

export type BillingAddonDefinition = {
  key: BillingAddonKey;
  label: string;
  description: string;
  amountCents: number;
  currency: "usd" | "try";
  quotaKey?: Exclude<BillingQuotaKey, "SEATS">;
  quantity?: number;
  serviceOnly?: boolean;
};

export const BILLING_PLAN_CATALOG: Record<BillingPlanKey, BillingPlanDefinition> = {
  FLEX: {
    key: "FLEX",
    label: "Flex",
    description:
      "Düzenli işe alımı olmayan ekipler için. 1 kullanıcıyla başlayın, ilan kredisi, aday değerlendirme kredisi ve AI mülakat kredisi satın alarak ilerleyin.",
    monthlyAmountCents: 0,
    currency: "try",
    billingModel: "prepaid",
    priceLabel: "Ön ödemeli kredi",
    seatsIncluded: 1,
    activeJobsIncluded: 0,
    candidateProcessingIncluded: 0,
    aiInterviewsIncluded: 0,
    features: {
      advancedReporting: false,
      calendarIntegrations: false,
      brandedCandidateExperience: false,
      customIntegrations: false
    },
    supportLabel: "E-posta desteği"
  },
  STARTER: {
    key: "STARTER",
    label: "Starter",
    description:
      "Tek recruiter ile düzenli işe alım yapan ekipler için. Düşük hacim, net operasyon ve aylık dahil kullanım.",
    monthlyAmountCents: 449900,
    currency: "try",
    billingModel: "subscription",
    seatsIncluded: 1,
    activeJobsIncluded: 2,
    candidateProcessingIncluded: 100,
    aiInterviewsIncluded: 15,
    features: {
      advancedReporting: false,
      calendarIntegrations: false,
      brandedCandidateExperience: false,
      customIntegrations: false
    },
    supportLabel: "E-posta desteği"
  },
  GROWTH: {
    key: "GROWTH",
    label: "Growth",
    description:
      "Düzenli işe alım yapan küçük ekipler için. Daha fazla hacim, aylık dahil kullanım, takvim entegrasyonu ve raporlama.",
    monthlyAmountCents: 1299900,
    currency: "try",
    billingModel: "subscription",
    seatsIncluded: 2,
    activeJobsIncluded: 10,
    candidateProcessingIncluded: 500,
    aiInterviewsIncluded: 50,
    features: {
      advancedReporting: true,
      calendarIntegrations: true,
      brandedCandidateExperience: false,
      customIntegrations: false
    },
    supportLabel: "Öncelikli destek",
    recommended: true
  },
  ENTERPRISE: {
    key: "ENTERPRISE",
    label: "Kurumsal",
    description:
      "Büyük ekipler için özel kota, markalı aday deneyimi, özel entegrasyon ve SLA.",
    monthlyAmountCents: null,
    currency: "usd",
    billingModel: "custom",
    seatsIncluded: 0,
    activeJobsIncluded: 0,
    candidateProcessingIncluded: 0,
    aiInterviewsIncluded: 0,
    features: {
      advancedReporting: true,
      calendarIntegrations: true,
      brandedCandidateExperience: true,
      customIntegrations: true
    },
    supportLabel: "Özel onboarding + SLA"
  }
};

export const BILLING_ADDON_CATALOG: Record<BillingAddonKey, BillingAddonDefinition> = {
  JOB_CREDIT_PACK_1: {
    key: "JOB_CREDIT_PACK_1",
    label: "İlan Kredisi Paketi 1",
    description: "Satın alma tarihinden itibaren 90 gün geçerli +1 ilan kredisi.",
    amountCents: 149900,
    currency: "try",
    quotaKey: "ACTIVE_JOBS",
    quantity: 1
  },
  JOB_CREDIT_PACK_3: {
    key: "JOB_CREDIT_PACK_3",
    label: "İlan Kredisi Paketi 3",
    description: "Satın alma tarihinden itibaren 90 gün geçerli +3 ilan kredisi.",
    amountCents: 399900,
    currency: "try",
    quotaKey: "ACTIVE_JOBS",
    quantity: 3
  },
  CANDIDATE_PROCESSING_PACK_50: {
    key: "CANDIDATE_PROCESSING_PACK_50",
    label: "Aday Değerlendirme Kredisi 50",
    description:
      "Satın alma tarihinden itibaren 90 gün geçerli +50 aday değerlendirme kredisi.",
    amountCents: 129900,
    currency: "try",
    quotaKey: "CANDIDATE_PROCESSING",
    quantity: 50
  },
  CANDIDATE_PROCESSING_PACK_100: {
    key: "CANDIDATE_PROCESSING_PACK_100",
    label: "Aday Değerlendirme Kredisi 100",
    description:
      "Satın alma tarihinden itibaren 90 gün geçerli +100 aday değerlendirme kredisi.",
    amountCents: 239900,
    currency: "try",
    quotaKey: "CANDIDATE_PROCESSING",
    quantity: 100
  },
  INTERVIEW_PACK_10: {
    key: "INTERVIEW_PACK_10",
    label: "AI Mülakat Kredisi 10",
    description:
      "Satın alma tarihinden itibaren 90 gün geçerli +10 AI mülakat kredisi.",
    amountCents: 149900,
    currency: "try",
    quotaKey: "AI_INTERVIEWS",
    quantity: 10
  },
  INTERVIEW_PACK_25: {
    key: "INTERVIEW_PACK_25",
    label: "AI Mülakat Kredisi 25",
    description:
      "Satın alma tarihinden itibaren 90 gün geçerli +25 AI mülakat kredisi.",
    amountCents: 329900,
    currency: "try",
    quotaKey: "AI_INTERVIEWS",
    quantity: 25
  }
};

export const FREE_TRIAL_DEFINITION: BillingTrialDefinition = {
  label: "Ücretsiz Deneme",
  description:
    "14 gün boyunca 1 ilan kredisi, aday değerlendirme ve AI mülakat akışını deneyin. Kredi kartı gerekmez.",
  durationDays: 14,
  monthlyAmountCents: 0,
  currency: "try",
  seatsIncluded: 1,
  activeJobsIncluded: 1,
  candidateProcessingIncluded: 25,
  aiInterviewsIncluded: 3,
  features: {
    advancedReporting: false,
    calendarIntegrations: true,
    brandedCandidateExperience: false,
    customIntegrations: false
  },
  supportLabel: "E-posta desteği"
};

export function buildPlanSnapshot(plan: BillingPlanDefinition) {
  return {
    seatsIncluded: plan.seatsIncluded,
    activeJobsIncluded: plan.activeJobsIncluded,
    candidateProcessingIncluded: plan.candidateProcessingIncluded,
    aiInterviewsIncluded: plan.aiInterviewsIncluded,
    features: plan.features,
    supportLabel: plan.supportLabel
  };
}

export function buildTrialSnapshot(trial = FREE_TRIAL_DEFINITION) {
  return {
    seatsIncluded: trial.seatsIncluded,
    activeJobsIncluded: trial.activeJobsIncluded,
    candidateProcessingIncluded: trial.candidateProcessingIncluded,
    aiInterviewsIncluded: trial.aiInterviewsIncluded,
    features: trial.features,
    supportLabel: trial.supportLabel
  };
}
