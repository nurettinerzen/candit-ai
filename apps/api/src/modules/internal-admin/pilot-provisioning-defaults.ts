import type { Prisma, PrismaClient } from "@prisma/client";

export const DEFAULT_PILOT_WORKSPACE_NAME = "Ana Çalışma Alanı";

const PILOT_PROMPT_TEMPLATES = [
  {
    key: "cv_parsing_tr_v1",
    stage: "CV_PARSING",
    version: 1
  },
  {
    key: "screening_support_tr_v1",
    stage: "SCREENING_SUPPORT",
    version: 1
  },
  {
    key: "report_generation_tr_v1",
    stage: "REPORT_GENERATION",
    version: 1
  },
  {
    key: "recommendation_generation_tr_v1",
    stage: "RECOMMENDATION_GENERATION",
    version: 1
  }
] as const;

const PILOT_SCORING_RUBRICS = [
  {
    key: "warehouse_screening",
    version: 1,
    domain: "warehouse",
    rubricJson: {
      dimensions: [
        { key: "relevant_experience", weight: 0.35 },
        { key: "shift_fit", weight: 0.2 },
        { key: "reliability_signals", weight: 0.2 },
        { key: "communication_clarity", weight: 0.15 },
        { key: "safety_awareness", weight: 0.1 }
      ]
    }
  },
  {
    key: "fit_scoring_warehouse",
    version: 1,
    domain: "warehouse",
    rubricJson: {
      schemaVersion: "fit_scoring_rubric.v1",
      roleFamily: "warehouse",
      categories: [
        {
          key: "deneyim_uyumu",
          label: "Deneyim Uyumu",
          weight: 0.25,
          description: "Depo, lojistik veya ilgili sektorde is deneyimi",
          deterministicSignals: [
            "recentRoles",
            "sectorSignals",
            "workHistorySignals",
            "estimatedYearsOfExperience"
          ],
          scoringGuidance: "Depo/lojistik deneyimi yuksek puan, ilgisiz sektor dusuk puan"
        },
        {
          key: "sertifika_belgeler",
          label: "Sertifika ve Belgeler",
          weight: 0.2,
          description: "Forklift, ehliyet, SRC gibi mesleki belgeler",
          deterministicSignals: ["certifications", "skills"],
          scoringGuidance: "Forklift sertifikasi veya ehliyet varsa yuksek puan"
        },
        {
          key: "fiziksel_uygunluk",
          label: "Fiziksel Uygunluk Sinyalleri",
          weight: 0.2,
          description: "Fiziksel is yapabilme sinyalleri",
          deterministicSignals: ["skills", "recentRoles"],
          scoringGuidance: "Depo, paketleme, yukleme gibi fiziksel is deneyimi varsa yuksek puan"
        },
        {
          key: "vardiya_esnekligi",
          label: "Vardiya Esnekligi",
          weight: 0.15,
          description: "Vardiyali calisma uygunlugu sinyalleri",
          deterministicSignals: ["workHistorySignals", "recentRoles"],
          scoringGuidance: "Vardiyali calisma gecmisi varsa yuksek puan"
        },
        {
          key: "genel_profil",
          label: "Genel Profil",
          weight: 0.2,
          description: "Lokasyon, istihdam bosuklari, iletisim bilgileri",
          deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo", "languages"],
          scoringGuidance: "Lokasyon uyumu, az bosluk, iletisim bilgisi tamsa yuksek puan"
        }
      ]
    }
  },
  {
    key: "fit_scoring_retail",
    version: 1,
    domain: "retail",
    rubricJson: {
      schemaVersion: "fit_scoring_rubric.v1",
      roleFamily: "retail",
      categories: [
        {
          key: "musteri_iliskisi",
          label: "Müşteri İlişkisi Deneyimi",
          weight: 0.25,
          description: "Musteri odakli is deneyimi",
          deterministicSignals: ["recentRoles", "sectorSignals", "skills"],
          scoringGuidance: "Perakende, musteri destek veya satis deneyimi varsa yuksek puan"
        },
        {
          key: "kasa_deneyimi",
          label: "Kasa ve POS Deneyimi",
          weight: 0.2,
          description: "Kasa islemleri, POS terminal kullanimi",
          deterministicSignals: ["skills", "recentRoles"],
          scoringGuidance: "Kasa islemleri, POS veya nakit yonetimi deneyimi varsa yuksek puan"
        },
        {
          key: "iletisim_becerisi",
          label: "İletişim Becerisi",
          weight: 0.2,
          description: "Iletisim ve dil becerileri",
          deterministicSignals: ["languages", "educationSummary"],
          scoringGuidance: "Birden fazla dil veya iletisim odakli egitim varsa yuksek puan"
        },
        {
          key: "uygunluk_vardiya",
          label: "Uygunluk ve Vardiya",
          weight: 0.15,
          description: "Calisma uygunlugu ve vardiya esnekligi",
          deterministicSignals: ["workHistorySignals", "recentRoles"],
          scoringGuidance: "Perakende sektorunde vardiyali calisma gecmisi varsa yuksek puan"
        },
        {
          key: "genel_profil",
          label: "Genel Profil",
          weight: 0.2,
          description: "Lokasyon, istihdam bosuklari, iletisim",
          deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo"],
          scoringGuidance: "Lokasyon uyumu, az bosluk, iletisim bilgisi tamsa yuksek puan"
        }
      ]
    }
  },
  {
    key: "fit_scoring_genel",
    version: 1,
    domain: "genel",
    rubricJson: {
      schemaVersion: "fit_scoring_rubric.v1",
      roleFamily: "genel",
      categories: [
        {
          key: "deneyim_uyumu",
          label: "Deneyim Uyumu",
          weight: 0.3,
          description: "Is deneyimi ve sektor uyumu",
          deterministicSignals: [
            "recentRoles",
            "sectorSignals",
            "workHistorySignals",
            "estimatedYearsOfExperience"
          ],
          scoringGuidance: "Ilgili sektor deneyimi varsa yuksek puan"
        },
        {
          key: "beceri_uyumu",
          label: "Beceri Uyumu",
          weight: 0.25,
          description: "Teknik ve mesleki beceriler",
          deterministicSignals: ["skills", "certifications"],
          scoringGuidance: "Pozisyon icin gerekli beceriler varsa yuksek puan"
        },
        {
          key: "egitim_sertifika",
          label: "Eğitim ve Sertifika",
          weight: 0.2,
          description: "Egitim durumu ve mesleki sertifikalar",
          deterministicSignals: ["educationSummary", "certifications"],
          scoringGuidance: "Ilgili egitim veya sertifika varsa yuksek puan"
        },
        {
          key: "genel_profil",
          label: "Genel Profil",
          weight: 0.25,
          description: "Lokasyon, dil, istihdam bosuklari",
          deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo", "languages"],
          scoringGuidance: "Lokasyon uyumu, dil becerisi, az bosluk varsa yuksek puan"
        }
      ]
    }
  }
] as const;

type PilotProvisioningClient = Pick<
  PrismaClient | Prisma.TransactionClient,
  "workspace" | "aiPromptTemplate" | "scoringRubric"
>;

export async function ensurePilotWorkspaceAndAiDefaults(
  prisma: PilotProvisioningClient,
  tenantId: string
) {
  await prisma.workspace.upsert({
    where: {
      tenantId_name: {
        tenantId,
        name: DEFAULT_PILOT_WORKSPACE_NAME
      }
    },
    update: {},
    create: {
      tenantId,
      name: DEFAULT_PILOT_WORKSPACE_NAME
    }
  });

  for (const template of PILOT_PROMPT_TEMPLATES) {
    await prisma.aiPromptTemplate.upsert({
      where: {
        tenantId_key_version: {
          tenantId,
          key: template.key,
          version: template.version
        }
      },
      update: {
        stage: template.stage,
        locale: "tr",
        systemPrompt:
          "Yalnizca Turkce cevap ver. AI sadece yardimci cikarim yapar. Nihai karari insan verir.",
        userPrompt: "JSON schema ile uyumlu cikti uret.",
        outputSchema: {
          type: "object",
          additionalProperties: true
        },
        isActive: true
      },
      create: {
        tenantId,
        key: template.key,
        version: template.version,
        stage: template.stage,
        locale: "tr",
        systemPrompt:
          "Yalnizca Turkce cevap ver. AI sadece yardimci cikarim yapar. Nihai karari insan verir.",
        userPrompt: "JSON schema ile uyumlu cikti uret.",
        outputSchema: {
          type: "object",
          additionalProperties: true
        },
        isActive: true
      }
    });
  }

  for (const rubric of PILOT_SCORING_RUBRICS) {
    await prisma.scoringRubric.upsert({
      where: {
        tenantId_key_version: {
          tenantId,
          key: rubric.key,
          version: rubric.version
        }
      },
      update: {
        domain: rubric.domain,
        rubricJson: rubric.rubricJson,
        isActive: true
      },
      create: {
        tenantId,
        key: rubric.key,
        version: rubric.version,
        domain: rubric.domain,
        rubricJson: rubric.rubricJson,
        isActive: true
      }
    });
  }
}
