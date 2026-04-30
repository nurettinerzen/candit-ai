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
  "İleri seviye İngilizce",
  "B sınıfı ehliyet",
  "SAP",
  "Logo Tiger"
] as const;

export const TECHNICAL_PRESET_LIBRARY = [
  ".NET",
  "ASP.NET Core",
  "MS SQL",
  "REST API",
  "Git",
  "Code review",
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
      technical: [],
      managerial: []
    },
    competencyDefinitions: [],
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
    branding: {
      logoUrl: null,
      imageUrls: []
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
      technical: normalizeList(profile?.competencySets?.technical),
      managerial: normalizeList(profile?.competencySets?.managerial)
    },
    competencyDefinitions: Array.isArray(profile?.competencyDefinitions)
      ? profile.competencyDefinitions
          .map((definition) => ({
            name: definition.name.trim(),
            category: definition.category,
            definition: definition.definition.trim(),
            expectedBehavior: cleanText(definition.expectedBehavior)
          }))
          .filter(
            (definition) =>
              definition.name &&
              definition.definition &&
              ["core", "functional", "technical", "managerial"].includes(definition.category)
          )
      : [],
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
    branding: {
      logoUrl: cleanText(profile?.branding?.logoUrl),
      imageUrls: normalizeList(profile?.branding?.imageUrls)
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
