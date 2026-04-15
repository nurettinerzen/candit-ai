import { AiTaskType, ApplicationStage, Prisma, PrismaClient } from "@prisma/client";
import { AiTaskPolicyService } from "../policy/ai-task-policy.service.js";
import { StructuredAiProvider } from "../providers/structured-ai-provider.js";
import { TaskProcessingError } from "../task-processing-error.js";
import {
  asJsonObject,
  toRecord,
  type TaskExecutionContext,
  type TaskExecutionResult
} from "../types.js";
import {
  defaultOutputSchema,
  normalizeStructuredSections,
  toOutputJson,
  type StructuredTaskSections
} from "./task-output.utils.js";
import {
  mergeJsonUserPrompt,
  mergeSystemPrompt,
  type LoadedPromptTemplate
} from "./prompt-template.utils.js";

export class ScreeningSupportTaskService {
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
        "SCREENING_SUPPORT task'i icin applicationId zorunludur."
      );
    }

    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id: applicationId,
        tenantId: context.tenantId
      },
      include: {
        candidate: {
          include: {
            cvFiles: {
              orderBy: {
                uploadedAt: "desc"
              },
              take: 1,
              include: {
                parsedProfile: true
              }
            }
          }
        },
        job: {
          include: {
            requirements: {
              orderBy: {
                key: "asc"
              }
            }
          }
        }
      }
    });

    if (!application) {
      throw new TaskProcessingError("APPLICATION_NOT_FOUND", "Application bulunamadi.", false, {
        applicationId
      });
    }

    const latestCvProfile = application.candidate.cvFiles[0]?.parsedProfile?.profileJson;
    const latestFitScore = await this.prisma.applicantFitScore.findFirst({
      where: {
        tenantId: context.tenantId,
        applicationId: application.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const rubric = await this.loadRubric(context.tenantId, context.taskRun.id, application.job.roleFamily);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "screening_support.v4.tr";
    const fitScoreContext = this.buildFitScoreContext(latestFitScore);
    const requirementCoverage = this.buildRequirementCoverage(
      application.job.requirements,
      latestCvProfile
    );
    const screeningDecisionContext = this.buildScreeningDecisionContext({
      fitScoreContext,
      requirementCoverage,
      job: {
        title: application.job.title,
        roleFamily: application.job.roleFamily,
        locationText: application.job.locationText,
        shiftType: application.job.shiftType
      }
    });

    const fallbackSections = this.buildFallbackSections({
      applicationId: application.id,
      jobId: application.job.id,
      stage: application.currentStage,
      requirementCoverage,
      fitScoreContext,
      hasCvProfile: Boolean(latestCvProfile),
      hasEmail: Boolean(application.candidate.email),
      hasPhone: Boolean(application.candidate.phone)
    });

    const generation = await this.provider.generate({
      taskType: "SCREENING_SUPPORT",
      schemaName: "screening_support_v1_tr",
      schema: defaultOutputSchema("screening_support_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt: mergeSystemPrompt(
        [
          "Turkce ve denetlenebilir recruiter screening destegi uret.",
          "Nihai karar verme, sadece destekleyici not, flag, risk ve eksik bilgi cikar.",
          "Once adayin role yakinligini direct fit / adjacent fit / weak fit mantigiyla zihninde konumlandir, sonra screening yorumunu buna gore kur.",
          "Risk sadece somut uyumsuzluk, negatif sinyal veya rolu dogrudan etkileyen dikkat noktasi olsun.",
          "Eksik bilgi ile riski asla ayni madde olarak yazma.",
          "Normal veya notr bilgileri sorun gibi gostermeme.",
          "Lokasyon veya ulasim konusunu yalnizca rol uzaktan degilse ve duzenli fiziksel katilim bekleniyorsa risk olarak yorumla.",
          "Job requirement'lar icinde zorunlu ve tercih edilen ayrimini dikkate al.",
          "Ileri derece dil, belge veya deneyim ancak ilanda acikca isteniyorsa risk veya arti olarak yorumlanabilir.",
          "Facts alanina sadece dogrulanmis veri yaz; yorumlari interpretation alaninda tut.",
          "Recommended outcome alaninda ADVANCE kullanacaksan bunu yalnizca yeterli pozitif kanit varsa yap.",
          "Aday rolin cekirdek gereksinimlerine belirgin bicimde alakasizsa veya role yakin deneyim neredeyse yoksa HOLD yerine REVIEW oner.",
          "Adjacent profillerde otomatik asiri negatif veya asiri pozitif davranma; cekirdek execution ve kritik gap'leri ayri ayri tart.",
          "Ayni capability'yi hem guclu yan hem eksik bilgi gibi yazma; acik kanit varsa eksik diye tekrar etme.",
          "Direct fit ve guclu kanit olan adaylari gereksiz ihtiyatla REVIEW'a itme; interview-worthy ise ADVANCE demekten cekinme.",
          "Role acikca alakasiz profilleri de profesyonel gorunuyor diye HOLD veya ADVANCE'a yumusatma; REVIEW oner.",
          "Fit score ve requirementCoverage alanlari recruiter icin hazirlanmis baglamsal sinyallerdir; bunlari gormezden gelme ama mekanik tek kurala da indirme."
        ].join(" "),
        promptTemplate
      ),
      userPrompt: mergeJsonUserPrompt({
        task: "SCREENING_SUPPORT",
        locale: "tr-TR",
        application: {
          id: application.id,
          currentStage: application.currentStage,
          stageUpdatedAt: application.stageUpdatedAt.toISOString()
        },
        candidate: {
          id: application.candidate.id,
          fullName: application.candidate.fullName,
          phone: application.candidate.phone,
          email: application.candidate.email,
          source: application.candidate.source
        },
        job: {
          id: application.job.id,
          title: application.job.title,
          roleFamily: application.job.roleFamily,
          locationText: application.job.locationText,
          shiftType: application.job.shiftType,
          jdText: application.job.jdText,
          requirements: application.job.requirements.map((item) => ({
            id: item.id,
            key: item.key,
            value: item.value,
            required: item.required
          }))
        },
        cvParsedProfile: latestCvProfile,
        fitScore: fitScoreContext,
        requirementCoverage,
        screeningDecisionContext,
        scoringRubric: rubric?.rubricJson ?? null,
        instructions: [
          "facts/interpretation/recommendation ayrimini koru",
          "missingInformation, recruiter'in tamamlayabilecegi acik maddeler olsun",
          "Risk yalnizca somut uyumsuzluk veya negatif sinyal olsun; belirsizlik ve eksik bilgiyi risk listesine tasima",
          "recommendedOutcome alaninda REJECT kullanma",
          "recommendation.action ile recommendedOutcome birbiriyle tutarli olsun; 'mulakata davet et' veya acikca ileri tasima oneriyorsan recommendedOutcome ADVANCE olmali",
          "Role belirgin bicimde alakasiz adaylarda recruiter'a vakit kazandiracak sekilde REVIEW oner; sirf eksik bilgi var diye HOLD'a kacma",
          "Lokasyon riskini yalnizca job.shiftType, job.locationText, job.jdText veya requirement'lar fiziksel katilim gerektiriyorsa one cikar; remote rollerde salt farkli sehirde olmayi risk sayma",
          "facts alanina aday adi gibi zaten bilinen kimlik bilgilerini yazma",
          "facts alaninda mumkunse job requirement karsiligi olan kanitlari yaz",
          "Interpretation alaninda sadece role etkisi olan yargilar kur; oznel veya abartili olumlu/olumsuz dil kullanma",
          "Eksik veri ile riski ayni madde veya ayni tema olarak tekrar etme",
          "screeningDecisionContext icindeki strongestFitAreas, weakestFitAreas ve unresolvedRequirements alanlarini okuyup yorumu buna gore kur",
          "screeningDecisionContext.outcomeCalibrationGuide alanindaki ADVANCE/HOLD/REVIEW mantigini aktif uygula",
          "screeningDecisionContext.requirementValidationGuide alanindaki notu dikkate al; validation gereken requirement, capability yok demek degildir",
          "Adayi zihninde direct fit, adjacent fit veya weak fit olarak konumlandir; bunu acikca yazmana gerek yok ama outcome ve yorum buna gore olsun",
          "Adjacent profilleri tamamen alakasiz gibi itme; ama cekirdek execution veya kanal kaniti yoksa ADVANCE verme",
          "Role-fit guclu ve interview icin yeterli kanit varsa ADVANCE oner; sadece eksik detaylar var diye REVIEW'a kacma",
          "HOLD yalnizca umut verici ama sonucu gercekten degistirebilecek 1-2 kritik teyit noktasi varsa kullan",
          "Role-fit zayif veya acikca alakasiz adaylarda REVIEW oner",
          "Fit score'u mekanik kopyalama; fit score, requirementCoverage ve cvParsedProfile birbiriyle beraber yorumlansin"
        ]
      }, promptTemplate)
    });

    const sections = this.sanitizeSections(
      normalizeStructuredSections(generation.output, fallbackSections)
    );
    const confidence = Math.min(
      this.policy.normalizeConfidence(sections.confidence, fallbackSections.confidence),
      this.deriveConfidenceCap({
        hasCvProfile: Boolean(latestCvProfile),
        requirementCoverage,
        fitScoreContext,
        missingInformationCount: sections.missingInformation.length
      })
    );
    const uncertaintyLevel = this.policy.uncertaintyLevel(confidence);

    const rubricNotes = this.summarizeRubric(rubric?.rubricJson);
    const screeningSupport = this.buildScreeningSupportView({
      sections,
      hasCvProfile: Boolean(latestCvProfile),
      stage: application.currentStage,
      applicationId: application.id,
      candidateId: application.candidate.id,
      jobId: application.job.id
    });
    const recommendedOutcome = this.resolveRecommendedOutcome({
      recommendedOutcome: sections.recommendedOutcome,
      recommendationAction: sections.recommendationAction,
      hasCvProfile: Boolean(latestCvProfile),
      fitScoreContext,
      requirementCoverage,
      missingInformationCount: sections.missingInformation.length
    });
    const recommendationAction = this.resolveRecommendationAction({
      recommendationAction: sections.recommendationAction,
      recommendedOutcome
    });

    return {
      outputJson: toOutputJson({
        schemaVersion: "screening_support.v1.tr",
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        fallback: generation.mode === "deterministic_fallback",
        facts: sections.facts,
        interpretation: sections.interpretation,
        recommendation: {
          summary: sections.recommendationSummary,
          action: recommendationAction,
          recommendedOutcome
        },
        flags: sections.flags,
        missingInformation: sections.missingInformation,
        uncertainty: {
          level: uncertaintyLevel,
          reasons: sections.uncertaintyReasons,
          confidence
        },
        evidenceLinks: sections.evidenceLinks,
        additional: {
          screeningSupport: {
            ...screeningSupport,
            rubric: rubricNotes,
            recruiterReviewSafe: true
          }
        }
      }),
      uncertaintyJson: asJsonObject({
        level: uncertaintyLevel,
        confidence,
        reasons: sections.uncertaintyReasons
      }),
      guardrailFlags: asJsonObject(this.policy.getGuardrailFlags(AiTaskType.SCREENING_SUPPORT)),
      providerKey: generation.providerKey,
      providerMode: generation.mode,
      modelKey: generation.modelKey,
      promptVersion: generation.promptVersion,
      policyVersion: this.policy.policyVersion
    };
  }

  private async loadPromptTemplate(
    tenantId: string,
    taskRunId: string
  ): Promise<LoadedPromptTemplate | null> {
    const run = await this.prisma.aiTaskRun.findUnique({
      where: {
        id: taskRunId
      },
      select: {
        promptTemplateId: true
      }
    });

    if (run?.promptTemplateId) {
      const byId = await this.prisma.aiPromptTemplate.findFirst({
        where: {
          id: run.promptTemplateId,
          tenantId,
          stage: AiTaskType.SCREENING_SUPPORT
        },
        select: {
          key: true,
          version: true,
          systemPrompt: true,
          userPrompt: true
        }
      });

      if (byId) {
        return byId;
      }
    }

    return this.prisma.aiPromptTemplate.findFirst({
      where: {
        tenantId,
        stage: AiTaskType.SCREENING_SUPPORT,
        isActive: true
      },
      orderBy: {
        version: "desc"
      },
      select: {
        key: true,
        version: true,
        systemPrompt: true,
        userPrompt: true
      }
    });
  }

  private async loadRubric(tenantId: string, taskRunId: string, roleFamily: string) {
    const run = await this.prisma.aiTaskRun.findUnique({
      where: {
        id: taskRunId
      },
      select: {
        rubricId: true
      }
    });

    if (run?.rubricId) {
      const byId = await this.prisma.scoringRubric.findFirst({
        where: {
          id: run.rubricId,
          tenantId,
          isActive: true
        }
      });

      if (byId) {
        return byId;
      }
    }

    return this.prisma.scoringRubric.findFirst({
      where: {
        tenantId,
        domain: roleFamily,
        isActive: true
      },
      orderBy: {
        version: "desc"
      }
    });
  }

  private summarizeRubric(rubricJson: unknown) {
    const rubric = toRecord(rubricJson);
    const dimensionsRaw = Array.isArray(rubric.dimensions) ? rubric.dimensions : [];

    const dimensions = dimensionsRaw
      .map((item) => toRecord(item))
      .map((item) => ({
        key: typeof item.key === "string" ? item.key : "unknown",
        weight: typeof item.weight === "number" ? item.weight : null
      }));

    return {
      dimensions,
      hasRubric: dimensions.length > 0
    };
  }

  private buildFallbackSections(input: {
    applicationId: string;
    jobId: string;
    stage: ApplicationStage;
    requirementCoverage: {
      requiredCount: number;
      matchedRequired: string[];
      partialRequired: string[];
      needsValidationRequired: string[];
      uncoveredRequired: string[];
      matchedPreferred: string[];
    };
    fitScoreContext: {
      overallScore: number;
      confidence: number;
      strengths: string[];
      risks: string[];
      missingInformation: string[];
      overallAssessment: string | null;
    } | null;
    hasCvProfile: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
  }): StructuredTaskSections {
    const missingInformation = [
      ...(input.hasCvProfile ? [] : ["cv_parsed_profile"]),
      ...(input.hasEmail ? [] : ["candidate_email"]),
      ...(input.hasPhone ? [] : ["candidate_phone"]),
      ...input.requirementCoverage.uncoveredRequired.map(
        (item) => `Zorunlu gereksinim teyidi: ${item}`
      )
    ];

    return {
      facts: [
        `Aktif stage: ${input.stage}`,
        `Zorunlu gereksinim eslesmesi: ${input.requirementCoverage.matchedRequired.length}/${input.requirementCoverage.requiredCount}`,
        ...(input.requirementCoverage.matchedRequired.length > 0
          ? [
              `CV'de dogrulanan ana sinyaller: ${input.requirementCoverage.matchedRequired
                .slice(0, 3)
                .join(", ")}`
            ]
          : []),
        ...(input.fitScoreContext
          ? [`Mevcut fit score: ${input.fitScoreContext.overallScore}/100`]
          : [])
      ],
      interpretation: [
        "Screening notlari uygulama, job gereksinimleri ve mevcut aday artefaktlari uzerinden olusturuldu.",
        input.hasCvProfile
          ? input.requirementCoverage.uncoveredRequired.length > 0
            ? `Bazı zorunlu gereksinimler CV'de net dogrulanmadi: ${input.requirementCoverage.uncoveredRequired
                .slice(0, 3)
                .join(", ")}`
            : "CV parse profili mevcut; recruiter detay teyidi yine gerekli."
          : "CV parse profili bulunmadigi icin screening yorumu kismen sinirlidir.",
        ...(input.fitScoreContext?.overallAssessment ? [input.fitScoreContext.overallAssessment] : [])
      ],
      recommendationSummary:
        "Adayi otomatik elemeden, kanitlanmayan alanlari teyit ederek recruiter ekraninda manuel degerlendir.",
      recommendationAction:
        input.requirementCoverage.uncoveredRequired.length > 0
          ? "Zorunlu gereksinimlerin karsiligini hedefli screening sorulariyla teyit et."
          : "Kilit operasyon ve uygunluk maddelerini recruiter gorusmesiyle teyit et.",
      recommendedOutcome:
        input.hasCvProfile && input.requirementCoverage.uncoveredRequired.length === 0 ? "HOLD" : "REVIEW",
      flags: [
        {
          code: input.hasCvProfile ? "MANUAL_REVIEW_REQUIRED" : "CV_PROFILE_MISSING",
          severity: input.hasCvProfile ? "medium" : "high",
          note: input.hasCvProfile
            ? "AI notlari destekleyicidir; nihai karar recruiter tarafindan verilmelidir."
            : "CV parse profili olmadan screening karar kalitesi duser."
        },
        ...(input.requirementCoverage.uncoveredRequired.length > 0
          ? [
              {
                code: "REQUIRED_EVIDENCE_MISSING",
                severity: "medium" as const,
                note: `Bazi zorunlu gereksinimler CV veya mevcut artefaktlarda net dogrulanmadi: ${input.requirementCoverage.uncoveredRequired
                  .slice(0, 2)
                  .join(", ")}`
              }
            ]
          : [])
      ],
      missingInformation,
      evidenceLinks: [
        {
          sourceType: "application",
          sourceRef: input.applicationId,
          claim: "Screening application baglaminda degerlendirildi."
        },
        {
          sourceType: "job",
          sourceRef: input.jobId,
          claim: "Job gereksinimleri screening yorumuna dahil edildi."
        }
      ],
      confidence:
        input.hasCvProfile && input.requirementCoverage.requiredCount > 0
          ? 0.64
          : input.hasCvProfile
            ? 0.58
            : 0.43,
      uncertaintyReasons: input.hasCvProfile
        ? input.requirementCoverage.uncoveredRequired.length > 0
          ? ["Bazi zorunlu gereksinimler mevcut artefaktlarda dogrudan kanitlanmadi."]
          : ["CV profili mevcut ancak insan teyidi zorunlu."]
        : ["CV parse profili olmadigi icin screening ciktisi kisitli."]
    };
  }

  private buildScreeningSupportView(input: {
    sections: StructuredTaskSections;
    hasCvProfile: boolean;
    stage: ApplicationStage;
    applicationId: string;
    candidateId: string;
    jobId: string;
  }) {
    const strengths = this.uniqueStrings([
      ...input.sections.facts,
      ...input.sections.interpretation.filter((line) => /uyum|deneyim|dogrulan|teyit|guclu/i.test(line))
    ]).slice(0, 5);
    const risks = [
      ...input.sections.flags
        .filter((flag) =>
          flag.severity === "high"
          || /uyumsuz|yetersiz|risk|sinirli|tutarsiz/i.test(flag.note)
        )
        .map((flag) => `${flag.code}: ${flag.note}`),
      ...input.sections.interpretation
        .filter((line) => /uyumsuz|yetersiz|sinirli|zayif|risk|kritik|tutarsiz/i.test(line))
        .slice(0, 4)
    ].slice(0, 6);
    const likelyFitObservations = input.sections.interpretation
      .filter((line) => /uyum|fit|uygun|pozitif|deneyim/i.test(line))
      .slice(0, 5);
    const followUpTopics = input.sections.missingInformation.map((item) => `Eksik alan: ${item}`);

    return {
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      stage: input.stage,
      shortSummary: input.sections.recommendationSummary,
      strengths,
      risks,
      likelyFitObservations,
      followUpTopics:
        followUpTopics.length > 0
          ? followUpTopics
          : [
              input.hasCvProfile
                ? "Pozisyona ozel yetkinlik dogrulama sorulari"
                : "CV parse profili olusturulduktan sonra ikinci degerlendirme"
            ],
      missingInformation: input.sections.missingInformation,
      evidenceReferences: input.sections.evidenceLinks,
      uncertainty: {
        reasons: input.sections.uncertaintyReasons,
        confidence: input.sections.confidence
      }
    };
  }

  private buildFitScoreContext(
    fitScore: {
      overallScore: Prisma.Decimal;
      confidence: Prisma.Decimal;
      subScoresJson: unknown;
      strengthsJson: unknown;
      risksJson: unknown;
      missingInfoJson: unknown;
      reasoningJson: unknown;
    } | null
  ) {
    if (!fitScore) {
      return null;
    }

    const reasoning = toRecord(fitScore.reasoningJson);

    return {
      overallScore: Number(fitScore.overallScore),
      confidence: Number(fitScore.confidence),
      categories: this.extractFitScoreCategories(fitScore.subScoresJson),
      strengths: this.toStringList(fitScore.strengthsJson),
      risks: this.toStringList(fitScore.risksJson),
      missingInformation: this.toStringList(fitScore.missingInfoJson),
      overallAssessment:
        typeof reasoning.overallAssessment === "string" ? reasoning.overallAssessment : null
    };
  }

  private buildScreeningDecisionContext(input: {
    fitScoreContext: {
      overallScore: number;
      confidence: number;
      categories: Array<{ key: string; label: string; score: number }>;
      strengths: string[];
      risks: string[];
      missingInformation: string[];
      overallAssessment: string | null;
    } | null;
    requirementCoverage: {
      requiredCount: number;
      matchedRequired: string[];
      partialRequired: string[];
      needsValidationRequired: string[];
      uncoveredRequired: string[];
      matchedPreferred: string[];
    };
    job: {
      title: string;
      roleFamily: string;
      locationText: string | null;
      shiftType: string | null;
    };
  }) {
    const sortedCategories = [...(input.fitScoreContext?.categories ?? [])]
      .sort((left, right) => right.score - left.score);

    return {
      roleSummary: {
        title: input.job.title,
        roleFamily: input.job.roleFamily,
        workModel: input.job.shiftType,
        locationText: input.job.locationText
      },
      strongestFitAreas: sortedCategories.slice(0, 3).map((item) => ({
        label: item.label,
        score: item.score
      })),
      weakestFitAreas: sortedCategories.slice(-2).map((item) => ({
        label: item.label,
        score: item.score
      })),
      fitStrengthSignals: (input.fitScoreContext?.strengths ?? []).slice(0, 5),
      fitRiskSignals: (input.fitScoreContext?.risks ?? []).slice(0, 5),
      unresolvedRequirements: input.requirementCoverage.uncoveredRequired.slice(0, 5),
      matchedRequirements: input.requirementCoverage.matchedRequired.slice(0, 5),
      partialRequirements: input.requirementCoverage.partialRequired.slice(0, 5),
      requirementsNeedingValidation: input.requirementCoverage.needsValidationRequired.slice(0, 5),
      fitOverallScore: input.fitScoreContext?.overallScore ?? null,
      fitConfidence: input.fitScoreContext?.confidence ?? null,
      requirementValidationGuide: "matchedRequirements acik veya guclu kismi kaniti, partialRequirements kismi kaniti, requirementsNeedingValidation ise capability olabilir ama ayrinti net degil durumunu anlatir. unresolvedRequirements listesi ise belirgin kanit gorulmeyen maddeleri temsil eder.",
      outcomeCalibrationGuide: {
        advance: "Aday role direct fit veya guclu direct-adjacent fit ise, cekirdek execution kaniti belirginse ve recruiter'in gorusmeye almasi makulse ADVANCE kullan.",
        hold: "Aday umut verici ama 1-2 kritik teyit sonucu belirgin bicimde degistirecekse HOLD kullan.",
        review: "Aday role zayif uyuyor, acikca alakasiz kaliyor veya cekirdek execution kaniti ciddi eksikse REVIEW kullan.",
        caution: [
          "Eksik bilgi tek basina REVIEW sebebi degildir.",
          "Genel profesyonellik, alakasiz deneyim veya sadece yonetici title'i ADVANCE icin yeterli degildir.",
          "Guclu direct fit adaylari asiri ihtiyatla asagi cekme."
        ]
      }
    };
  }

  private buildRequirementCoverage(
    requirements: Array<{ key: string; value: string; required: boolean }>,
    profileJson: unknown
  ) {
    const evidenceCorpus = this.buildRequirementEvidenceCorpus(profileJson);
    const required = requirements.filter((item) => item.required);
    const preferred = requirements.filter((item) => !item.required);
    const requiredStates = required.map((item) => ({
      item,
      status: this.evaluateRequirementEvidence(item, evidenceCorpus)
    }));
    const preferredStates = preferred.map((item) => ({
      item,
      status: this.evaluateRequirementEvidence(item, evidenceCorpus)
    }));

    const matchedRequired = requiredStates
      .filter(({ status }) => status === "proven" || status === "partial")
      .map(({ item }) => item.value);
    const partialRequired = requiredStates
      .filter(({ status }) => status === "partial")
      .map(({ item }) => item.value);
    const needsValidationRequired = requiredStates
      .filter(({ status }) => status === "needs_validation")
      .map(({ item }) => item.value);
    const uncoveredRequired = requiredStates
      .filter(({ status }) => status === "absent")
      .map(({ item }) => item.value);
    const matchedPreferred = preferredStates
      .filter(({ status }) => status === "proven" || status === "partial")
      .map(({ item }) => item.value);

    return {
      requiredCount: required.length,
      matchedRequired,
      partialRequired,
      needsValidationRequired,
      uncoveredRequired,
      matchedPreferred
    };
  }

  private buildRequirementEvidenceCorpus(profileJson: unknown) {
    const profile = toRecord(profileJson);
    const extractedFacts = toRecord(profile.extractedFacts);
    const normalizedSummary = toRecord(profile.normalizedSummary);

    return [
      ...this.toStringList(extractedFacts.skills),
      ...this.toStringList(extractedFacts.recentRoles),
      ...this.toStringList(extractedFacts.workHistorySignals),
      ...this.toStringList(extractedFacts.sectorSignals),
      ...this.toStringList(extractedFacts.certifications),
      ...this.toStringList(extractedFacts.languages),
      ...this.toStringList(normalizedSummary.likelyFitSignals),
      typeof normalizedSummary.shortSummary === "string" ? normalizedSummary.shortSummary : "",
      typeof normalizedSummary.coreWorkHistorySummary === "string"
        ? normalizedSummary.coreWorkHistorySummary
        : ""
    ]
      .join(" ")
      .toLocaleLowerCase("tr-TR");
  }

  private evaluateRequirementEvidence(
    requirement: { key: string; value: string; required: boolean },
    evidenceCorpus: string
  ) {
    const groups = this.requirementPatternGroups(
      requirement.key.toLocaleLowerCase("tr-TR"),
      requirement.value.toLocaleLowerCase("tr-TR")
    );
    const matches = groups.filter((group) => group.pattern.test(evidenceCorpus));

    if (groups.length > 0 && matches.length >= Math.min(2, groups.length)) {
      return "proven" as const;
    }

    if (groups.length > 0 && matches.length === 1) {
      return "partial" as const;
    }

    if (this.matchesRequirementEvidence(requirement.value, evidenceCorpus)) {
      return "needs_validation" as const;
    }

    return "absent" as const;
  }

  private requirementPatternGroups(normalizedKey: string, normalizedValue: string) {
    const groups: Array<{ pattern: RegExp }> = [];

    if (/experience|deneyim/.test(normalizedKey)) {
      groups.push(
        { pattern: /(performance marketing|paid media|paid search|paid social|growth marketing|digital acquisition|performance marketing specialist|paid media specialist)/ },
        { pattern: /(\b[4-9]\s*yil|\b1[0-9]\s*yil|senior|lead|manager|uzmani|specialist)/ }
      );
    }

    if (/lead|demand/.test(normalizedKey) || /lead generation|demand generation/.test(normalizedValue)) {
      groups.push({ pattern: /(lead generation|demand generation|mql|sql|demo|pipeline|funnel|conversion optimization|donusum)/ });
    }

    if (/analytics|attribution/.test(normalizedKey) || /ga4|gtm|attribution|rapor/.test(normalizedValue)) {
      groups.push(
        { pattern: /(ga4|google analytics 4|analytics)/ },
        { pattern: /(gtm|tag manager|tracking|tag)/ },
        { pattern: /(attribution|dashboard|looker studio|reporting|raporlama)/ }
      );
    }

    if (/budget|butce/.test(normalizedKey) || /butce|optimizasyon/.test(normalizedValue)) {
      groups.push(
        { pattern: /(butce|budget|media spend|m tl|tl reklam butcesi|reklam butcesi)/ },
        { pattern: /(optimiz|optimization|roas|cac|cpl|cpa)/ }
      );
    }

    if (/hands_on/.test(normalizedKey) || /bireysel katk/i.test(normalizedValue)) {
      groups.push(
        { pattern: /(hands-on|bizzat|aktif olarak|ellerim kirlenmeye|kampanya optimize|hesaplarini bizzat optimize|kurdum|yonettim)/ },
        { pattern: /(kampanya|ads|google|meta|linkedin)/ }
      );
    }

    if (/location/.test(normalizedKey) || /cekmekoy|hibrit|ofis/.test(normalizedValue)) {
      groups.push(
        { pattern: /(hibrit|hybrid|ofis|duzenli katilim|ofise gelebilirim)/ },
        { pattern: /(ulasim|tasinabilirim|relocation|istanbul'a tasinabilirim|duzenli gidip gelebilirim)/ }
      );
    }

    if (/work_model/.test(normalizedKey) || /remote-only/.test(normalizedValue)) {
      groups.push({ pattern: /(hibrit|hybrid|ofis|remote disinda|uzaktan disinda)/ });
    }

    if (/communication/.test(normalizedKey) || /satis|tasarim|urun/.test(normalizedValue)) {
      groups.push(
        { pattern: /(satis ekibi|sales)/ },
        { pattern: /(tasarim|design|urun|product|cross-functional|cross functional|ekiplerle)/ }
      );
    }

    if (/english/.test(normalizedKey) || /ingilizce/.test(normalizedValue)) {
      groups.push({ pattern: /(ingilizce|english|advanced english|fluent english)/ });
    }

    return groups;
  }

  private matchesRequirementEvidence(requirement: string, evidenceCorpus: string) {
    const ignored = new Set([
      "ve",
      "ile",
      "icin",
      "olan",
      "gore",
      "uyum",
      "deneyimi",
      "deneyim",
      "bilgisi",
      "hakimiyet",
      "tecrube",
      "tecrubesi",
      "uzman",
      "uzmani",
      "yonetim",
      "yonetici",
      "alan",
      "teknik",
      "beceri",
      "yetkinlik",
      "seviyesi",
      "pozisyon",
      "rol",
      "ekip",
      "birim"
    ]);
    const tokens = requirement
      .toLocaleLowerCase("tr-TR")
      .split(/[^a-z0-9çğıöşü]+/i)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3 && !ignored.has(item));

    if (tokens.length === 0) {
      return false;
    }

    const matchedTokens = tokens.filter((token) => evidenceCorpus.includes(token));

    if (tokens.length === 1) {
      return matchedTokens.length === 1;
    }

    if (tokens.length === 2) {
      return matchedTokens.length === 2;
    }

    return matchedTokens.length >= Math.max(2, Math.ceil(tokens.length * 0.6));
  }

  private sanitizeSections(sections: StructuredTaskSections): StructuredTaskSections {
    const missingInformation = this.uniqueStrings(sections.missingInformation).slice(0, 8);
    const facts = this.uniqueStrings(
      sections.facts.filter((line) => !/^Aday:|^Pozisyon:/i.test(line))
    ).slice(0, 8);
    const interpretation = this.uniqueStrings(
      sections.interpretation.filter(
        (line) =>
          !missingInformation.some(
            (missing) => this.textsOverlap(line, missing) && /eksik|teyit|dogrulanmadi|belirsiz/i.test(line)
          )
      )
    ).slice(0, 6);
    const flags = this.uniqueFlags(
      sections.flags.filter(
        (flag) =>
          !missingInformation.some(
            (missing) => this.textsOverlap(flag.note, missing) && /eksik|teyit|dogrulanmadi|belirsiz/i.test(flag.note)
          )
      )
    ).slice(0, 6);

    return {
      ...sections,
      facts: facts.length > 0 ? facts : sections.facts.slice(0, 6),
      interpretation,
      flags,
      missingInformation,
      uncertaintyReasons: this.uniqueStrings(sections.uncertaintyReasons).slice(0, 6),
      evidenceLinks: this.uniqueEvidenceLinks(sections.evidenceLinks).slice(0, 10)
    };
  }

  private deriveConfidenceCap(input: {
    hasCvProfile: boolean;
    requirementCoverage: {
      requiredCount: number;
      matchedRequired: string[];
      uncoveredRequired: string[];
    };
    fitScoreContext: {
      overallScore: number;
      confidence: number;
    } | null;
    missingInformationCount: number;
  }) {
    let cap = input.hasCvProfile ? 0.84 : 0.44;

    if (input.requirementCoverage.requiredCount > 0) {
      if (input.requirementCoverage.matchedRequired.length === 0) {
        cap = Math.min(cap, 0.52);
      } else if (input.requirementCoverage.uncoveredRequired.length > 0) {
        cap = Math.min(cap, 0.68);
      }
    }

    if (input.fitScoreContext && input.fitScoreContext.confidence < 0.55) {
      cap = Math.min(cap, 0.66);
    }

    if (input.missingInformationCount >= 4) {
      cap = Math.min(cap, 0.58);
    }

    return cap;
  }

  private limitRecommendedOutcome(
    recommendedOutcome: string | undefined,
    input: {
      hasCvProfile: boolean;
    }
  ) {
    const normalized = this.policy.normalizeRecommendation(recommendedOutcome);

    if (!input.hasCvProfile) {
      return "REVIEW";
    }

    return normalized;
  }

  private resolveRecommendedOutcome(input: {
    recommendedOutcome: string | undefined;
    recommendationAction: string | undefined;
    hasCvProfile: boolean;
    fitScoreContext: {
      overallScore: number;
      confidence: number;
    } | null;
    requirementCoverage: {
      uncoveredRequired: string[];
    };
    missingInformationCount: number;
  }) {
    return this.limitRecommendedOutcome(input.recommendedOutcome, {
      hasCvProfile: input.hasCvProfile
    });
  }

  private resolveRecommendationAction(input: {
    recommendationAction: string | undefined;
    recommendedOutcome: "ADVANCE" | "HOLD" | "REVIEW";
  }) {
    const action = input.recommendationAction?.trim();
    const normalizedAction = (action ?? "")
      .toLocaleLowerCase("tr-TR");

    if (input.recommendedOutcome === "ADVANCE") {
      if (/mulakata davet|mülakata davet|ilerlet|ileri tasi|gorusmeye al|görüşmeye al|advance/.test(normalizedAction)) {
        return action ?? "Adayi mulakata davet et.";
      }

      return "Adayi mulakata davet et.";
    }

    if (input.recommendedOutcome === "HOLD") {
      if (/incele|dogrula|degerlendir|tut|hold/.test(normalizedAction)) {
        return action ?? "Adayi recruiter incelemesinde tut; kritik noktalar dogrulandiktan sonra ilerletme karari ver.";
      }

      return "Adayi recruiter incelemesinde tut; kritik noktalar dogrulandiktan sonra ilerletme karari ver.";
    }

    if (/incele|review|degerlendir|manuel/.test(normalizedAction)) {
      return action ?? "Adayi manuel recruiter incelemesine al.";
    }

    return "Adayi manuel recruiter incelemesine al.";
  }

  private toStringList(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  private extractFitScoreCategories(value: unknown) {
    const record = toRecord(value);
    const categories = Array.isArray(record.categories) ? record.categories : [];

    return categories
      .map((item) => toRecord(item))
      .map((item) => ({
        key: typeof item.key === "string" ? item.key : "unknown",
        label: typeof item.label === "string" ? item.label : "Kategori",
        score: typeof item.score === "number" ? item.score : Number(item.score ?? 0)
      }))
      .filter((item) => Number.isFinite(item.score))
      .slice(0, 6);
  }

  private uniqueStrings(values: string[]) {
    const seen = new Set<string>();
    const output: string[] = [];

    for (const value of values.map((item) => item.trim()).filter(Boolean)) {
      const normalized = value
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      output.push(value);
    }

    return output;
  }

  private uniqueFlags(
    values: Array<{ code: string; severity: "low" | "medium" | "high"; note: string }>
  ) {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = `${value.code}:${value.note.trim().toLocaleLowerCase("tr-TR")}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private uniqueEvidenceLinks(values: Array<{ sourceType: string; sourceRef: string; claim: string }>) {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = `${value.sourceType}:${value.sourceRef}:${value.claim.trim().toLocaleLowerCase("tr-TR")}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private textsOverlap(left: string, right: string) {
    const leftTokens = left
      .toLocaleLowerCase("tr-TR")
      .split(/[^a-z0-9çğıöşü]+/i)
      .filter((token) => token.length >= 4);
    const rightTokens = right
      .toLocaleLowerCase("tr-TR")
      .split(/[^a-z0-9çğıöşü]+/i)
      .filter((token) => token.length >= 4);

    return leftTokens.some((token) => rightTokens.includes(token));
  }
}
