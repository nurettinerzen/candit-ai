import { AiTaskType, PrismaClient } from "@prisma/client";
import { AiTaskPolicyService } from "../policy/ai-task-policy.service.js";
import { StructuredAiProvider } from "../providers/structured-ai-provider.js";
import { TaskProcessingError } from "../task-processing-error.js";
import {
  asJsonObject,
  type TaskExecutionContext,
  type TaskExecutionResult
} from "../types.js";
import {
  defaultOutputSchema,
  normalizeStructuredSections,
  toOutputJson,
  type StructuredTaskSections
} from "./task-output.utils.js";

export class CvParsingTaskService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly policy: AiTaskPolicyService,
    private readonly provider: StructuredAiProvider
  ) {}

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const candidateId = context.taskRun.candidateId;

    if (!candidateId) {
      throw new TaskProcessingError(
        "CANDIDATE_ID_REQUIRED",
        "CV_PARSING task'i icin candidateId zorunludur."
      );
    }

    const candidate = await this.prisma.candidate.findFirst({
      where: {
        id: candidateId,
        tenantId: context.tenantId,
        deletedAt: null
      },
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
    });

    if (!candidate) {
      throw new TaskProcessingError("CANDIDATE_NOT_FOUND", "Aday bulunamadi.", false, {
        candidateId
      });
    }

    const latestCvFile = candidate.cvFiles[0] ?? null;
    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "cv_parsing.v1.tr";

    const fallbackSections = this.buildFallbackSections({
      candidate: {
        id: candidate.id,
        fullName: candidate.fullName,
        source: candidate.source,
        email: candidate.email,
        phone: candidate.phone
      },
      cvFile: latestCvFile
        ? {
            id: latestCvFile.id,
            originalName: latestCvFile.originalName,
            mimeType: latestCvFile.mimeType,
            sizeBytes: latestCvFile.sizeBytes,
            uploadedAt: latestCvFile.uploadedAt.toISOString()
          }
        : null
    });

    const generation = await this.provider.generate({
      taskType: "CV_PARSING",
      schemaName: "cv_parsing_v1_tr",
      schema: defaultOutputSchema("cv_parsing_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt:
        "Yalnizca Turkce recruiter destek ciktisi uret. Kesin olmayan bilgiyi acikca belirsiz olarak isaretle. Aday hakkinda otomatik ret veya nihai karar verme.",
      userPrompt: JSON.stringify({
        task: "CV_PARSING",
        locale: "tr-TR",
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          source: candidate.source,
          email: candidate.email,
          phone: candidate.phone
        },
        cvFile: latestCvFile
          ? {
              id: latestCvFile.id,
              originalName: latestCvFile.originalName,
              mimeType: latestCvFile.mimeType,
              sizeBytes: latestCvFile.sizeBytes,
              uploadedAt: latestCvFile.uploadedAt.toISOString(),
              previousParsedProfile: latestCvFile.parsedProfile?.profileJson ?? null
            }
          : null,
        instructions: [
          "facts/interpretation/recommendation ayrimini koru",
          "evidenceLinks icinde sourceRef belirt",
          "missingInformation alanini gercek bosluklar icin doldur"
        ]
      })
    });

    const sections = normalizeStructuredSections(generation.output, fallbackSections);
    const confidence = this.policy.normalizeConfidence(sections.confidence, fallbackSections.confidence);
    const uncertaintyLevel = this.policy.uncertaintyLevel(confidence);
    const requiresManualReview =
      confidence < 0.65 ||
      sections.missingInformation.length > 0 ||
      generation.mode === "deterministic_fallback";

    const parsedProfileSnapshot = {
      candidateSummary: sections.facts,
      interpretation: sections.interpretation,
      recruiterNotes: {
        recommendationSummary: sections.recommendationSummary,
        recommendationAction: sections.recommendationAction,
        flags: sections.flags,
        missingInformation: sections.missingInformation
      },
      evidenceLinks: sections.evidenceLinks
    };

    let cvParsedProfileId: string | undefined;

    if (latestCvFile) {
      const profile = await this.prisma.cVParsedProfile.upsert({
        where: {
          cvFileId: latestCvFile.id
        },
        update: {
          profileJson: parsedProfileSnapshot,
          parseConfidence: confidence,
          requiresManualReview
        },
        create: {
          tenantId: context.tenantId,
          cvFileId: latestCvFile.id,
          profileJson: parsedProfileSnapshot,
          parseConfidence: confidence,
          requiresManualReview
        }
      });

      cvParsedProfileId = profile.id;
    }

    return {
      outputJson: toOutputJson({
        schemaVersion: "cv_parsing.v1.tr",
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        fallback: generation.mode === "deterministic_fallback",
        facts: sections.facts,
        interpretation: sections.interpretation,
        recommendation: {
          summary: sections.recommendationSummary,
          action: sections.recommendationAction,
          recommendedOutcome: "REVIEW"
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
          parsedProfile: parsedProfileSnapshot,
          parsedProfileId: cvParsedProfileId,
          cvFileId: latestCvFile?.id ?? null
        }
      }),
      uncertaintyJson: asJsonObject({
        level: uncertaintyLevel,
        confidence,
        reasons: sections.uncertaintyReasons,
        requiresManualReview
      }),
      guardrailFlags: asJsonObject(this.policy.getGuardrailFlags(AiTaskType.CV_PARSING)),
      providerKey: generation.providerKey,
      providerMode: generation.mode,
      modelKey: generation.modelKey,
      promptVersion: generation.promptVersion,
      policyVersion: this.policy.policyVersion,
      artifacts: {
        cvParsedProfileId
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
          stage: AiTaskType.CV_PARSING
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
        stage: AiTaskType.CV_PARSING,
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
    candidate: {
      id: string;
      fullName: string;
      source: string | null;
      email: string | null;
      phone: string | null;
    };
    cvFile: {
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      uploadedAt: string;
    } | null;
  }): StructuredTaskSections {
    if (!input.cvFile) {
      return {
        facts: [
          `Aday: ${input.candidate.fullName}`,
          "Sistemde CV dosyasi bulunamadi.",
          `Kaynak: ${input.candidate.source ?? "belirtilmedi"}`
        ],
        interpretation: [
          "CV icerigi olmadan deneyim ve yetkinlik analizi sinirlidir.",
          "Adaydan guncel CV talep edilmeden otomatik yorum guvenilir degildir."
        ],
        recommendationSummary: "CV eksikligi nedeniyle once dokuman tamamlanmali.",
        recommendationAction: "Adaydan PDF/DOCX CV yuklemesi istenmeli.",
        recommendedOutcome: "REVIEW",
        flags: [
          {
            code: "CV_FILE_MISSING",
            severity: "high",
            note: "CV dosyasi olmadan profil cikartimi tamamlanamaz."
          }
        ],
        missingInformation: ["cv_file", "deneyim_gecmisi", "teknik_beceriler"],
        evidenceLinks: [
          {
            sourceType: "candidate",
            sourceRef: input.candidate.id,
            claim: "Aday kaydi mevcut fakat CV dosyasi yok."
          }
        ],
        confidence: 0.28,
        uncertaintyReasons: ["CV dokumani bulunmadigi icin icerik analizi yapilamadi."]
      };
    }

    return {
      facts: [
        `Aday: ${input.candidate.fullName}`,
        `CV dosyasi: ${input.cvFile.originalName}`,
        `Yukleme tarihi: ${input.cvFile.uploadedAt}`
      ],
      interpretation: [
        "CV icerigi text extract edilmedigi icin sadece metadata uzerinden ozet hazirlandi.",
        "Detayli deneyim cikarimi icin dosya icerigi parse adimi genisletilmeli."
      ],
      recommendationSummary: "Metadata tabanli ozet olusturuldu; manuel inceleme onerilir.",
      recommendationAction: "Recruiter CV metnini gozden gecirip kritik alanlari dogrulamalidir.",
      recommendedOutcome: "REVIEW",
      flags: [
        {
          code: "CV_TEXT_NOT_EXTRACTED",
          severity: "medium",
          note: "Dosya icerigi parse edilmedigi icin otomatik tespitler sinirlidir."
        }
      ],
      missingInformation: ["detayli_deneyim", "egitim_seviyesi", "sertifikalar"],
      evidenceLinks: [
        {
          sourceType: "cv_file",
          sourceRef: input.cvFile.id,
          claim: "CV dosyasi metadata'si parse edildi."
        },
        {
          sourceType: "candidate",
          sourceRef: input.candidate.id,
          claim: "Aday temel profil bilgileri kullanildi."
        }
      ],
      confidence: 0.57,
      uncertaintyReasons: ["Sadece metadata mevcut; CV metni analiz edilmedi."]
    };
  }
}
