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
import {
  mergeJsonUserPrompt,
  mergeSystemPrompt,
  type LoadedPromptTemplate
} from "./prompt-template.utils.js";
import {
  analyzeInterviewTranscript,
  type InterviewTranscriptSignals
} from "./interview-signal.utils.js";

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
    const transcriptSignals = analyzeInterviewTranscript(transcriptSegments);
    const [latestScreeningTask, latestFitScore, latestCvProfile] = await Promise.all([
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
      this.prisma.applicantFitScore.findFirst({
        where: {
          tenantId: context.tenantId,
          applicationId
        },
        orderBy: {
          createdAt: "desc"
        }
      }),
      this.prisma.cVParsedProfile.findFirst({
        where: {
          tenantId: context.tenantId,
          cvFile: {
            candidateId: application.candidateId
          }
        },
        orderBy: {
          createdAt: "desc"
        }
      })
    ]);

    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "report_generation.v1.tr";
    const fitScoreContext = this.buildFitScoreContext(latestFitScore);
    const cvContext = this.buildCvContext(latestCvProfile?.profileJson ?? null);

    const fallbackSections = this.buildFallbackSections({
      applicationId,
      sessionId: session.id,
      transcriptSegments,
      transcriptSignals,
      latestScreeningOutput: latestScreeningTask?.outputJson ?? null,
      fitScoreContext
    });

    const generation = await this.provider.generate({
      taskType: "REPORT_GENERATION",
      schemaName: "report_generation_v1_tr",
      schema: defaultOutputSchema("report_generation_v1_tr", {
        includeInterviewInsights: true
      }),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt: mergeSystemPrompt(
        [
          "Turkce recruiter odakli AI mulakat raporu uret.",
          "Ana kaynak yalnizca mevcut interview session transcriptidir.",
          "CV parse, fit score ve screening verileri sadece ikincil baglamdir; transcriptte gecmeyen bir niteliği guclu yon veya fact olarak yazma.",
          "Cikti dili dogal, sade ve recruiter'in dogrudan kullanabilecegi yorum tonunda olsun.",
          "Teknik kural, sinyal, heuristic ya da model ici degerlendirme dili kullanma.",
          "interviewSummary, strengths, weaknesses ve missingInformation alanlari yalnizca bu mulakattan turemeli.",
          "Interpretation alaninda mulakat ile CV/fit score arasindaki tutarlilik veya dogrulanamayan noktalar kisaca belirtilebilir.",
          "Aday yanitlari yuzeysel, kacamak, saka yollu veya rol sahipligini gostermiyorsa bunu net ama dogal bir risk yorumu olarak ifade et.",
          "Zayif mulakatta ADVANCE onerme.",
          "Facts/interpretation/recommendation net ayrissin ve denetlenebilir kalsin."
        ].join(" "),
        promptTemplate
      ),
      userPrompt: mergeJsonUserPrompt({
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
        latestScreeningOutput: latestScreeningTask?.outputJson ?? null,
        fitScore: fitScoreContext,
        cvProfileSummary: cvContext,
        instructions: [
          "recruiter'in okuyabilecegi net ve doğal bir rapor tonu kullan",
          "evidenceLinks alaninda transcript segment id'si varsa kullan",
          "recommendedOutcome sadece ADVANCE/HOLD/REVIEW olabilir",
          "strengths ve weaknesses sadece mevcut mulakat kanitlarindan cikmali",
          "mulakat cevabi zayifsa recommendation ve confidence'i asagi cek",
          "flags alanindaki note metinleri recruiter'a hitap eden doğal risk cümleleri olsun",
          "recommendation summary, interviewSummary, facts ve interpretation birbirini tekrar etmesin",
          "facts alanina aday adi gibi zaten bilinen kimlik bilgilerini yazma",
          "missingInformation alanina risklerin aynisini tekrar etme; yalnizca recruiter'in ayrıca teyit etmesi gereken acik sorulari yaz",
          "facts, strengths ve interpretation alanlarina CV veya profil özeti koyma; yalnızca görüşmede gerçekten söylenen ya da söylenemeyen şeyleri yaz",
          "yıl deneyim, genel profil gücü, liderlik geçmişi gibi resume özetlerini bu alanlara taşıma",
          "CV veya fit score baglamini kullaniyorsan bunu sadece 'mulakatta dogrulandi / dogrulanmadi / soru olarak acik kaldı' seviyesinde yorumla"
        ]
      }, promptTemplate)
    });

    const sections = this.sanitizeReportSections(
      this.applyInterviewSignals(
        normalizeStructuredSections(generation.output, fallbackSections),
        transcriptSignals
      )
    );
    const confidence = Math.min(
      this.policy.normalizeConfidence(sections.confidence, fallbackSections.confidence),
      transcriptSignals.maxConfidence
    );
    const uncertaintyLevel = this.policy.uncertaintyLevel(confidence);
    const recommendation = this.limitRecommendation(
      this.policy.normalizeRecommendation(sections.recommendedOutcome),
      transcriptSignals.maxRecommendation
    );
    const overallScore = this.policy.normalizeConfidence(confidence * 0.9 + 0.05, 0.5);

    const reportJson = {
      schemaVersion: "ai_report.v1.tr",
      sections: {
        facts: sections.facts,
        interpretation: sections.interpretation,
        interviewSummary: sections.interviewSummary,
        strengths: sections.strengths ?? [],
        weaknesses: sections.weaknesses ?? [],
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
        interviewSummary: sections.interviewSummary,
        strengths: sections.strengths,
        weaknesses: sections.weaknesses,
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
          stage: AiTaskType.REPORT_GENERATION
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
        stage: AiTaskType.REPORT_GENERATION,
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

  private buildFallbackSections(input: {
    applicationId: string;
    sessionId: string;
    transcriptSegments: TranscriptSegment[];
    transcriptSignals: InterviewTranscriptSignals;
    latestScreeningOutput: Prisma.JsonValue | null;
    fitScoreContext: {
      overallScore: number;
      confidence: number;
      strengths: string[];
      risks: string[];
      missingInformation: string[];
      overallAssessment: string | null;
    } | null;
  }): StructuredTaskSections {
    const segment = input.transcriptSegments.find((item) => item.speaker === "CANDIDATE");
    const screening = toRecord(input.latestScreeningOutput);
    const screeningRecommendation = toRecord(screening.sections)?.recommendation;

    return {
      facts: [
        `Aday cevap sayisi: ${input.transcriptSignals.candidateSegmentCount}`,
        `Ortalama cevap uzunlugu: ${Math.round(input.transcriptSignals.averageWordsPerAnswer)} kelime`,
        ...(segment ? [`Mulakatta dogrudan ifade edilen ornek konu: ${segment.text.slice(0, 110)}`] : []),
        ...(input.fitScoreContext ? [`Mevcut fit score baglami: ${input.fitScoreContext.overallScore}/100`] : [])
      ],
      interpretation: [
        segment
          ? `Aday ifadesi ornegi: "${segment.text.slice(0, 120)}"`
          : "Transcript segmenti olmadigi icin yorum sinirlidir.",
        typeof screeningRecommendation === "object"
          ? "Screening support ciktilari rapor olustururken referans alindi."
          : "Screening support ciktilari bulunamadi; rapor temel sinyal setiyle hazirlandi.",
        ...(input.fitScoreContext?.overallAssessment ? [input.fitScoreContext.overallAssessment] : [])
      ],
      interviewSummary: input.transcriptSignals.interviewSummary,
      strengths: input.transcriptSignals.strengths,
      weaknesses: input.transcriptSignals.weaknesses,
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
        },
        ...input.transcriptSignals.flags
      ],
      missingInformation: [
        ...(input.transcriptSegments.length === 0
          ? ["transcript_segments", "interview_evidence"]
          : ["detayli_referans_kontrolu"]),
        ...input.transcriptSignals.missingInformation
      ],
      evidenceLinks: [
        {
          sourceType: "application",
          sourceRef: input.applicationId,
          claim: "Rapor application baglaminda olusturuldu."
        },
        {
          sourceType: "interview_session",
          sourceRef: input.sessionId,
          claim: "Rapor bu interview session transcriptine dayandirildi."
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

  private sanitizeReportSections(sections: StructuredTaskSections): StructuredTaskSections {
    return {
      ...sections,
      facts: this.uniqueStrings(
        sections.facts.filter((line) => !/^Aday:|^Pozisyon:|^Session:/i.test(line))
      ).slice(0, 8),
      interpretation: this.uniqueStrings(sections.interpretation).slice(0, 6),
      strengths: this.uniqueStrings(sections.strengths ?? []).slice(0, 6),
      weaknesses: this.uniqueStrings(sections.weaknesses ?? []).slice(0, 6),
      missingInformation: this.uniqueStrings(sections.missingInformation).slice(0, 8),
      uncertaintyReasons: this.uniqueStrings(sections.uncertaintyReasons).slice(0, 6),
      flags: this.uniqueFlags(sections.flags).slice(0, 8),
      evidenceLinks: this.uniqueEvidenceLinks(sections.evidenceLinks).slice(0, 12)
    };
  }

  private applyInterviewSignals(
    sections: StructuredTaskSections,
    signals: InterviewTranscriptSignals
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
      confidence: Math.min(sections.confidence, signals.maxConfidence),
      facts: this.uniqueStrings(sections.facts),
      interpretation: this.uniqueStrings(sections.interpretation)
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

  private uniqueEvidenceLinks(values: EvidenceLink[]) {
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

  private buildFitScoreContext(
    fitScore: {
      overallScore: Prisma.Decimal;
      confidence: Prisma.Decimal;
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
      strengths: this.toStringList(fitScore.strengthsJson),
      risks: this.toStringList(fitScore.risksJson),
      missingInformation: this.toStringList(fitScore.missingInfoJson),
      overallAssessment:
        typeof reasoning.overallAssessment === "string" ? reasoning.overallAssessment : null
    };
  }

  private buildCvContext(profileJson: Prisma.JsonValue | null) {
    const profile = toRecord(profileJson);
    const extractedFacts = toRecord(profile.extractedFacts);
    const normalizedSummary = toRecord(profile.normalizedSummary);

    return {
      recentRoles: this.toStringList(extractedFacts.recentRoles).slice(0, 4),
      skills: this.toStringList(extractedFacts.skills).slice(0, 6),
      sectorSignals: this.toStringList(extractedFacts.sectorSignals).slice(0, 4),
      likelyFitSignals: this.toStringList(normalizedSummary.likelyFitSignals).slice(0, 4),
      missingCriticalInformation: this.toStringList(profile.missingCriticalInformation).slice(0, 6)
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
