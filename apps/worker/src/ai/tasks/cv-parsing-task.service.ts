import { randomUUID } from "crypto";
import {
  AiAutomationLevel,
  AiTaskStatus,
  AiTaskType,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { Queue } from "bullmq";
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
import {
  defaultOutputSchema,
  normalizeStructuredSections,
  toOutputJson,
  type StructuredTaskSections
} from "./task-output.utils.js";
import {
  CvDocumentContentService,
  type CvExtractionMethod,
  type CvExtractionStatus
} from "./cv-document-content.service.js";

type ParsedProfileSnapshot = {
  schemaVersion: string;
  source: {
    cvFileId: string;
    candidateId: string;
    extractionStatus: CvExtractionStatus;
    extractionMethod: CvExtractionMethod;
    extractionProvider: string;
    extractionQualityScore: number | null;
    providerMode: "llm_openai" | "deterministic_fallback";
    providerKey: string;
    modelKey?: string;
    parsedAt: string;
  };
  extractedFacts: {
    fullName: string;
    contacts: {
      emails: string[];
      phones: string[];
    };
    languages: string[];
    workHistorySignals: string[];
    recentRoles: string[];
    sectorSignals: string[];
    yearsExperienceEstimate: number | null;
    educationSummary: string[];
    certifications: string[];
    skills: string[];
    locationSignals: string[];
  };
  normalizedSummary: {
    shortSummary: string;
    coreWorkHistorySummary: string;
    likelyFitSignals: string[];
    recruiterFollowUpTopics: string[];
  };
  inferredObservations: Array<{
    observation: string;
    confidence: number;
    rationale: string;
    uncertain: true;
  }>;
  missingCriticalInformation: string[];
  uncertaintyNotes: string[];
  aiSections: {
    facts: string[];
    interpretation: string[];
    recommendation: {
      summary: string;
      action: string;
      recommendedOutcome?: string;
    };
  };
};

type DeterministicProfileBuild = {
  profile: Omit<ParsedProfileSnapshot, "source" | "aiSections">;
  sections: StructuredTaskSections;
};

type NormalizedCvParsingOutput = {
  profile: Omit<ParsedProfileSnapshot, "source" | "aiSections">;
  sections: StructuredTaskSections;
};

const TURKISH_CITIES = [
  "adana", "adiyaman", "afyonkarahisar", "agri", "aksaray", "amasya", "ankara", "antalya",
  "ardahan", "artvin", "aydin", "balikesir", "bartin", "batman", "bayburt", "bilecik",
  "bingol", "bitlis", "bolu", "burdur", "bursa", "canakkale", "cankiri", "corum", "denizli",
  "diyarbakir", "duzce", "edirne", "elazig", "erzincan", "erzurum", "eskisehir", "gaziantep",
  "giresun", "gumushane", "hakkari", "hatay", "igdir", "isparta", "istanbul", "izmir",
  "kahramanmaras", "karabuk", "karaman", "kars", "kastamonu", "kayseri", "kilis", "kirikkale",
  "kirklareli", "kirsehir", "kocaeli", "konya", "kutahya", "malatya", "manisa", "mardin",
  "mersin", "mugla", "mus", "nevsehir", "nigde", "ordu", "osmaniye", "rize", "sakarya",
  "samsun", "sanliurfa", "siirt", "sinop", "sivas", "sirnak", "tekirdag", "tokat", "trabzon",
  "tunceli", "usak", "van", "yalova", "yozgat", "zonguldak"
] as const;

function normalizeTurkishText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

const LANGUAGE_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Turkce", pattern: /\b(turkce|turkce)\b/i },
  { label: "Ingilizce", pattern: /\b(ingilizce|english)\b/i },
  { label: "Arapca", pattern: /\b(arapca|arabic)\b/i },
  { label: "Rusca", pattern: /\b(rusca|russian)\b/i },
  { label: "Almanca", pattern: /\b(almanca|german)\b/i }
];

const ROLE_SIGNALS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Depo Operasyon Personeli", pattern: /\b(depo|stok|sevkiyat|paketleme)\b/i },
  { label: "Kasiyer", pattern: /\b(kasiyer|kasa)\b/i },
  { label: "Musteri Destek", pattern: /\b(musteri destek|cagri merkezi|call center|whatsapp destek)\b/i },
  { label: "Lojistik Operasyon", pattern: /\b(loji|lojistik|dagitim)\b/i },
  { label: "Satis Danismani", pattern: /\b(satis danismani|reyon|magaza)\b/i }
];

const SKILL_KEYWORDS = [
  "forklift",
  "excel",
  "crm",
  "sap",
  "stok",
  "paketleme",
  "sevkiyat",
  "musteri iliskileri",
  "kasa islemleri",
  "iade sureci",
  "terminal",
  "raporlama",
  "satis hedefi",
  "telefon destegi",
  "vardiya"
] as const;

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const redis = new URL(redisUrl);
const queueConnection = {
  host: redis.hostname,
  port: Number(redis.port || 6379),
  username: redis.username || undefined,
  password: redis.password || undefined,
  maxRetriesPerRequest: null
};
const queueName = "ai-interviewer-jobs";

function mapExtractionStatusToPrisma(status: CvExtractionStatus) {
  switch (status) {
    case "extracted":
      return "EXTRACTED" as const;
    case "partial":
      return "PARTIAL" as const;
    case "unsupported":
      return "UNSUPPORTED" as const;
    default:
      return "FAILED" as const;
  }
}

function mapExtractionMethodToPrisma(method: CvExtractionMethod) {
  switch (method) {
    case "utf8_plain_text":
      return "UTF8_PLAIN_TEXT" as const;
    case "pdf_parse":
      return "PDF_PARSE" as const;
    case "docx_mammoth":
      return "DOCX_MAMMOTH" as const;
    case "doc_legacy":
      return "DOC_LEGACY" as const;
    case "doc_os_conversion":
      return "DOC_OS_CONVERSION" as const;
    default:
      return "METADATA_ONLY" as const;
  }
}

function cvParsingOutputSchema(schemaName: string) {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: schemaName,
    type: "object",
    additionalProperties: false,
    required: [
      "profile",
      "facts",
      "interpretation",
      "recommendation",
      "flags",
      "missingInformation",
      "evidenceLinks",
      "confidence",
      "uncertainty"
    ],
    properties: {
      profile: {
        type: "object",
        additionalProperties: false,
        required: [
          "extractedFacts",
          "normalizedSummary",
          "inferredObservations",
          "missingCriticalInformation",
          "uncertaintyNotes"
        ],
        properties: {
          extractedFacts: {
            type: "object",
            additionalProperties: false,
            required: [
              "fullName",
              "contacts",
              "languages",
              "workHistorySignals",
              "recentRoles",
              "sectorSignals",
              "yearsExperienceEstimate",
              "educationSummary",
              "certifications",
              "skills",
              "locationSignals"
            ],
            properties: {
              fullName: { type: "string" },
              contacts: {
                type: "object",
                additionalProperties: false,
                required: ["emails", "phones"],
                properties: {
                  emails: { type: "array", items: { type: "string" }, maxItems: 5 },
                  phones: { type: "array", items: { type: "string" }, maxItems: 5 }
                }
              },
              languages: { type: "array", items: { type: "string" }, maxItems: 8 },
              workHistorySignals: { type: "array", items: { type: "string" }, maxItems: 10 },
              recentRoles: { type: "array", items: { type: "string" }, maxItems: 8 },
              sectorSignals: { type: "array", items: { type: "string" }, maxItems: 8 },
              yearsExperienceEstimate: { type: ["number", "null"] },
              educationSummary: { type: "array", items: { type: "string" }, maxItems: 6 },
              certifications: { type: "array", items: { type: "string" }, maxItems: 6 },
              skills: { type: "array", items: { type: "string" }, maxItems: 12 },
              locationSignals: { type: "array", items: { type: "string" }, maxItems: 6 }
            }
          },
          normalizedSummary: {
            type: "object",
            additionalProperties: false,
            required: [
              "shortSummary",
              "coreWorkHistorySummary",
              "likelyFitSignals",
              "recruiterFollowUpTopics"
            ],
            properties: {
              shortSummary: { type: "string" },
              coreWorkHistorySummary: { type: "string" },
              likelyFitSignals: { type: "array", items: { type: "string" }, maxItems: 8 },
              recruiterFollowUpTopics: { type: "array", items: { type: "string" }, maxItems: 8 }
            }
          },
          inferredObservations: {
            type: "array",
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["observation", "confidence", "rationale", "uncertain"],
              properties: {
                observation: { type: "string" },
                confidence: { type: "number" },
                rationale: { type: "string" },
                uncertain: { type: "boolean" }
              }
            }
          },
          missingCriticalInformation: { type: "array", items: { type: "string" }, maxItems: 10 },
          uncertaintyNotes: { type: "array", items: { type: "string" }, maxItems: 10 }
        }
      },
      ...defaultOutputSchema(schemaName).properties
    }
  };
}

export class CvParsingTaskService {
  private readonly cvContentService = new CvDocumentContentService();
  private readonly queue = new Queue(queueName, {
    connection: queueConnection
  });

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
      select: {
        id: true,
        fullName: true,
        source: true,
        email: true,
        phone: true,
        locationText: true,
        yearsOfExperience: true
      }
    });

    if (!candidate) {
      throw new TaskProcessingError("CANDIDATE_NOT_FOUND", "Aday bulunamadi.", false, {
        candidateId
      });
    }

    const cvFile = await this.resolveCvFile(context, candidate.id);
    const extraction = await this.cvContentService.extract({
      storageKey: cvFile.storageKey,
      originalName: cvFile.originalName,
      mimeType: cvFile.mimeType
    });
    const extractionStatus = mapExtractionStatusToPrisma(extraction.status);
    const extractionMethod = mapExtractionMethodToPrisma(extraction.method);

    await this.prisma.cVExtractionRun.create({
      data: {
        tenantId: context.tenantId,
        candidateId: candidate.id,
        cvFileId: cvFile.id,
        aiTaskRunId: context.taskRun.id,
        status: extractionStatus,
        method: extractionMethod,
        providerKey: extraction.providerKey,
        charCount: extraction.charCount,
        qualityScore: extraction.qualityScore,
        metadata: asJsonObject({
          notes: extraction.notes,
          errorMessage: extraction.errorMessage ?? null
        }),
        errorMessage: extraction.errorMessage
      }
    });

    const deterministic = this.buildDeterministicProfile({
      candidate,
      cvFile,
      extractionText: extraction.text,
      extractionStatus: extraction.status,
      extractionNotes: extraction.notes
    });

    const promptTemplate = await this.loadPromptTemplate(context.tenantId, context.taskRun.id);
    const promptVersion = promptTemplate
      ? `${promptTemplate.key}:v${promptTemplate.version}`
      : "cv_parsing.v2.tr";

    const generation = await this.provider.generate({
      taskType: "CV_PARSING",
      schemaName: "cv_parsing_v1_tr",
      schema: cvParsingOutputSchema("cv_parsing_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt:
        "Turkce recruiter destek ciktisi uret. CV'den aday bilgisini cikart, belirsizlikleri acikca belirt, otomatik red veya nihai karar verme.",
      userPrompt: JSON.stringify({
        task: "CV_PARSING",
        locale: "tr-TR",
        candidate: {
          id: candidate.id,
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          source: candidate.source
        },
        cvFile: {
          id: cvFile.id,
          originalName: cvFile.originalName,
          mimeType: cvFile.mimeType,
          sizeBytes: cvFile.sizeBytes,
          uploadedAt: cvFile.uploadedAt.toISOString()
        },
        extraction: {
          status: extraction.status,
          method: extraction.method,
          charCount: extraction.charCount,
          notes: extraction.notes
        },
        cvTextSnippet: extraction.text ? extraction.text.slice(0, 12000) : null,
        existingCandidateProfile: {
          fullName: candidate.fullName,
          email: candidate.email,
          phone: candidate.phone,
          locationText: candidate.locationText,
          yearsOfExperience: candidate.yearsOfExperience
        },
        instructions: [
          "CV metninden profile.extractedFacts alanlarini cikart",
          "Emin olmadigin alanlari bos birak veya null don, uydurma yapma",
          "Isim, email, telefon, lokasyon, rol sinyali, sektor sinyali, beceri, egitim ve belge alanlarini mumkun oldugunca CV'den cikart",
          "facts/interpretation/recommendation ayrimini koru",
          "evidenceLinks alaninda candidate/cv_file referansi kullan",
          "missingInformation alanini recruiter'in tamamlayabilecegi maddelerle doldur"
        ]
      })
    });

    const normalized = this.normalizeCvParsingOutput(generation.output, deterministic);
    const sections = normalized.sections;
    const confidence = this.policy.normalizeConfidence(
      sections.confidence,
      deterministic.sections.confidence
    );
    const uncertaintyLevel = this.policy.uncertaintyLevel(confidence);
    const requiresManualReview =
      confidence < 0.7 ||
      extraction.status !== "extracted" ||
      (extraction.qualityScore ?? 0) < 0.55 ||
      normalized.profile.missingCriticalInformation.length > 0 ||
      generation.mode === "deterministic_fallback";

    const parsedProfileSnapshot: ParsedProfileSnapshot = {
      ...normalized.profile,
      source: {
        cvFileId: cvFile.id,
        candidateId: candidate.id,
        extractionStatus: extraction.status,
        extractionMethod: extraction.method,
        extractionProvider: extraction.providerKey,
        extractionQualityScore: extraction.qualityScore,
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        parsedAt: new Date().toISOString()
      },
      aiSections: {
        facts: sections.facts,
        interpretation: sections.interpretation,
        recommendation: {
          summary: sections.recommendationSummary,
          action: sections.recommendationAction,
          recommendedOutcome: sections.recommendedOutcome
        }
      }
    };

    const profile = await this.prisma.cVParsedProfile.upsert({
      where: {
        cvFileId: cvFile.id
      },
      update: {
        aiTaskRunId: context.taskRun.id,
        profileJson: parsedProfileSnapshot,
        parseConfidence: confidence,
        requiresManualReview,
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        extractionStatus,
        extractionMethod,
        extractionProvider: extraction.providerKey,
        extractionCharCount: extraction.charCount,
        extractionQuality: extraction.qualityScore,
        extractionNotesJson: asJsonObject({
          notes: extraction.notes,
          errorMessage: extraction.errorMessage ?? null
        }),
        uncertaintyJson: asJsonObject({
          level: uncertaintyLevel,
          confidence,
          reasons: sections.uncertaintyReasons
        })
      },
      create: {
        tenantId: context.tenantId,
        cvFileId: cvFile.id,
        aiTaskRunId: context.taskRun.id,
        profileJson: parsedProfileSnapshot,
        parseConfidence: confidence,
        requiresManualReview,
        providerMode: generation.mode,
        providerKey: generation.providerKey,
        modelKey: generation.modelKey,
        extractionStatus,
        extractionMethod,
        extractionProvider: extraction.providerKey,
        extractionCharCount: extraction.charCount,
        extractionQuality: extraction.qualityScore,
        extractionNotesJson: asJsonObject({
          notes: extraction.notes,
          errorMessage: extraction.errorMessage ?? null
        }),
        uncertaintyJson: asJsonObject({
          level: uncertaintyLevel,
          confidence,
          reasons: sections.uncertaintyReasons
        })
      }
    });

    await this.syncCandidateProfile({
      tenantId: context.tenantId,
      candidate,
      cvFile,
      parsedProfile: parsedProfileSnapshot
    });
    await this.enqueuePostParseTasks({
      tenantId: context.tenantId,
      requestedBy: context.taskRun.requestedBy ?? "system:cv_parsing",
      providerKey: context.taskRun.providerKey,
      applicationId: context.taskRun.applicationId,
      candidateId: candidate.id,
      jobId: context.taskRun.jobId,
      cvFileId: cvFile.id,
      traceId: context.traceId
    });

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
          cvFileId: cvFile.id,
          cvParsedProfileId: profile.id,
          extractionStatus: extraction.status,
          extractionMethod: extraction.method,
          extractionProvider: extraction.providerKey,
          extractionCharCount: extraction.charCount,
          extractionQualityScore: extraction.qualityScore,
          extractionNotes: extraction.notes,
          extractionErrorMessage: extraction.errorMessage ?? null,
          parsedProfile: parsedProfileSnapshot
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
        cvParsedProfileId: profile.id
      }
    };
  }

  private async syncCandidateProfile(input: {
    tenantId: string;
    candidate: {
      id: string;
      fullName: string;
      email: string | null;
      phone: string | null;
      locationText?: string | null;
      yearsOfExperience?: Prisma.Decimal | null;
    };
    cvFile: {
      id: string;
      originalName: string;
    };
    parsedProfile: ParsedProfileSnapshot;
  }) {
    const extractedFacts = input.parsedProfile.extractedFacts;
    const nextName =
      extractedFacts.fullName.trim().length > 0 &&
      this.shouldReplaceCandidateName(input.candidate.fullName, input.cvFile.originalName)
        ? extractedFacts.fullName.trim()
        : undefined;
    const nextEmail =
      !input.candidate.email && extractedFacts.contacts.emails[0]
        ? extractedFacts.contacts.emails[0]
        : undefined;
    const nextPhone =
      !input.candidate.phone && extractedFacts.contacts.phones[0]
        ? extractedFacts.contacts.phones[0]
        : undefined;
    const nextLocation =
      !input.candidate.locationText && extractedFacts.locationSignals[0]
        ? extractedFacts.locationSignals[0]
        : undefined;
    const nextYears =
      !input.candidate.yearsOfExperience && extractedFacts.yearsExperienceEstimate !== null
        ? new Prisma.Decimal(extractedFacts.yearsExperienceEstimate)
        : undefined;

    if (
      nextName === undefined &&
      nextEmail === undefined &&
      nextPhone === undefined &&
      nextLocation === undefined &&
      nextYears === undefined
    ) {
      return;
    }

    await this.prisma.candidate.update({
      where: {
        id: input.candidate.id
      },
      data: {
        ...(nextName ? { fullName: nextName } : {}),
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(nextPhone ? { phone: nextPhone } : {}),
        ...(nextLocation ? { locationText: nextLocation } : {}),
        ...(nextYears ? { yearsOfExperience: nextYears } : {})
      }
    });
  }

  private normalizeCvParsingOutput(
    value: unknown,
    fallback: DeterministicProfileBuild
  ): NormalizedCvParsingOutput {
    const root = toRecord(value);
    const profile = toRecord(root.profile);
    const extractedFacts = toRecord(profile.extractedFacts);
    const contacts = toRecord(extractedFacts.contacts);
    const normalizedSummary = toRecord(profile.normalizedSummary);

    const normalizedProfile: Omit<ParsedProfileSnapshot, "source" | "aiSections"> = {
      schemaVersion: "cv_profile.v1.tr",
      extractedFacts: {
        fullName: toStringValue(extractedFacts.fullName, fallback.profile.extractedFacts.fullName),
        contacts: {
          emails: this.toTrimmedStringArray(contacts.emails, fallback.profile.extractedFacts.contacts.emails, 5),
          phones: this.toTrimmedStringArray(contacts.phones, fallback.profile.extractedFacts.contacts.phones, 5)
        },
        languages: this.toTrimmedStringArray(extractedFacts.languages, fallback.profile.extractedFacts.languages, 8),
        workHistorySignals: this.toTrimmedStringArray(
          extractedFacts.workHistorySignals,
          fallback.profile.extractedFacts.workHistorySignals,
          10
        ),
        recentRoles: this.toTrimmedStringArray(extractedFacts.recentRoles, fallback.profile.extractedFacts.recentRoles, 8),
        sectorSignals: this.toTrimmedStringArray(extractedFacts.sectorSignals, fallback.profile.extractedFacts.sectorSignals, 8),
        yearsExperienceEstimate: this.toNullableNumber(
          extractedFacts.yearsExperienceEstimate,
          fallback.profile.extractedFacts.yearsExperienceEstimate
        ),
        educationSummary: this.toTrimmedStringArray(
          extractedFacts.educationSummary,
          fallback.profile.extractedFacts.educationSummary,
          6
        ),
        certifications: this.toTrimmedStringArray(
          extractedFacts.certifications,
          fallback.profile.extractedFacts.certifications,
          6
        ),
        skills: this.toTrimmedStringArray(extractedFacts.skills, fallback.profile.extractedFacts.skills, 12),
        locationSignals: this.toTrimmedStringArray(
          extractedFacts.locationSignals,
          fallback.profile.extractedFacts.locationSignals,
          6
        )
      },
      normalizedSummary: {
        shortSummary: toStringValue(
          normalizedSummary.shortSummary,
          fallback.profile.normalizedSummary.shortSummary
        ),
        coreWorkHistorySummary: toStringValue(
          normalizedSummary.coreWorkHistorySummary,
          fallback.profile.normalizedSummary.coreWorkHistorySummary
        ),
        likelyFitSignals: this.toTrimmedStringArray(
          normalizedSummary.likelyFitSignals,
          fallback.profile.normalizedSummary.likelyFitSignals,
          8
        ),
        recruiterFollowUpTopics: this.toTrimmedStringArray(
          normalizedSummary.recruiterFollowUpTopics,
          fallback.profile.normalizedSummary.recruiterFollowUpTopics,
          8
        )
      },
      inferredObservations: this.normalizeObservations(
        profile.inferredObservations,
        fallback.profile.inferredObservations
      ),
      missingCriticalInformation: this.toTrimmedStringArray(
        profile.missingCriticalInformation,
        fallback.profile.missingCriticalInformation,
        10
      ),
      uncertaintyNotes: this.toTrimmedStringArray(
        profile.uncertaintyNotes,
        fallback.profile.uncertaintyNotes,
        10
      )
    };

    return {
      profile: normalizedProfile,
      sections: normalizeStructuredSections(root, fallback.sections)
    };
  }

  private async enqueuePostParseTasks(input: {
    tenantId: string;
    requestedBy: string;
    providerKey: string | null;
    applicationId: string | null;
    candidateId: string;
    jobId: string | null;
    cvFileId: string;
    traceId?: string;
  }) {
    if (!input.applicationId || !input.jobId) {
      return;
    }

    await this.enqueueAiTaskRunIfNeeded({
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      providerKey: input.providerKey,
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      cvFileId: input.cvFileId,
      taskType: "SCREENING_SUPPORT",
      workflowType: "screening_support",
      automationLevel: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
      maxAttempts: 4,
      traceId: input.traceId
    });

    await this.enqueueAiTaskRunIfNeeded({
      tenantId: input.tenantId,
      requestedBy: input.requestedBy,
      providerKey: input.providerKey,
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      cvFileId: input.cvFileId,
      taskType: "APPLICANT_FIT_SCORING",
      workflowType: "applicant_fit_scoring",
      automationLevel: AiAutomationLevel.ASSISTED,
      maxAttempts: 3,
      traceId: input.traceId
    });
  }

  private async enqueueAiTaskRunIfNeeded(input: {
    tenantId: string;
    requestedBy: string;
    providerKey: string | null;
    applicationId: string;
    candidateId: string;
    jobId: string;
    cvFileId: string;
    taskType: "SCREENING_SUPPORT" | "APPLICANT_FIT_SCORING";
    workflowType: "screening_support" | "applicant_fit_scoring";
    automationLevel: AiAutomationLevel;
    maxAttempts: number;
    traceId?: string;
  }) {
    const activeRun = await this.prisma.aiTaskRun.findFirst({
      where: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        taskType: input.taskType,
        status: {
          in: [AiTaskStatus.PENDING, AiTaskStatus.QUEUED, AiTaskStatus.RUNNING]
        }
      },
      select: {
        id: true
      }
    });

    if (activeRun) {
      return;
    }

    const workflowJob = await this.prisma.workflowJob.create({
      data: {
        tenantId: input.tenantId,
        type: input.workflowType,
        payload: {
          taskType: input.taskType,
          candidateId: input.candidateId,
          jobId: input.jobId,
          applicationId: input.applicationId,
          input: {
            triggerSource: "system",
            triggerReasonCode: "cv_parsing_completed_follow_up",
            cvFileId: input.cvFileId
          }
        } as Prisma.InputJsonValue,
        traceId: input.traceId ?? randomUUID(),
        maxAttempts: input.maxAttempts
      }
    });

    const taskRun = await this.prisma.aiTaskRun.create({
      data: {
        tenantId: input.tenantId,
        taskType: input.taskType,
        status: AiTaskStatus.QUEUED,
        automationLevel: input.automationLevel,
        candidateId: input.candidateId,
        jobId: input.jobId,
        applicationId: input.applicationId,
        inputJson: {
          triggerSource: "system",
          triggerReasonCode: "cv_parsing_completed_follow_up",
          cvFileId: input.cvFileId
        } as Prisma.InputJsonValue,
        providerKey: input.providerKey ?? undefined,
        requestedBy: input.requestedBy,
        workflowJobId: workflowJob.id
      }
    });

    await this.prisma.workflowJob.update({
      where: {
        id: workflowJob.id
      },
      data: {
        payload: {
          taskRunId: taskRun.id,
          taskType: input.taskType,
          candidateId: input.candidateId,
          jobId: input.jobId,
          applicationId: input.applicationId,
          input: {
            triggerSource: "system",
            triggerReasonCode: "cv_parsing_completed_follow_up",
            cvFileId: input.cvFileId
          }
        } as Prisma.InputJsonValue
      }
    });

    await this.queue.add(
      workflowJob.type,
      {
        workflowJobId: workflowJob.id,
        tenantId: input.tenantId,
        type: workflowJob.type,
        payload: {
          taskRunId: taskRun.id,
          taskType: input.taskType,
          candidateId: input.candidateId,
          jobId: input.jobId,
          applicationId: input.applicationId,
          input: {
            triggerSource: "system",
            triggerReasonCode: "cv_parsing_completed_follow_up",
            cvFileId: input.cvFileId
          }
        }
      },
      {
        jobId: workflowJob.id,
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 100
      }
    );
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

  private async resolveCvFile(context: TaskExecutionContext, candidateId: string) {
    const input = toRecord(context.taskRun.inputJson);
    const requestedCvFileId =
      typeof input.cvFileId === "string" && input.cvFileId.trim().length > 0
        ? input.cvFileId
        : null;

    if (requestedCvFileId) {
      const explicitCvFile = await this.prisma.cVFile.findFirst({
        where: {
          id: requestedCvFileId,
          tenantId: context.tenantId,
          candidateId
        }
      });

      if (!explicitCvFile) {
        throw new TaskProcessingError(
          "CV_FILE_NOT_FOUND",
          "Task run icinde belirtilen cvFileId bulunamadi.",
          false,
          {
            cvFileId: requestedCvFileId,
            candidateId
          }
        );
      }

      return explicitCvFile;
    }

    const latestCvFile = await this.prisma.cVFile.findFirst({
      where: {
        tenantId: context.tenantId,
        candidateId
      },
      orderBy: [{ isPrimary: "desc" }, { uploadedAt: "desc" }]
    });

    if (!latestCvFile) {
      throw new TaskProcessingError(
        "CV_FILE_NOT_FOUND",
        "Adaya ait parse edilecek CV dosyasi bulunamadi.",
        false,
        {
          candidateId
        }
      );
    }

    return latestCvFile;
  }

  private buildDeterministicProfile(input: {
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
      uploadedAt: Date;
    };
    extractionText: string | null;
    extractionStatus: CvExtractionStatus;
    extractionNotes: string[];
  }): DeterministicProfileBuild {
    const lines = input.extractionText
      ? input.extractionText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
      : [];
    const text = input.extractionText ?? "";
    const textLower = text.toLowerCase();
    const normalizedText = normalizeTurkishText(text);

    const emails = this.uniqueList([
      ...this.extractEmails(text),
      ...(input.candidate.email ? [input.candidate.email] : [])
    ]);
    const phones = this.uniqueList([
      ...this.extractPhones(text),
      ...(input.candidate.phone ? [input.candidate.phone] : [])
    ]);
    const languages = this.uniqueList(
      LANGUAGE_SIGNALS.filter((item) => item.pattern.test(text)).map((item) => item.label)
    );
    const skills = this.uniqueList(
      SKILL_KEYWORDS.filter((keyword) => textLower.includes(keyword)).map((keyword) => keyword)
    ).slice(0, 12);
    const educationSummary = this.pickLines(lines, /(universite|universite|lise|meslek|onlisans|lisans|egitim|egitim)/i, 5);
    const certifications = this.pickLines(lines, /(sertifika|belge|ehliyet|src|forklift)/i, 5);
    const workHistorySignals = this.pickLines(
      lines,
      /(20\d{2}|19\d{2}|deneyim|tecrube|tecrube|calisti|calisti|gorev|pozisyon)/i,
      8
    );
    const recentRoles = this.uniqueList(
      ROLE_SIGNALS.filter((item) => item.pattern.test(text)).map((item) => item.label)
    );
    const sectorSignals = this.uniqueList(
      this.readSectorSignals(textLower, recentRoles)
    );
    const locationSignals = this.uniqueList(
      TURKISH_CITIES.filter((city) => normalizedText.includes(city)).map(
        (city) => city.charAt(0).toUpperCase() + city.slice(1)
      )
    );
    const yearsExperienceEstimate = this.estimateYearsExperience(text, workHistorySignals);
    const extractedFullName =
      this.extractCandidateName(lines, input.cvFile.originalName) ?? input.candidate.fullName;

    const missingCriticalInformation = this.uniqueList([
      ...(emails.length + phones.length > 0 ? [] : ["iletisim_bilgisi"]),
      ...(workHistorySignals.length > 0 ? [] : ["is_deneyimi_detayi"]),
      ...(skills.length > 0 ? [] : ["beceri_ve_yetkinlik"]),
      ...(educationSummary.length > 0 ? [] : ["egitim_gecmisi"]),
      ...(input.extractionStatus === "extracted" ? [] : ["cv_metin_cikarimi"])
    ]);

    const gapSignals = this.detectPotentialEmploymentGaps(text);

    const uncertaintyNotes = this.uniqueList([
      ...input.extractionNotes,
      ...(gapSignals.length > 0
        ? ["Deneyim yil araliklarinda bosluk olabilecegine dair sinyal var."]
        : []),
      ...(missingCriticalInformation.length > 0
        ? [`Eksik kritik alanlar: ${missingCriticalInformation.join(", ")}`]
        : [])
    ]);

    const inferredObservations = this.buildInferredObservations({
      recentRoles,
      sectorSignals,
      skills,
      gapSignals
    });

    const shortSummary = this.buildShortSummary({
      candidateName: input.candidate.fullName,
      recentRoles,
      yearsExperienceEstimate,
      sectorSignals,
      extractionStatus: input.extractionStatus
    });
    const recruiterFollowUpTopics = this.uniqueList([
      ...(missingCriticalInformation.includes("cv_metin_cikarimi")
        ? ["CV'yi TXT/PDF okunabilir formatta tekrar isteme"]
        : []),
      ...(gapSignals.length > 0 ? ["Calisma donemlerindeki bosluklarin teyidi"] : []),
      ...(certifications.length > 0 ? ["Sertifika/belge dogrulugu"] : []),
      ...(skills.length === 0 ? ["Beceri listesi ve teknik yeterlilik"] : [])
    ]);
    const likelyFitSignals = this.uniqueList([
      ...recentRoles,
      ...sectorSignals.slice(0, 3),
      ...(skills.includes("vardiya") ? ["Vardiya calisma uyumu sinyali"] : [])
    ]);

    const confidence = this.calculateDeterministicConfidence({
      extractionStatus: input.extractionStatus,
      workHistoryCount: workHistorySignals.length,
      skillCount: skills.length,
      contactCount: emails.length + phones.length,
      educationCount: educationSummary.length
    });

    const sections: StructuredTaskSections = {
      facts: this.uniqueList([
        `Aday: ${input.candidate.fullName}`,
        `CV dosyasi: ${input.cvFile.originalName}`,
        ...(recentRoles.length > 0 ? [`Son rol sinyalleri: ${recentRoles.join(", ")}`] : []),
        ...(yearsExperienceEstimate !== null
          ? [`Tahmini deneyim: ~${yearsExperienceEstimate} yil`]
          : []),
        ...(languages.length > 0 ? [`Dil sinyalleri: ${languages.join(", ")}`] : [])
      ]).slice(0, 10),
      interpretation: this.uniqueList([
        shortSummary,
        ...(inferredObservations.length > 0
          ? inferredObservations.map((item) => `${item.observation} (${item.rationale})`)
          : []),
        ...uncertaintyNotes.map((note) => `Belirsizlik: ${note}`)
      ]).slice(0, 10),
      recommendationSummary:
        "CV parsing ciktisi recruiter icin on-analizdir; nihai degerlendirme insan tarafinda kalir.",
      recommendationAction:
        "Eksik bilgileri takip sorulariyla tamamlayip adayi manuel olarak degerlendirin.",
      recommendedOutcome: "REVIEW",
      flags: this.uniqueList([
        ...(input.extractionStatus === "extracted"
          ? []
          : ["CV_TEXT_EXTRACTION_LIMITED:high"]),
        ...(missingCriticalInformation.length > 0
          ? ["MISSING_CRITICAL_INFORMATION:medium"]
          : []),
        ...(gapSignals.length > 0 ? ["POTENTIAL_EMPLOYMENT_GAP:medium"] : [])
      ]).map((item) => {
        const [codeRaw, severityRaw] = item.split(":");
        const code = codeRaw ?? "GENERIC_FLAG";
        const severity = severityRaw === "high" ? "high" : "medium";
        const note =
          code === "CV_TEXT_EXTRACTION_LIMITED"
            ? "Bu formatta V1 metin cikarimi sinirlidir; manuel CV incelemesi gerekli."
            : code === "POTENTIAL_EMPLOYMENT_GAP"
              ? "Deneyim yil araliklarinda bosluk olabilecegine dair sinyal var."
              : "Kritik bilgi eksikleri recruiter tarafindan tamamlanmali.";
        return {
          code,
          severity: severity as "medium" | "high",
          note
        };
      }),
      missingInformation: missingCriticalInformation,
      evidenceLinks: [
        {
          sourceType: "candidate",
          sourceRef: input.candidate.id,
          claim: "Aday temel profili parsing girdisi olarak kullanildi."
        },
        {
          sourceType: "cv_file",
          sourceRef: input.cvFile.id,
          claim:
            input.extractionStatus === "extracted"
              ? "CV metni TXT olarak cikartildi."
              : "CV metni tam cikartilamadi; metadata tabanli parsing yapildi."
        }
      ],
      confidence,
      uncertaintyReasons: uncertaintyNotes
    };

    return {
      profile: {
        schemaVersion: "cv_profile.v1.tr",
        extractedFacts: {
          fullName: extractedFullName,
          contacts: {
            emails,
            phones
          },
          languages,
          workHistorySignals,
          recentRoles,
          sectorSignals,
          yearsExperienceEstimate,
          educationSummary,
          certifications,
          skills,
          locationSignals
        },
        normalizedSummary: {
          shortSummary,
          coreWorkHistorySummary:
            workHistorySignals.length > 0
              ? workHistorySignals.slice(0, 3).join(" | ")
              : "CV iceriginde dogrudan deneyim satiri cikarilamadi.",
          likelyFitSignals,
          recruiterFollowUpTopics
        },
        inferredObservations,
        missingCriticalInformation,
        uncertaintyNotes
      },
      sections
    };
  }

  private extractCandidateName(lines: string[], originalName: string) {
    const candidates = [
      ...lines.slice(0, 8),
      originalName.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ")
    ];

    for (const raw of candidates) {
      const cleaned = raw
        .replace(/\b(cv|resume|ozgecmis|özgeçmiş|curriculum vitae)\b/gi, " ")
        .replace(/[|_/\\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (
        /^[A-Za-zÇĞİÖŞÜçğıöşü'.]+(?:\s+[A-Za-zÇĞİÖŞÜçğıöşü'.]+){1,3}$/.test(cleaned) &&
        !/@/.test(cleaned) &&
        !/\d/.test(cleaned)
      ) {
        return cleaned;
      }
    }

    return null;
  }

  private shouldReplaceCandidateName(currentName: string, originalName: string) {
    const normalizedCurrent = currentName
      .toLocaleLowerCase("tr-TR")
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const normalizedFile = originalName
      .replace(/\.[^.]+$/, "")
      .toLocaleLowerCase("tr-TR")
      .replace(/[_\-]+/g, " ")
      .replace(/\b(cv|resume|ozgecmis|özgeçmiş|curriculum vitae)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    return (
      normalizedCurrent.length === 0 ||
      normalizedCurrent === "yeni aday" ||
      normalizedCurrent === normalizedFile ||
      /[_\d]/.test(currentName)
    );
  }

  private extractEmails(text: string) {
    const matches = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
    return this.uniqueList(matches.map((item) => item.toLowerCase())).slice(0, 5);
  }

  private extractPhones(text: string) {
    const matches =
      text.match(/(?:\+?90|0)?\s*\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}/g) ?? [];
    const normalized = matches
      .map((item) => item.replace(/\D/g, ""))
      .map((digits) => {
        if (digits.startsWith("90")) {
          return digits;
        }
        if (digits.startsWith("0")) {
          return `9${digits}`;
        }
        if (digits.length === 10) {
          return `90${digits}`;
        }
        return digits;
      })
      .filter((digits) => digits.length >= 12);

    return this.uniqueList(normalized).slice(0, 5);
  }

  private estimateYearsExperience(text: string, workHistorySignals: string[]) {
    const byDuration = (text.match(/(\d{1,2})\s*\+?\s*(yil|sene)/gi) ?? [])
      .map((item) => {
        const num = Number(item.replace(/[^\d]/g, ""));
        return Number.isFinite(num) ? num : 0;
      })
      .filter((num) => num > 0);

    if (byDuration.length > 0) {
      return Math.min(Math.max(...byDuration), 40);
    }

    const yearMatches = (text.match(/\b(19|20)\d{2}\b/g) ?? [])
      .map((item) => Number(item))
      .filter((value) => Number.isFinite(value));

    if (yearMatches.length >= 2) {
      const earliest = Math.min(...yearMatches);
      const latest = Math.max(...yearMatches);
      const diff = latest - earliest;

      if (diff >= 0 && diff <= 40) {
        return diff;
      }
    }

    if (workHistorySignals.length > 0) {
      return 1;
    }

    return null;
  }

  private detectPotentialEmploymentGaps(text: string) {
    const rangeRegex = /((19|20)\d{2})\s*[-]\s*((19|20)\d{2}|devam|halen|present)/gi;
    const ranges: Array<{ start: number; end: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = rangeRegex.exec(text)) !== null) {
      const start = Number(match[1]);
      const endRawValue = match[3];

      if (!endRawValue) {
        continue;
      }

      const endRaw = endRawValue.toLowerCase();
      const end =
        endRaw === "devam" || endRaw === "halen" || endRaw === "present"
          ? new Date().getFullYear()
          : Number(endRaw);

      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        ranges.push({ start, end });
      }
    }

    const sorted = ranges.sort((a, b) => a.start - b.start);
    const gaps: string[] = [];

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];

      if (!previous || !current) {
        continue;
      }

      const gap = current.start - previous.end;

      if (gap > 1) {
        gaps.push(`${previous.end} - ${current.start}`);
      }
    }

    return gaps;
  }

  private buildInferredObservations(input: {
    recentRoles: string[];
    sectorSignals: string[];
    skills: string[];
    gapSignals: string[];
  }) {
    const observations: Array<{
      observation: string;
      confidence: number;
      rationale: string;
      uncertain: true;
    }> = [];

    if (input.recentRoles.length > 0 && input.sectorSignals.length > 0) {
      observations.push({
        observation: "Adayin rol-sektor uyumu icin pozitif sinyal bulunuyor.",
        confidence: 0.64,
        rationale: `${input.recentRoles[0]} ve ${input.sectorSignals[0]} sinyalleri goruldu.`,
        uncertain: true
      });
    }

    if (input.skills.includes("vardiya")) {
      observations.push({
        observation: "Vardiya gerektiren rollerde uyum ihtimali olabilir.",
        confidence: 0.61,
        rationale: "CV metninde vardiya ifadesi bulundu.",
        uncertain: true
      });
    }

    if (input.gapSignals.length > 0) {
      observations.push({
        observation: "Deneyim kronolojisinde aciklanmasi gereken bosluk olabilir.",
        confidence: 0.52,
        rationale: `Yil araliklari: ${input.gapSignals.slice(0, 2).join(", ")}`,
        uncertain: true
      });
    }

    return observations.slice(0, 5);
  }

  private buildShortSummary(input: {
    candidateName: string;
    recentRoles: string[];
    yearsExperienceEstimate: number | null;
    sectorSignals: string[];
    extractionStatus: CvExtractionStatus;
  }) {
    if (input.extractionStatus !== "extracted") {
      return `${input.candidateName} icin CV metin cikarimi sinirli; profil ozetinde manuel inceleme zorunludur.`;
    }

    const rolePart =
      input.recentRoles.length > 0
        ? `Rol sinyali: ${input.recentRoles.slice(0, 2).join(", ")}.`
        : "Net rol sinyali sinirli.";
    const experiencePart =
      input.yearsExperienceEstimate !== null
        ? `Tahmini deneyim ${input.yearsExperienceEstimate} yil civarinda.`
        : "Deneyim suresi net degil.";
    const sectorPart =
      input.sectorSignals.length > 0
        ? `Sektor sinyali: ${input.sectorSignals.slice(0, 2).join(", ")}.`
        : "Sektor sinyali sinirli.";

    return `${rolePart} ${experiencePart} ${sectorPart}`.trim();
  }

  private readSectorSignals(textLower: string, recentRoles: string[]) {
    const sectors = [];

    if (/\bdepo|stok|sevkiyat|forklift|lojistik\b/i.test(textLower)) {
      sectors.push("Depo/Lojistik");
    }
    if (/\bmarket|magaza|kasiyer|perakende|reyon\b/i.test(textLower)) {
      sectors.push("Perakende");
    }
    if (/\bmusteri|destek|cagri|cagri|whatsapp|ticket\b/i.test(textLower)) {
      sectors.push("Musteri Destek");
    }

    if (sectors.length === 0 && recentRoles.length > 0) {
      sectors.push("Rol sinyalinden sektor cikarimi");
    }

    return sectors;
  }

  private calculateDeterministicConfidence(input: {
    extractionStatus: CvExtractionStatus;
    workHistoryCount: number;
    skillCount: number;
    contactCount: number;
    educationCount: number;
  }) {
    if (input.extractionStatus !== "extracted") {
      return input.extractionStatus === "partial" ? 0.28 : 0.34;
    }

    let score = 0.56;

    if (input.workHistoryCount > 0) {
      score += 0.12;
    }
    if (input.skillCount > 0) {
      score += 0.08;
    }
    if (input.contactCount > 0) {
      score += 0.08;
    }
    if (input.educationCount > 0) {
      score += 0.06;
    }

    return Math.min(score, 0.9);
  }

  private toTrimmedStringArray(value: unknown, fallback: string[], maxItems: number) {
    const items = toArray(value)
      .map((item) => toStringValue(item, "").trim())
      .filter(Boolean);

    return this.uniqueList(items.length > 0 ? items : fallback).slice(0, maxItems);
  }

  private toNullableNumber(value: unknown, fallback: number | null) {
    if (value === null) {
      return null;
    }

    const numeric = toNumberValue(value, Number.NaN);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    return fallback;
  }

  private normalizeObservations(
    value: unknown,
    fallback: Omit<ParsedProfileSnapshot, "source" | "aiSections">["inferredObservations"]
  ) {
    const normalized = toArray(value)
      .map((item) => {
        const record = toRecord(item);
        const observation = toStringValue(record.observation, "").trim();
        const rationale = toStringValue(record.rationale, "").trim();

        if (!observation || !rationale) {
          return null;
        }

        const confidence = Math.min(1, Math.max(0, toNumberValue(record.confidence, 0.5)));

        return {
          observation,
          confidence,
          rationale,
          uncertain: true as const
        };
      })
      .filter((
        item
      ): item is Omit<ParsedProfileSnapshot, "source" | "aiSections">["inferredObservations"][number] => item !== null);

    return (normalized.length > 0 ? normalized : fallback).slice(0, 8);
  }

  private pickLines(lines: string[], pattern: RegExp, limit: number) {
    return this.uniqueList(lines.filter((line) => pattern.test(line))).slice(0, limit);
  }

  private uniqueList(items: string[]) {
    const normalized = items
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return Array.from(new Set(normalized));
  }
}
