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
  type StructuredTaskSections
} from "./task-output.utils.js";
import {
  mergeJsonUserPrompt,
  mergeSystemPrompt,
  type LoadedPromptTemplate
} from "./prompt-template.utils.js";
import {
  analyzeInterviewTranscript,
  type InterviewTranscriptSignals
} from "./interview-signal.utils.js";
import {
  looksLikeDerivedContextLeakage,
  looksLikeLowSignalDecisionSummary,
  textsOverlap
} from "./task-text-sanitizer.utils.js";
import { alignDecisionCopy } from "./decision-copy-alignment.utils.js";

const FIT_SCORING_RUBRIC_KEY_PREFIX = "fit_scoring_";

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
    const [latestReport, latestScreening, latestCvParsing, latestFitScore] = await Promise.all([
      this.prisma.aiReport.findFirst({
        where: {
          tenantId: context.tenantId,
          applicationId,
          ...(targetSessionId ? { sessionId: targetSessionId } : {})
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      this.prisma.aiTaskRun.findFirst({
        where: {
          tenantId: context.tenantId,
          taskType: AiTaskType.SCREENING_SUPPORT,
          applicationId,
          status: "SUCCEEDED"
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      this.prisma.aiTaskRun.findFirst({
        where: {
          tenantId: context.tenantId,
          taskType: AiTaskType.CV_PARSING,
          candidateId: application.candidateId,
          status: "SUCCEEDED"
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      this.prisma.applicantFitScore.findFirst({
        where: {
          tenantId: context.tenantId,
          applicationId
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);

    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const rubric = await this.loadRubric(context.tenantId, context.taskRun.id, application.job.roleFamily);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "recommendation_generation.v1.tr";
    const fitScoreContext = this.buildFitScoreContext(latestFitScore);

    const fallbackSections = this.buildFallbackSections({
      applicationId: application.id,
      sessionId: targetSessionId,
      hasReport: Boolean(latestReport),
      hasScreening: Boolean(latestScreening?.outputJson),
      hasCvParsing: Boolean(latestCvParsing?.outputJson),
      transcriptSignals,
      fitScoreContext
    });

    const generation = await this.provider.generate({
      taskType: "RECOMMENDATION_GENERATION",
      schemaName: "recommendation_generation_v1_tr",
      schema: defaultOutputSchema("recommendation_generation_v1_tr", {
        includeInterviewInsights: true
      }),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt: mergeSystemPrompt(
        [
          "Turkce recruiter odakli recommendation uret.",
          "Nihai karar verme, otomatik ret yapma.",
          "Mevcut interview session varsa degerlendirmeyi once bu session transcriptine dayandir.",
          "Eski session raporunu yeni mulakat yerine kullanma.",
          "Aday yanitlari yuzeysel, kacamak, saka yollu veya rol sahipligini gostermiyorsa ADVANCE onerme; en fazla HOLD ya da REVIEW oner.",
          "Cikti dili dogal ve recruiter dostu olsun; teknik kural, sinyal, heuristic veya model ici yorum dili kullanma.",
          "Recommendation; report, screening, CV parse ve fit score artefaktlarini birlikte okuyabilir ama transcriptte celisen bir noktayi gormezden gelme.",
          "Ayni temayi facts, interpretation, flags ve missingInformation alanlarinda tekrar etme.",
          "Ciktilar denetlenebilir ve kanit baglantili olsun."
        ].join(" "),
        promptTemplate
      ),
      userPrompt: mergeJsonUserPrompt({
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
        fitScore: fitScoreContext,
        scoringRubric: rubric?.rubricJson ?? null,
        instructions: [
          "recommendedOutcome alani REJECT olamaz",
          "recommendation summary recruiter aksiyonu icersin ve doğal bir yönetici özeti gibi okunsun",
          "uncertainty reasons alanini bos birakma",
          "mevcut session raporu yoksa onceki rapora dayanarak ADVANCE verme",
          "flags, interpretation ve summary alanlarinda teknik etiket degil recruiter'a uygun doğal dil kullan",
          "recommendation summary report interviewSummary'sini kelimesi kelimesine tekrar etmesin; yalnizca karar ve sonraki recruiter aksiyonunu soylesin",
          "aynı riski facts, interpretation ve flags alanlarinda tekrar tekrar yazma",
          "fit score veya CV verisini kullaniyorsan bunu karar kalitesine etkisi acisindan yorumla; transcriptte desteklenmeyen bir avantaji tek basina ADVANCE nedeni yapma"
        ]
      }, promptTemplate)
    });

    const sections = this.sanitizeSections(
      this.applyInterviewSignals(
        normalizeStructuredSections(generation.output, fallbackSections),
        transcriptSignals,
        Boolean(session && latestReport)
      )
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
    const decisionCopy = alignDecisionCopy({
      mode: "review_pack",
      recommendation,
      summary: sections.recommendationSummary,
      action: sections.recommendationAction,
      strengths: sections.strengths ?? [],
      weaknesses: sections.weaknesses ?? [],
      missingInformation: sections.missingInformation
    });

    const summaryText = decisionCopy.summary;
    const rationaleJson = {
      schemaVersion: "application_recommendation.v1.tr",
      facts: sections.facts,
      interpretation: sections.interpretation,
      recommendation: {
        summary: summaryText,
        action: decisionCopy.action,
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
        cvParsingTaskRunId: latestCvParsing?.id ?? null,
        fitScoreId: latestFitScore?.id ?? null
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
          action: decisionCopy.action,
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
          stage: AiTaskType.RECOMMENDATION_GENERATION
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
        stage: AiTaskType.RECOMMENDATION_GENERATION,
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

    const preferredRubric = await this.prisma.scoringRubric.findFirst({
      where: {
        tenantId,
        domain: roleFamily,
        isActive: true,
        key: {
          startsWith: FIT_SCORING_RUBRIC_KEY_PREFIX
        }
      },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }]
    });

    if (preferredRubric) {
      return preferredRubric;
    }

    return this.prisma.scoringRubric.findFirst({
      where: {
        tenantId,
        domain: roleFamily,
        isActive: true
      },
      orderBy: [{ version: "desc" }, { updatedAt: "desc" }]
    });
  }

  private buildFallbackSections(input: {
    applicationId: string;
    sessionId: string | null;
    hasReport: boolean;
    hasScreening: boolean;
    hasCvParsing: boolean;
    transcriptSignals: InterviewTranscriptSignals;
    fitScoreContext: {
      overallScore: number;
      confidence: number;
      strengths: string[];
      risks: string[];
      missingInformation: string[];
      overallAssessment: string | null;
    } | null;
  }): StructuredTaskSections {
    const missingInformation = [
      ...(input.hasReport ? [] : ["latest_ai_report"]),
      ...(input.hasScreening ? [] : ["screening_support_output"]),
      ...(input.hasCvParsing ? [] : ["cv_parsing_output"]),
      ...input.transcriptSignals.missingInformation
    ];

    return {
      facts: [
        `Application ID: ${input.applicationId}`,
        `Session ID: ${input.sessionId ?? "yok"}`,
        `Rapor var mi: ${input.hasReport ? "evet" : "hayir"}`,
        ...(input.fitScoreContext ? [`Fit score baglami: ${input.fitScoreContext.overallScore}/100`] : [])
      ],
      interpretation: [
        "Recommendation artifact'i recruiter kararini desteklemek icin uretilir.",
        input.hasReport
          ? "Mevcut session'a ait AI raporu recommendation baglaminda dikkate alindi."
          : "Mevcut session raporu olmadigi icin recommendation daha yuksek belirsizlik tasir.",
        input.transcriptSignals.interviewSummary,
        ...(input.fitScoreContext?.overallAssessment ? [input.fitScoreContext.overallAssessment] : [])
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
                take: 60
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
              take: 60
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
      confidence: Math.min(sections.confidence, hasSessionReport ? signals.maxConfidence : 0.72),
      facts: this.uniqueStrings(sections.facts),
      interpretation: this.uniqueStrings(sections.interpretation)
    };
  }

  private sanitizeSections(sections: StructuredTaskSections): StructuredTaskSections {
    const strengths = this.filterSectionLines(sections.strengths ?? [], {
      limit: 6,
      references: [sections.interviewSummary]
    });
    const weaknesses = this.filterSectionLines(sections.weaknesses ?? [], {
      limit: 6,
      references: [sections.interviewSummary]
    });
    const facts = this.filterSectionLines(
      sections.facts.filter((line) => !/^Aday:|^Pozisyon:/i.test(line)),
      {
        limit: 8,
        references: [sections.interviewSummary, ...strengths, ...weaknesses]
      }
    );
    const interpretation = this.filterSectionLines(sections.interpretation, {
      limit: 6,
      references: [sections.interviewSummary, ...facts, ...strengths, ...weaknesses]
    });
    const flags = this.uniqueFlags(
      sections.flags.filter(
        (flag) =>
          !looksLikeDerivedContextLeakage(flag.note) &&
          !this.overlapsAny(flag.note, [...weaknesses, ...sections.missingInformation], {
            minSharedTokens: 4,
            minSimilarityRatio: 0.74
          })
      )
    ).slice(0, 8);
    const missingInformation = this.filterSectionLines(sections.missingInformation, {
      limit: 8,
      references: [...weaknesses, ...flags.map((flag) => flag.note), ...facts, ...interpretation]
    });

    return {
      ...sections,
      facts,
      interpretation,
      strengths,
      weaknesses,
      recommendationSummary: this.sanitizeDecisionSummary({
        summary: sections.recommendationSummary,
        interviewSummary: sections.interviewSummary,
        recommendation: sections.recommendedOutcome,
        strengths,
        weaknesses
      }),
      missingInformation,
      uncertaintyReasons: this.uniqueStrings(sections.uncertaintyReasons).slice(0, 6),
      flags
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

  private filterSectionLines(
    values: string[],
    input: {
      limit: number;
      references?: string[];
    }
  ) {
    return this.uniqueStrings(values)
      .filter(
        (value) =>
          !looksLikeDerivedContextLeakage(value) &&
          !this.overlapsAny(value, input.references ?? [], {
            minSharedTokens: 4,
            minSimilarityRatio: 0.74
          })
      )
      .slice(0, input.limit);
  }

  private overlapsAny(
    value: string,
    references: string[],
    options?: {
      minSharedTokens?: number;
      minSimilarityRatio?: number;
    }
  ) {
    return references.some((reference) => textsOverlap(value, reference, options));
  }

  private sanitizeDecisionSummary(input: {
    summary: string;
    interviewSummary: string;
    recommendation: Recommendation;
    strengths: string[];
    weaknesses: string[];
  }) {
    const rawSummary = input.summary.trim();

    if (
      rawSummary &&
      !looksLikeLowSignalDecisionSummary(rawSummary) &&
      !textsOverlap(rawSummary, input.interviewSummary, {
        minSharedTokens: 4,
        minSimilarityRatio: 0.7
      })
    ) {
      return rawSummary.slice(0, 700);
    }

    if (input.recommendation === Recommendation.ADVANCE) {
      const leadingSignal = input.strengths[0] ?? "Adayi ilerletmeyi destekleyen yeterli sinyal var.";
      return `${leadingSignal} Sonraki asamaya tasiyip kalan riskleri kisa bir teyitle kapatin.`
        .slice(0, 700);
    }

    if (input.recommendation === Recommendation.REVIEW) {
      const mainRisk = input.weaknesses[0] ?? "Role uyum ve execution seviyesi bu asamada net degil.";
      return `${mainRisk} Ilerletmeden once daha siki bir manuel inceleme uygulayin.`
        .slice(0, 700);
    }

    const openQuestion = input.weaknesses[0] ?? "Karar icin halen acik noktalar var.";
    return `${openQuestion} Kisa bir follow-up veya referans teyidi sonrasinda nihai karari verin.`
      .slice(0, 700);
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

  private buildFitScoreContext(
    fitScore: {
      overallScore: Prisma.Decimal;
      confidence: Prisma.Decimal;
      subScoresJson: Prisma.JsonValue | null;
      strengthsJson: Prisma.JsonValue | null;
      risksJson: Prisma.JsonValue | null;
      missingInfoJson: Prisma.JsonValue | null;
      reasoningJson: Prisma.JsonValue | null;
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

  private toStringList(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private extractFitScoreCategories(value: Prisma.JsonValue | null) {
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
}
