import type { SiteLocale } from "./i18n";
import type { TenantMessageTemplate } from "./types";

export const TENANT_MESSAGE_TEMPLATE_VARIABLES = [
  "{{candidateName}}",
  "{{companyName}}",
  "{{jobTitle}}",
  "{{interviewLink}}",
  "{{deadline}}"
];

export type TenantMessageTemplateDefinition = {
  key: string;
  group: "application" | "interview";
  system: boolean;
  label: Record<SiteLocale, string>;
  description: Record<SiteLocale, string>;
};

export const TENANT_MESSAGE_TEMPLATE_DEFINITIONS: TenantMessageTemplateDefinition[] = [
  {
    key: "application_received_v1",
    group: "application",
    system: true,
    label: { tr: "Başvuru alındı", en: "Application received" },
    description: {
      tr: "Aday başvuruyu tamamladığında gönderilen standart bilgilendirme.",
      en: "Standard confirmation sent when a candidate completes an application."
    }
  },
  {
    key: "application_shortlisted_v1",
    group: "application",
    system: true,
    label: { tr: "Ön eleme olumlu", en: "Shortlisted" },
    description: {
      tr: "Aday kısa listeye alındığında veya olumlu ön değerlendirme aldığında kullanılır.",
      en: "Used when a candidate is shortlisted or receives a positive pre-screen result."
    }
  },
  {
    key: "application_advanced_v1",
    group: "application",
    system: true,
    label: { tr: "Süreç ilerledi", en: "Application advanced" },
    description: {
      tr: "Aday bir sonraki işe alım aşamasına taşındığında gönderilir.",
      en: "Sent when the candidate moves to the next hiring stage."
    }
  },
  {
    key: "application_on_hold_v1",
    group: "application",
    system: true,
    label: { tr: "Değerlendirme bekliyor", en: "On hold" },
    description: {
      tr: "Süreç durakladığında ama adayla iletişim koparılmadığında kullanılır.",
      en: "Used when the process pauses while keeping the candidate informed."
    }
  },
  {
    key: "application_talent_pool_v1",
    group: "application",
    system: true,
    label: { tr: "Yetenek havuzu", en: "Talent pool" },
    description: {
      tr: "Aday uygun pozisyonlar için yetenek havuzunda tutulduğunda gönderilir.",
      en: "Sent when a candidate is kept in the talent pool for future roles."
    }
  },
  {
    key: "application_rejected_v1",
    group: "application",
    system: true,
    label: { tr: "Olumsuz sonuç", en: "Rejected" },
    description: {
      tr: "Süreç olumsuz tamamlandığında adaya gönderilen kapanış mesajı.",
      en: "Closing message sent when the process ends negatively."
    }
  },
  {
    key: "interview_scheduled_v1",
    group: "interview",
    system: true,
    label: { tr: "Görüşme planlandı", en: "Interview scheduled" },
    description: {
      tr: "Takvimli görüşme oluşturulduğunda gönderilir.",
      en: "Sent when a scheduled interview is created."
    }
  },
  {
    key: "interview_rescheduled_v1",
    group: "interview",
    system: true,
    label: { tr: "Görüşme güncellendi", en: "Interview rescheduled" },
    description: {
      tr: "Görüşme tarihi veya bağlantısı değiştiğinde gönderilir.",
      en: "Sent when the interview time or link changes."
    }
  },
  {
    key: "interview_cancelled_v1",
    group: "interview",
    system: true,
    label: { tr: "Görüşme iptal edildi", en: "Interview cancelled" },
    description: {
      tr: "Planlı görüşme iptal edildiğinde gönderilir.",
      en: "Sent when a scheduled interview is cancelled."
    }
  },
  {
    key: "interview_invitation_on_demand_v1",
    group: "interview",
    system: true,
    label: { tr: "AI mülakat daveti", en: "AI interview invitation" },
    description: {
      tr: "Adaya isteğe bağlı AI mülakat bağlantısı iletilirken kullanılır.",
      en: "Used when sending an on-demand AI interview link to the candidate."
    }
  },
  {
    key: "interview_invitation_reminder_v1",
    group: "interview",
    system: true,
    label: { tr: "AI mülakat hatırlatma", en: "AI interview reminder" },
    description: {
      tr: "AI mülakat daveti süresi dolmadan önce hatırlatma için kullanılır.",
      en: "Used as a reminder before an AI interview invitation expires."
    }
  }
] as const;

const DEFINITION_BY_KEY = new Map(TENANT_MESSAGE_TEMPLATE_DEFINITIONS.map((definition) => [definition.key, definition]));

export function getTenantMessageTemplateDefinition(key: string) {
  return DEFINITION_BY_KEY.get(key) ?? null;
}

export function createEmptyTenantMessageTemplate(): TenantMessageTemplate {
  return {
    subject: "",
    body: "",
    ctaLabel: null
  };
}

export function normalizeCustomTemplateKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function getOrderedTenantMessageTemplateKeys(templates: Record<string, TenantMessageTemplate>) {
  const knownKeys = TENANT_MESSAGE_TEMPLATE_DEFINITIONS.map((definition) => definition.key);
  const customKeys = Object.keys(templates)
    .filter((key) => !knownKeys.includes(key))
    .sort((left, right) => left.localeCompare(right));

  return [
    ...knownKeys.filter((key) => templates[key]),
    ...customKeys
  ];
}
