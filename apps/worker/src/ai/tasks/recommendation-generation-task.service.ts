import { AiTaskType, PrismaClient } from "@prisma/client";
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

export class RecommendationGenerationTaskService {
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
        "RECOMMENDATION_GENERATION task'i icin applicationId zorunludur."
      );
    }

    const application = await this.prisma.candidateApplication.findFirst({
      where: {
        id: applicationId,
        tenantId: context.tenantId
      },
      include: {
        candidate: true,
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

    const latestReport = await this.prisma.aiReport.findFirst({
      where: {
        tenantId: context.tenantId,
        applicationId
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const latestScreening = await this.prisma.aiTaskRun.findFirst({
      where: {
        tenantId: context.tenantId,
        taskType: AiTaskType.SCREENING_SUPPORT,
        applicationId,
        status: "SUCCEEDED"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const latestCvParsing = await this.prisma.aiTaskRun.findFirst({
      where: {
        tenantId: context.tenantId,
        taskType: AiTaskType.CV_PARSING,
        candidateId: application.candidateId,
        status: "SUCCEEDED"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const rubric = await this.loadRubric(context.tenantId, context.taskRun.id, application.job.roleFamily);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "recommendation_generation.v1.tr";

    const fallbackSections = this.buildFallbackSections({
      applicationId: application.id,
      candidateName: application.candidate.fullName,
      jobTitle: application.job.title,
      hasReport: Boolean(latestReport),
      hasScreening: Boolean(latestScreening?.outputJson),
      hasCvParsing: Boolean(latestCvParsing?.outputJson)
    });

    const generation = await this.provider.generate({
      taskType: "RECOMMENDATION_GENERATION",
      schemaName: "recommendation_generation_v1_tr",
      schema: defaultOutputSchema("recommendation_generation_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt:
        "Turkce recruiter odakli recommendation uret. Nihai karar verme, otomatik ret yapma. Ciktilar denetlenebilir ve kanit baglantili olsun.",
      userPrompt: JSON.stringify({
        task: "RECOMMENDATION_GENERATION",
        locale: "tr-TR",
        application: {
          id: application.id,
          currentStage: application.currentStage,
          stageUpdatedAt: application.stageUpdatedAt.toISOString()
        },
        candidate: {
          id: application.candidate.id,
          fullName: application.candidate.fullName,
          email: application.candidate.email,
          phone: application.candidate.phone,
          source: application.candidate.source
        },
        job: {
          id: application.job.id,
          title: application.job.title,
          roleFamily: application.job.roleFamily,
          requirements: application.job.requirements.map((item) => ({
            key: item.key,
            value: item.value,
            required: item.required
          }))
        },
        latestReport: latestReport
          ? {
              id: latestReport.id,
              recommendation: latestReport.recommendation,
              confidence: latestReport.confidence,
              createdAt: latestReport.createdAt.toISOString(),
              reportJson: latestReport.reportJson
            }
          : null,
        latestScreeningOutput: latestScreening?.outputJson ?? null,
        latestCvParsingOutput: latestCvParsing?.outputJson ?? null,
        scoringRubric: rubric?.rubricJson ?? null,
        instructions: [
          "recommendedOutcome alani REJECT olamaz",
          "recommendation summary recruiter aksiyonu icersin",
          "uncertainty reasons alanini bos birakma"
        ]
      })
    });

    const sections = normalizeStructuredSections(generation.output, fallbackSections);
    const confidence = this.policy.normalizeConfidence(sections.confidence, fallbackSections.confidence);
    const uncertaintyLevel = this.policy.uncertaintyLevel(confidence);
    const recommendation = this.policy.normalizeRecommendation(sections.recommendedOutcome);

    const summaryText = sections.recommendationSummary.slice(0, 700);
    const rationaleJson = {
      schemaVersion: "application_recommendation.v1.tr",
      facts: sections.facts,
      interpretation: sections.interpretation,
      recommendation: {
        summary: summaryText,
        action: sections.recommendationAction,
        recommendedOutcome: recommendation
      },
      flags: sections.flags,
      missingInformation: sections.missingInformation,
      evidenceLinks: sections.evidenceLinks,
      sourceArtifacts: {
        reportId: latestReport?.id ?? null,
        screeningTaskRunId: latestScreening?.id ?? null,
        cvParsingTaskRunId: latestCvParsing?.id ?? null
      },
      safety: {
        recruiterReviewRequired: true,
        autoDecisionApplied: false,
        autoRejectAllowed: false
      }
    };

    const uncertaintyJson = {
      level: uncertaintyLevel,
      confidence,
      reasons: sections.uncertaintyReasons,
      explicitReviewerAction: "Nihai karar icin recruiter onayi zorunludur."
    };

    const linkedSessionId = context.taskRun.sessionId ?? latestReport?.sessionId ?? null;
    const linkedSession = linkedSessionId
      ? await this.prisma.interviewSession.findFirst({
          where: {
            id: linkedSessionId,
            tenantId: context.tenantId,
            applicationId
          },
          select: {
            id: true,
            rubricKey: true,
            rubricVersion: true
          }
        })
      : null;

    const recommendationRecord = await this.prisma.applicationRecommendation.create({
      data: {
        tenantId: context.tenantId,
        applicationId,
        sessionId: linkedSession?.id ?? null,
        aiTaskRunId: context.taskRun.id,
        rubricKey: linkedSession?.rubricKey ?? rubric?.key ?? null,
        rubricVersion: linkedSession?.rubricVersion ?? rubric?.version ?? null,
        recommendation,
        confidence,
        summaryText,
        rationaleJson,
        uncertaintyJson,
        evidenceCount: sections.evidenceLinks.length,
        requiresHumanApproval: true,
        createdBy: context.taskRun.requestedBy
      }
    });

    return {
      outputJson: toOutputJson({
        schemaVersion: "recommendation_generation.v1.tr",
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        fallback: generation.mode === "deterministic_fallback",
        facts: sections.facts,
        interpretation: sections.interpretation,
        recommendation: {
          summary: summaryText,
          action: sections.recommendationAction,
          recommendedOutcome: recommendation
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
          recommendationId: recommendationRecord.id,
          requiresHumanApproval: recommendationRecord.requiresHumanApproval,
          evidenceCount: recommendationRecord.evidenceCount
        }
      }),
      uncertaintyJson: asJsonObject(uncertaintyJson),
      guardrailFlags: asJsonObject(this.policy.getGuardrailFlags(AiTaskType.RECOMMENDATION_GENERATION)),
      providerKey: generation.providerKey,
      providerMode: generation.mode,
      modelKey: generation.modelKey,
      promptVersion: generation.promptVersion,
      policyVersion: this.policy.policyVersion,
      artifacts: {
        recommendationId: recommendationRecord.id
      }
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
          stage: AiTaskType.RECOMMENDATION_GENERATION
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
        stage: AiTaskType.RECOMMENDATION_GENERATION,
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

  private buildFallbackSections(input: {
    applicationId: string;
    candidateName: string;
    jobTitle: string;
    hasReport: boolean;
    hasScreening: boolean;
    hasCvParsing: boolean;
  }): StructuredTaskSections {
    const missingInformation = [
      ...(input.hasReport ? [] : ["latest_ai_report"]),
      ...(input.hasScreening ? [] : ["screening_support_output"]),
      ...(input.hasCvParsing ? [] : ["cv_parsing_output"])
    ];

    return {
      facts: [
        `Aday: ${input.candidateName}`,
        `Pozisyon: ${input.jobTitle}`,
        `Application ID: ${input.applicationId}`,
        `Rapor var mi: ${input.hasReport ? "evet" : "hayir"}`
      ],
      interpretation: [
        "Recommendation artifact'i recruiter kararini desteklemek icin uretilir.",
        input.hasReport
          ? "En son AI raporu recommendation baglaminda dikkate alindi."
          : "AI raporu olmadigi icin recommendation daha yuksek belirsizlik tasir."
      ],
      recommendationSummary:
        "Aday icin otomatik karar uygulanmadi; recruiter onayi sonrasinda manuel stage karari alinmalidir.",
      recommendationAction:
        "Eksik artefaktlari tamamlayip hiring manager review oncesi recruiter degerlendirmesi yap.",
      recommendedOutcome: input.hasReport ? "HOLD" : "REVIEW",
      flags: [
        {
          code: input.hasReport ? "HUMAN_REVIEW_REQUIRED" : "REPORT_MISSING",
          severity: input.hasReport ? "medium" : "high",
          note: input.hasReport
            ? "Nihai karar sistemi otomatik uygulamaz; recruiter onayi gerekir."
            : "Rapor olmadan recommendation kesinlik seviyesi dusuktur."
        }
      ],
      missingInformation,
      evidenceLinks: [
        {
          sourceType: "application",
          sourceRef: input.applicationId,
          claim: "Recommendation bu application kaydi baglaminda olusturuldu."
        }
      ],
      confidence: input.hasReport ? 0.66 : 0.38,
      uncertaintyReasons: input.hasReport
        ? ["Recommendation destekleyicidir; nihai karar insan kontrolu gerektirir."]
        : ["Temel AI raporu eksik oldugu icin belirsizlik artmistir."]
    };
  }
}
