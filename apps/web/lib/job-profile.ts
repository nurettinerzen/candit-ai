import type { JobProfile } from "./types";

export const DEFAULT_RESPONSE_SLA_DAYS = 15;

export const DEPARTMENT_SUGGESTIONS = [
  "Operasyon",
  "Satış",
  "Pazarlama",
  "İnsan Kaynakları",
  "Finans",
  "Bilgi Teknolojileri",
  "Müşteri Hizmetleri",
  "Üretim",
  "Lojistik",
  "Muhasebe",
  "Yazılım Geliştirme"
] as const;

export const TITLE_LEVEL_SUGGESTIONS = [
  "Asistan",
  "Uzman Yardımcısı",
  "Uzman",
  "Kıdemli Uzman",
  "Takım Lideri",
  "Yönetici",
  "Müdür"
] as const;

export const QUALIFICATION_PRESET_LIBRARY = [
  "Bilgisayar Mühendisliği",
  "Yazılım Mühendisliği",
  ".NET",
  "ASP.NET Core",
  "MS SQL",
  "REST API",
  "Git",
  "Code review",
  "İleri seviye İngilizce",
  "B sınıfı ehliyet",
  "SAP",
  "Logo Tiger"
] as const;

function cleanText(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeList(values: string[] | null | undefined) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => value.trim())
    .filter(Boolean);
}

export function createEmptyJobProfile(): JobProfile {
  return {
    titleLevel: null,
    responsibilities: [],
    competencySets: {
      core: [],
      functional: [],
      managerial: []
    },
    evaluationCriteria: {
      educationLevel: null,
      schoolDepartments: [],
      certificates: [],
      minimumExperienceYears: null,
      tools: [],
      languages: []
    },
    applicantQuestions: [],
    workflow: {
      responseSlaDays: DEFAULT_RESPONSE_SLA_DAYS,
      hideCompensationOnPosting: true
    },
    notes: null
  };
}

export function normalizeJobProfile(profile: Partial<JobProfile> | JobProfile | null | undefined): JobProfile {
  const empty = createEmptyJobProfile();

  return {
    titleLevel: cleanText(profile?.titleLevel) ?? empty.titleLevel,
    responsibilities: normalizeList(profile?.responsibilities),
    competencySets: {
      core: normalizeList(profile?.competencySets?.core),
      functional: normalizeList(profile?.competencySets?.functional),
      managerial: normalizeList(profile?.competencySets?.managerial)
    },
    evaluationCriteria: {
      educationLevel: cleanText(profile?.evaluationCriteria?.educationLevel),
      schoolDepartments: normalizeList(profile?.evaluationCriteria?.schoolDepartments),
      certificates: normalizeList(profile?.evaluationCriteria?.certificates),
      minimumExperienceYears:
        typeof profile?.evaluationCriteria?.minimumExperienceYears === "number"
          ? profile.evaluationCriteria.minimumExperienceYears
          : empty.evaluationCriteria.minimumExperienceYears,
      tools: normalizeList(profile?.evaluationCriteria?.tools),
      languages: normalizeList(profile?.evaluationCriteria?.languages)
    },
    applicantQuestions: normalizeList(profile?.applicantQuestions),
    workflow: {
      responseSlaDays:
        typeof profile?.workflow?.responseSlaDays === "number"
          ? profile.workflow.responseSlaDays
          : empty.workflow.responseSlaDays,
      hideCompensationOnPosting: profile?.workflow?.hideCompensationOnPosting !== false
    },
    notes: cleanText(profile?.notes)
  };
}

export function appendUniqueValue(list: string[], value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return list;
  }

  const existing = new Set(list.map((item) => item.trim().toLocaleLowerCase("tr-TR")));
  if (existing.has(normalizedValue.toLocaleLowerCase("tr-TR"))) {
    return list;
  }

  return [...list, normalizedValue];
}
