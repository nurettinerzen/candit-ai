export type BillingPlanDefinition = {
  key: "STARTER" | "GROWTH" | "ENTERPRISE";
  label: string;
  description: string;
  monthlyAmountCents: number | null;
  currency: "usd";
  seatsIncluded: number;
  activeJobsIncluded: number;
  candidateProcessingIncluded: number;
  aiInterviewsIncluded: number;
  features: {
    advancedReporting: boolean;
    calendarIntegrations: boolean;
    brandedCandidateExperience: boolean;
    customIntegrations: boolean;
  };
  supportLabel: string;
  recommended?: boolean;
};

export type BillingTrialDefinition = {
  label: string;
  description: string;
  durationDays: number;
  monthlyAmountCents: number;
  currency: "usd";
  seatsIncluded: number;
  activeJobsIncluded: number;
  candidateProcessingIncluded: number;
  aiInterviewsIncluded: number;
  features: BillingPlanDefinition["features"];
  supportLabel: string;
};

export type BillingAddonDefinition = {
  key:
    | "INTERVIEW_PACK_25"
    | "CANDIDATE_PROCESSING_PACK_100"
    | "PROFESSIONAL_ONBOARDING"
    | "CUSTOM_INTEGRATION_SETUP";
  label: string;
  description: string;
  amountCents: number;
  currency: "usd";
  quotaKey?: "AI_INTERVIEWS" | "CANDIDATE_PROCESSING";
  quantity?: number;
  serviceOnly?: boolean;
};

export const BILLING_PLAN_CATALOG: Record<
  BillingPlanDefinition["key"],
  BillingPlanDefinition
> = {
  STARTER: {
    key: "STARTER",
    label: "Starter",
    description:
      "Küçük ekipler ve düşük hacim için. Az sayıda aktif ilan ve temel recruiter operasyonu.",
    monthlyAmountCents: 14900,
    currency: "usd",
    seatsIncluded: 3,
    activeJobsIncluded: 3,
    candidateProcessingIncluded: 150,
    aiInterviewsIncluded: 30,
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
      "Asıl satış paketi. Daha yüksek hacim, AI interview kapasitesi ve takvim entegrasyonları.",
    monthlyAmountCents: 49900,
    currency: "usd",
    seatsIncluded: 8,
    activeJobsIncluded: 10,
    candidateProcessingIncluded: 500,
    aiInterviewsIncluded: 100,
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
    label: "Enterprise",
    description:
      "Büyük ekipler için özel kota, branded candidate experience, özel entegrasyon ve SLA.",
    monthlyAmountCents: null,
    currency: "usd",
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

export const BILLING_ADDON_CATALOG: Record<
  BillingAddonDefinition["key"],
  BillingAddonDefinition
> = {
  INTERVIEW_PACK_25: {
    key: "INTERVIEW_PACK_25",
    label: "Ek AI mülakat paketi",
    description: "Mevcut dönem için +25 AI mülakat hakkı.",
    amountCents: 7900,
    currency: "usd",
    quotaKey: "AI_INTERVIEWS",
    quantity: 25
  },
  CANDIDATE_PROCESSING_PACK_100: {
    key: "CANDIDATE_PROCESSING_PACK_100",
    label: "Ek Aday İşleme Paketi",
    description: "Mevcut dönem için +100 aday işleme hakkı.",
    amountCents: 5900,
    currency: "usd",
    quotaKey: "CANDIDATE_PROCESSING",
    quantity: 100
  },
  PROFESSIONAL_ONBOARDING: {
    key: "PROFESSIONAL_ONBOARDING",
    label: "Profesyonel Kurulum / Onboarding",
    description: "Kurulum desteği, süreç tasarımı ve ekip onboarding hizmeti.",
    amountCents: 24900,
    currency: "usd",
    serviceOnly: true
  },
  CUSTOM_INTEGRATION_SETUP: {
    key: "CUSTOM_INTEGRATION_SETUP",
    label: "Özel Entegrasyon Kurulumu",
    description: "Özel entegrasyon kurulumu ve teknik uyarlama hizmeti.",
    amountCents: 149900,
    currency: "usd",
    serviceOnly: true
  }
};

export const FREE_TRIAL_DEFINITION: BillingTrialDefinition = {
  label: "Ücretsiz Deneme",
  description:
    "14 gün boyunca tek ilan üzerinde screening ve AI mülakat akışını deneyin. Kredi kartı gerekmez.",
  durationDays: 14,
  monthlyAmountCents: 0,
  currency: "usd",
  seatsIncluded: 2,
  activeJobsIncluded: 1,
  candidateProcessingIncluded: 50,
  aiInterviewsIncluded: 5,
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
