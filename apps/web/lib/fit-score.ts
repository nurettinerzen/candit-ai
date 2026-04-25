import type { ApplicantFitScoreCategory, ApplicantFitScoreView } from "./types";

const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  experienceFit: "Deneyim Uyumu",
  locationFit: "Lokasyon Uyumu",
  shiftFit: "Vardiya Uyumu",
  roleFit: "Rol Uyumu"
};

const CANONICAL_CATEGORY_LABELS: Record<string, string> = {
  deneyim_uyumu: "Deneyim Uyumu",
  beceri_uyumu: "Beceri Uyumu",
  beceri_ve_arac_uyumu: "Beceri ve Araç Uyumu",
  uygulama_ve_sonuc_kaniti: "Uygulama ve Sonuç Kanıtı",
  lokasyon_ve_calisma_modeli_uyumu: "Lokasyon ve Çalışma Modeli Uyumu",
  lokasyon_uyumu: "Lokasyon Uyumu",
  egitim_ve_sertifika_uyumu: "Eğitim ve Sertifika Uyumu",
  egitim_sertifika: "Eğitim ve Sertifika",
  musteri_iliskisi: "Müşteri İlişkisi Deneyimi",
  iletisim_becerisi: "İletişim Becerisi",
  uygunluk_vardiya: "Uygunluk ve Vardiya",
  genel_profil: "Genel Profil"
};

const CANONICAL_LABEL_BY_ASCII: Record<string, string> = {
  "Rol ve Deneyim Uyumu": "Rol ve Deneyim Uyumu",
  "Beceri ve Arac Uyumu": "Beceri ve Araç Uyumu",
  "Uygulama ve Sonuc Kaniti": "Uygulama ve Sonuç Kanıtı",
  "Lokasyon ve Calisma Modeli Uyumu": "Lokasyon ve Çalışma Modeli Uyumu",
  "Egitim ve Sertifika Uyumu": "Eğitim ve Sertifika Uyumu",
  "Egitim ve Sertifika": "Eğitim ve Sertifika",
  "Musteri Iliskisi Deneyimi": "Müşteri İlişkisi Deneyimi",
  "Iletisim Becerisi": "İletişim Becerisi"
};

function canonicalizeCategoryLabel(key: string, label: string | null | undefined) {
  if (key && CANONICAL_CATEGORY_LABELS[key]) {
    return CANONICAL_CATEGORY_LABELS[key];
  }

  if (label && CANONICAL_LABEL_BY_ASCII[label]) {
    return CANONICAL_LABEL_BY_ASCII[label];
  }

  return label ?? key;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumeric(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

export function toFitScorePercent(value: number | string | null | undefined) {
  const numeric = toNumeric(value);
  if (numeric === null) {
    return null;
  }

  const scaled = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.round(clamp(scaled, 0, 100));
}

export function toConfidencePercent(value: number | string | null | undefined) {
  const numeric = toNumeric(value);
  if (numeric === null) {
    return null;
  }

  const scaled = numeric > 1 ? numeric / 100 : numeric;
  return Math.round(clamp(scaled, 0, 1) * 100);
}

export function normalizeFitCategories(subScores: ApplicantFitScoreView["subScores"] | Record<string, unknown> | null | undefined): ApplicantFitScoreCategory[] {
  if (!subScores || typeof subScores !== "object") {
    return [];
  }

  if (Array.isArray((subScores as { categories?: unknown }).categories)) {
    return ((subScores as { categories: unknown[] }).categories)
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const category = item as Record<string, unknown>;
        const score = toFitScorePercent(category.score as number | string | null | undefined);
        const confidence = toConfidencePercent(category.confidence as number | string | null | undefined);
        return {
          key: typeof category.key === "string" ? category.key : `category_${index + 1}`,
          label: canonicalizeCategoryLabel(
            typeof category.key === "string" ? category.key : `category_${index + 1}`,
            typeof category.label === "string" ? category.label : `Kategori ${index + 1}`
          ),
          weight: typeof category.weight === "number" ? category.weight : null,
          score: score ?? 0,
          confidence: confidence == null ? 0 : confidence / 100,
          deterministicScore: toFitScorePercent(category.deterministicScore as number | string | null | undefined),
          aiScore: toFitScorePercent(category.aiScore as number | string | null | undefined),
          strengths: uniqueStrings(category.strengths),
          risks: uniqueStrings(category.risks),
          reasoning: typeof category.reasoning === "string" ? category.reasoning : ""
        } satisfies ApplicantFitScoreCategory;
      })
      .filter((item): item is ApplicantFitScoreCategory => item !== null);
  }

  return Object.entries(subScores)
    .filter(([key]) => key !== "schemaVersion" && key !== "rubricRoleFamily")
    .map(([key, value]) => {
      const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
      const score = toFitScorePercent(record.score as number | string | null | undefined);
      const confidence = toConfidencePercent(record.confidence as number | string | null | undefined);

      return {
        key,
        label: canonicalizeCategoryLabel(key, LEGACY_CATEGORY_LABELS[key] ?? key),
        weight: null,
        score: score ?? 0,
        confidence: confidence == null ? 0 : confidence / 100,
        deterministicScore: null,
        aiScore: null,
        strengths: [],
        risks: [],
        reasoning: typeof record.reason === "string" ? record.reason : ""
      } satisfies ApplicantFitScoreCategory;
    });
}
