import { AiTaskType, ApplicationStage, PrismaClient } from "@prisma/client";
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
    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const rubric = await this.loadRubric(context.tenantId, context.taskRun.id, application.job.roleFamily);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "screening_support.v1.tr";

    const fallbackSections = this.buildFallbackSections({
      applicationId: application.id,
      candidateName: application.candidate.fullName,
      candidateId: application.candidate.id,
      jobId: application.job.id,
      jobTitle: application.job.title,
      stage: application.currentStage,
      requirementCount: application.job.requirements.length,
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
      systemPrompt:
        "Turkce ve denetlenebilir recruiter screening destegi uret. Nihai karar verme, sadece destekleyici not, flag, risk ve eksik bilgi cikar. Eksik bilgiyi risk diye tekrar yazma.",
      userPrompt: JSON.stringify({
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
          requirements: application.job.requirements.map((item) => ({
            id: item.id,
            key: item.key,
            value: item.value,
            required: item.required
          }))
        },
        cvParsedProfile: latestCvProfile,
        scoringRubric: rubric?.rubricJson ?? null,
        instructions: [
          "facts/interpretation/recommendation ayrimini koru",
          "missingInformation, recruiter'in tamamlayabilecegi acik maddeler olsun",
          "Risk yalnizca somut uyumsuzluk veya negatif sinyal olsun; belirsizlik ve eksik bilgiyi risk listesine tasima",
          "recommendedOutcome alaninda REJECT kullanma"
        ]
      })
    });

    const sections = normalizeStructuredSections(generation.output, fallbackSections);
    const confidence = this.policy.normalizeConfidence(sections.confidence, fallbackSections.confidence);
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
          action: sections.recommendationAction,
          recommendedOutcome: this.policy.normalizeRecommendation(sections.recommendedOutcome)
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

  private async loadPromptTemplate(tenantId: string, taskRunId: string) {
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
          version: true
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
        version: true
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
    candidateName: string;
    candidateId: string;
    jobId: string;
    jobTitle: string;
    stage: ApplicationStage;
    requirementCount: number;
    hasCvProfile: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
  }): StructuredTaskSections {
    const missingInformation = [
      ...(input.hasCvProfile ? [] : ["cv_parsed_profile"]),
      ...(input.hasEmail ? [] : ["candidate_email"]),
      ...(input.hasPhone ? [] : ["candidate_phone"])
    ];

    return {
      facts: [
        `Aday: ${input.candidateName}`,
        `Pozisyon: ${input.jobTitle}`,
        `Aktif stage: ${input.stage}`,
        `Job requirement sayisi: ${input.requirementCount}`
      ],
      interpretation: [
        "Screening notlari uygulama ve job metadata'si uzerinden olusturuldu.",
        input.hasCvProfile
          ? "CV parse profili mevcut; recruiter detay teyidi yine gerekli."
          : "CV parse profili bulunmadigi icin screening yorumu kismen sinirlidir."
      ],
      recommendationSummary:
        "Adayi otomatik elemeden, eksik alanlari tamamlayarak recruiter ekraninda manuel degerlendir.",
      recommendationAction:
        "Eksik iletisim/CV bilgilerini tamamlatip standard screening sorulari ile teyit et.",
      recommendedOutcome: "REVIEW",
      flags: [
        {
          code: input.hasCvProfile ? "MANUAL_REVIEW_REQUIRED" : "CV_PROFILE_MISSING",
          severity: input.hasCvProfile ? "medium" : "high",
          note: input.hasCvProfile
            ? "AI notlari destekleyicidir; nihai karar recruiter tarafindan verilmelidir."
            : "CV parse profili olmadan screening karar kalitesi duser."
        }
      ],
      missingInformation,
      evidenceLinks: [
        {
          sourceType: "application",
          sourceRef: input.applicationId,
          claim: "Aday basvuru baglami screening icin kullanildi."
        },
        {
          sourceType: "job",
          sourceRef: input.jobId,
          claim: "Job gereksinimleri screening notuna dahil edildi."
        }
      ],
      confidence: input.hasCvProfile ? 0.62 : 0.43,
      uncertaintyReasons: input.hasCvProfile
        ? ["CV profili mevcut ancak insan teyidi zorunlu."]
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
    const strengths = input.sections.facts.slice(0, 5);
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
}
