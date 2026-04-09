import {
  AiTaskType,
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
  type StructuredTaskSections
} from "./task-output.utils.js";
import {
  analyzeInterviewTranscript,
  type InterviewTranscriptSignals
} from "./interview-signal.utils.js";

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

    const session = await this.resolveSession({
      tenantId: context.tenantId,
      applicationId,
      sessionId: context.taskRun.sessionId
    });
    const targetSessionId = session?.id ?? context.taskRun.sessionId ?? null;
    const transcriptSegments = session?.transcript?.segments ?? [];
    const transcriptSignals = analyzeInterviewTranscript(transcriptSegments);
    const latestReport = await this.prisma.aiReport.findFirst({
      where: {
        tenantId: context.tenantId,
        applicationId,
        ...(targetSessionId ? { sessionId: targetSessionId } : {})
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
      sessionId: targetSessionId,
      candidateName: application.candidate.fullName,
      jobTitle: application.job.title,
      hasReport: Boolean(latestReport),
      hasScreening: Boolean(latestScreening?.outputJson),
      hasCvParsing: Boolean(latestCvParsing?.outputJson),
      transcriptSignals
    });

    const generation = await this.provider.generate({
      taskType: "RECOMMENDATION_GENERATION",
      schemaName: "recommendation_generation_v1_tr",
      schema: defaultOutputSchema("recommendation_generation_v1_tr", {
        includeInterviewInsights: true
      }),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt:
        "Türkçe recruiter odaklı recommendation üret. Nihai karar verme, otomatik ret yapma. Mevcut interview session varsa değerlendirmeyi önce bu session transcriptine dayandır. Eski session raporunu yeni mülakat yerine kullanma. Aday yanıtları yüzeysel, kaçamak, şaka yollu veya rol sahipliğini göstermiyorsa ADVANCE önerme; en fazla HOLD ya da REVIEW öner. Çıktı dili doğal ve recruiter dostu olsun; teknik kural, sinyal, heuristic veya model içi yorum dili kullanma. Çıktılar denetlenebilir ve kanıt bağlantılı olsun.",
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
              sessionId: latestReport.sessionId,
              recommendation: latestReport.recommendation,
              confidence: latestReport.confidence,
              createdAt: latestReport.createdAt.toISOString(),
              reportJson: latestReport.reportJson
            }
          : null,
        interviewSession: session
          ? {
              id: session.id,
              status: session.status,
              startedAt: session.startedAt?.toISOString() ?? null,
              endedAt: session.endedAt?.toISOString() ?? null
            }
          : null,
        transcriptSegments: transcriptSegments.map((segment) => ({
          id: segment.id,
          speaker: segment.speaker,
          text: segment.text,
          startMs: segment.startMs,
          endMs: segment.endMs
        })),
        transcriptSignals: {
          candidateSegmentCount: transcriptSignals.candidateSegmentCount,
          averageWordsPerAnswer: transcriptSignals.averageWordsPerAnswer,
          evasiveAnswerCount: transcriptSignals.evasiveAnswerCount,
          lowSignalRatio: transcriptSignals.lowSignalRatio,
          severity: transcriptSignals.severity,
          shouldBlockAdvance: transcriptSignals.shouldBlockAdvance,
          interviewSummary: transcriptSignals.interviewSummary,
          weaknesses: transcriptSignals.weaknesses
        },
        latestScreeningOutput: latestScreening?.outputJson ?? null,
        latestCvParsingOutput: latestCvParsing?.outputJson ?? null,
        scoringRubric: rubric?.rubricJson ?? null,
        instructions: [
          "recommendedOutcome alani REJECT olamaz",
          "recommendation summary recruiter aksiyonu icersin ve doğal bir yönetici özeti gibi okunsun",
          "uncertainty reasons alanini bos birakma",
          "mevcut session raporu yoksa onceki rapora dayanarak ADVANCE verme",
          "flags, interpretation ve summary alanlarinda teknik etiket degil recruiter'a uygun doğal dil kullan",
          "recommendation summary report interviewSummary'sini kelimesi kelimesine tekrar etmesin; yalnizca karar ve sonraki recruiter aksiyonunu soylesin",
          "aynı riski facts, interpretation ve flags alanlarinda tekrar tekrar yazma"
        ]
      })
    });

    const sections = this.applyInterviewSignals(
      normalizeStructuredSections(generation.output, fallbackSections),
      transcriptSignals,
      Boolean(session && latestReport)
    );
    const confidence = Math.min(
      this.policy.normalizeConfidence(sections.confidence, fallbackSections.confidence),
      transcriptSignals.maxConfidence,
      session && !latestReport ? 0.72 : 1
    );
    const uncertaintyLevel = this.policy.uncertaintyLevel(confidence);
    const recommendation = this.limitRecommendation(
      this.policy.normalizeRecommendation(sections.recommendedOutcome),
      transcriptSignals.maxRecommendation
    );

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
      interviewSummary: sections.interviewSummary,
      strengths: sections.strengths ?? [],
      weaknesses: sections.weaknesses ?? [],
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
        interviewSummary: sections.interviewSummary,
        strengths: sections.strengths,
        weaknesses: sections.weaknesses,
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
    sessionId: string | null;
    candidateName: string;
    jobTitle: string;
    hasReport: boolean;
    hasScreening: boolean;
    hasCvParsing: boolean;
    transcriptSignals: InterviewTranscriptSignals;
  }): StructuredTaskSections {
    const missingInformation = [
      ...(input.hasReport ? [] : ["latest_ai_report"]),
      ...(input.hasScreening ? [] : ["screening_support_output"]),
      ...(input.hasCvParsing ? [] : ["cv_parsing_output"]),
      ...input.transcriptSignals.missingInformation
    ];

    return {
      facts: [
        `Aday: ${input.candidateName}`,
        `Pozisyon: ${input.jobTitle}`,
        `Application ID: ${input.applicationId}`,
        `Session ID: ${input.sessionId ?? "yok"}`,
        `Rapor var mi: ${input.hasReport ? "evet" : "hayir"}`
      ],
      interpretation: [
        "Recommendation artifact'i recruiter kararini desteklemek icin uretilir.",
        input.hasReport
          ? "Mevcut session'a ait AI raporu recommendation baglaminda dikkate alindi."
          : "Mevcut session raporu olmadigi icin recommendation daha yuksek belirsizlik tasir.",
        input.transcriptSignals.interviewSummary
      ],
      interviewSummary: input.transcriptSignals.interviewSummary,
      strengths: input.transcriptSignals.strengths,
      weaknesses: input.transcriptSignals.weaknesses,
      recommendationSummary:
        "Aday icin otomatik karar uygulanmadi; recruiter onayi sonrasinda manuel stage karari alinmalidir.",
      recommendationAction:
        "Eksik artefaktlari tamamlayip hiring manager review oncesi recruiter degerlendirmesi yap.",
      recommendedOutcome: input.hasReport
        ? input.transcriptSignals.maxRecommendation === "ADVANCE"
          ? "HOLD"
          : input.transcriptSignals.maxRecommendation
        : "REVIEW",
      flags: [
        {
          code: input.hasReport ? "HUMAN_REVIEW_REQUIRED" : "REPORT_MISSING",
          severity: input.hasReport ? "medium" : "high",
          note: input.hasReport
            ? "Nihai karar sistemi otomatik uygulamaz; recruiter onayi gerekir."
            : "Rapor olmadan recommendation kesinlik seviyesi dusuktur."
        },
        ...input.transcriptSignals.flags
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
                take: 30
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
              take: 30
            }
          }
        }
      },
      orderBy: {
        endedAt: "desc"
      }
    });
  }

  private applyInterviewSignals(
    sections: StructuredTaskSections,
    signals: InterviewTranscriptSignals,
    hasSessionReport: boolean
  ): StructuredTaskSections {
    return {
      ...sections,
      interviewSummary:
        sections.interviewSummary && sections.interviewSummary.trim().length > 0
          ? sections.interviewSummary
          : signals.interviewSummary,
      strengths:
        sections.strengths && sections.strengths.length > 0 ? sections.strengths : signals.strengths,
      weaknesses: this.uniqueStrings([...(sections.weaknesses ?? []), ...signals.weaknesses]),
      flags: this.uniqueFlags([...sections.flags, ...signals.flags]),
      missingInformation: this.uniqueStrings([
        ...sections.missingInformation,
        ...signals.missingInformation
      ]),
      recommendedOutcome: this.limitRecommendation(
        this.policy.normalizeRecommendation(sections.recommendedOutcome),
        signals.maxRecommendation
      ),
      confidence: Math.min(sections.confidence, hasSessionReport ? signals.maxConfidence : 0.72)
    };
  }

  private limitRecommendation(
    recommendation: Recommendation,
    maxRecommendation: "ADVANCE" | "HOLD" | "REVIEW"
  ): Recommendation {
    if (maxRecommendation === "REVIEW") {
      return Recommendation.REVIEW;
    }

    if (maxRecommendation === "HOLD" && recommendation === Recommendation.ADVANCE) {
      return Recommendation.HOLD;
    }

    return recommendation;
  }

  private uniqueStrings(values: string[]) {
    const normalized = new Set<string>();
    const output: string[] = [];

    for (const value of values.map((item) => item.trim()).filter(Boolean)) {
      const key = value
        .toLocaleLowerCase("tr-TR")
        .replace(/[ıİ]/g, "i")
        .replace(/[şŞ]/g, "s")
        .replace(/[ğĞ]/g, "g")
        .replace(/[üÜ]/g, "u")
        .replace(/[öÖ]/g, "o")
        .replace(/[çÇ]/g, "c")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");

      if (normalized.has(key)) {
        continue;
      }

      normalized.add(key);
      output.push(value);
    }

    return output.slice(0, 8);
  }

  private uniqueFlags(
    values: Array<{ code: string; severity: "low" | "medium" | "high"; note: string }>
  ) {
    const seen = new Set<string>();
    return values.filter((value) => {
      const key = `${value.code}:${value.note}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}
