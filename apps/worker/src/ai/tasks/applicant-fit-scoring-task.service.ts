import { AiTaskType, type Prisma, PrismaClient } from "@prisma/client";
import { AiTaskPolicyService } from "../policy/ai-task-policy.service.js";
import { StructuredAiProvider } from "../providers/structured-ai-provider.js";
import { TaskProcessingError } from "../task-processing-error.js";
import {
  asJsonObject,
  toArray,
  toNumberValue,
  toRecord,
  toStringValue,
  type TaskExecutionContext,
  type TaskExecutionResult
} from "../types.js";

// ── Rubric types ──

type RubricCategory = {
  key: string;
  label: string;
  weight: number;
  description: string;
  deterministicSignals: string[];
  scoringGuidance: string;
};

type FitScoringRubric = {
  schemaVersion: string;
  roleFamily: string;
  categories: RubricCategory[];
};

// ── AI output types ──

type AiCategoryScore = {
  key: string;
  score: number;
  confidence: number;
  strengths: string[];
  risks: string[];
  reasoning: string;
};

type AiFitScoringOutput = {
  categoryScores: AiCategoryScore[];
  overallAssessment: string;
  missingInformation: string[];
  confidence: number;
  uncertainty: { reasons: string[] };
};

// ── Default rubrics (used when no DB rubric exists) ──

const DEFAULT_RUBRICS: Record<string, FitScoringRubric> = {
  warehouse: {
    schemaVersion: "fit_scoring_rubric.v1",
    roleFamily: "warehouse",
    categories: [
      {
        key: "deneyim_uyumu",
        label: "Deneyim Uyumu",
        weight: 0.25,
        description: "Depo, lojistik veya ilgili sektorde is deneyimi",
        deterministicSignals: ["recentRoles", "sectorSignals", "workHistorySignals", "estimatedYearsOfExperience"],
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
  },
  retail: {
    schemaVersion: "fit_scoring_rubric.v1",
    roleFamily: "retail",
    categories: [
      {
        key: "musteri_iliskisi",
        label: "Musteri Iliskisi Deneyimi",
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
        label: "Iletisim Becerisi",
        weight: 0.2,
        description: "Iletisim ve dil becerileri",
        deterministicSignals: ["languages", "educationSummary"],
        scoringGuidance: "Birden fazla dil veya iletisim odakli egitim varsa yuksek puan"
      },
      {
        key: "uygunluk_vardiya",
        label: "Uygunluk ve Vardiya",
        weight: 0.15,
        description: "Calismo uygunlugu ve vardiya esnekligi",
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
  },
  genel: {
    schemaVersion: "fit_scoring_rubric.v1",
    roleFamily: "genel",
    categories: [
      {
        key: "deneyim_uyumu",
        label: "Deneyim Uyumu",
        weight: 0.3,
        description: "Is deneyimi ve sektor uyumu",
        deterministicSignals: ["recentRoles", "sectorSignals", "workHistorySignals", "estimatedYearsOfExperience"],
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
        label: "Egitim ve Sertifika",
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
};

// ── Fit Scoring Output Schema for OpenAI ──

function fitScoringOutputSchema(schemaName: string) {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: schemaName,
    type: "object",
    additionalProperties: false,
    required: ["categoryScores", "overallAssessment", "missingInformation", "confidence", "uncertainty"],
    properties: {
      categoryScores: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "score", "confidence", "strengths", "risks", "reasoning"],
          properties: {
            key: { type: "string" },
            score: { type: "number" },
            confidence: { type: "number" },
            strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
            risks: { type: "array", items: { type: "string" }, maxItems: 5 },
            reasoning: { type: "string" }
          }
        },
        maxItems: 10
      },
      overallAssessment: { type: "string" },
      missingInformation: { type: "array", items: { type: "string" }, maxItems: 10 },
      confidence: { type: "number" },
      uncertainty: {
        type: "object",
        additionalProperties: false,
        required: ["reasons"],
        properties: {
          reasons: { type: "array", items: { type: "string" }, maxItems: 8 }
        }
      }
    }
  };
}

// ── Task Service ──

export class ApplicantFitScoringTaskService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AiTaskPolicyService,
    private readonly provider: StructuredAiProvider
  ) {}

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const applicationId = context.taskRun.applicationId;

    if (!applicationId) {
      throw new TaskProcessingError(
        "APPLICATION_ID_REQUIRED",
        "APPLICANT_FIT_SCORING task'i icin applicationId zorunludur."
      );
    }

    // 1. Load application with job and candidate
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: applicationId, tenantId: context.tenantId },
      include: {
        candidate: true,
        job: {
          include: {
            requirements: { orderBy: { key: "asc" } }
          }
        }
      }
    });

    if (!application) {
      throw new TaskProcessingError("APPLICATION_NOT_FOUND", "Application bulunamadi.", false, {
        applicationId
      });
    }

    // 2. Load latest CV parsed profile
    const latestCvProfile = await this.prisma.cVParsedProfile.findFirst({
      where: {
        tenantId: context.tenantId,
        cvFile: { candidateId: application.candidateId }
      },
      orderBy: { createdAt: "desc" },
      include: { cvFile: { select: { id: true, originalName: true } } }
    });

    if (!latestCvProfile) {
      throw new TaskProcessingError(
        "CV_PROFILE_NOT_FOUND",
        "Adayin CV profili bulunamadi. Once CV yukleyip parse edilmesi gerekiyor.",
        false,
        { candidateId: application.candidateId }
      );
    }

    // 3. Load rubric (DB first, then default)
    const rubric = await this.loadRubric(context.tenantId, context.taskRun.id, application.job.roleFamily);
    const rubricData = rubric
      ? (toRecord(rubric.rubricJson) as unknown as FitScoringRubric)
      : this.getDefaultRubric(application.job.roleFamily);

    const promptVersion = "applicant_fit_scoring.v1.tr";

    // 4. Deterministic category scoring
    const profileJson = toRecord(latestCvProfile.profileJson);
    const extractedFacts = toRecord(profileJson.extractedFacts);
    const deterministicScores = this.buildDeterministicScores(extractedFacts, rubricData.categories);

    // 5. AI scoring
    const aiResult = await this.provider.generate({
      taskType: "APPLICANT_FIT_SCORING",
      schemaName: "applicant_fit_scoring_v1_tr",
      schema: fitScoringOutputSchema("applicant_fit_scoring_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt: [
        "Sen bir profesyonel IK uzmani CV degerlendirme asistanisin.",
        "Turkce cikti uret.",
        "Adayin CV profilini verilen rubric kategorilerine gore degerlendir.",
        "Her kategori icin 0-100 arasi puan ver.",
        "Guclu yonleri, riskleri ve eksik bilgileri belirle.",
        "Nihai karar verme, sadece degerlendirme yap."
      ].join(" "),
      userPrompt: JSON.stringify({
        task: "APPLICANT_FIT_SCORING",
        locale: "tr-TR",
        candidate: {
          fullName: application.candidate.fullName,
          source: application.candidate.source
        },
        job: {
          title: application.job.title,
          roleFamily: application.job.roleFamily,
          requirements: application.job.requirements.map((r) => ({
            key: r.key,
            value: r.value,
            required: r.required
          }))
        },
        cvProfile: {
          extractedFacts,
          interpretation: toRecord(profileJson).interpretation ?? null,
          parseConfidence: latestCvProfile.parseConfidence,
          extractionStatus: latestCvProfile.extractionStatus
        },
        rubricCategories: rubricData.categories.map((c) => ({
          key: c.key,
          label: c.label,
          weight: c.weight,
          description: c.description,
          scoringGuidance: c.scoringGuidance
        })),
        deterministicBaseScores: deterministicScores,
        instructions: [
          "Her kategori icin score alani 0-100 arasi olmali",
          "confidence alani 0-1 arasi olmali",
          "strengths ve risks Turkce olmali",
          "overallAssessment Turkce bir ozet cumlesi olmali",
          "Deterministik baz skorlari dikkate al ama kendi degerlendirmeni de kat"
        ]
      })
    });

    // 6. Merge deterministic + AI scores
    const mergedScores = this.mergeScores(deterministicScores, aiResult.output, rubricData.categories);
    const overallScore = this.calculateWeightedOverall(mergedScores.categoryScores, rubricData.categories);
    const overallConfidence = mergedScores.confidence;

    // 7. Aggregate strengths, risks, missing info
    const allStrengths = mergedScores.categoryScores.flatMap((cs) => cs.strengths);
    const allRisks = mergedScores.categoryScores.flatMap((cs) => cs.risks);
    const missingInfo = mergedScores.missingInformation;

    // 8. Save ApplicantFitScore
    const fitScore = await this.prisma.applicantFitScore.create({
      data: {
        tenantId: context.tenantId,
        applicationId,
        aiTaskRunId: context.taskRun.id,
        overallScore,
        confidence: overallConfidence,
        subScoresJson: {
          schemaVersion: "fit_scoring_sub_scores.v1",
          rubricRoleFamily: rubricData.roleFamily,
          categories: mergedScores.categoryScores.map((cs) => ({
            key: cs.key,
            label: rubricData.categories.find((c) => c.key === cs.key)?.label ?? cs.key,
            weight: rubricData.categories.find((c) => c.key === cs.key)?.weight ?? 0,
            score: cs.score,
            confidence: cs.confidence,
            deterministicScore: cs.deterministicScore,
            aiScore: cs.aiScore,
            strengths: cs.strengths,
            risks: cs.risks,
            reasoning: cs.reasoning
          }))
        } as unknown as Prisma.InputJsonValue,
        strengthsJson: allStrengths as unknown as Prisma.InputJsonValue,
        risksJson: allRisks as unknown as Prisma.InputJsonValue,
        missingInfoJson: missingInfo as unknown as Prisma.InputJsonValue,
        reasoningJson: {
          overallAssessment: mergedScores.overallAssessment,
          uncertaintyReasons: mergedScores.uncertaintyReasons,
          providerMode: aiResult.mode,
          rubricSource: rubric ? "database" : "default"
        } as unknown as Prisma.InputJsonValue,
        modelKey: aiResult.modelKey,
        promptVersion
      }
    });

    // 9. Return result
    const uncertaintyLevel = overallConfidence >= 0.7 ? "dusuk" : overallConfidence >= 0.4 ? "orta" : "yuksek";

    return {
      outputJson: asJsonObject({
        schemaVersion: "applicant_fit_scoring.v1.tr",
        provider: {
          mode: aiResult.mode,
          key: aiResult.providerKey,
          model: aiResult.modelKey
        },
        overallScore,
        confidence: overallConfidence,
        categoryScores: mergedScores.categoryScores,
        overallAssessment: mergedScores.overallAssessment,
        missingInformation: missingInfo,
        uncertainty: {
          level: uncertaintyLevel,
          reasons: mergedScores.uncertaintyReasons,
          confidence: overallConfidence
        },
        safety: {
          recruiterReviewRequired: true,
          autoDecisionApplied: false,
          autoRejectAllowed: false
        },
        additional: {
          fitScoreId: fitScore.id,
          rubricRoleFamily: rubricData.roleFamily,
          cvFileId: latestCvProfile.cvFile?.id ?? null
        }
      }),
      uncertaintyJson: asJsonObject({
        level: uncertaintyLevel,
        confidence: overallConfidence,
        reasons: mergedScores.uncertaintyReasons
      }),
      guardrailFlags: asJsonObject(this.policy.getGuardrailFlags(AiTaskType.APPLICANT_FIT_SCORING)),
      providerKey: aiResult.providerKey,
      providerMode: aiResult.mode,
      modelKey: aiResult.modelKey,
      promptVersion: aiResult.promptVersion,
      policyVersion: this.policy.policyVersion,
      artifacts: {
        fitScoreId: fitScore.id
      }
    };
  }

  // ── Deterministic scoring ──

  private buildDeterministicScores(
    extractedFacts: Record<string, unknown>,
    categories: RubricCategory[]
  ): Array<{ key: string; score: number; signals: string[] }> {
    return categories.map((category) => {
      let score = 30; // Base score
      const signals: string[] = [];

      for (const signalKey of category.deterministicSignals) {
        const signalValue = extractedFacts[signalKey];

        if (!signalValue) continue;

        if (Array.isArray(signalValue) && signalValue.length > 0) {
          const bonus = Math.min(signalValue.length * 10, 40);
          score += bonus;
          signals.push(`${signalKey}: ${signalValue.length} sinyal`);
        } else if (typeof signalValue === "string" && signalValue.trim().length > 0) {
          score += 15;
          signals.push(`${signalKey}: mevcut`);
        } else if (typeof signalValue === "number" && signalValue > 0) {
          const bonus = Math.min(signalValue * 5, 30);
          score += bonus;
          signals.push(`${signalKey}: ${signalValue}`);
        } else if (typeof signalValue === "object" && signalValue !== null) {
          const keys = Object.keys(signalValue as Record<string, unknown>);
          if (keys.length > 0) {
            score += 10;
            signals.push(`${signalKey}: ${keys.length} alan`);
          }
        }
      }

      return {
        key: category.key,
        score: Math.min(Math.round(score), 100),
        signals
      };
    });
  }

  // ── Merge deterministic + AI ──

  private mergeScores(
    deterministicScores: Array<{ key: string; score: number; signals: string[] }>,
    aiOutput: Record<string, unknown> | undefined,
    categories: RubricCategory[]
  ): {
    categoryScores: Array<{
      key: string;
      score: number;
      confidence: number;
      deterministicScore: number;
      aiScore: number;
      strengths: string[];
      risks: string[];
      reasoning: string;
    }>;
    overallAssessment: string;
    missingInformation: string[];
    confidence: number;
    uncertaintyReasons: string[];
  } {
    const aiData = aiOutput ? this.parseAiOutput(aiOutput) : null;
    const detWeight = aiData ? 0.4 : 1.0;
    const aiWeight = aiData ? 0.6 : 0.0;

    const categoryScores = categories.map((category) => {
      const det = deterministicScores.find((d) => d.key === category.key);
      const detScore = det?.score ?? 30;
      const aiCategory = aiData?.categoryScores.find((a) => a.key === category.key);
      const aiScore = aiCategory?.score ?? detScore;

      const blendedScore = Math.round(detScore * detWeight + aiScore * aiWeight);
      const confidence = aiCategory
        ? toNumberValue(aiCategory.confidence, 0.5)
        : 0.3;

      return {
        key: category.key,
        score: Math.min(blendedScore, 100),
        confidence,
        deterministicScore: detScore,
        aiScore,
        strengths: aiCategory?.strengths ?? (det?.signals ?? []),
        risks: aiCategory?.risks ?? [],
        reasoning: aiCategory?.reasoning ?? "Deterministik sinyal bazli degerlendirme."
      };
    });

    return {
      categoryScores,
      overallAssessment: aiData?.overallAssessment ?? "CV profili deterministik sinyallerle degerlendirildi.",
      missingInformation: aiData?.missingInformation ?? [],
      confidence: aiData?.confidence ?? 0.35,
      uncertaintyReasons: aiData?.uncertainty?.reasons ?? [
        "AI destegi olmadan sadece deterministik sinyaller kullanildi."
      ]
    };
  }

  private parseAiOutput(output: Record<string, unknown>): AiFitScoringOutput | null {
    try {
      const categoryScores = toArray(output.categoryScores)
        .map((entry) => {
          const rec = toRecord(entry);
          return {
            key: toStringValue(rec.key, "unknown"),
            score: toNumberValue(rec.score, 50),
            confidence: toNumberValue(rec.confidence, 0.5),
            strengths: toArray(rec.strengths).filter((s): s is string => typeof s === "string"),
            risks: toArray(rec.risks).filter((s): s is string => typeof s === "string"),
            reasoning: toStringValue(rec.reasoning, "")
          };
        })
        .filter((cs) => cs.key !== "unknown");

      return {
        categoryScores,
        overallAssessment: toStringValue(output.overallAssessment, ""),
        missingInformation: toArray(output.missingInformation).filter((s): s is string => typeof s === "string"),
        confidence: toNumberValue(output.confidence, 0.5),
        uncertainty: {
          reasons: toArray(toRecord(output.uncertainty).reasons).filter(
            (s): s is string => typeof s === "string"
          )
        }
      };
    } catch {
      return null;
    }
  }

  // ── Weighted overall score ──

  private calculateWeightedOverall(
    categoryScores: Array<{ key: string; score: number }>,
    categories: RubricCategory[]
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const category of categories) {
      const cs = categoryScores.find((s) => s.key === category.key);
      if (cs) {
        weightedSum += cs.score * category.weight;
        totalWeight += category.weight;
      }
    }

    if (totalWeight === 0) return 50;
    return Math.round(weightedSum / totalWeight);
  }

  // ── Rubric loading ──

  private async loadRubric(tenantId: string, taskRunId: string, roleFamily: string) {
    const run = await this.prisma.aiTaskRun.findUnique({
      where: { id: taskRunId },
      select: { rubricId: true }
    });

    if (run?.rubricId) {
      const byId = await this.prisma.scoringRubric.findFirst({
        where: { id: run.rubricId, tenantId, isActive: true }
      });
      if (byId) return byId;
    }

    // Try roleFamily first, then fallback to "genel"
    const byRole = await this.prisma.scoringRubric.findFirst({
      where: { tenantId, domain: roleFamily, isActive: true },
      orderBy: { version: "desc" }
    });

    if (byRole) return byRole;

    return this.prisma.scoringRubric.findFirst({
      where: { tenantId, domain: "genel", isActive: true },
      orderBy: { version: "desc" }
    });
  }

  private getDefaultRubric(roleFamily: string): FitScoringRubric {
    return DEFAULT_RUBRICS[roleFamily] ?? DEFAULT_RUBRICS["genel"] as FitScoringRubric;
  }
}
