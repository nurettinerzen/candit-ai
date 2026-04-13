export type BillingPlanDefinition = {
  key: "STARTER" | "GROWTH" | "ENTERPRISE";
  label: string;
  description: string;
  monthlyAmountCents: number | null;
  currency: "usd" | "try";
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
  currency: "usd" | "try";
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
    | "INTERVIEW_PACK_10"
    | "CANDIDATE_PROCESSING_PACK_100"
    | "CANDIDATE_PROCESSING_PACK_50";
  label: string;
  description: string;
  amountCents: number;
  currency: "usd" | "try";
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
      "Tek recruiter ile düzenli işe alım yapan ekipler için. Düşük hacim, düşük koltuk, net operasyon.",
    monthlyAmountCents: 449900,
    currency: "try",
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
      "Düzenli işe alım yapan küçük ekipler için. Daha fazla hacim, takvim entegrasyonu ve raporlama.",
    monthlyAmountCents: 1299900,
    currency: "try",
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
  CANDIDATE_PROCESSING_PACK_50: {
    key: "CANDIDATE_PROCESSING_PACK_50",
    label: "Ek Aday İşleme Paketi 50",
    description: "Mevcut dönem için +50 aday işleme hakkı.",
    amountCents: 109900,
    currency: "try",
    quotaKey: "CANDIDATE_PROCESSING",
    quantity: 50
  },
  CANDIDATE_PROCESSING_PACK_100: {
    key: "CANDIDATE_PROCESSING_PACK_100",
    label: "Ek Aday İşleme Paketi 100",
    description: "Mevcut dönem için +100 aday işleme hakkı.",
    amountCents: 199900,
    currency: "try",
    quotaKey: "CANDIDATE_PROCESSING",
    quantity: 100
  },
  INTERVIEW_PACK_10: {
    key: "INTERVIEW_PACK_10",
    label: "Ek AI Mülakat Paketi 10",
    description: "Mevcut dönem için +10 AI mülakat hakkı.",
    amountCents: 119900,
    currency: "try",
    quotaKey: "AI_INTERVIEWS",
    quantity: 10
  },
  INTERVIEW_PACK_25: {
    key: "INTERVIEW_PACK_25",
    label: "Ek AI Mülakat Paketi 25",
    description: "Mevcut dönem için +25 AI mülakat hakkı.",
    amountCents: 249900,
    currency: "try",
    quotaKey: "AI_INTERVIEWS",
    quantity: 25
  }
};

export const FREE_TRIAL_DEFINITION: BillingTrialDefinition = {
  label: "Ücretsiz Deneme",
  description:
    "14 gün boyunca tek ilan üzerinde screening ve AI mülakat akışını deneyin. Kredi kartı gerekmez.",
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
