import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  ContactSuppressionStatus,
  OutreachMessageStatus,
  Prisma,
  ProspectFitLabel,
  SourcingProspectStage,
  TalentSourceKind
} from "@prisma/client";
import { ApplicationsService } from "../applications/applications.service";
import { CandidatesService } from "../candidates/candidates.service";
import { JobsService } from "../jobs/jobs.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  buildTalentSignals,
  evaluateSourcingFit,
  fitEvaluationToJson,
  type SourcingFitEvaluation
} from "./sourcing-fit.util";

type CreateSourcingProjectInput = {
  tenantId: string;
  createdBy: string;
  jobId: string;
  name?: string;
  personaSummary?: string;
  notes?: string;
};

type UpdateProspectStageInput = {
  tenantId: string;
  projectId: string;
  prospectId: string;
  stage: SourcingProspectStage;
  recruiterNote?: string;
};

type AttachProspectInput = {
  tenantId: string;
  projectId: string;
  prospectId: string;
  requestedBy: string;
  traceId?: string;
};

type SendOutreachInput = {
  tenantId: string;
  projectId: string;
  prospectIds: string[];
  requestedBy: string;
  templateId?: string;
  subject?: string;
  body?: string;
  reviewNote?: string;
  sendNow?: boolean;
  stepIndex?: number;
};

type UpdateSuppressionInput = {
  tenantId: string;
  profileId: string;
  status: ContactSuppressionStatus;
  reason?: string;
};

type SourcingDiscoveryCriteriaInput = {
  roleTitle?: string;
  keyword?: string;
  locationText?: string;
  minYearsExperience?: number | null;
  skillTags?: string[];
  companyBackground?: string[];
  languages?: string[];
  workModel?: string;
  compensationMin?: number | null;
  compensationMax?: number | null;
  idealCandidateNotes?: string;
};

type SourcingDiscoveryCriteria = {
  roleTitle: string;
  keyword: string | null;
  locationText: string | null;
  minYearsExperience: number | null;
  skillTags: string[];
  companyBackground: string[];
  languages: string[];
  workModel: string | null;
  compensationMin: number | null;
  compensationMax: number | null;
  idealCandidateNotes: string | null;
};

type DiscoverExternalProspectsInput = {
  tenantId: string;
  projectId: string;
  requestedBy: string;
  criteria?: SourcingDiscoveryCriteriaInput;
};

type RecruiterImportSourceType =
  | "recruiter_import"
  | "public_profile_url"
  | "agency_upload"
  | "referral"
  | "job_board_export";

type RecruiterLeadInput = {
  fullName: string;
  headline?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  locationText?: string | null;
  yearsOfExperience?: number | null;
  workModel?: string | null;
  email?: string | null;
  phone?: string | null;
  sourceUrl?: string | null;
  skills?: string[];
  languages?: string[];
  notes?: string | null;
  recruiterTags?: string[];
  externalRef?: string | null;
  evidence?: string[];
};

type ImportRecruiterLeadsInput = {
  tenantId: string;
  projectId: string;
  requestedBy: string;
  sourceType: RecruiterImportSourceType;
  sourceLabel?: string | null;
  leads: RecruiterLeadInput[];
};

type ImportProfileUrlsInput = {
  tenantId: string;
  projectId: string;
  requestedBy: string;
  urls: string[];
  note?: string | null;
};

type RecruiterImportSummary = {
  totalRecords: number;
  processedRecords: number;
  newProfiles: number;
  mergedProfiles: number;
  newProspects: number;
  duplicateProspects: number;
  existingCandidateMatches: number;
  errorCount: number;
  sourceType: RecruiterImportSourceType;
  sourceLabel: string;
  errors: Array<{
    index: number;
    reason: string;
    ref: string | null;
  }>;
};

type ExternalDiscoveryCandidate = {
  fullName: string;
  headline: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  locationText: string | null;
  yearsOfExperience: number | null;
  workModel: string | null;
  skills: string[];
  languages: string[];
  experienceSummary: string[];
  educationSummary: string[];
  summary: string | null;
  email: string | null;
  phone: string | null;
  sourceTitle: string;
  sourceUrl: string;
  sourceType: string | null;
  sourceConfidence: "high" | "medium" | "low";
  evidence: string[];
  whyMatch: string | null;
  contactSignals: string[];
  searchSnippetOnly: boolean;
  pageType: string | null;
  matchedCriteria: string[];
  qualityWarnings: string[];
};

type DiscoveryQualityLabel = "HIGH" | "MEDIUM" | "LOW";

type ScoredExternalDiscoveryCandidate = ExternalDiscoveryCandidate & {
  qualityLabel: DiscoveryQualityLabel;
  qualityScore: number;
  recruiterQualityLabel: string;
  recruiterQualitySummary: string;
  qualityReasons: string[];
  qualityWarnings: string[];
  matchedCriteria: string[];
};

type DiscoveryRoleContext = {
  roleBuckets: string[];
  titleVariants: string[];
  keywordVariants: string[];
  digitalVisibility: "limited" | "standard";
  recruiterGuidance: string[];
};

type ExternalDiscoverySummary = {
  totalCandidates: number;
  createdProfiles: number;
  mergedProfiles: number;
  linkedProspects: number;
  skippedResults: number;
  existingCandidateMatches: number;
  lastRunAt: string;
  mode: "openai_web_search";
  querySummary: string;
  highQualityResults: number;
  mediumQualityResults: number;
  lowQualityResults: number;
  filteredPatterns: string[];
  digitalVisibility: "limited" | "standard";
};

type OpenAiDiscoveryResponse = {
  candidates: ExternalDiscoveryCandidate[];
  queryHints?: string[];
  notes?: string[];
};

type UrlLeadExtraction = {
  isPersonProfile: boolean;
  fullName: string | null;
  headline: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  locationText: string | null;
  yearsOfExperience: number | null;
  workModel: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  languages: string[];
  summary: string | null;
  evidence: string[];
  notes: string[];
  warnings: string[];
  rejectReason: string | null;
};

type StringRecord = Record<string, unknown>;

const DISCOVERY_PROVIDER_KEY = "openai_web_search";
const DISCOVERY_PROVIDER_LABEL = "OpenAI Web Search";
const DISCOVERY_MODEL = process.env.OPENAI_MODEL_SOURCING_DISCOVERY?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() || "";
const UNSUPPORTED_DISCOVERY_URL_PATTERNS = [
  /\/jobs?\//i,
  /\/careers?\//i,
  /indeed\./i,
  /glassdoor\./i,
  /kariyer\.net\/is-ilani/i,
  /eleman\.net\/ilan\//i,
  /\/blog\//i,
  /\/articles?\//i,
  /\/course\//i,
  /\/courses\//i,
  /\/events?\//i,
  /\/forum\//i,
  /\/thread\//i,
  /\/directory\//i,
  /\/directories\//i,
  /\/listing\//i,
  /facebook\.com/i,
  /instagram\.com/i,
  /tiktok\.com/i,
  /x\.com/i,
  /twitter\.com/i
] as const;

const LOW_QUALITY_TITLE_PATTERNS = [
  /\b(job|jobs|career|careers|ilan|ilanlar|opening|openings)\b/i,
  /\b(blog|article|makale|yazi|insight|guide|rehber)\b/i,
  /\b(course|training|bootcamp|sertifika|event|webinar)\b/i,
  /\b(directory|listing|firma rehberi|şirket rehberi)\b/i,
  /\b(forum|community|topluluk|thread)\b/i
] as const;

const PERSON_NAME_BLOCKLIST = [
  "kariyer",
  "career",
  "jobs",
  "job",
  "blog",
  "article",
  "event",
  "directory",
  "listing"
] as const;

const ROLE_QUERY_RULES = [
  {
    bucket: "warehouse_leadership",
    matchTokens: ["depo", "warehouse", "lojistik", "logistics", "vardiya", "shift", "operasyon", "operations"],
    titleVariants: [
      "depo operasyon şefi",
      "depo sorumlusu",
      "depo amiri",
      "depo vardiya sorumlusu",
      "lojistik operasyon sorumlusu",
      "operasyon ekip lideri",
      "saha operasyon sorumlusu",
      "warehouse supervisor",
      "warehouse operations lead",
      "logistics operations supervisor",
      "shift supervisor",
      "operations team leader"
    ],
    keywordVariants: [
      "depo operasyonu",
      "stok yönetimi",
      "stok kontrolü",
      "sevkiyat",
      "yükleme boşaltma",
      "inbound outbound",
      "ekip yönetimi",
      "vardiya yönetimi",
      "warehouse management system",
      "WMS",
      "fulfillment",
      "dispatch",
      "inventory control"
    ],
    digitalVisibility: "limited" as const
  },
  {
    bucket: "store_operations",
    matchTokens: ["mağaza", "magaza", "store", "saha", "field", "retail", "frontline"],
    titleVariants: [
      "mağaza operasyon sorumlusu",
      "mağaza vardiya amiri",
      "saha operasyon lideri",
      "store operations supervisor",
      "store shift lead",
      "field operations lead"
    ],
    keywordVariants: [
      "mağaza operasyonu",
      "vardiya yönetimi",
      "ekip yönetimi",
      "saha koordinasyonu",
      "store operations",
      "frontline leadership"
    ],
    digitalVisibility: "limited" as const
  }
] as const;

function asRecord(value: unknown): StringRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as StringRecord;
}

function asStringArray(value: unknown) {
  const raw =
    typeof value === "string"
      ? value
          .split(/[\n,;|]/)
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : Array.isArray(value)
        ? value
        : [];
  return raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return undefined;
  }

  return new Prisma.Decimal(value);
}

function normalizeEmail(email?: string | null) {
  return email ? email.trim().toLowerCase() : null;
}

function normalizePhone(phone?: string | null) {
  if (!phone) {
    return null;
  }

  const normalized = phone.replace(/[^\d+]/g, "");
  return normalized.length > 0 ? normalized : null;
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function deriveProspectStage(label: ProspectFitLabel) {
  switch (label) {
    case ProspectFitLabel.STRONG_MATCH:
    case ProspectFitLabel.GOOD_MATCH:
      return SourcingProspectStage.GOOD_FIT;
    default:
      return SourcingProspectStage.NEEDS_REVIEW;
  }
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] ?? "");
}

function normalizeLooseText(value?: string | null) {
  return value
    ?.toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim() ?? "";
}

function uniqueTrimmed(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
    .filter((value) => value.length > 0);
}

function mergeString(existing: string | null | undefined, incoming: string | null | undefined) {
  if (!incoming || incoming.trim().length === 0) {
    return existing ?? null;
  }

  if (!existing || existing.trim().length === 0) {
    return incoming.trim();
  }

  return incoming.trim().length > existing.trim().length ? incoming.trim() : existing.trim();
}

function mergeStringArray(existing: unknown, incoming: string[]) {
  return uniqueTrimmed([...asStringArray(existing), ...incoming]);
}

function stripJsonFences(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  return trimmed;
}

function parseStructuredJson<T>(value: string): T {
  const cleaned = stripJsonFences(value);

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }

    throw new Error("External discovery yaniti parse edilemedi.");
  }
}

function parseDomain(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function canonicalizeSourceUrl(sourceUrl?: string | null) {
  if (!sourceUrl) {
    return null;
  }

  try {
    const url = new URL(sourceUrl);
    url.hash = "";
    url.searchParams.delete("utm_source");
    url.searchParams.delete("utm_medium");
    url.searchParams.delete("utm_campaign");
    const normalized = url.toString().replace(/\/+$/, "");
    return normalized;
  } catch {
    return sourceUrl.trim();
  }
}

function isUnsupportedDiscoveryUrl(sourceUrl: string) {
  return UNSUPPORTED_DISCOVERY_URL_PATTERNS.some((pattern) => pattern.test(sourceUrl));
}

function decodeBasicHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function stripHtmlContent(html: string) {
  return decodeBasicHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractHtmlTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeBasicHtmlEntities(match[1]).trim() : null;
}

function extractMetaContent(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeBasicHtmlEntities(match[1]).trim();
    }
  }

  return null;
}

function approximateSignature(input: {
  fullName: string;
  currentCompany?: string | null;
  currentTitle?: string | null;
}) {
  return [
    normalizeLooseText(input.fullName),
    normalizeLooseText(input.currentCompany),
    normalizeLooseText(input.currentTitle)
  ]
    .filter((token) => token.length > 0)
    .join("::");
}

function containsToken(text: string, tokens: readonly string[]) {
  return tokens.some((token) => text.includes(normalizeLooseText(token)));
}

function looksLikePersonName(fullName: string) {
  const normalized = normalizeLooseText(fullName);

  if (!normalized || PERSON_NAME_BLOCKLIST.some((token) => normalized.includes(token))) {
    return false;
  }

  const tokens = normalized.split(" ").filter((token) => token.length >= 2);
  return tokens.length >= 2 && tokens.length <= 5;
}

function recruiterQualityLabel(label: DiscoveryQualityLabel) {
  switch (label) {
    case "HIGH":
      return "Güçlü public profil";
    case "MEDIUM":
      return "Orta güvenli profil";
    default:
      return "Gürültülü / zayıf kaynak";
  }
}

function recruiterImportSourceConfig(sourceType: RecruiterImportSourceType, sourceLabel?: string | null) {
  switch (sourceType) {
    case "public_profile_url":
      return {
        sourceKind: TalentSourceKind.PUBLIC_PROFESSIONAL,
        providerKey: "public_profile_url",
        providerLabel: sourceLabel?.trim() || "Public Profile URL",
        candidateSource: "public_profile_url"
      };
    case "agency_upload":
      return {
        sourceKind: TalentSourceKind.RECRUITER_IMPORT,
        providerKey: "agency_upload",
        providerLabel: sourceLabel?.trim() || "Ajans Yüklemesi",
        candidateSource: "agency_upload"
      };
    case "referral":
      return {
        sourceKind: TalentSourceKind.REFERRAL,
        providerKey: "referral",
        providerLabel: sourceLabel?.trim() || "Referans",
        candidateSource: "referral"
      };
    case "job_board_export":
      return {
        sourceKind: TalentSourceKind.RECRUITER_IMPORT,
        providerKey: "job_board_export",
        providerLabel: sourceLabel?.trim() || "Job Board Export",
        candidateSource: "job_board_export"
      };
    default:
      return {
        sourceKind: TalentSourceKind.RECRUITER_IMPORT,
        providerKey: "recruiter_import",
        providerLabel: sourceLabel?.trim() || "Recruiter Import",
        candidateSource: "recruiter_import"
      };
  }
}

@Injectable()
export class SourcingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JobsService) private readonly jobsService: JobsService,
    @Inject(CandidatesService) private readonly candidatesService: CandidatesService,
    @Inject(ApplicationsService) private readonly applicationsService: ApplicationsService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService
  ) {}

  async getOverview(tenantId: string) {
    await Promise.all([
      this.syncInternalTalentProfiles(tenantId),
      this.ensureDefaultOutreachTemplates(tenantId, "system:sourcing")
    ]);

    const existingProjectIds = await this.prisma.sourcingProject.findMany({
      where: {
        tenantId,
        archivedAt: null
      },
      select: {
        id: true
      }
    });

    await Promise.all(
      existingProjectIds.map((project) => this.refreshProjectDiscovery(tenantId, project.id))
    );

    const [projects, talentProfiles, latestSavedProspects] = await Promise.all([
      this.prisma.sourcingProject.findMany({
        where: {
          tenantId,
          archivedAt: null
        },
        include: {
          job: {
            include: {
              requirements: true
            }
          },
          prospects: {
            include: {
              talentProfile: {
                select: {
                  sourceKind: true,
                  suppressionStatus: true
                }
              }
            },
            orderBy: [{ fitScore: "desc" }, { updatedAt: "desc" }]
          }
        },
        orderBy: {
          updatedAt: "desc"
        }
      }),
      this.prisma.talentProfile.findMany({
        where: {
          tenantId
        },
        orderBy: {
          updatedAt: "desc"
        },
        include: {
          sourceRecords: {
            orderBy: {
              createdAt: "desc"
            },
            take: 2
          }
        }
      }),
      this.prisma.sourcingProjectProspect.findMany({
        where: {
          tenantId,
          stage: {
            in: [SourcingProspectStage.SAVED, SourcingProspectStage.GOOD_FIT]
          }
        },
        include: {
          project: {
            select: {
              id: true,
              name: true
            }
          },
          talentProfile: {
            include: {
              sourceRecords: {
                orderBy: {
                  createdAt: "desc"
                },
                take: 1
              }
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 6
      })
    ]);

    const summary = {
      totalProjects: projects.length,
      activeProjects: projects.filter((project) => project.status === "ACTIVE").length,
      totalProspects: projects.reduce((sum, project) => sum + project.prospects.length, 0),
      savedProspects: projects.reduce(
        (sum, project) =>
          sum +
          project.prospects.filter(
            (prospect) =>
              prospect.stage === SourcingProspectStage.SAVED ||
              prospect.stage === SourcingProspectStage.GOOD_FIT
          ).length,
        0
      ),
      contacted: projects.reduce(
        (sum, project) =>
          sum + project.prospects.filter((prospect) => prospect.stage === SourcingProspectStage.CONTACTED).length,
        0
      ),
      replied: projects.reduce(
        (sum, project) =>
          sum + project.prospects.filter((prospect) => prospect.stage === SourcingProspectStage.REPLIED).length,
        0
      ),
      converted: projects.reduce(
        (sum, project) =>
          sum + project.prospects.filter((prospect) => prospect.stage === SourcingProspectStage.CONVERTED).length,
        0
      ),
      rediscoveredCandidates: talentProfiles.filter(
        (profile) => profile.sourceKind === TalentSourceKind.INTERNAL_CANDIDATE
      ).length,
      doNotContactCount: talentProfiles.filter(
        (profile) => profile.suppressionStatus !== ContactSuppressionStatus.ALLOWED
      ).length
    };

    return {
      summary,
      projects: projects.map((project) => this.mapProjectSummary(project)),
      talentPool: {
        totalProfiles: talentProfiles.length,
        bySource: this.countBy(
          talentProfiles.map((profile) => profile.sourceKind),
          (value) => value
        ),
        bySuppression: this.countBy(
          talentProfiles.map((profile) => profile.suppressionStatus),
          (value) => value
        ),
        recentProfiles: talentProfiles.slice(0, 6).map((profile) => ({
          id: profile.id,
          fullName: profile.fullName,
          headline: profile.headline,
          locationText: profile.locationText,
          currentTitle: profile.currentTitle,
          sourceKind: profile.sourceKind,
          suppressionStatus: profile.suppressionStatus,
          primarySource: profile.sourceRecords[0]
            ? {
                providerLabel: profile.sourceRecords[0].providerLabel,
                displayName: profile.sourceRecords[0].displayName,
                sourceUrl: profile.sourceRecords[0].sourceUrl
              }
            : null
        }))
      },
      savedProspects: latestSavedProspects.map((prospect) => ({
        id: prospect.id,
        projectId: prospect.project.id,
        projectName: prospect.project.name,
        fullName: prospect.talentProfile.fullName,
        headline: prospect.talentProfile.headline,
        currentTitle: prospect.talentProfile.currentTitle,
        fitLabel: prospect.fitLabel,
        fitScore: toNumber(prospect.fitScore),
        sourceKind: prospect.talentProfile.sourceKind,
        suppressionStatus: prospect.talentProfile.suppressionStatus,
        primarySource: prospect.talentProfile.sourceRecords[0]
          ? {
              providerLabel: prospect.talentProfile.sourceRecords[0].providerLabel,
              displayName: prospect.talentProfile.sourceRecords[0].displayName
            }
          : null
      })),
      compliance: {
        guidance:
          "Sourcing; iç aday havuzu, recruiter import ve canlı public web discovery ile bulunan kamuya açık/profesyonel profil verisi üzerinden çalışır. Suppression ve kaynak görünürlüğü recruiter ekranında korunur.",
        supportedSourceKinds: [
          TalentSourceKind.INTERNAL_CANDIDATE,
          TalentSourceKind.PUBLIC_PROFESSIONAL,
          TalentSourceKind.RECRUITER_IMPORT,
          TalentSourceKind.REFERRAL
        ]
      }
    };
  }

  async createProject(input: CreateSourcingProjectInput) {
    const job = await this.jobsService.getById(input.tenantId, input.jobId);

    const existing = await this.prisma.sourcingProject.findFirst({
      where: {
        tenantId: input.tenantId,
        jobId: input.jobId,
        archivedAt: null
      }
    });

    if (existing) {
      await this.refreshProjectDiscovery(input.tenantId, existing.id);
      return {
        created: false,
        projectId: existing.id
      };
    }

    const searchQuery = [job.title, job.roleFamily, job.locationText].filter(Boolean).join(" · ");
    const personaSummary =
      input.personaSummary?.trim() ||
      `Rol: ${job.title}. Lokasyon: ${job.locationText ?? "esnek"}. Temel arama odağı: ${job.requirements
        .map((requirement) => requirement.value)
        .slice(0, 4)
        .join(", ")}`;
    const seededDiscoveryCriteria = this.buildDefaultDiscoveryCriteria(job, personaSummary);

    const created = await this.prisma.sourcingProject.create({
      data: {
        tenantId: input.tenantId,
        jobId: job.id,
        name: input.name?.trim() || `${job.title} Sourcing Projesi`,
        personaSummary,
        notes: input.notes?.trim() || null,
        searchQuery,
        filtersJson: {
          location: job.locationText,
          shiftType: job.shiftType,
          roleFamily: job.roleFamily,
          requirementKeys: job.requirements.map((requirement) => requirement.key),
          discoveryCriteria: seededDiscoveryCriteria
        },
        stageGoalsJson: {
          needsReview: 8,
          goodFit: 5,
          contacted: 3
        },
        createdBy: input.createdBy
      }
    });

    await Promise.all([
      this.ensureDefaultOutreachTemplates(input.tenantId, input.createdBy),
      this.refreshProjectDiscovery(input.tenantId, created.id)
    ]);

    return {
      created: true,
      projectId: created.id
    };
  }

  async getProjectDetail(tenantId: string, projectId: string) {
    await this.ensureDefaultOutreachTemplates(tenantId, "system:sourcing");

    let project = await this.loadProjectDetailGraph(tenantId, projectId);

    if (!project) {
      throw new NotFoundException("Sourcing projesi bulunamadı.");
    }

    if (project.prospects.length === 0) {
      await this.refreshProjectDiscovery(tenantId, project.id);
      project = await this.loadProjectDetailGraph(tenantId, projectId);

      if (!project) {
        throw new NotFoundException("Sourcing projesi bulunamadı.");
      }
    }

    const stageCounts = this.countBy(project.prospects.map((prospect) => prospect.stage), (value) => value);
    const fitLabelCounts = this.countBy(project.prospects.map((prospect) => prospect.fitLabel), (value) => value);
    const prospects = project.prospects.map((prospect) => this.mapProspectDetail(prospect));
    const outreachTemplates = await this.listOutreachTemplates(tenantId, "system:sourcing", projectId);
    const discoveryCriteria = this.resolveDiscoveryCriteria(project);
    const discoveryContext = this.buildDiscoveryRoleContext(discoveryCriteria, project.job);
    const lastExternalDiscovery = this.readLastExternalDiscovery(project.filtersJson);
    const orderedProspects = [...prospects].sort((left, right) => {
      const rightRank = (right.fitScore ?? 0) * 0.62 + (right.discoveryQuality.score ?? 55) * 0.38;
      const leftRank = (left.fitScore ?? 0) * 0.62 + (left.discoveryQuality.score ?? 55) * 0.38;
      return rightRank - leftRank;
    });
    const topProspects = [...orderedProspects]
      .filter((prospect) => prospect.stage !== "CONVERTED")
      .slice(0, 4);

    const unmatchedRequirementHints = this.buildRequirementCoverageHints(project.job, prospects);

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        personaSummary: project.personaSummary,
        searchQuery: project.searchQuery,
        notes: project.notes,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        criteria: discoveryCriteria,
        lastExternalDiscovery,
        job: project.job
          ? {
              id: project.job.id,
              title: project.job.title,
              roleFamily: project.job.roleFamily,
              locationText: project.job.locationText,
              shiftType: project.job.shiftType,
              salaryMin: toNumber(project.job.salaryMin),
              salaryMax: toNumber(project.job.salaryMax),
              requirements: project.job.requirements.map((requirement) => ({
                id: requirement.id,
                key: requirement.key,
                value: requirement.value,
                required: requirement.required
              }))
            }
          : null
      },
      funnel: {
        total: orderedProspects.length,
        byStage: stageCounts,
        byFitLabel: fitLabelCounts,
        avgFitScore:
          orderedProspects.length > 0
            ? Number(
                (
                  orderedProspects.reduce((sum, prospect) => sum + (prospect.fitScore ?? 0), 0) / orderedProspects.length
                ).toFixed(1)
              )
            : null
      },
      prospects: orderedProspects,
      filters: this.buildProjectFilterOptions(orderedProspects),
      outreachTemplates,
      copilot: {
        recommendedCandidates: topProspects.map((prospect) => ({
          id: prospect.id,
          fullName: prospect.fullName,
          fitScore: prospect.fitScore,
          fitLabel: prospect.fitLabel,
          reason:
            prospect.discoveryQuality.reasons[0] ??
            prospect.strengths[0] ??
            "Profil role yakın sinyal veriyor."
        })),
        searchRefinements: [
          ...discoveryContext.recruiterGuidance,
          ...(project.job?.locationText && prospects.filter((prospect) => prospect.locationText === project.job?.locationText).length < 2
            ? ["Lokasyon filtresini hibrit/uzaktan uygun adayları da kapsayacak şekilde genişletin."]
            : []),
          ...unmatchedRequirementHints
        ].slice(0, 3),
        batchSuggestions: this.buildBatchSuggestions(prospects),
        outreachSuggestions: [
          prospects.filter((prospect) => prospect.stage === "GOOD_FIT" && prospect.email).length > 0
            ? "Good fit grubundaki adaylara kısa tanışma maili hazırlayın."
            : null,
          prospects.filter((prospect) => prospect.stage === "CONTACTED").length > 2
            ? "Yanıt vermeyen adaylar için manuel follow-up planlayın."
            : null
        ].filter((item): item is string => Boolean(item))
      },
      rediscovery: {
        internalMatches: prospects.filter((prospect) => prospect.sourceKind === "INTERNAL_CANDIDATE").length,
        externalMatches: prospects.filter((prospect) => prospect.sourceKind === "PUBLIC_PROFESSIONAL").length,
        existingCandidateLinked: prospects.filter((prospect) => prospect.attachedCandidateId).length
      },
      compliance: {
        blockedProfiles: prospects.filter((prospect) => prospect.suppressionStatus !== "ALLOWED").length,
        message:
          "Bu proje iç aday havuzu, recruiter import ve canlı public web discovery ile bulunan kamuya açık/profesyonel profil kaynaklarını kullanır. Do not contact statüsündeki profillere outreach engellenir."
      },
      discovery: this.buildDiscoveryWorkbenchState({
        context: discoveryContext,
        prospects: orderedProspects,
        lastExternalDiscovery
      })
    };
  }

  async refreshProject(tenantId: string, projectId: string) {
    await this.refreshProjectDiscovery(tenantId, projectId);
    return this.getProjectDetail(tenantId, projectId);
  }

  async discoverExternalProspects(input: DiscoverExternalProspectsInput) {
    const project = await this.prisma.sourcingProject.findFirst({
      where: {
        id: input.projectId,
        tenantId: input.tenantId,
        archivedAt: null
      },
      include: {
        job: {
          include: {
            requirements: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException("Sourcing projesi bulunamadı.");
    }

    if (!OPENAI_API_KEY) {
      throw new BadRequestException("External discovery için OPENAI_API_KEY yapılandırılmalı.");
    }

    const discoveryCriteria = this.resolveDiscoveryCriteria(project, input.criteria);
    const discoveryContext = this.buildDiscoveryRoleContext(discoveryCriteria, project.job);
    const searchQuery = this.buildDiscoverySearchQuery(discoveryCriteria, discoveryContext);
    const discovered = await this.runOpenAiPublicWebDiscovery(discoveryCriteria, discoveryContext);
    const summary = await this.ingestExternalDiscoveryResults({
      tenantId: input.tenantId,
      projectId: project.id,
      job: project.job,
      criteria: discoveryCriteria,
      context: discoveryContext,
      requestedBy: input.requestedBy,
      candidates: discovered.candidates
    });

    const currentFilters = asRecord(project.filtersJson);

    await this.prisma.sourcingProject.update({
      where: {
        id: project.id
      },
      data: {
        searchQuery,
        filtersJson: {
          ...currentFilters,
          discoveryCriteria,
          lastExternalDiscovery: {
            ...summary,
            queryHints: discovered.queryHints ?? [],
            notes: discovered.notes ?? []
          }
        }
      }
    });

    return {
      summary,
      project: await this.getProjectDetail(input.tenantId, project.id)
    };
  }

  async importRecruiterLeads(input: ImportRecruiterLeadsInput) {
    const project = await this.prisma.sourcingProject.findFirst({
      where: {
        id: input.projectId,
        tenantId: input.tenantId,
        archivedAt: null
      },
      include: {
        job: {
          include: {
            requirements: true
          }
        }
      }
    });

    if (!project) {
      throw new NotFoundException("Sourcing projesi bulunamadı.");
    }

    const sourceConfig = recruiterImportSourceConfig(input.sourceType, input.sourceLabel);
    const summary: RecruiterImportSummary = {
      totalRecords: input.leads.length,
      processedRecords: 0,
      newProfiles: 0,
      mergedProfiles: 0,
      newProspects: 0,
      duplicateProspects: 0,
      existingCandidateMatches: 0,
      errorCount: 0,
      sourceType: input.sourceType,
      sourceLabel: sourceConfig.providerLabel,
      errors: []
    };

    for (const [index, rawLead] of input.leads.entries()) {
      const lead = this.normalizeRecruiterLead(rawLead);

      if (!lead.fullName) {
        summary.errorCount += 1;
        summary.errors.push({
          index,
          reason: "Ad soyad bilgisi zorunlu.",
          ref: lead.sourceUrl ?? lead.email ?? null
        });
        continue;
      }

      if (lead.sourceUrl && isUnsupportedDiscoveryUrl(lead.sourceUrl)) {
        summary.errorCount += 1;
        summary.errors.push({
          index,
          reason: "URL desteklenmeyen veya profil dışı bir kaynağa ait.",
          ref: lead.sourceUrl
        });
        continue;
      }

      const existingProfile = await this.findExistingTalentProfileForLeadImport(input.tenantId, lead);
      const existingProspect =
        existingProfile
          ? await this.prisma.sourcingProjectProspect.findUnique({
              where: {
                tenantId_projectId_talentProfileId: {
                  tenantId: input.tenantId,
                  projectId: input.projectId,
                  talentProfileId: existingProfile.id
                }
              }
            })
          : null;
      const matchedCandidateId =
        existingProfile?.candidateId ??
        (await this.findCandidateForLeadImport(input.tenantId, lead));

      if (matchedCandidateId) {
        summary.existingCandidateMatches += 1;
      }

      const profile = await this.upsertTalentProfileFromLeadImport({
        tenantId: input.tenantId,
        lead,
        existingProfile,
        candidateId: matchedCandidateId,
        sourceConfig
      });

      if (existingProfile) {
        summary.mergedProfiles += 1;
      } else {
        summary.newProfiles += 1;
      }

      await this.upsertLeadSourceRecord({
        tenantId: input.tenantId,
        talentProfileId: profile.id,
        lead,
        sourceConfig
      });

      const evaluation = project.job
        ? evaluateSourcingFit(
            {
              ...project.job,
              requirements: project.job.requirements.map((requirement, reqIndex) => ({
                key: `import_${reqIndex + 1}`,
                value: requirement.value,
                required: true
              }))
            },
            buildTalentSignals({
              fullName: profile.fullName,
              headline: profile.headline,
              summary: profile.summary,
              locationText: profile.locationText,
              currentTitle: profile.currentTitle,
              currentCompany: profile.currentCompany,
              yearsOfExperience: toNumber(profile.yearsOfExperience),
              workModel: profile.workModel,
              sourceKind: profile.sourceKind,
              skills: asStringArray(profile.skillTagsJson),
              languages: asStringArray(profile.languageTagsJson),
              experiences: asStringArray(profile.experienceJson),
              education: asStringArray(profile.educationJson),
              email: profile.email,
              phone: profile.phone
            })
          )
        : ({
            label: ProspectFitLabel.UNKNOWN,
            score: 48,
            confidence: 0.5,
            strengths: [],
            risks: [],
            missingInfo: [],
            evidence: []
          } satisfies SourcingFitEvaluation);

      await this.upsertProjectProspectFromLeadImport({
        tenantId: input.tenantId,
        projectId: input.projectId,
        talentProfileId: profile.id,
        evaluation,
        lead,
        sourceConfig
      });

      if (existingProspect) {
        summary.duplicateProspects += 1;
      } else {
        summary.newProspects += 1;
      }

      summary.processedRecords += 1;
    }

    return {
      summary,
      project: await this.getProjectDetail(input.tenantId, input.projectId)
    };
  }

  async importPublicProfileUrls(input: ImportProfileUrlsInput) {
    if (!OPENAI_API_KEY) {
      throw new BadRequestException("URL ingestion için OPENAI_API_KEY yapılandırılmalı.");
    }

    const extractedLeads: RecruiterLeadInput[] = [];
    const errors: RecruiterImportSummary["errors"] = [];

    for (const [index, rawUrl] of input.urls.entries()) {
      const sourceUrl = canonicalizeSourceUrl(rawUrl);

      if (!sourceUrl) {
        errors.push({
          index,
          reason: "Geçerli bir URL girilmedi.",
          ref: rawUrl
        });
        continue;
      }

      if (isUnsupportedDiscoveryUrl(sourceUrl)) {
        errors.push({
          index,
          reason: "Bu URL, profil ingestion için desteklenmeyen bir sayfa tipine ait.",
          ref: sourceUrl
        });
        continue;
      }

      try {
        const extracted = await this.extractRecruiterLeadFromPublicUrl(sourceUrl);
        if (!extracted.isPersonProfile || !extracted.fullName) {
          errors.push({
            index,
            reason: extracted.rejectReason ?? "URL bir kişi profili olarak doğrulanamadı.",
            ref: sourceUrl
          });
          continue;
        }

        extractedLeads.push({
          fullName: extracted.fullName,
          headline: extracted.headline,
          currentTitle: extracted.currentTitle,
          currentCompany: extracted.currentCompany,
          locationText: extracted.locationText,
          yearsOfExperience: extracted.yearsOfExperience,
          workModel: extracted.workModel,
          email: extracted.email,
          phone: extracted.phone,
          sourceUrl,
          skills: extracted.skills,
          languages: extracted.languages,
          notes: uniqueTrimmed([input.note ?? null, extracted.summary, ...extracted.notes]).join(" · ") || null,
          evidence: extracted.evidence
        });
      } catch (error) {
        errors.push({
          index,
          reason: error instanceof Error ? error.message : "URL işlenemedi.",
          ref: sourceUrl
        });
      }
    }

    const imported = await this.importRecruiterLeads({
      tenantId: input.tenantId,
      projectId: input.projectId,
      requestedBy: input.requestedBy,
      sourceType: "public_profile_url",
      leads: extractedLeads
    });

    return {
      summary: {
        ...imported.summary,
        totalRecords: input.urls.length,
        errorCount: imported.summary.errorCount + errors.length,
        errors: [...imported.summary.errors, ...errors]
      },
      project: imported.project
    };
  }

  async updateProspectStage(input: UpdateProspectStageInput) {
    await this.assertProjectExists(input.tenantId, input.projectId);

    const updated = await this.prisma.sourcingProjectProspect.updateMany({
      where: {
        tenantId: input.tenantId,
        id: input.prospectId,
        projectId: input.projectId
      },
      data: {
        stage: input.stage,
        recruiterNote: input.recruiterNote?.trim() || undefined,
        lastReviewedAt: new Date(),
        contactedAt:
          input.stage === SourcingProspectStage.CONTACTED ? new Date() : undefined,
        repliedAt:
          input.stage === SourcingProspectStage.REPLIED ? new Date() : undefined,
        convertedAt:
          input.stage === SourcingProspectStage.CONVERTED ? new Date() : undefined
      }
    });

    if (updated.count === 0) {
      throw new NotFoundException("Prospect bulunamadı.");
    }

    return {
      ok: true
    };
  }

  async attachProspectToHiringFlow(input: AttachProspectInput) {
    const project = await this.prisma.sourcingProject.findFirst({
      where: {
        id: input.projectId,
        tenantId: input.tenantId,
        archivedAt: null
      },
      include: {
        job: true
      }
    });

    if (!project || !project.jobId || !project.job) {
      throw new BadRequestException("Bu sourcing projesi henüz bir requisition ile bağlı değil.");
    }

    const prospect = await this.prisma.sourcingProjectProspect.findFirst({
      where: {
        tenantId: input.tenantId,
        id: input.prospectId,
        projectId: input.projectId
      },
      include: {
        talentProfile: {
          include: {
            sourceRecords: {
              orderBy: {
                createdAt: "desc"
              },
              take: 3
            }
          }
        }
      }
    });

    if (!prospect) {
      throw new NotFoundException("Prospect bulunamadı.");
    }

    let candidateId = prospect.attachedCandidateId ?? prospect.talentProfile.candidateId ?? null;

    if (!candidateId) {
      const preferredSourceKey =
        prospect.talentProfile.sourceRecords.find((record) => record.isPrimary)?.providerKey ??
        prospect.talentProfile.sourceRecords[0]?.providerKey ??
        null;
      const preferredSourceLabel =
        prospect.talentProfile.sourceRecords.find((record) => record.isPrimary)?.providerLabel ??
        prospect.talentProfile.primarySourceLabel ??
        undefined;
      const createdCandidate = await this.candidatesService.create({
        tenantId: input.tenantId,
        createdBy: input.requestedBy,
        fullName: prospect.talentProfile.fullName,
        email: prospect.talentProfile.email ?? undefined,
        phone: prospect.talentProfile.phone ?? undefined,
        source:
          prospect.talentProfile.sourceKind === TalentSourceKind.INTERNAL_CANDIDATE
            ? "internal_rediscovery"
            : preferredSourceKey ??
              (prospect.talentProfile.sourceKind === TalentSourceKind.REFERRAL
                ? "referral"
                : "public_professional"),
        locationText: prospect.talentProfile.locationText ?? undefined,
        yearsOfExperience: toNumber(prospect.talentProfile.yearsOfExperience) ?? undefined,
        externalSource: preferredSourceLabel
      });

      candidateId = createdCandidate.candidate.id;

      try {
        await this.prisma.talentProfile.update({
          where: {
            id: prospect.talentProfile.id
          },
          data: {
            candidateId
          }
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes("candidateId")
        ) {
          // Another talent profile already owns this deduplicated candidate link.
          // Keep the prospect-level attachment and continue the hiring-flow handoff.
        } else {
          throw error;
        }
      }
    }

    let application = await this.prisma.candidateApplication.findFirst({
      where: {
        tenantId: input.tenantId,
        candidateId,
        jobId: project.jobId
      }
    });

    if (!application) {
      application = await this.applicationsService.create({
        tenantId: input.tenantId,
        candidateId,
        jobId: project.jobId,
        createdBy: input.requestedBy,
        traceId: input.traceId
      });
    }

    await this.prisma.sourcingProjectProspect.update({
      where: {
        tenantId_projectId_talentProfileId: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          talentProfileId: prospect.talentProfileId
        }
      },
      data: {
        attachedCandidateId: candidateId,
        attachedApplicationId: application.id,
        stage: SourcingProspectStage.CONVERTED,
        convertedAt: new Date()
      }
    });

    return {
      candidateId,
      applicationId: application.id,
      projectId: input.projectId,
      jobId: project.jobId
    };
  }

  private buildDefaultDiscoveryCriteria(
    job:
      | {
          title: string;
          locationText: string | null;
          shiftType: string | null;
          salaryMin?: Prisma.Decimal | null;
          salaryMax?: Prisma.Decimal | null;
          requirements?: Array<{ value: string }>;
        }
      | null,
    personaSummary?: string | null
  ): SourcingDiscoveryCriteria {
    const skillTags = uniqueTrimmed(job?.requirements?.map((requirement) => requirement.value) ?? []).slice(0, 8);

    return {
      roleTitle: job?.title?.trim() || "",
      keyword: skillTags.slice(0, 4).join(", ") || null,
      locationText: job?.locationText ?? null,
      minYearsExperience: null,
      skillTags,
      companyBackground: [],
      languages: [],
      workModel: job?.shiftType ?? null,
      compensationMin: toNumber(job?.salaryMin),
      compensationMax: toNumber(job?.salaryMax),
      idealCandidateNotes: personaSummary?.trim() || null
    };
  }

  private buildDiscoveryRoleContext(
    criteria: SourcingDiscoveryCriteria,
    job?:
      | {
          title: string;
          roleFamily: string;
          locationText: string | null;
        }
      | null
  ): DiscoveryRoleContext {
    const contextText = normalizeLooseText(
      [
        criteria.roleTitle,
        criteria.keyword,
        criteria.locationText,
        criteria.idealCandidateNotes,
        criteria.skillTags.join(" "),
        criteria.companyBackground.join(" "),
        job?.title,
        job?.roleFamily
      ]
        .filter(Boolean)
        .join(" ")
    );

    const matchedRules = ROLE_QUERY_RULES.filter((rule) => containsToken(contextText, rule.matchTokens));
    const titleVariants = uniqueTrimmed([
      criteria.roleTitle,
      job?.title,
      ...matchedRules.flatMap((rule) => rule.titleVariants)
    ]);
    const keywordVariants = uniqueTrimmed([
      criteria.keyword,
      ...criteria.skillTags,
      ...criteria.companyBackground,
      ...criteria.languages,
      ...matchedRules.flatMap((rule) => rule.keywordVariants)
    ]);
    const digitalVisibility =
      matchedRules.some((rule) => rule.digitalVisibility === "limited") ? "limited" : "standard";

    const recruiterGuidance = uniqueTrimmed([
      digitalVisibility === "limited"
        ? "Bu rol grubunda public professional discovery sınırlı olabilir; rediscovery ve recruiter import ile birlikte kullanın."
        : null,
      matchedRules.some((rule) => rule.bucket === "warehouse_leadership")
        ? "Warehouse / lojistik liderlik rolleri için Türkçe ve İngilizce title varyantları genişletildi."
        : null,
      matchedRules.some((rule) => rule.bucket === "store_operations")
        ? "Saha / mağaza operasyon rolleri için frontline leadership eşanlamları genişletildi."
        : null
    ]);

    return {
      roleBuckets: matchedRules.map((rule) => rule.bucket),
      titleVariants,
      keywordVariants,
      digitalVisibility,
      recruiterGuidance
    };
  }

  private resolveDiscoveryCriteria(
    project: {
      personaSummary: string | null;
      filtersJson: Prisma.JsonValue | null;
      job?: {
        title: string;
        locationText: string | null;
        shiftType: string | null;
        salaryMin?: Prisma.Decimal | null;
        salaryMax?: Prisma.Decimal | null;
        requirements?: Array<{ value: string }>;
      } | null;
    },
    overrides?: SourcingDiscoveryCriteriaInput
  ): SourcingDiscoveryCriteria {
    const fallback = this.buildDefaultDiscoveryCriteria(project.job ?? null, project.personaSummary);
    const stored = asRecord(asRecord(project.filtersJson).discoveryCriteria);

    const storedCriteria: SourcingDiscoveryCriteria = {
      roleTitle: asString(stored.roleTitle) ?? fallback.roleTitle,
      keyword: asString(stored.keyword) ?? fallback.keyword,
      locationText: asString(stored.locationText) ?? fallback.locationText,
      minYearsExperience: toNumber(stored.minYearsExperience as number | string | null | undefined),
      skillTags: uniqueTrimmed(asStringArray(stored.skillTags)),
      companyBackground: uniqueTrimmed(asStringArray(stored.companyBackground)),
      languages: uniqueTrimmed(asStringArray(stored.languages)),
      workModel: asString(stored.workModel) ?? fallback.workModel,
      compensationMin: toNumber(stored.compensationMin as number | string | null | undefined) ?? fallback.compensationMin,
      compensationMax: toNumber(stored.compensationMax as number | string | null | undefined) ?? fallback.compensationMax,
      idealCandidateNotes: asString(stored.idealCandidateNotes) ?? fallback.idealCandidateNotes
    };

    if (!overrides) {
      return {
        ...fallback,
        ...storedCriteria,
        skillTags: storedCriteria.skillTags.length > 0 ? storedCriteria.skillTags : fallback.skillTags,
        companyBackground:
          storedCriteria.companyBackground.length > 0 ? storedCriteria.companyBackground : fallback.companyBackground,
        languages: storedCriteria.languages.length > 0 ? storedCriteria.languages : fallback.languages
      };
    }

    return {
      roleTitle: overrides.roleTitle?.trim() || storedCriteria.roleTitle || fallback.roleTitle,
      keyword: overrides.keyword?.trim() || storedCriteria.keyword || fallback.keyword,
      locationText: overrides.locationText?.trim() || storedCriteria.locationText || fallback.locationText,
      minYearsExperience:
        overrides.minYearsExperience ?? storedCriteria.minYearsExperience ?? fallback.minYearsExperience,
      skillTags:
        overrides.skillTags && overrides.skillTags.length > 0
          ? uniqueTrimmed(overrides.skillTags)
          : storedCriteria.skillTags.length > 0
            ? storedCriteria.skillTags
            : fallback.skillTags,
      companyBackground:
        overrides.companyBackground && overrides.companyBackground.length > 0
          ? uniqueTrimmed(overrides.companyBackground)
          : storedCriteria.companyBackground.length > 0
            ? storedCriteria.companyBackground
            : fallback.companyBackground,
      languages:
        overrides.languages && overrides.languages.length > 0
          ? uniqueTrimmed(overrides.languages)
          : storedCriteria.languages.length > 0
            ? storedCriteria.languages
            : fallback.languages,
      workModel: overrides.workModel?.trim() || storedCriteria.workModel || fallback.workModel,
      compensationMin: overrides.compensationMin ?? storedCriteria.compensationMin ?? fallback.compensationMin,
      compensationMax: overrides.compensationMax ?? storedCriteria.compensationMax ?? fallback.compensationMax,
      idealCandidateNotes:
        overrides.idealCandidateNotes?.trim() || storedCriteria.idealCandidateNotes || fallback.idealCandidateNotes
    };
  }

  private readLastExternalDiscovery(filtersJson: Prisma.JsonValue | null) {
    const raw = asRecord(asRecord(filtersJson).lastExternalDiscovery);
    const lastRunAt = asString(raw.lastRunAt);

    if (!lastRunAt) {
      return null;
    }

    return {
      totalCandidates: Number(raw.totalCandidates ?? 0),
      createdProfiles: Number(raw.createdProfiles ?? 0),
      mergedProfiles: Number(raw.mergedProfiles ?? 0),
      linkedProspects: Number(raw.linkedProspects ?? 0),
      skippedResults: Number(raw.skippedResults ?? 0),
      existingCandidateMatches: Number(raw.existingCandidateMatches ?? 0),
      lastRunAt,
      mode: "openai_web_search" as const,
      querySummary: asString(raw.querySummary) ?? "",
      highQualityResults: Number(raw.highQualityResults ?? 0),
      mediumQualityResults: Number(raw.mediumQualityResults ?? 0),
      lowQualityResults: Number(raw.lowQualityResults ?? 0),
      filteredPatterns: uniqueTrimmed(asStringArray(raw.filteredPatterns)),
      digitalVisibility: asString(raw.digitalVisibility) === "limited" ? "limited" : "standard",
      queryHints: uniqueTrimmed(asStringArray(raw.queryHints)),
      notes: uniqueTrimmed(asStringArray(raw.notes))
    };
  }

  private buildDiscoverySearchQuery(criteria: SourcingDiscoveryCriteria, context?: DiscoveryRoleContext) {
    return [
      criteria.roleTitle,
      criteria.keyword,
      criteria.locationText,
      context?.titleVariants.slice(0, 4).join(", "),
      criteria.skillTags.join(", "),
      criteria.companyBackground.join(", "),
      criteria.languages.join(", "),
      criteria.workModel,
      criteria.minYearsExperience ? `${criteria.minYearsExperience}+ years` : null
    ]
      .filter((part): part is string => Boolean(part && part.trim().length > 0))
      .join(" · ");
  }

  private scoreExternalDiscoveryCandidate(
    candidate: ExternalDiscoveryCandidate,
    criteria: SourcingDiscoveryCriteria,
    context: DiscoveryRoleContext
  ) {
    const combinedText = normalizeLooseText(
      [
        candidate.fullName,
        candidate.headline,
        candidate.currentTitle,
        candidate.currentCompany,
        candidate.locationText,
        candidate.summary,
        candidate.whyMatch,
        candidate.evidence.join(" "),
        candidate.experienceSummary.join(" "),
        candidate.skills.join(" "),
        candidate.matchedCriteria.join(" ")
      ]
        .filter(Boolean)
        .join(" ")
    );
    const locationText = normalizeLooseText(candidate.locationText);
    const requestedLocation = normalizeLooseText(criteria.locationText);
    const reasons: string[] = [];
    const warnings: string[] = uniqueTrimmed(candidate.qualityWarnings);
    const matchedCriteria = uniqueTrimmed(candidate.matchedCriteria);
    const filteredPatterns: string[] = [];
    let score = 0;

    if (looksLikePersonName(candidate.fullName)) {
      score += 18;
      reasons.push("Gerçek kişi adı sinyali mevcut.");
    } else {
      filteredPatterns.push("person_signal_missing");
    }

    const pageType = candidate.pageType?.trim().toLowerCase() || (candidate.searchSnippetOnly ? "indexed_snippet" : "public_profile");
    if (["job_posting", "company_page", "directory", "article", "blog", "course", "event", "forum"].includes(pageType)) {
      filteredPatterns.push(`page_type:${pageType}`);
    } else if (pageType === "public_profile" || pageType === "portfolio" || pageType === "team_profile") {
      score += 18;
      reasons.push("Sayfa tipi profil odaklı görünüyor.");
    } else if (pageType === "indexed_snippet") {
      score += 8;
      warnings.push("Profil yalnızca indexed snippet seviyesinde görünüyor.");
    }

    if (LOW_QUALITY_TITLE_PATTERNS.some((pattern) => pattern.test(candidate.sourceTitle))) {
      filteredPatterns.push("low_quality_title");
    }

    const roleVariantHits = context.titleVariants.filter((variant) =>
      combinedText.includes(normalizeLooseText(variant))
    );
    const keywordHits = context.keywordVariants.filter((variant) =>
      combinedText.includes(normalizeLooseText(variant))
    );

    if (roleVariantHits.length > 0) {
      score += 24;
      reasons.push(`Rol/title eşleşmesi bulundu: ${roleVariantHits.slice(0, 3).join(", ")}.`);
      matchedCriteria.push(...roleVariantHits.slice(0, 3));
    } else if (keywordHits.length > 0) {
      score += 14;
      reasons.push(`Operasyonel keyword eşleşmesi bulundu: ${keywordHits.slice(0, 3).join(", ")}.`);
      matchedCriteria.push(...keywordHits.slice(0, 3));
    } else {
      warnings.push("Rol ve title sinyali zayıf.");
    }

    if (candidate.currentTitle || candidate.headline) {
      score += 10;
      reasons.push("Başlık/unvan sinyali mevcut.");
    }

    if (candidate.currentCompany || candidate.experienceSummary.length > 0) {
      score += 10;
      reasons.push("Şirket veya deneyim sinyali mevcut.");
    } else {
      warnings.push("Şirket/deneyim satırı eksik.");
    }

    if (requestedLocation && locationText) {
      if (locationText.includes(requestedLocation) || requestedLocation.includes(locationText)) {
        score += 10;
        reasons.push("Lokasyon sinyali kriterle uyumlu.");
        matchedCriteria.push(criteria.locationText ?? "");
      } else {
        warnings.push("Lokasyon sinyali tam örtüşmüyor.");
      }
    } else if (criteria.locationText && !candidate.locationText) {
      warnings.push("Lokasyon sinyali eksik.");
    }

    if (candidate.searchSnippetOnly) {
      score -= 8;
    }
    if (!candidate.email && !candidate.phone) {
      warnings.push("Public iletişim sinyali görünmüyor.");
      score -= 4;
    }
    if (candidate.sourceConfidence === "high") {
      score += 6;
    } else if (candidate.sourceConfidence === "low") {
      score -= 6;
      warnings.push("Kaynak güven seviyesi düşük.");
    }

    if (context.digitalVisibility === "limited" && roleVariantHits.length === 0 && keywordHits.length === 0) {
      filteredPatterns.push("blue_collar_role_miss");
    }

    const keep =
      filteredPatterns.length === 0 &&
      looksLikePersonName(candidate.fullName) &&
      (roleVariantHits.length > 0 || keywordHits.length > 0) &&
      Boolean(candidate.currentTitle || candidate.headline || candidate.currentCompany || candidate.experienceSummary.length > 0) &&
      score >= (context.digitalVisibility === "limited" ? 42 : 46);

    const qualityLabel: DiscoveryQualityLabel = score >= 72 ? "HIGH" : score >= 54 ? "MEDIUM" : "LOW";
    const recruiterLabel = recruiterQualityLabel(qualityLabel);
    const recruiterQualitySummary =
      qualityLabel === "HIGH"
        ? "Profil sayfası, rol sinyali ve deneyim bilgisi birlikte doğrulanabildi."
        : qualityLabel === "MEDIUM"
          ? "Profil anlamlı görünüyor ama bazı alanlar snippet veya eksik bilgi seviyesinde."
          : "Sonuç recruiter review gerektiriyor; sayfa tipi veya rol kanıtı zayıf.";

    return {
      keep,
      filteredPatterns,
      scoredCandidate: {
        ...candidate,
        pageType,
        qualityLabel,
        qualityScore: Math.max(0, Math.min(100, score)),
        recruiterQualityLabel: recruiterLabel,
        recruiterQualitySummary,
        qualityReasons: uniqueTrimmed(reasons),
        qualityWarnings: uniqueTrimmed(warnings),
        matchedCriteria: uniqueTrimmed(matchedCriteria)
      } satisfies ScoredExternalDiscoveryCandidate
    };
  }

  private buildDiscoveryWorkbenchState(input: {
    context: DiscoveryRoleContext;
    prospects: Array<ReturnType<SourcingService["mapProspectDetail"]>>;
    lastExternalDiscovery: ReturnType<SourcingService["readLastExternalDiscovery"]>;
  }) {
    const externalProspects = input.prospects.filter(
      (prospect) => prospect.sourceRecords.some((record) => record.providerLabel === DISCOVERY_PROVIDER_LABEL)
    );
    const qualityCounts = {
      high: externalProspects.filter((prospect) => prospect.discoveryQuality.label === "HIGH").length,
      medium: externalProspects.filter((prospect) => prospect.discoveryQuality.label === "MEDIUM").length,
      low: externalProspects.filter((prospect) => prospect.discoveryQuality.label === "LOW").length
    };

    let status: "NOT_RUN" | "STRONG_RESULTS" | "LIMITED_RESULTS" | "LOW_QUALITY_RESULTS" | "PUBLIC_DISCOVERY_WEAK" =
      "NOT_RUN";
    let recruiterMessage = "Canlı discovery henüz çalıştırılmadı.";

    if (input.lastExternalDiscovery) {
      if (input.lastExternalDiscovery.totalCandidates === 0) {
        status = input.context.digitalVisibility === "limited" ? "PUBLIC_DISCOVERY_WEAK" : "LIMITED_RESULTS";
        recruiterMessage =
          input.context.digitalVisibility === "limited"
            ? "Bu rol için public discovery zayıf görünüyor; rediscovery ve import ile desteklemek daha verimli olabilir."
            : "Bu kriterlerde güçlü public sonuç bulunamadı; query’yi genişletmek gerekebilir.";
      } else if (qualityCounts.high > 0) {
        status = "STRONG_RESULTS";
        recruiterMessage = "Güçlü public profil sonuçları bulundu.";
      } else if (qualityCounts.medium > 0) {
        status = "LIMITED_RESULTS";
        recruiterMessage = "Sınırlı ama recruiter review’e uygun sonuçlar bulundu.";
      } else {
        status = "LOW_QUALITY_RESULTS";
        recruiterMessage = "Bulunan sonuçların kalite seviyesi düşük; daraltma yerine query iyileştirme önerilir.";
      }
    }

    return {
      status,
      recruiterMessage,
      recruiterGuidance: uniqueTrimmed([
        ...input.context.recruiterGuidance,
        status === "PUBLIC_DISCOVERY_WEAK"
          ? "Title varyantlarını genişletin ve aynı anda rediscovery / recruiter import akışını açın."
          : null,
        status === "LOW_QUALITY_RESULTS"
          ? "Daha spesifik title ve operasyonel sistem keyword’leri ekleyin."
          : null
      ]),
      roleHints: input.context.titleVariants.slice(0, 6),
      digitalVisibility: input.context.digitalVisibility,
      qualityCounts,
      filteredPatterns: input.lastExternalDiscovery?.filteredPatterns ?? []
    };
  }

  private async runOpenAiPublicWebDiscovery(
    criteria: SourcingDiscoveryCriteria,
    context: DiscoveryRoleContext
  ): Promise<OpenAiDiscoveryResponse> {
    const prompt = [
      "Search the public web for real people who appear to match this recruiting brief.",
      "You may use publicly accessible professional/profile/portfolio pages and publicly indexed search result snippets that clearly identify a person and their professional profile URL.",
      "Prioritize profile-like public pages over articles, company pages, event pages, forums, course pages, or generic directories.",
      "Do not include job postings, company pages without a named person, social-only profiles, or content that requires login/paywall access to read the identifying snippet.",
      "For blue-collar or operations leadership roles, search using Turkish and English title variants, but only return a person when role/title or experience evidence is explicit on the page or indexed snippet.",
      "Only include fields when they are actually visible on the public page or indexed snippet. Never guess contact information.",
      "Return STRICT JSON only. No markdown fences.",
      JSON.stringify({
        candidates: [
          {
            fullName: "",
            headline: "",
            currentTitle: "",
            currentCompany: "",
            locationText: "",
            yearsOfExperience: 0,
            workModel: "",
            skills: [""],
            languages: [""],
            experienceSummary: [""],
            educationSummary: [""],
            summary: "",
            email: null,
            phone: null,
            sourceTitle: "",
            sourceUrl: "",
            sourceType: "public_profile",
            sourceConfidence: "medium",
            evidence: [""],
            whyMatch: "",
            contactSignals: [""],
            searchSnippetOnly: false,
            pageType: "public_profile",
            matchedCriteria: [""],
            qualityWarnings: [""]
          }
        ],
        queryHints: [""],
        notes: [""]
      }),
      "If no credible public prospects are found, return {\"candidates\":[],\"queryHints\":[],\"notes\":[\"No credible public prospects found.\"]}.",
      `Recruiting brief: ${JSON.stringify(criteria)}`,
      `Title variants to use: ${JSON.stringify(context.titleVariants)}`,
      `Operational keyword variants to use: ${JSON.stringify(context.keywordVariants)}`,
      `Digital visibility expectation: ${context.digitalVisibility}`
    ].join("\n");

    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: DISCOVERY_MODEL,
        tools: [{ type: "web_search_preview" }],
        input: prompt
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`External discovery error (${response.status}): ${body.slice(0, 400)}`);
    }

    const payload = (await response.json()) as {
      output?: Array<{
        type?: string;
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    };

    const text =
      payload.output
        ?.find((item) => item.type === "message")
        ?.content?.find((item) => item.type === "output_text")
        ?.text ?? "";

    if (!text.trim()) {
      return {
        candidates: [],
        queryHints: [],
        notes: ["Web search yanıtı boş döndü."]
      };
    }

    const structured = parseStructuredJson<{
      candidates?: Array<Record<string, unknown>>;
      queryHints?: string[];
      notes?: string[];
    }>(text);

    return {
      candidates: (structured.candidates ?? [])
        .map((candidate) => asRecord(candidate))
        .map((candidate) => {
          const canonicalUrl = canonicalizeSourceUrl(asString(candidate.sourceUrl));
          return {
            fullName: asString(candidate.fullName) ?? "",
            headline: asString(candidate.headline),
            currentTitle: asString(candidate.currentTitle),
            currentCompany: asString(candidate.currentCompany),
            locationText: asString(candidate.locationText),
            yearsOfExperience: toNumber(candidate.yearsOfExperience as number | string | null | undefined),
            workModel: asString(candidate.workModel),
            skills: uniqueTrimmed(asStringArray(candidate.skills)),
            languages: uniqueTrimmed(asStringArray(candidate.languages)),
            experienceSummary: uniqueTrimmed(asStringArray(candidate.experienceSummary)),
            educationSummary: uniqueTrimmed(asStringArray(candidate.educationSummary)),
            summary: asString(candidate.summary),
            email: normalizeEmail(asString(candidate.email)),
            phone: normalizePhone(asString(candidate.phone)),
            sourceTitle: asString(candidate.sourceTitle) ?? "Public web result",
            sourceUrl: canonicalUrl ?? "",
            sourceType: asString(candidate.sourceType),
            sourceConfidence:
              asString(candidate.sourceConfidence) === "high" || asString(candidate.sourceConfidence) === "low"
                ? (asString(candidate.sourceConfidence) as "high" | "low")
                : "medium",
            evidence: uniqueTrimmed(asStringArray(candidate.evidence)),
            whyMatch: asString(candidate.whyMatch),
            contactSignals: uniqueTrimmed(asStringArray(candidate.contactSignals)),
            searchSnippetOnly: candidate.searchSnippetOnly === true,
            pageType: asString(candidate.pageType),
            matchedCriteria: uniqueTrimmed(asStringArray(candidate.matchedCriteria)),
            qualityWarnings: uniqueTrimmed(asStringArray(candidate.qualityWarnings))
          } satisfies ExternalDiscoveryCandidate;
        })
        .filter((candidate) => candidate.fullName.length > 0 && candidate.sourceUrl.length > 0),
      queryHints: uniqueTrimmed(structured.queryHints ?? []),
      notes: uniqueTrimmed(structured.notes ?? [])
    };
  }

  private async fetchPublicProfilePage(sourceUrl: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(sourceUrl, {
        headers: {
          "user-agent": "CanditSourcingBot/1.0 (+public profile ingestion)"
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`URL alınamadı (${response.status}).`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
        throw new Error("URL HTML profil sayfası olarak okunamadı.");
      }

      const html = (await response.text()).slice(0, 120000);
      return {
        html,
        title: extractHtmlTitle(html),
        metaDescription:
          extractMetaContent(html, "description") ??
          extractMetaContent(html, "og:description"),
        bodyText: stripHtmlContent(html).slice(0, 12000)
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async extractRecruiterLeadFromPublicUrl(sourceUrl: string): Promise<UrlLeadExtraction> {
    const page = await this.fetchPublicProfilePage(sourceUrl);
    const fallbackName = page.title?.split("|")[0]?.split("—")[0]?.trim() ?? null;

    if (!OPENAI_API_KEY) {
      return {
        isPersonProfile: Boolean(fallbackName && looksLikePersonName(fallbackName)),
        fullName: fallbackName && looksLikePersonName(fallbackName) ? fallbackName : null,
        headline: page.metaDescription,
        currentTitle: null,
        currentCompany: null,
        locationText: null,
        yearsOfExperience: null,
        workModel: null,
        email: null,
        phone: null,
        skills: [],
        languages: [],
        summary: page.metaDescription,
        evidence: uniqueTrimmed([page.title, page.metaDescription].filter(Boolean) as string[]),
        notes: [],
        warnings: [],
        rejectReason: fallbackName ? null : "URL bir kişi profili olarak doğrulanamadı."
      };
    }

    const prompt = [
      "You extract a single recruiter lead from a recruiter-supplied public profile URL.",
      "Only use the provided page title, meta description, and visible text excerpt.",
      "Reject company pages, articles, job posts, generic directories, or any page that is not clearly about one real person.",
      "Do not guess contact info. Only return email/phone if explicitly visible.",
      "Return strict JSON only.",
      JSON.stringify({
        isPersonProfile: true,
        fullName: "",
        headline: "",
        currentTitle: "",
        currentCompany: "",
        locationText: "",
        yearsOfExperience: null,
        workModel: "",
        email: null,
        phone: null,
        skills: [""],
        languages: [""],
        summary: "",
        evidence: [""],
        notes: [""],
        warnings: [""],
        rejectReason: null
      }),
      `URL: ${sourceUrl}`,
      `Page title: ${page.title ?? ""}`,
      `Meta description: ${page.metaDescription ?? ""}`,
      `Visible text excerpt: ${page.bodyText}`
    ].join("\n");

    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: DISCOVERY_MODEL,
        input: prompt
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`URL extraction error (${response.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as {
      output?: Array<{
        type?: string;
        content?: Array<{
          type?: string;
          text?: string;
        }>;
      }>;
    };
    const text =
      payload.output
        ?.find((item) => item.type === "message")
        ?.content?.find((item) => item.type === "output_text")
        ?.text ?? "";

    if (!text.trim()) {
      throw new Error("URL extraction yanıtı boş döndü.");
    }

    const structured = parseStructuredJson<Record<string, unknown>>(text);

    return {
      isPersonProfile: structured.isPersonProfile === true,
      fullName: asString(structured.fullName),
      headline: asString(structured.headline),
      currentTitle: asString(structured.currentTitle),
      currentCompany: asString(structured.currentCompany),
      locationText: asString(structured.locationText),
      yearsOfExperience: toNumber(structured.yearsOfExperience as number | string | null | undefined),
      workModel: asString(structured.workModel),
      email: normalizeEmail(asString(structured.email)),
      phone: normalizePhone(asString(structured.phone)),
      skills: uniqueTrimmed(asStringArray(structured.skills)),
      languages: uniqueTrimmed(asStringArray(structured.languages)),
      summary: asString(structured.summary),
      evidence: uniqueTrimmed(asStringArray(structured.evidence)),
      notes: uniqueTrimmed(asStringArray(structured.notes)),
      warnings: uniqueTrimmed(asStringArray(structured.warnings)),
      rejectReason: asString(structured.rejectReason)
    };
  }

  private async ingestExternalDiscoveryResults(input: {
    tenantId: string;
    projectId: string;
    job:
      | {
          title: string;
          roleFamily: string;
          locationText: string | null;
          shiftType: string | null;
          requirements: Array<{ value: string }>;
        }
      | null;
    criteria: SourcingDiscoveryCriteria;
    context: DiscoveryRoleContext;
    requestedBy: string;
    candidates: ExternalDiscoveryCandidate[];
  }): Promise<ExternalDiscoverySummary> {
    let createdProfiles = 0;
    let mergedProfiles = 0;
    let linkedProspects = 0;
    let skippedResults = 0;
    let existingCandidateMatches = 0;
    let highQualityResults = 0;
    let mediumQualityResults = 0;
    let lowQualityResults = 0;
    const filteredPatterns = new Set<string>();

    const seenSourceUrls = new Set<string>();
    const seenSignatures = new Set<string>();

    for (const candidate of input.candidates) {
      const quality = this.scoreExternalDiscoveryCandidate(candidate, input.criteria, input.context);
      const sourceUrl = canonicalizeSourceUrl(candidate.sourceUrl);
      const signature = approximateSignature(quality.scoredCandidate);

      if (!quality.keep) {
        quality.filteredPatterns.forEach((pattern) => filteredPatterns.add(pattern));
        skippedResults += 1;
        continue;
      }

      if (!sourceUrl || !candidate.fullName || isUnsupportedDiscoveryUrl(sourceUrl)) {
        skippedResults += 1;
        continue;
      }

      if (seenSourceUrls.has(sourceUrl) || (signature && seenSignatures.has(signature))) {
        skippedResults += 1;
        continue;
      }

      seenSourceUrls.add(sourceUrl);
      if (signature) {
        seenSignatures.add(signature);
      }

      const existingProfile = await this.findExistingTalentProfileForDiscovery(input.tenantId, candidate);
      const matchedCandidateId =
        existingProfile?.candidateId ??
        (await this.findCandidateForDiscovery(input.tenantId, candidate));

      if (matchedCandidateId) {
        existingCandidateMatches += 1;
      }

      const profile = await this.upsertTalentProfileFromDiscovery({
        tenantId: input.tenantId,
        candidate: quality.scoredCandidate,
        existingProfile,
        candidateId: matchedCandidateId
      });

      if (existingProfile) {
        mergedProfiles += 1;
      } else {
        createdProfiles += 1;
      }

      await this.upsertDiscoverySourceRecord({
        tenantId: input.tenantId,
        talentProfileId: profile.id,
        candidate: quality.scoredCandidate,
        criteria: input.criteria
      });

      const evaluation = input.job
        ? evaluateSourcingFit(
            {
              ...input.job,
              requirements: input.job.requirements.map((requirement, index) => ({
                key: `discovery_${index + 1}`,
                value: requirement.value,
                required: true
              }))
            },
            buildTalentSignals({
              fullName: profile.fullName,
              headline: profile.headline,
              summary: profile.summary,
              locationText: profile.locationText,
              currentTitle: profile.currentTitle,
              currentCompany: profile.currentCompany,
              yearsOfExperience: toNumber(profile.yearsOfExperience),
              workModel: profile.workModel,
              sourceKind: profile.sourceKind,
              skills: asStringArray(profile.skillTagsJson),
              languages: asStringArray(profile.languageTagsJson),
              experiences: asStringArray(profile.experienceJson),
              education: asStringArray(profile.educationJson),
              email: profile.email,
              phone: profile.phone
            })
          )
        : ({
            label: ProspectFitLabel.UNKNOWN,
            score: 50,
            confidence: 0.4,
            strengths: [],
            risks: [],
            missingInfo: [],
            evidence: []
          } satisfies SourcingFitEvaluation);

      await this.upsertProjectProspectFromDiscovery({
        tenantId: input.tenantId,
        projectId: input.projectId,
        talentProfileId: profile.id,
        evaluation,
        candidate: quality.scoredCandidate
      });

      if (quality.scoredCandidate.qualityLabel === "HIGH") {
        highQualityResults += 1;
      } else if (quality.scoredCandidate.qualityLabel === "MEDIUM") {
        mediumQualityResults += 1;
      } else {
        lowQualityResults += 1;
      }

      linkedProspects += 1;
    }

    return {
      totalCandidates: input.candidates.length,
      createdProfiles,
      mergedProfiles,
      linkedProspects,
      skippedResults,
      existingCandidateMatches,
      lastRunAt: new Date().toISOString(),
      mode: "openai_web_search",
      querySummary: this.buildDiscoverySearchQuery(input.criteria, input.context),
      highQualityResults,
      mediumQualityResults,
      lowQualityResults,
      filteredPatterns: [...filteredPatterns],
      digitalVisibility: input.context.digitalVisibility
    };
  }

  private async findExistingTalentProfileForDiscovery(
    tenantId: string,
    candidate: ExternalDiscoveryCandidate
  ) {
    const sourceUrl = canonicalizeSourceUrl(candidate.sourceUrl);

    if (sourceUrl) {
      const sourceMatch = await this.prisma.talentProfileSource.findFirst({
        where: {
          tenantId,
          sourceUrl
        },
        include: {
          talentProfile: true
        }
      });

      if (sourceMatch?.talentProfile) {
        return sourceMatch.talentProfile;
      }
    }

    const normalizedEmail = normalizeEmail(candidate.email);
    if (normalizedEmail) {
      const emailMatch = await this.prisma.talentProfile.findFirst({
        where: {
          tenantId,
          normalizedEmail
        }
      });

      if (emailMatch) {
        return emailMatch;
      }
    }

    const normalizedPhone = normalizePhone(candidate.phone);
    if (normalizedPhone) {
      const phoneMatch = await this.prisma.talentProfile.findFirst({
        where: {
          tenantId,
          normalizedPhone
        }
      });

      if (phoneMatch) {
        return phoneMatch;
      }
    }

    const sameNameProfiles = await this.prisma.talentProfile.findMany({
      where: {
        tenantId,
        fullName: {
          equals: candidate.fullName,
          mode: "insensitive"
        }
      },
      take: 8
    });

    return (
      sameNameProfiles.find((profile) => {
        const sameCompany =
          candidate.currentCompany &&
          profile.currentCompany &&
          normalizeLooseText(candidate.currentCompany) === normalizeLooseText(profile.currentCompany);
        const sameTitle =
          candidate.currentTitle &&
          profile.currentTitle &&
          normalizeLooseText(candidate.currentTitle) === normalizeLooseText(profile.currentTitle);
        return Boolean(sameCompany || sameTitle);
      }) ?? null
    );
  }

  private normalizeRecruiterLead(rawLead: RecruiterLeadInput): RecruiterLeadInput {
    return {
      fullName: rawLead.fullName?.trim() || "",
      headline: asString(rawLead.headline),
      currentTitle: asString(rawLead.currentTitle),
      currentCompany: asString(rawLead.currentCompany),
      locationText: asString(rawLead.locationText),
      yearsOfExperience:
        rawLead.yearsOfExperience !== null && rawLead.yearsOfExperience !== undefined
          ? Number(rawLead.yearsOfExperience)
          : null,
      workModel: asString(rawLead.workModel),
      email: normalizeEmail(asString(rawLead.email)),
      phone: normalizePhone(asString(rawLead.phone)),
      sourceUrl: canonicalizeSourceUrl(asString(rawLead.sourceUrl)),
      skills: uniqueTrimmed(asStringArray(rawLead.skills)),
      languages: uniqueTrimmed(asStringArray(rawLead.languages)),
      notes: asString(rawLead.notes),
      recruiterTags: uniqueTrimmed(asStringArray(rawLead.recruiterTags)),
      externalRef: asString(rawLead.externalRef),
      evidence: uniqueTrimmed(asStringArray(rawLead.evidence))
    };
  }

  private async findExistingTalentProfileForLeadImport(tenantId: string, lead: RecruiterLeadInput) {
    if (lead.sourceUrl) {
      const sourceMatch = await this.prisma.talentProfileSource.findFirst({
        where: {
          tenantId,
          sourceUrl: lead.sourceUrl
        },
        include: {
          talentProfile: true
        }
      });

      if (sourceMatch?.talentProfile) {
        return sourceMatch.talentProfile;
      }
    }

    const normalizedEmail = normalizeEmail(lead.email);
    if (normalizedEmail) {
      const emailMatch = await this.prisma.talentProfile.findFirst({
        where: {
          tenantId,
          normalizedEmail
        }
      });

      if (emailMatch) {
        return emailMatch;
      }
    }

    const normalizedPhone = normalizePhone(lead.phone);
    if (normalizedPhone) {
      const phoneMatch = await this.prisma.talentProfile.findFirst({
        where: {
          tenantId,
          normalizedPhone
        }
      });

      if (phoneMatch) {
        return phoneMatch;
      }
    }

    const nameMatches = await this.prisma.talentProfile.findMany({
      where: {
        tenantId,
        fullName: {
          equals: lead.fullName,
          mode: "insensitive"
        }
      },
      take: 8
    });

    return (
      nameMatches.find((profile) => {
        const sameCompany =
          lead.currentCompany &&
          profile.currentCompany &&
          normalizeLooseText(lead.currentCompany) === normalizeLooseText(profile.currentCompany);
        const sameTitle =
          lead.currentTitle &&
          profile.currentTitle &&
          normalizeLooseText(lead.currentTitle) === normalizeLooseText(profile.currentTitle);
        return Boolean(sameCompany || sameTitle);
      }) ?? null
    );
  }

  private async findCandidateForDiscovery(tenantId: string, candidate: ExternalDiscoveryCandidate) {
    const normalizedEmail = normalizeEmail(candidate.email);
    if (normalizedEmail) {
      const found = await this.prisma.candidate.findFirst({
        where: {
          tenantId,
          email: normalizedEmail
        }
      });
      if (found) {
        return found.id;
      }
    }

    const normalizedPhone = normalizePhone(candidate.phone);
    if (normalizedPhone) {
      const found = await this.prisma.candidate.findFirst({
        where: {
          tenantId,
          phone: normalizedPhone
        }
      });
      if (found) {
        return found.id;
      }
    }

    return null;
  }

  private async findCandidateForLeadImport(tenantId: string, lead: RecruiterLeadInput) {
    const normalizedEmail = normalizeEmail(lead.email);
    if (normalizedEmail) {
      const found = await this.prisma.candidate.findFirst({
        where: {
          tenantId,
          email: normalizedEmail
        }
      });
      if (found) {
        return found.id;
      }
    }

    const normalizedPhone = normalizePhone(lead.phone);
    if (normalizedPhone) {
      const found = await this.prisma.candidate.findFirst({
        where: {
          tenantId,
          phone: normalizedPhone
        }
      });
      if (found) {
        return found.id;
      }
    }

    return null;
  }

  private async upsertTalentProfileFromLeadImport(input: {
    tenantId: string;
    lead: RecruiterLeadInput;
    existingProfile: {
      id: string;
      candidateId: string | null;
      fullName: string;
      normalizedEmail: string | null;
      normalizedPhone: string | null;
      email: string | null;
      phone: string | null;
      headline: string | null;
      summary: string | null;
      locationText: string | null;
      currentTitle: string | null;
      currentCompany: string | null;
      yearsOfExperience: Prisma.Decimal | null;
      workModel: string | null;
      sourceKind: TalentSourceKind;
      primarySourceLabel: string | null;
      skillTagsJson: Prisma.JsonValue | null;
      languageTagsJson: Prisma.JsonValue | null;
      educationJson: Prisma.JsonValue | null;
      experienceJson: Prisma.JsonValue | null;
      contactSignalsJson: Prisma.JsonValue | null;
      sourceMetadataJson: Prisma.JsonValue | null;
    } | null;
    candidateId: string | null;
    sourceConfig: ReturnType<typeof recruiterImportSourceConfig>;
  }) {
    const normalizedEmail = normalizeEmail(input.lead.email);
    const normalizedPhone = normalizePhone(input.lead.phone);
    const summary = input.lead.notes ?? input.lead.headline ?? input.lead.currentTitle ?? null;
    const contactSignals = uniqueTrimmed([
      ...(input.lead.email ? ["Import ile e-posta sağlandı"] : []),
      ...(input.lead.phone ? ["Import ile telefon sağlandı"] : [])
    ]);

    if (input.existingProfile) {
      return this.prisma.talentProfile.update({
        where: {
          id: input.existingProfile.id
        },
        data: {
          candidateId: input.existingProfile.candidateId ?? input.candidateId ?? undefined,
          normalizedEmail: input.existingProfile.normalizedEmail ?? normalizedEmail ?? undefined,
          normalizedPhone: input.existingProfile.normalizedPhone ?? normalizedPhone ?? undefined,
          email: mergeString(input.existingProfile.email, input.lead.email),
          phone: mergeString(input.existingProfile.phone, input.lead.phone),
          headline: mergeString(input.existingProfile.headline, input.lead.headline),
          summary: mergeString(input.existingProfile.summary, summary),
          locationText: mergeString(input.existingProfile.locationText, input.lead.locationText),
          currentTitle: mergeString(input.existingProfile.currentTitle, input.lead.currentTitle),
          currentCompany: mergeString(input.existingProfile.currentCompany, input.lead.currentCompany),
          yearsOfExperience:
            input.existingProfile.yearsOfExperience ?? toDecimal(input.lead.yearsOfExperience) ?? undefined,
          workModel: mergeString(input.existingProfile.workModel, input.lead.workModel),
          sourceKind:
            input.existingProfile.sourceKind === TalentSourceKind.OTHER
              ? input.sourceConfig.sourceKind
              : input.existingProfile.sourceKind,
          primarySourceLabel: input.existingProfile.primarySourceLabel ?? input.sourceConfig.providerLabel,
          skillTagsJson: mergeStringArray(input.existingProfile.skillTagsJson, input.lead.skills ?? []) as Prisma.InputJsonValue,
          languageTagsJson: mergeStringArray(input.existingProfile.languageTagsJson, input.lead.languages ?? []) as Prisma.InputJsonValue,
          contactSignalsJson: uniqueTrimmed([
            ...asStringArray(asRecord(input.existingProfile.contactSignalsJson).signals),
            ...contactSignals
          ]) as Prisma.InputJsonValue,
          sourceMetadataJson: {
            ...asRecord(input.existingProfile.sourceMetadataJson),
            lastLeadImportSourceType: input.sourceConfig.providerKey,
            lastLeadImportLabel: input.sourceConfig.providerLabel,
            lastLeadImportAt: new Date().toISOString(),
            lastLeadImportUrl: input.lead.sourceUrl ?? null
          } as Prisma.InputJsonValue,
          lastEnrichedAt: new Date()
        }
      });
    }

    return this.prisma.talentProfile.create({
      data: {
        tenantId: input.tenantId,
        candidateId: input.candidateId ?? undefined,
        fullName: input.lead.fullName,
        normalizedEmail: normalizedEmail ?? undefined,
        normalizedPhone: normalizedPhone ?? undefined,
        email: input.lead.email ?? undefined,
        phone: input.lead.phone ?? undefined,
        headline: input.lead.headline ?? undefined,
        summary: summary ?? undefined,
        locationText: input.lead.locationText ?? undefined,
        currentTitle: input.lead.currentTitle ?? undefined,
        currentCompany: input.lead.currentCompany ?? undefined,
        yearsOfExperience: toDecimal(input.lead.yearsOfExperience) ?? undefined,
        workModel: input.lead.workModel ?? undefined,
        sourceKind: input.sourceConfig.sourceKind,
        primarySourceLabel: input.sourceConfig.providerLabel,
        skillTagsJson: (input.lead.skills ?? []) as Prisma.InputJsonValue,
        languageTagsJson: (input.lead.languages ?? []) as Prisma.InputJsonValue,
        contactSignalsJson: {
          signals: contactSignals
        } as Prisma.InputJsonValue,
        sourceMetadataJson: {
          lastLeadImportSourceType: input.sourceConfig.providerKey,
          lastLeadImportLabel: input.sourceConfig.providerLabel,
          lastLeadImportAt: new Date().toISOString(),
          lastLeadImportUrl: input.lead.sourceUrl ?? null
        } as Prisma.InputJsonValue,
        lastEnrichedAt: new Date()
      }
    });
  }

  private async upsertTalentProfileFromDiscovery(input: {
    tenantId: string;
    candidate: ScoredExternalDiscoveryCandidate;
    existingProfile: {
      id: string;
      candidateId: string | null;
      fullName: string;
      normalizedEmail: string | null;
      normalizedPhone: string | null;
      email: string | null;
      phone: string | null;
      headline: string | null;
      summary: string | null;
      locationText: string | null;
      currentTitle: string | null;
      currentCompany: string | null;
      yearsOfExperience: Prisma.Decimal | null;
      workModel: string | null;
      sourceKind: TalentSourceKind;
      primarySourceLabel: string | null;
      skillTagsJson: Prisma.JsonValue | null;
      languageTagsJson: Prisma.JsonValue | null;
      educationJson: Prisma.JsonValue | null;
      experienceJson: Prisma.JsonValue | null;
      contactSignalsJson: Prisma.JsonValue | null;
      sourceMetadataJson: Prisma.JsonValue | null;
    } | null;
    candidateId: string | null;
  }) {
    const normalizedEmail = normalizeEmail(input.candidate.email);
    const normalizedPhone = normalizePhone(input.candidate.phone);
    const summary = mergeString(input.candidate.summary, input.candidate.whyMatch);
    const contactSignals = uniqueTrimmed([
      ...(input.candidate.email ? ["Public email görünümü var"] : []),
      ...(input.candidate.phone ? ["Public phone görünümü var"] : []),
      ...input.candidate.contactSignals
    ]);

    if (input.existingProfile) {
      return this.prisma.talentProfile.update({
        where: {
          id: input.existingProfile.id
        },
        data: {
          candidateId: input.existingProfile.candidateId ?? input.candidateId ?? undefined,
          normalizedEmail: input.existingProfile.normalizedEmail ?? normalizedEmail ?? undefined,
          normalizedPhone: input.existingProfile.normalizedPhone ?? normalizedPhone ?? undefined,
          email: mergeString(input.existingProfile.email, input.candidate.email),
          phone: mergeString(input.existingProfile.phone, input.candidate.phone),
          headline: mergeString(input.existingProfile.headline, input.candidate.headline),
          summary: mergeString(input.existingProfile.summary, summary),
          locationText: mergeString(input.existingProfile.locationText, input.candidate.locationText),
          currentTitle: mergeString(input.existingProfile.currentTitle, input.candidate.currentTitle),
          currentCompany: mergeString(input.existingProfile.currentCompany, input.candidate.currentCompany),
          yearsOfExperience:
            input.existingProfile.yearsOfExperience ?? toDecimal(input.candidate.yearsOfExperience) ?? undefined,
          workModel: mergeString(input.existingProfile.workModel, input.candidate.workModel),
          sourceKind:
            input.existingProfile.sourceKind === TalentSourceKind.OTHER
              ? TalentSourceKind.PUBLIC_PROFESSIONAL
              : input.existingProfile.sourceKind,
          primarySourceLabel: input.existingProfile.primarySourceLabel ?? DISCOVERY_PROVIDER_LABEL,
          skillTagsJson: mergeStringArray(input.existingProfile.skillTagsJson, input.candidate.skills) as Prisma.InputJsonValue,
          languageTagsJson: mergeStringArray(input.existingProfile.languageTagsJson, input.candidate.languages) as Prisma.InputJsonValue,
          educationJson:
            mergeStringArray(input.existingProfile.educationJson, input.candidate.educationSummary) as Prisma.InputJsonValue,
          experienceJson:
            mergeStringArray(input.existingProfile.experienceJson, input.candidate.experienceSummary) as Prisma.InputJsonValue,
          contactSignalsJson: uniqueTrimmed([
            ...asStringArray(asRecord(input.existingProfile.contactSignalsJson).signals),
            ...contactSignals
          ]) as Prisma.InputJsonValue,
          sourceMetadataJson: {
            ...asRecord(input.existingProfile.sourceMetadataJson),
            lastDiscoveryProvider: DISCOVERY_PROVIDER_KEY,
            lastDiscoveryConfidence: input.candidate.sourceConfidence,
            lastDiscoverySourceType: input.candidate.sourceType,
            lastDiscoverySnippetOnly: input.candidate.searchSnippetOnly,
            lastDiscoveredAt: new Date().toISOString()
          } as Prisma.InputJsonValue,
          lastEnrichedAt: new Date()
        }
      });
    }

    return this.prisma.talentProfile.create({
      data: {
        tenantId: input.tenantId,
        candidateId: input.candidateId ?? undefined,
        fullName: input.candidate.fullName,
        normalizedEmail: normalizedEmail ?? undefined,
        normalizedPhone: normalizedPhone ?? undefined,
        email: input.candidate.email ?? undefined,
        phone: input.candidate.phone ?? undefined,
        headline: input.candidate.headline ?? undefined,
        summary: summary ?? undefined,
        locationText: input.candidate.locationText ?? undefined,
        currentTitle: input.candidate.currentTitle ?? undefined,
        currentCompany: input.candidate.currentCompany ?? undefined,
        yearsOfExperience: toDecimal(input.candidate.yearsOfExperience) ?? undefined,
        workModel: input.candidate.workModel ?? undefined,
        sourceKind: TalentSourceKind.PUBLIC_PROFESSIONAL,
        primarySourceLabel: DISCOVERY_PROVIDER_LABEL,
        skillTagsJson: input.candidate.skills as Prisma.InputJsonValue,
        languageTagsJson: input.candidate.languages as Prisma.InputJsonValue,
        educationJson: input.candidate.educationSummary as Prisma.InputJsonValue,
        experienceJson: input.candidate.experienceSummary as Prisma.InputJsonValue,
        contactSignalsJson: {
          signals: contactSignals
        } as Prisma.InputJsonValue,
        sourceMetadataJson: {
          lastDiscoveryProvider: DISCOVERY_PROVIDER_KEY,
          lastDiscoveryConfidence: input.candidate.sourceConfidence,
          lastDiscoverySourceType: input.candidate.sourceType,
          lastDiscoverySnippetOnly: input.candidate.searchSnippetOnly,
          lastDiscoveredAt: new Date().toISOString()
        } as Prisma.InputJsonValue,
        lastEnrichedAt: new Date()
      }
    });
  }

  private async upsertDiscoverySourceRecord(input: {
    tenantId: string;
    talentProfileId: string;
    candidate: ScoredExternalDiscoveryCandidate;
    criteria: SourcingDiscoveryCriteria;
  }) {
    const sourceUrl = canonicalizeSourceUrl(input.candidate.sourceUrl);
    const existing = sourceUrl
      ? await this.prisma.talentProfileSource.findFirst({
          where: {
            tenantId: input.tenantId,
            talentProfileId: input.talentProfileId,
            sourceUrl
          }
        })
      : null;

    const metadata = {
      discoveryProviderKey: DISCOVERY_PROVIDER_KEY,
      discoveryProviderLabel: DISCOVERY_PROVIDER_LABEL,
      sourceType: input.candidate.sourceType,
      sourceConfidence: input.candidate.sourceConfidence,
      searchSnippetOnly: input.candidate.searchSnippetOnly,
      pageType: input.candidate.pageType,
      qualityLabel: input.candidate.qualityLabel,
      qualityScore: input.candidate.qualityScore,
      recruiterQualityLabel: input.candidate.recruiterQualityLabel,
      recruiterQualitySummary: input.candidate.recruiterQualitySummary,
      matchedCriteria: input.candidate.matchedCriteria,
      qualityReasons: input.candidate.qualityReasons,
      qualityWarnings: input.candidate.qualityWarnings,
      evidence: input.candidate.evidence,
      whyMatch: input.candidate.whyMatch,
      querySummary: this.buildDiscoverySearchQuery(input.criteria),
      discoveredAt: new Date().toISOString(),
      sourceDomain: parseDomain(sourceUrl ?? "")
    } satisfies Record<string, unknown>;

    if (existing) {
      return this.prisma.talentProfileSource.update({
        where: {
          id: existing.id
        },
        data: {
          displayName: input.candidate.sourceTitle,
          sourceUrl: sourceUrl ?? undefined,
          isVerified: true,
          lastSeenAt: new Date(),
          metadataJson: metadata as Prisma.InputJsonValue
        }
      });
    }

    return this.prisma.talentProfileSource.create({
      data: {
        tenantId: input.tenantId,
        talentProfileId: input.talentProfileId,
        sourceKind: TalentSourceKind.PUBLIC_PROFESSIONAL,
        providerKey: DISCOVERY_PROVIDER_KEY,
        providerLabel: DISCOVERY_PROVIDER_LABEL,
        displayName: input.candidate.sourceTitle,
        sourceUrl: sourceUrl ?? undefined,
        isPrimary: false,
        isVerified: true,
        lastSeenAt: new Date(),
        metadataJson: metadata as Prisma.InputJsonValue
      }
    });
  }

  private async upsertLeadSourceRecord(input: {
    tenantId: string;
    talentProfileId: string;
    lead: RecruiterLeadInput;
    sourceConfig: ReturnType<typeof recruiterImportSourceConfig>;
  }) {
    const existing = await this.prisma.talentProfileSource.findFirst({
      where: {
        tenantId: input.tenantId,
        talentProfileId: input.talentProfileId,
        providerKey: input.sourceConfig.providerKey,
        ...(input.lead.sourceUrl
          ? {
              sourceUrl: input.lead.sourceUrl
            }
          : {
              displayName: input.lead.fullName
            })
      }
    });

    const metadata = {
      importSourceType: input.sourceConfig.providerKey,
      importSourceLabel: input.sourceConfig.providerLabel,
      notes: input.lead.notes,
      recruiterTags: input.lead.recruiterTags ?? [],
      evidence: input.lead.evidence ?? [],
      currentTitle: input.lead.currentTitle,
      currentCompany: input.lead.currentCompany,
      importedAt: new Date().toISOString()
    } satisfies Record<string, unknown>;

    if (existing) {
      return this.prisma.talentProfileSource.update({
        where: {
          id: existing.id
        },
        data: {
          displayName: input.lead.fullName,
          externalRef: input.lead.externalRef ?? undefined,
          sourceUrl: input.lead.sourceUrl ?? undefined,
          lastSeenAt: new Date(),
          isVerified: Boolean(input.lead.sourceUrl),
          metadataJson: metadata as Prisma.InputJsonValue
        }
      });
    }

    return this.prisma.talentProfileSource.create({
      data: {
        tenantId: input.tenantId,
        talentProfileId: input.talentProfileId,
        sourceKind: input.sourceConfig.sourceKind,
        providerKey: input.sourceConfig.providerKey,
        providerLabel: input.sourceConfig.providerLabel,
        displayName: input.lead.fullName,
        externalRef: input.lead.externalRef ?? undefined,
        sourceUrl: input.lead.sourceUrl ?? undefined,
        isPrimary: true,
        isVerified: Boolean(input.lead.sourceUrl),
        lastSeenAt: new Date(),
        metadataJson: metadata as Prisma.InputJsonValue
      }
    });
  }

  private async upsertProjectProspectFromDiscovery(input: {
    tenantId: string;
    projectId: string;
    talentProfileId: string;
    evaluation: SourcingFitEvaluation;
    candidate: ScoredExternalDiscoveryCandidate;
  }) {
    const existing = await this.prisma.sourcingProjectProspect.findUnique({
      where: {
        tenantId_projectId_talentProfileId: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          talentProfileId: input.talentProfileId
        }
      }
    });

    const stickyStages: SourcingProspectStage[] = [
      SourcingProspectStage.SAVED,
      SourcingProspectStage.CONTACTED,
      SourcingProspectStage.REPLIED,
      SourcingProspectStage.CONVERTED
    ];
    const preservedStage =
      existing && stickyStages.some((stage) => stage === existing.stage)
        ? existing.stage
        : deriveProspectStage(input.evaluation.label);

    const evidence = [
      ...input.evaluation.evidence,
      ...input.candidate.evidence.map((text) => ({
        title: input.candidate.sourceTitle,
        text,
        kind: "source" as const
      })),
      ...(input.candidate.whyMatch
        ? [
            {
              title: "Discovery match",
              text: input.candidate.whyMatch,
              kind: "source" as const
            }
          ]
        : [])
    ];

    const missingInfo = uniqueTrimmed([
      ...input.evaluation.missingInfo,
      ...(input.candidate.searchSnippetOnly ? ["Profil yalnızca public search snippet seviyesinde doğrulandı."] : []),
      ...(!input.candidate.email ? ["Public iletişim e-postası görünmüyor."] : []),
      ...input.candidate.qualityWarnings
    ]);

    await this.prisma.sourcingProjectProspect.upsert({
      where: {
        tenantId_projectId_talentProfileId: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          talentProfileId: input.talentProfileId
        }
      },
      update: {
        stage: preservedStage,
        fitLabel: input.evaluation.label,
        fitScore: toDecimal(input.evaluation.score),
        fitConfidence: toDecimal(input.evaluation.confidence),
        strengthsJson: uniqueTrimmed([
          ...input.evaluation.strengths,
          ...(input.candidate.whyMatch ? [input.candidate.whyMatch] : []),
          ...input.candidate.qualityReasons
        ]) as Prisma.InputJsonValue,
        risksJson: input.evaluation.risks as Prisma.InputJsonValue,
        missingInfoJson: missingInfo as Prisma.InputJsonValue,
        evidenceJson: evidence as Prisma.InputJsonValue,
        sourceSnapshotJson: [
          {
            providerLabel: DISCOVERY_PROVIDER_LABEL,
            displayName: input.candidate.sourceTitle,
            sourceUrl: input.candidate.sourceUrl,
            sourceKind: TalentSourceKind.PUBLIC_PROFESSIONAL,
            qualityLabel: input.candidate.qualityLabel,
            recruiterQualityLabel: input.candidate.recruiterQualityLabel,
            matchedCriteria: input.candidate.matchedCriteria
          }
        ] as Prisma.InputJsonValue
      },
      create: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        talentProfileId: input.talentProfileId,
        stage: preservedStage,
        fitLabel: input.evaluation.label,
        fitScore: toDecimal(input.evaluation.score),
        fitConfidence: toDecimal(input.evaluation.confidence),
        strengthsJson: uniqueTrimmed([
          ...input.evaluation.strengths,
          ...(input.candidate.whyMatch ? [input.candidate.whyMatch] : []),
          ...input.candidate.qualityReasons
        ]) as Prisma.InputJsonValue,
        risksJson: input.evaluation.risks as Prisma.InputJsonValue,
        missingInfoJson: missingInfo as Prisma.InputJsonValue,
        evidenceJson: evidence as Prisma.InputJsonValue,
        sourceSnapshotJson: [
          {
            providerLabel: DISCOVERY_PROVIDER_LABEL,
            displayName: input.candidate.sourceTitle,
            sourceUrl: input.candidate.sourceUrl,
            sourceKind: TalentSourceKind.PUBLIC_PROFESSIONAL,
            qualityLabel: input.candidate.qualityLabel,
            recruiterQualityLabel: input.candidate.recruiterQualityLabel,
            matchedCriteria: input.candidate.matchedCriteria
          }
        ] as Prisma.InputJsonValue
      }
    });
  }

  private async upsertProjectProspectFromLeadImport(input: {
    tenantId: string;
    projectId: string;
    talentProfileId: string;
    evaluation: SourcingFitEvaluation;
    lead: RecruiterLeadInput;
    sourceConfig: ReturnType<typeof recruiterImportSourceConfig>;
  }) {
    const existing = await this.prisma.sourcingProjectProspect.findUnique({
      where: {
        tenantId_projectId_talentProfileId: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          talentProfileId: input.talentProfileId
        }
      }
    });

    const stickyStages: SourcingProspectStage[] = [
      SourcingProspectStage.SAVED,
      SourcingProspectStage.CONTACTED,
      SourcingProspectStage.REPLIED,
      SourcingProspectStage.CONVERTED
    ];
    const preservedStage =
      existing && stickyStages.some((stage) => stage === existing.stage)
        ? existing.stage
        : deriveProspectStage(input.evaluation.label);

    const importStrength = `${input.sourceConfig.providerLabel} ile recruiter-assisted lead ingestion üzerinden eklendi.`;
    const missingInfo = uniqueTrimmed([
      ...input.evaluation.missingInfo,
      ...(!input.lead.currentTitle ? ["Unvan bilgisi eksik."] : []),
      ...(!input.lead.currentCompany ? ["Şirket bilgisi eksik."] : []),
      ...(!input.lead.locationText ? ["Lokasyon bilgisi eksik."] : []),
      ...(!input.lead.email && !input.lead.phone ? ["İletişim bilgisi henüz sağlanmadı."] : [])
    ]);
    const evidence = [
      ...input.evaluation.evidence,
      {
        title: input.sourceConfig.providerLabel,
        text:
          input.lead.notes ??
          input.lead.evidence?.[0] ??
          input.lead.sourceUrl ??
          "Recruiter-assisted import ile sourcing projesine eklendi.",
        kind: "source" as const
      }
    ];

    await this.prisma.sourcingProjectProspect.upsert({
      where: {
        tenantId_projectId_talentProfileId: {
          tenantId: input.tenantId,
          projectId: input.projectId,
          talentProfileId: input.talentProfileId
        }
      },
      update: {
        stage: preservedStage,
        fitLabel: input.evaluation.label,
        fitScore: toDecimal(input.evaluation.score),
        fitConfidence: toDecimal(input.evaluation.confidence),
        strengthsJson: uniqueTrimmed([
          ...input.evaluation.strengths,
          importStrength,
          ...(input.lead.notes ? [input.lead.notes] : [])
        ]) as Prisma.InputJsonValue,
        risksJson: input.evaluation.risks as Prisma.InputJsonValue,
        missingInfoJson: missingInfo as Prisma.InputJsonValue,
        evidenceJson: evidence as Prisma.InputJsonValue,
        sourceSnapshotJson: [
          {
            providerLabel: input.sourceConfig.providerLabel,
            displayName: input.lead.fullName,
            sourceUrl: input.lead.sourceUrl,
            sourceKind: input.sourceConfig.sourceKind,
            importSourceType: input.sourceConfig.providerKey
          }
        ] as Prisma.InputJsonValue
      },
      create: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        talentProfileId: input.talentProfileId,
        stage: preservedStage,
        fitLabel: input.evaluation.label,
        fitScore: toDecimal(input.evaluation.score),
        fitConfidence: toDecimal(input.evaluation.confidence),
        strengthsJson: uniqueTrimmed([
          ...input.evaluation.strengths,
          importStrength,
          ...(input.lead.notes ? [input.lead.notes] : [])
        ]) as Prisma.InputJsonValue,
        risksJson: input.evaluation.risks as Prisma.InputJsonValue,
        missingInfoJson: missingInfo as Prisma.InputJsonValue,
        evidenceJson: evidence as Prisma.InputJsonValue,
        sourceSnapshotJson: [
          {
            providerLabel: input.sourceConfig.providerLabel,
            displayName: input.lead.fullName,
            sourceUrl: input.lead.sourceUrl,
            sourceKind: input.sourceConfig.sourceKind,
            importSourceType: input.sourceConfig.providerKey
          }
        ] as Prisma.InputJsonValue
      }
    });
  }

  async sendOutreach(input: SendOutreachInput) {
    if (!input.subject?.trim() && !input.templateId) {
      throw new BadRequestException("E-posta konusu veya template seçimi gerekli.");
    }

    if (!input.body?.trim() && !input.templateId) {
      throw new BadRequestException("E-posta içeriği veya template seçimi gerekli.");
    }

    await this.assertProjectExists(input.tenantId, input.projectId);

    const project = await this.prisma.sourcingProject.findFirst({
      where: {
        id: input.projectId,
        tenantId: input.tenantId
      },
      include: {
        job: {
          select: {
            title: true
          }
        }
      }
    });

    const template =
      input.templateId
        ? await this.prisma.sourcingOutreachTemplate.findFirst({
            where: {
              id: input.templateId,
              tenantId: input.tenantId
            }
          })
        : null;

    const prospects = await this.prisma.sourcingProjectProspect.findMany({
      where: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        id: {
          in: input.prospectIds
        }
      },
      include: {
        talentProfile: true
      }
    });

    const results: Array<{
      prospectId: string;
      status: OutreachMessageStatus | "BLOCKED" | "SKIPPED";
      email: string | null;
      error?: string;
      messageId?: string;
    }> = [];

    for (const prospect of prospects) {
      const email = prospect.talentProfile.email;
      if (!email) {
        results.push({
          prospectId: prospect.id,
          status: "SKIPPED",
          email: null,
          error: "Profilde iletişim e-postası bulunmuyor."
        });
        continue;
      }

      if (prospect.talentProfile.suppressionStatus !== ContactSuppressionStatus.ALLOWED) {
        results.push({
          prospectId: prospect.id,
          status: "BLOCKED",
          email,
          error: "Profil do not contact / suppression durumunda."
        });
        continue;
      }

      const variables = {
        firstName: firstName(prospect.talentProfile.fullName),
        fullName: prospect.talentProfile.fullName,
        currentTitle: prospect.talentProfile.currentTitle ?? "",
        currentCompany: prospect.talentProfile.currentCompany ?? "",
        headline: prospect.talentProfile.headline ?? "",
        jobTitle: project?.job?.title ?? "",
        company: "Candit.ai"
      };

      const subject = renderTemplate(
        input.subject?.trim() || template?.subjectTemplate || "",
        variables
      );
      const body = renderTemplate(input.body?.trim() || template?.bodyTemplate || "", variables);

      let sendResult:
        | Awaited<ReturnType<NotificationsService["send"]>>
        | null = null;

      const message = await this.prisma.sourcingOutreachMessage.create({
        data: {
          tenantId: input.tenantId,
          projectProspectId: prospect.id,
          templateId: template?.id,
          channel: "email",
          stepIndex: input.stepIndex ?? 0,
          status: input.sendNow === false ? OutreachMessageStatus.READY_TO_SEND : OutreachMessageStatus.DRAFT,
          subject,
          body,
          reviewNote: input.reviewNote?.trim() || null,
          reviewedBy: input.requestedBy
        }
      });

      if (input.sendNow !== false) {
        sendResult = await this.notificationsService.send({
          tenantId: input.tenantId,
          channel: "email",
          to: email,
          subject,
          body,
          requestedBy: input.requestedBy,
          metadata: {
            source: "sourcing_outreach",
            projectId: input.projectId,
            prospectId: prospect.id
          }
        });

        const sent = sendResult.status !== "failed";

        await Promise.all([
          this.prisma.sourcingOutreachMessage.update({
            where: {
              id: message.id
            },
            data: {
              status: sent ? OutreachMessageStatus.SENT : OutreachMessageStatus.FAILED,
              providerKey: sendResult.provider,
              providerMessageId: sendResult.messageId,
              sendError: sendResult.errorMessage ?? null,
              sentBy: input.requestedBy,
              sentAt: sent ? new Date() : null
            }
          }),
          sent
            ? this.prisma.sourcingProjectProspect.update({
                where: {
                  id: prospect.id
                },
                data: {
                  stage:
                    prospect.stage === SourcingProspectStage.REPLIED
                      ? prospect.stage
                      : SourcingProspectStage.CONTACTED,
                  contactedAt: new Date(),
                  contactState: "email_sent"
                }
              })
            : Promise.resolve()
        ]);

        results.push({
          prospectId: prospect.id,
          status: sent ? OutreachMessageStatus.SENT : OutreachMessageStatus.FAILED,
          email,
          error: sendResult.errorMessage ?? undefined,
          messageId: sendResult.messageId
        });
      } else {
        results.push({
          prospectId: prospect.id,
          status: OutreachMessageStatus.READY_TO_SEND,
          email
        });
      }
    }

    return {
      total: prospects.length,
      results
    };
  }

  async updateSuppression(input: UpdateSuppressionInput) {
    const profile = await this.prisma.talentProfile.findFirst({
      where: {
        id: input.profileId,
        tenantId: input.tenantId
      }
    });

    if (!profile) {
      throw new NotFoundException("Talent profile bulunamadı.");
    }

    await this.prisma.talentProfile.update({
      where: {
        id: profile.id
      },
      data: {
        suppressionStatus: input.status,
        doNotContactReason: input.reason?.trim() || null
      }
    });

    return {
      ok: true
    };
  }

  async listOutreachTemplates(tenantId: string, requestedBy: string, projectId?: string) {
    await this.ensureDefaultOutreachTemplates(tenantId, requestedBy);

    const templates = await this.prisma.sourcingOutreachTemplate.findMany({
      where: {
        tenantId,
        OR: [{ projectId: null }, ...(projectId ? [{ projectId }] : [])]
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
    });

    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      subjectTemplate: template.subjectTemplate,
      bodyTemplate: template.bodyTemplate,
      isDefault: template.isDefault,
      sequence: Array.isArray(template.sequenceJson) ? template.sequenceJson : []
    }));
  }

  private async assertProjectExists(tenantId: string, projectId: string) {
    const found = await this.prisma.sourcingProject.findFirst({
      where: {
        id: projectId,
        tenantId,
        archivedAt: null
      },
      select: {
        id: true
      }
    });

    if (!found) {
      throw new NotFoundException("Sourcing projesi bulunamadı.");
    }

    return found;
  }

  private async refreshProjectDiscovery(tenantId: string, projectId: string) {
    await this.syncInternalTalentProfiles(tenantId);

    const project = await this.prisma.sourcingProject.findFirst({
      where: {
        id: projectId,
        tenantId,
        archivedAt: null
      },
      include: {
        job: {
          include: {
            requirements: true
          }
        }
      }
    });

    if (!project || !project.job) {
      throw new NotFoundException("Sourcing projesi bulunamadı.");
    }

    const existing = await this.prisma.sourcingProjectProspect.findMany({
      where: {
        tenantId,
        projectId
      }
    });

    const existingByTalentProfileId = new Map(existing.map((item) => [item.talentProfileId, item]));

    const profiles = await this.prisma.talentProfile.findMany({
      where: {
        tenantId
      },
      include: {
        sourceRecords: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    for (const profile of profiles) {
      const primaryDiscoverySource =
        profile.sourceRecords.find((record) => record.providerKey === DISCOVERY_PROVIDER_KEY) ?? null;
      const discoveryMetadata = asRecord(primaryDiscoverySource?.metadataJson);
      const discoveryReasons = uniqueTrimmed(asStringArray(discoveryMetadata.qualityReasons));
      const discoveryWarnings = uniqueTrimmed(asStringArray(discoveryMetadata.qualityWarnings));
      const discoveryMatchedCriteria = uniqueTrimmed(asStringArray(discoveryMetadata.matchedCriteria));
      const discoveryQualityLabel = asString(discoveryMetadata.qualityLabel);
      const discoveryRecruiterLabel = asString(discoveryMetadata.recruiterQualityLabel);

      const evaluation = evaluateSourcingFit(project.job, buildTalentSignals({
        fullName: profile.fullName,
        headline: profile.headline,
        summary: profile.summary,
        locationText: profile.locationText,
        currentTitle: profile.currentTitle,
        currentCompany: profile.currentCompany,
        yearsOfExperience: toNumber(profile.yearsOfExperience),
        workModel: profile.workModel,
        sourceKind: profile.sourceKind,
        skills: asStringArray(profile.skillTagsJson),
        languages: asStringArray(profile.languageTagsJson),
        experiences: asStringArray(profile.experienceJson),
        education: asStringArray(profile.educationJson),
        email: profile.email,
        phone: profile.phone
      }));

      if (evaluation.score < 30 && !profile.candidateId) {
        continue;
      }

      const current = existingByTalentProfileId.get(profile.id);
      const preservedStage =
        current &&
        current.stage !== SourcingProspectStage.NEW &&
        current.stage !== SourcingProspectStage.NEEDS_REVIEW &&
        current.stage !== SourcingProspectStage.GOOD_FIT
          ? current.stage
          : deriveProspectStage(evaluation.label);

      await this.prisma.sourcingProjectProspect.upsert({
        where: {
          tenantId_projectId_talentProfileId: {
            tenantId,
            projectId,
            talentProfileId: profile.id
          }
        },
        update: {
          stage: preservedStage,
          fitLabel: evaluation.label,
          fitScore: toDecimal(evaluation.score),
          fitConfidence: toDecimal(evaluation.confidence),
          strengthsJson: uniqueTrimmed([
            ...evaluation.strengths,
            ...discoveryReasons
          ]) as Prisma.InputJsonValue,
          risksJson: evaluation.risks,
          missingInfoJson: uniqueTrimmed([
            ...evaluation.missingInfo,
            ...discoveryWarnings
          ]) as Prisma.InputJsonValue,
          evidenceJson: [
            ...fitEvaluationToJson(evaluation),
            ...(primaryDiscoverySource
              ? [
                  {
                    title: primaryDiscoverySource.providerLabel,
                    text:
                      asString(discoveryMetadata.recruiterQualitySummary) ??
                      "Public discovery kaynağından gelen profil sinyali.",
                    kind: "source"
                  }
                ]
              : [])
          ] as Prisma.InputJsonValue,
          sourceSnapshotJson: profile.sourceRecords.map((record) => ({
            providerLabel: record.providerLabel,
            displayName: record.displayName,
            sourceUrl: record.sourceUrl,
            sourceKind: record.sourceKind,
            qualityLabel:
              record.providerKey === DISCOVERY_PROVIDER_KEY ? discoveryQualityLabel : undefined,
            recruiterQualityLabel:
              record.providerKey === DISCOVERY_PROVIDER_KEY ? discoveryRecruiterLabel : undefined,
            matchedCriteria:
              record.providerKey === DISCOVERY_PROVIDER_KEY ? discoveryMatchedCriteria : undefined
          })) as Prisma.InputJsonValue
        },
        create: {
          tenantId,
          projectId,
          talentProfileId: profile.id,
          stage: preservedStage,
          fitLabel: evaluation.label,
          fitScore: toDecimal(evaluation.score),
          fitConfidence: toDecimal(evaluation.confidence),
          strengthsJson: uniqueTrimmed([
            ...evaluation.strengths,
            ...discoveryReasons
          ]) as Prisma.InputJsonValue,
          risksJson: evaluation.risks,
          missingInfoJson: uniqueTrimmed([
            ...evaluation.missingInfo,
            ...discoveryWarnings
          ]) as Prisma.InputJsonValue,
          evidenceJson: [
            ...fitEvaluationToJson(evaluation),
            ...(primaryDiscoverySource
              ? [
                  {
                    title: primaryDiscoverySource.providerLabel,
                    text:
                      asString(discoveryMetadata.recruiterQualitySummary) ??
                      "Public discovery kaynağından gelen profil sinyali.",
                    kind: "source"
                  }
                ]
              : [])
          ] as Prisma.InputJsonValue,
          sourceSnapshotJson: profile.sourceRecords.map((record) => ({
            providerLabel: record.providerLabel,
            displayName: record.displayName,
            sourceUrl: record.sourceUrl,
            sourceKind: record.sourceKind,
            qualityLabel:
              record.providerKey === DISCOVERY_PROVIDER_KEY ? discoveryQualityLabel : undefined,
            recruiterQualityLabel:
              record.providerKey === DISCOVERY_PROVIDER_KEY ? discoveryRecruiterLabel : undefined,
            matchedCriteria:
              record.providerKey === DISCOVERY_PROVIDER_KEY ? discoveryMatchedCriteria : undefined
          })) as Prisma.InputJsonValue
        }
      });
    }
  }

  private loadProjectDetailGraph(tenantId: string, projectId: string) {
    return this.prisma.sourcingProject.findFirst({
      where: {
        id: projectId,
        tenantId,
        archivedAt: null
      },
      include: {
        job: {
          include: {
            requirements: true
          }
        },
        prospects: {
          include: {
            talentProfile: {
              include: {
                sourceRecords: {
                  orderBy: {
                    createdAt: "desc"
                  }
                }
              }
            },
            outreachMessages: {
              orderBy: {
                createdAt: "desc"
              },
              take: 5
            }
          },
          orderBy: [{ fitScore: "desc" }, { updatedAt: "desc" }]
        },
        outreachTemplates: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
        }
      }
    });
  }

  private async syncInternalTalentProfiles(tenantId: string) {
    const candidates = await this.prisma.candidate.findMany({
      where: {
        tenantId,
        deletedAt: null
      },
      include: {
        cvFiles: {
          orderBy: {
            uploadedAt: "desc"
          },
          include: {
            parsedProfile: true
          }
        },
        applications: {
          orderBy: {
            createdAt: "desc"
          },
          take: 3,
          include: {
            job: {
              select: {
                title: true,
                roleFamily: true
              }
            }
          }
        }
      }
    });

    for (const candidate of candidates) {
      const latestParsed = candidate.cvFiles.find((file) => file.parsedProfile)?.parsedProfile ?? null;
      const extractedFacts = asRecord(asRecord(latestParsed?.profileJson).extractedFacts);
      const normalizedSummary = asRecord(asRecord(latestParsed?.profileJson).normalizedSummary);
      const contacts = asRecord(extractedFacts.contacts);
      const workHistorySignals = asStringArray(extractedFacts.workHistorySignals);
      const recentRoles = asStringArray(extractedFacts.recentRoles);
      const skills = asStringArray(extractedFacts.skills);
      const languages = asStringArray(extractedFacts.languages);
      const education = asStringArray(extractedFacts.educationSummary);
      const currentExperience = workHistorySignals[0] ?? null;
      const currentCompany = currentExperience?.split("|")[2]?.trim() ?? null;
      const latestApplicationRole = candidate.applications[0]?.job.title ?? null;
      const summary =
        asString(normalizedSummary.coreWorkHistorySummary) ??
        asString(normalizedSummary.shortSummary) ??
        "İç aday havuzundaki profil için detaylı özet henüz çıkarılmadı.";
      const mergedYears =
        toNumber(candidate.yearsOfExperience) ??
        (Number.isFinite(Number(extractedFacts.yearsExperienceEstimate))
          ? Number(extractedFacts.yearsExperienceEstimate)
          : null);

      const headline =
        recentRoles[0] && candidate.applications[0]?.job.roleFamily
          ? `${recentRoles[0]} · ${candidate.applications[0]?.job.roleFamily}`
          : recentRoles[0] ?? latestApplicationRole;

      const talentProfile = await this.prisma.talentProfile.upsert({
        where: {
          candidateId: candidate.id
        },
        update: {
          tenantId,
          fullName: candidate.fullName,
          normalizedEmail: normalizeEmail(candidate.email),
          normalizedPhone: normalizePhone(candidate.phone),
          email: candidate.email,
          phone: candidate.phone,
          headline,
          summary,
          locationText:
            candidate.locationText ??
            asStringArray(extractedFacts.locationSignals)[0] ??
            null,
          currentTitle: recentRoles[0] ?? latestApplicationRole,
          currentCompany,
          yearsOfExperience: toDecimal(mergedYears) ?? null,
          sourceKind: TalentSourceKind.INTERNAL_CANDIDATE,
          primarySourceLabel: "İç aday havuzu",
          skillTagsJson: skills as Prisma.InputJsonValue,
          languageTagsJson: languages as Prisma.InputJsonValue,
          educationJson: education as Prisma.InputJsonValue,
          experienceJson: workHistorySignals as Prisma.InputJsonValue,
          contactSignalsJson: {
            hasEmail: Boolean(candidate.email),
            hasPhone: Boolean(candidate.phone)
          },
          sourceMetadataJson: {
            candidateId: candidate.id,
            latestCvProfileId: latestParsed?.id ?? null,
            latestApplications: candidate.applications.map((application) => ({
              id: application.id,
              jobTitle: application.job.title,
              roleFamily: application.job.roleFamily
            }))
          },
          lastEnrichedAt: new Date()
        },
        create: {
          tenantId,
          candidateId: candidate.id,
          fullName: candidate.fullName,
          normalizedEmail: normalizeEmail(candidate.email),
          normalizedPhone: normalizePhone(candidate.phone),
          email: candidate.email,
          phone: candidate.phone,
          headline,
          summary,
          locationText:
            candidate.locationText ??
            asStringArray(extractedFacts.locationSignals)[0] ??
            null,
          currentTitle: recentRoles[0] ?? latestApplicationRole,
          currentCompany,
          yearsOfExperience: toDecimal(mergedYears) ?? null,
          sourceKind: TalentSourceKind.INTERNAL_CANDIDATE,
          primarySourceLabel: "İç aday havuzu",
          skillTagsJson: skills as Prisma.InputJsonValue,
          languageTagsJson: languages as Prisma.InputJsonValue,
          educationJson: education as Prisma.InputJsonValue,
          experienceJson: workHistorySignals as Prisma.InputJsonValue,
          contactSignalsJson: {
            hasEmail: Boolean(candidate.email),
            hasPhone: Boolean(candidate.phone)
          },
          sourceMetadataJson: {
            candidateId: candidate.id,
            latestCvProfileId: latestParsed?.id ?? null,
            latestApplications: candidate.applications.map((application) => ({
              id: application.id,
              jobTitle: application.job.title,
              roleFamily: application.job.roleFamily
            }))
          },
          lastEnrichedAt: new Date()
        }
      });

      await this.prisma.talentProfileSource.deleteMany({
        where: {
          tenantId,
          talentProfileId: talentProfile.id,
          providerKey: "candidate_pool_sync"
        }
      });

      await this.prisma.talentProfileSource.create({
        data: {
          tenantId,
          talentProfileId: talentProfile.id,
          sourceKind: TalentSourceKind.INTERNAL_CANDIDATE,
          providerKey: "candidate_pool_sync",
          providerLabel: "İç aday havuzu",
          displayName: candidate.fullName,
          externalRef: candidate.id,
          isPrimary: true,
          isVerified: true,
          sourceUrl: `/candidates/${candidate.id}`,
          metadataJson: {
            candidateId: candidate.id,
            syncedFrom: "candidate_profile"
          }
        }
      });
    }
  }

  private async ensureDefaultOutreachTemplates(tenantId: string, createdBy: string) {
    const count = await this.prisma.sourcingOutreachTemplate.count({
      where: {
        tenantId,
        projectId: null
      }
    });

    if (count > 0) {
      return;
    }

    const templates = [
      {
        name: "Kısa tanışma",
        description: "İlk temas için kısa ve saygılı outreach.",
        subjectTemplate: "{{jobTitle}} rolü için kısa bir tanışma",
        bodyTemplate:
          "Merhaba {{firstName}},\n\n{{currentTitle}} geçmişiniz ve {{headline}} sinyalleriniz dikkatimi çekti. {{jobTitle}} rolümüz için kısa bir tanışma yapmak isterim.\n\nUygunsanız size AI ön görüşme akışını ve rol detaylarını paylaşabilirim.\n\nİyi günler,\nCandit ekibi",
        sequenceJson: [
          { dayOffset: 0, label: "İlk temas" },
          { dayOffset: 4, label: "Nazik takip" },
          { dayOffset: 8, label: "Son yoklama" }
        ]
      },
      {
        name: "Rediscovery geri dönüş",
        description: "İç havuzdaki adayları yeni requisition için yeniden kazanma şablonu.",
        subjectTemplate: "{{jobTitle}} için profilinizi tekrar değerlendirmek istiyoruz",
        bodyTemplate:
          "Merhaba {{firstName}},\n\nDaha önce sistemimizde yer alan profilinizi {{jobTitle}} requisition'ı için yeniden değerlendirdik. {{currentTitle}} geçmişiniz bu rol için güçlü sinyaller veriyor.\n\nİsterseniz kısa bir değerlendirme akışı ve sonraki adımları sizinle paylaşabiliriz.\n\nSelamlar,\nCandit ekibi",
        sequenceJson: [
          { dayOffset: 0, label: "Rediscovery ilk temas" },
          { dayOffset: 5, label: "Takip" }
        ]
      }
    ];

    await this.prisma.sourcingOutreachTemplate.createMany({
      data: templates.map((template) => ({
        tenantId,
        projectId: null,
        name: template.name,
        description: template.description,
        subjectTemplate: template.subjectTemplate,
        bodyTemplate: template.bodyTemplate,
        sequenceJson: template.sequenceJson as Prisma.InputJsonValue,
        isDefault: true,
        createdBy
      }))
    });
  }

  private mapProjectSummary(project: {
    id: string;
    name: string;
    status: string;
    personaSummary: string | null;
    updatedAt: Date;
    job: {
      id: string;
      title: string;
      roleFamily: string;
      locationText: string | null;
    } | null;
    prospects: Array<{
      stage: SourcingProspectStage;
      fitScore: Prisma.Decimal | null;
      updatedAt: Date;
      talentProfile: {
        sourceKind: TalentSourceKind;
        suppressionStatus: ContactSuppressionStatus;
      };
    }>;
  }) {
    const byStage = this.countBy(project.prospects.map((prospect) => prospect.stage), (value) => value);

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      personaSummary: project.personaSummary,
      updatedAt: project.updatedAt,
      job: project.job,
      metrics: {
        total: project.prospects.length,
        needsReview: byStage.NEEDS_REVIEW ?? 0,
        goodFit: byStage.GOOD_FIT ?? 0,
        contacted: byStage.CONTACTED ?? 0,
        replied: byStage.REPLIED ?? 0,
        converted: byStage.CONVERTED ?? 0,
        blocked: project.prospects.filter(
          (prospect) => prospect.talentProfile.suppressionStatus !== ContactSuppressionStatus.ALLOWED
        ).length,
        avgFitScore:
          project.prospects.length > 0
            ? Number(
                (
                  project.prospects.reduce((sum, prospect) => sum + (toNumber(prospect.fitScore) ?? 0), 0) /
                  project.prospects.length
                ).toFixed(1)
              )
            : null
      },
      sourceMix: this.countBy(
        project.prospects.map((prospect) => prospect.talentProfile.sourceKind),
        (value) => value
      )
    };
  }

  private mapProspectDetail(prospect: {
    id: string;
    stage: SourcingProspectStage;
    fitLabel: ProspectFitLabel;
    fitScore: Prisma.Decimal | null;
    fitConfidence: Prisma.Decimal | null;
    strengthsJson: Prisma.JsonValue | null;
    risksJson: Prisma.JsonValue | null;
    missingInfoJson: Prisma.JsonValue | null;
    evidenceJson: Prisma.JsonValue | null;
    recruiterNote: string | null;
    attachedCandidateId: string | null;
    attachedApplicationId: string | null;
    contactedAt: Date | null;
    repliedAt: Date | null;
    convertedAt: Date | null;
    talentProfile: {
      id: string;
      fullName: string;
      headline: string | null;
      summary: string | null;
      locationText: string | null;
      currentTitle: string | null;
      currentCompany: string | null;
      yearsOfExperience: Prisma.Decimal | null;
      workModel: string | null;
      email: string | null;
      phone: string | null;
      sourceKind: TalentSourceKind;
      primarySourceLabel: string | null;
      suppressionStatus: ContactSuppressionStatus;
      doNotContactReason: string | null;
      skillTagsJson: Prisma.JsonValue | null;
      languageTagsJson: Prisma.JsonValue | null;
      educationJson: Prisma.JsonValue | null;
      experienceJson: Prisma.JsonValue | null;
      sourceRecords: Array<{
        id: string;
        providerKey: string;
        providerLabel: string;
        displayName: string;
        sourceUrl: string | null;
        sourceKind: TalentSourceKind;
        isVerified: boolean;
        metadataJson: Prisma.JsonValue | null;
      }>;
      sourceMetadataJson: Prisma.JsonValue | null;
    };
    outreachMessages: Array<{
      id: string;
      status: OutreachMessageStatus;
      subject: string;
      sentAt: Date | null;
      repliedAt: Date | null;
    }>;
  }) {
    const primaryDiscoveryRecord =
      prospect.talentProfile.sourceRecords.find((record) => record.providerKey === DISCOVERY_PROVIDER_KEY) ?? null;
    const discoveryMetadata = asRecord(primaryDiscoveryRecord?.metadataJson);
    const discoveryLabelRaw = asString(discoveryMetadata.qualityLabel);
    const discoveryLabel =
      discoveryLabelRaw === "HIGH" || discoveryLabelRaw === "MEDIUM" || discoveryLabelRaw === "LOW"
        ? discoveryLabelRaw
        : "UNKNOWN";
    const discoveryReasons = uniqueTrimmed(asStringArray(discoveryMetadata.qualityReasons));
    const discoveryWarnings = uniqueTrimmed(asStringArray(discoveryMetadata.qualityWarnings));
    const discoveryMatchedCriteria = uniqueTrimmed(asStringArray(discoveryMetadata.matchedCriteria));
    const discoverySummary =
      asString(discoveryMetadata.recruiterQualitySummary) ??
      (primaryDiscoveryRecord ? "Public discovery sonucu recruiter review gerektiriyor." : "Kalite sinyali yok.");
    const discoveryScore = toNumber(discoveryMetadata.qualityScore as number | string | null | undefined);
    const evidence = Array.isArray(prospect.evidenceJson)
      ? prospect.evidenceJson
          .map((item) => asRecord(item))
          .map((item) => {
            const kind = asString(item.kind);
            return {
              title: asString(item.title) ?? "Kanıt",
              text: asString(item.text) ?? "",
              kind:
                kind === "title" ||
                kind === "skills" ||
                kind === "location" ||
                kind === "experience" ||
                kind === "source"
                  ? kind
                  : ("source" as const)
            };
          })
          .filter((item) => item.text.length > 0)
      : [];

    return {
      id: prospect.id,
      profileId: prospect.talentProfile.id,
      stage: prospect.stage,
      fitLabel: prospect.fitLabel,
      fitScore: toNumber(prospect.fitScore),
      fitConfidence: toNumber(prospect.fitConfidence),
      fullName: prospect.talentProfile.fullName,
      headline: prospect.talentProfile.headline,
      summary: prospect.talentProfile.summary,
      locationText: prospect.talentProfile.locationText,
      currentTitle: prospect.talentProfile.currentTitle,
      currentCompany: prospect.talentProfile.currentCompany,
      yearsOfExperience: toNumber(prospect.talentProfile.yearsOfExperience),
      workModel: prospect.talentProfile.workModel,
      email: prospect.talentProfile.email,
      phone: prospect.talentProfile.phone,
      sourceKind: prospect.talentProfile.sourceKind,
      primarySourceLabel: prospect.talentProfile.primarySourceLabel,
      suppressionStatus: prospect.talentProfile.suppressionStatus,
      doNotContactReason: prospect.talentProfile.doNotContactReason,
      strengths: asStringArray(prospect.strengthsJson),
      risks: asStringArray(prospect.risksJson),
      missingInfo: asStringArray(prospect.missingInfoJson),
      skills: asStringArray(prospect.talentProfile.skillTagsJson),
      languages: asStringArray(prospect.talentProfile.languageTagsJson),
      education: asStringArray(prospect.talentProfile.educationJson),
      experiences: asStringArray(prospect.talentProfile.experienceJson),
      evidence,
      discoveryQuality: {
        label: discoveryLabel,
        score: discoveryScore,
        recruiterLabel:
          asString(discoveryMetadata.recruiterQualityLabel) ??
          (discoveryLabel === "UNKNOWN" ? "Kalite skoru yok" : recruiterQualityLabel(discoveryLabel)),
        summary: discoverySummary,
        matchedCriteria: discoveryMatchedCriteria,
        reasons: discoveryReasons,
        warnings: discoveryWarnings,
        pageType: asString(discoveryMetadata.pageType)
      },
      recruiterNote: prospect.recruiterNote,
      attachedCandidateId: prospect.attachedCandidateId,
      attachedApplicationId: prospect.attachedApplicationId,
      contactedAt: prospect.contactedAt,
      repliedAt: prospect.repliedAt,
      convertedAt: prospect.convertedAt,
      sourceRecords: prospect.talentProfile.sourceRecords.map((record) => ({
        id: record.id,
        providerKey: record.providerKey,
        providerLabel: record.providerLabel,
        displayName: record.displayName,
        sourceUrl: record.sourceUrl,
        sourceKind: record.sourceKind,
        isVerified: record.isVerified
      })),
      outreachHistory: prospect.outreachMessages.map((message) => ({
        id: message.id,
        status: message.status,
        subject: message.subject,
        sentAt: message.sentAt,
        repliedAt: message.repliedAt
      }))
    };
  }

  private buildProjectFilterOptions(prospects: Array<ReturnType<SourcingService["mapProspectDetail"]>>) {
    const skillCounts = new Map<string, number>();
    const languageCounts = new Map<string, number>();
    const educationCounts = new Map<string, number>();
    const companyCounts = new Map<string, number>();

    for (const prospect of prospects) {
      for (const skill of prospect.skills) {
        skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
      }

      for (const language of prospect.languages) {
        languageCounts.set(language, (languageCounts.get(language) ?? 0) + 1);
      }

      for (const education of prospect.education) {
        educationCounts.set(education, (educationCounts.get(education) ?? 0) + 1);
      }

      if (prospect.currentCompany) {
        companyCounts.set(prospect.currentCompany, (companyCounts.get(prospect.currentCompany) ?? 0) + 1);
      }
    }

    return {
      locations: uniqueNonEmpty(prospects.map((prospect) => prospect.locationText)),
      workModels: uniqueNonEmpty(prospects.map((prospect) => prospect.workModel)),
      sourceKinds: uniqueNonEmpty(prospects.map((prospect) => prospect.sourceKind)),
      stages: uniqueNonEmpty(prospects.map((prospect) => prospect.stage)),
      fitLabels: uniqueNonEmpty(prospects.map((prospect) => prospect.fitLabel)),
      companies: [...companyCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([label, count]) => ({ label, count })),
      topSkills: [...skillCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([label, count]) => ({ label, count })),
      educations: [...educationCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count })),
      languages: [...languageCounts.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count }))
    };
  }

  private buildRequirementCoverageHints(
    job: { requirements: Array<{ value: string }> } | null,
    prospects: Array<ReturnType<SourcingService["mapProspectDetail"]>>
  ) {
    if (!job || job.requirements.length === 0) {
      return [];
    }

    return job.requirements
      .map((requirement) => {
        const normalized = requirement.value.toLocaleLowerCase("tr-TR");
        const matchCount = prospects.filter((prospect) =>
          prospect.skills.some((skill) => skill.toLocaleLowerCase("tr-TR").includes(normalized)) ||
          prospect.experiences.some((experience) => experience.toLocaleLowerCase("tr-TR").includes(normalized))
        ).length;

        return {
          requirement: requirement.value,
          matchCount
        };
      })
      .filter((item) => item.matchCount === 0)
      .slice(0, 2)
      .map((item) => `"${item.requirement}" sinyali için arama kelimelerini genişletin.`);
  }

  private buildBatchSuggestions(prospects: Array<ReturnType<SourcingService["mapProspectDetail"]>>) {
    const suggestions: string[] = [];

    const readyToContact = prospects.filter(
      (prospect) =>
        prospect.stage === "GOOD_FIT" &&
        prospect.suppressionStatus === "ALLOWED" &&
        Boolean(prospect.email)
    ).length;
    if (readyToContact > 0) {
      suggestions.push(`${readyToContact} good fit adayı için bulk outreach hazır.`);
    }

    const rediscovered = prospects.filter((prospect) => prospect.sourceKind === "INTERNAL_CANDIDATE").length;
    if (rediscovered > 0) {
      suggestions.push(`${rediscovered} iç aday rediscovery ile geldi; duplicate effort azalabilir.`);
    }

    const blocked = prospects.filter((prospect) => prospect.suppressionStatus !== "ALLOWED").length;
    if (blocked > 0) {
      suggestions.push(`${blocked} profil suppression nedeniyle outreach dışında tutulmalı.`);
    }

    return suggestions.slice(0, 3);
  }

  private countBy<T>(items: T[], pickKey: (item: T) => string) {
    return items.reduce<Record<string, number>>((acc, item) => {
      const key = pickKey(item);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim().length > 0)))];
}
