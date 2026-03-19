import {
  AiTaskType,
  Prisma,
  PrismaClient,
  Recommendation,
  type TranscriptSegment
} from "@prisma/client";
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
  type EvidenceLink,
  type StructuredTaskSections
} from "./task-output.utils.js";

export class ReportGenerationTaskService {
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
        "REPORT_GENERATION task'i icin applicationId zorunludur."
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

    const session = await this.resolveSession({
      tenantId: context.tenantId,
      applicationId,
      sessionId: context.taskRun.sessionId
    });

    if (!session) {
      throw new TaskProcessingError(
        "SESSION_REQUIRED",
        "REPORT_GENERATION task'i icin application baglaminda bir interview session bulunamadi.",
        false,
        {
          applicationId,
          sessionId: context.taskRun.sessionId
        }
      );
    }

    const transcriptSegments = session.transcript?.segments ?? [];
    const latestScreeningTask = await this.prisma.aiTaskRun.findFirst({
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

    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "report_generation.v1.tr";

    const fallbackSections = this.buildFallbackSections({
      candidateName: application.candidate.fullName,
      jobTitle: application.job.title,
      applicationId,
      sessionId: session.id,
      transcriptSegments,
      latestScreeningOutput: latestScreeningTask?.outputJson ?? null
    });

    const generation = await this.provider.generate({
      taskType: "REPORT_GENERATION",
      schemaName: "report_generation_v1_tr",
      schema: defaultOutputSchema("report_generation_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt:
        "Turkce recruiter raporu uret. Cikti sadece karar destegi olsun, otomatik nihai karar verme. Facts/interpretation/recommendation net ayrilsin.",
      userPrompt: JSON.stringify({
        task: "REPORT_GENERATION",
        locale: "tr-TR",
        application: {
          id: application.id,
          stage: application.currentStage,
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
        session: {
          id: session.id,
          status: session.status,
          mode: session.mode,
          startedAt: session.startedAt?.toISOString() ?? null,
          endedAt: session.endedAt?.toISOString() ?? null
        },
        transcriptSegments: transcriptSegments.map((segment) => ({
          id: segment.id,
          speaker: segment.speaker,
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs
        })),
        latestScreeningOutput: latestScreeningTask?.outputJson ?? null,
        instructions: [
          "recruiter'in okuyabilecegi net bir rapor tonu kullan",
          "evidenceLinks alaninda transcript segment id'si varsa kullan",
          "recommendedOutcome sadece ADVANCE/HOLD/REVIEW olabilir"
        ]
      })
    });

    const sections = normalizeStructuredSections(generation.output, fallbackSections);
    const confidence = this.policy.normalizeConfidence(sections.confidence, fallbackSections.confidence);
    const uncertaintyLevel = this.policy.uncertaintyLevel(confidence);
    const recommendation = this.policy.normalizeRecommendation(sections.recommendedOutcome);
    const overallScore = this.policy.normalizeConfidence(confidence * 0.9 + 0.05, 0.5);

    const reportJson = {
      schemaVersion: "ai_report.v1.tr",
      sections: {
        facts: sections.facts,
        interpretation: sections.interpretation,
        recommendation: {
          summary: sections.recommendationSummary,
          action: sections.recommendationAction,
          recommendedOutcome: recommendation
        },
        flags: sections.flags,
        missingInformation: sections.missingInformation
      },
      uncertainty: {
        level: uncertaintyLevel,
        reasons: sections.uncertaintyReasons,
        confidence
      },
      evidenceLinks: sections.evidenceLinks,
      safety: {
        recruiterReviewRequired: true,
        autoDecisionApplied: false,
        autoRejectAllowed: false
      },
      generation: {
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        promptVersion: generation.promptVersion,
        fallback: generation.mode === "deterministic_fallback"
      }
    };

    const report = await this.prisma.aiReport.create({
      data: {
        tenantId: context.tenantId,
        applicationId: application.id,
        sessionId: session.id,
        transcriptId: session.transcript?.id ?? null,
        rubricKey: session.rubricKey ?? null,
        rubricVersion: session.rubricVersion ?? null,
        reportJson,
        overallScore,
        recommendation,
        confidence,
        modelName:
          generation.mode === "deterministic_fallback"
            ? "deterministic-fallback"
            : generation.modelKey ?? "openai",
        promptVersion: generation.promptVersion
      }
    });

    const evidenceLinks = await this.persistEvidenceLinks({
      tenantId: context.tenantId,
      reportId: report.id,
      transcriptSegments,
      evidenceLinks: sections.evidenceLinks
    });

    await this.prisma.aiRun.create({
      data: {
        tenantId: context.tenantId,
        reportId: report.id,
        modelId:
          generation.mode === "deterministic_fallback"
            ? "deterministic-fallback"
            : generation.modelKey ?? "openai",
        promptVersion: generation.promptVersion,
        policyVersion: this.policy.policyVersion,
        inputArtifacts: {
          applicationId: application.id,
          sessionId: session.id,
          transcriptSegmentCount: transcriptSegments.length,
          screeningTaskRunId: latestScreeningTask?.id ?? null
        },
        outputArtifacts: reportJson
      }
    });

    return {
      outputJson: toOutputJson({
        schemaVersion: "report_generation.v1.tr",
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        fallback: generation.mode === "deterministic_fallback",
        facts: sections.facts,
        interpretation: sections.interpretation,
        recommendation: {
          summary: sections.recommendationSummary,
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
          reportId: report.id,
          overallScore,
          sessionId: session.id,
          evidenceCount: evidenceLinks.length
        }
      }),
      uncertaintyJson: asJsonObject({
        level: uncertaintyLevel,
        confidence,
        reasons: sections.uncertaintyReasons
      }),
      guardrailFlags: asJsonObject(this.policy.getGuardrailFlags(AiTaskType.REPORT_GENERATION)),
      providerKey: generation.providerKey,
      providerMode: generation.mode,
      modelKey: generation.modelKey,
      promptVersion: generation.promptVersion,
      policyVersion: this.policy.policyVersion,
      artifacts: {
        reportId: report.id,
        evidenceLinkIds: evidenceLinks.map((item) => item.id)
      }
    };
  }

  private async resolveSession(input: {
    tenantId: string;
    applicationId: string;
    sessionId: string | null;
  }) {
    if (input.sessionId) {
      return this.prisma.interviewSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: input.tenantId,
          applicationId: input.applicationId
        },
        include: {
          transcript: {
            include: {
              segments: {
                orderBy: {
                  startMs: "asc"
                },
                take: 20
              }
            }
          }
        }
      });
    }

    return this.prisma.interviewSession.findFirst({
      where: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        status: "COMPLETED"
      },
      include: {
        transcript: {
          include: {
            segments: {
              orderBy: {
                startMs: "asc"
              },
              take: 20
            }
          }
        }
      },
      orderBy: {
        endedAt: "desc"
      }
    });
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
          stage: AiTaskType.REPORT_GENERATION
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
        stage: AiTaskType.REPORT_GENERATION,
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

  private buildFallbackSections(input: {
    candidateName: string;
    jobTitle: string;
    applicationId: string;
    sessionId: string;
    transcriptSegments: TranscriptSegment[];
    latestScreeningOutput: Prisma.JsonValue | null;
  }): StructuredTaskSections {
    const segment = input.transcriptSegments.find((item) => item.speaker === "CANDIDATE");
    const screening = toRecord(input.latestScreeningOutput);
    const screeningRecommendation = toRecord(screening.sections)?.recommendation;

    return {
      facts: [
        `Aday: ${input.candidateName}`,
        `Pozisyon: ${input.jobTitle}`,
        `Session: ${input.sessionId}`,
        `Transcript segment sayisi: ${input.transcriptSegments.length}`
      ],
      interpretation: [
        segment
          ? `Aday ifadesi ornegi: "${segment.text.slice(0, 120)}"`
          : "Transcript segmenti olmadigi icin yorum sinirlidir.",
        typeof screeningRecommendation === "object"
          ? "Screening support ciktilari rapor olustururken referans alindi."
          : "Screening support ciktilari bulunamadi; rapor temel sinyal setiyle hazirlandi."
      ],
      recommendationSummary:
        "Rapor recruiter karar destegi icindir; nihai stage/karar insan onayi ile verilmelidir.",
      recommendationAction:
        "Eksik noktalar icin adaya hedefli follow-up sorulari ile manuel teyit yap.",
      recommendedOutcome: "HOLD",
      flags: [
        {
          code: input.transcriptSegments.length === 0 ? "TRANSCRIPT_MISSING" : "MANUAL_REVIEW_REQUIRED",
          severity: input.transcriptSegments.length === 0 ? "high" : "medium",
          note:
            input.transcriptSegments.length === 0
              ? "Transcript yok; rapor guvenirligi sinirlidir."
              : "Rapor otomatik karara donusturulmeden recruiter tarafindan incelenmelidir."
        }
      ],
      missingInformation:
        input.transcriptSegments.length === 0
          ? ["transcript_segments", "interview_evidence"]
          : ["detayli_referans_kontrolu"],
      evidenceLinks: [
        {
          sourceType: "application",
          sourceRef: input.applicationId,
          claim: "Rapor application baglaminda olusturuldu."
        },
        ...(segment
          ? [
              {
                sourceType: "transcript_segment",
                sourceRef: segment.id,
                claim: "Aday transcript beyanlari rapora kanit olarak eklendi."
              }
            ]
          : [])
      ],
      confidence: input.transcriptSegments.length > 0 ? 0.67 : 0.34,
      uncertaintyReasons:
        input.transcriptSegments.length > 0
          ? ["Transcript parcali oldugu icin baglamin tamami teyit edilmedi."]
          : ["Transcript olmadan rapor cogu alanda varsayimsaldir."]
    };
  }

  private async persistEvidenceLinks(input: {
    tenantId: string;
    reportId: string;
    transcriptSegments: TranscriptSegment[];
    evidenceLinks: EvidenceLink[];
  }) {
    const segmentIds = new Set(input.transcriptSegments.map((item) => item.id));

    const creates = input.evidenceLinks.slice(0, 20).map((item) =>
      this.prisma.aiEvidenceLink.create({
        data: {
          tenantId: input.tenantId,
          reportId: input.reportId,
          evidenceType: item.sourceType,
          evidenceRef: item.sourceRef,
          claimText: item.claim,
          transcriptSegmentId:
            item.sourceType === "transcript_segment" && segmentIds.has(item.sourceRef)
              ? item.sourceRef
              : null
        }
      })
    );

    return Promise.all(creates);
  }
}
