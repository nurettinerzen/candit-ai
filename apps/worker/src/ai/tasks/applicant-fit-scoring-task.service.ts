import { AiTaskType, type Prisma, PrismaClient } from "@prisma/client";
import { AiTaskPolicyService } from "../policy/ai-task-policy.service.js";
import { StructuredAiProvider } from "../providers/structured-ai-provider.js";
import { TaskProcessingError } from "../task-processing-error.js";
import { CvDocumentContentService } from "./cv-document-content.service.js";
import { guardLocationCategoryScore } from "./location-score-guardrail.utils.js";
import {
  asJsonObject,
  toArray,
  toNumberValue,
  toRecord,
  toStringValue,
  type TaskExecutionContext,
  type TaskExecutionResult
} from "../types.js";

// ── Rubric types ──

type RubricCategory = {
  key: string;
  label: string;
  weight: number;
  description: string;
  deterministicSignals: string[];
  scoringGuidance: string;
};

type FitScoringRubric = {
  schemaVersion: string;
  roleFamily: string;
  categories: RubricCategory[];
};

type CandidateFlexibility =
  | "unknown"
  | "remote_only"
  | "commute_open"
  | "relocation_open"
  | "relocation_resistant";

type CommuteSeverity =
  | "minimal"
  | "light"
  | "moderate"
  | "heavy"
  | "severe"
  | "extreme"
  | "unknown";

type LocationFitAnalysis = {
  score: number;
  reasoning: string;
  strengths: string[];
  risks: string[];
  missingInformation: string[];
  candidateLocationText: string | null;
  jobLocationText: string | null;
  presenceMode: "remote" | "hybrid" | "onsite";
  candidateFlexibility: CandidateFlexibility;
  mismatchLevel: "same_locality" | "same_city" | "cross_city" | "cross_country" | "ambiguous";
  commuteSeverity: CommuteSeverity;
  officeDaysPerWeek: number | null;
  locationConfidence: number;
  localitySummary: string | null;
};

type JobScoringContext = {
  title: string;
  roleFamily: string;
  locationText: string | null;
  shiftType: string | null;
  jdText: string | null;
  requirementTexts: string[];
};

type RequirementCoverage = {
  requiredCount: number;
  matchedRequired: string[];
  partialRequired: string[];
  needsValidationRequired: string[];
  uncoveredRequired: string[];
  matchedPreferred: string[];
  coverageRatio: number;
  operationalRequirements: RequirementAssessmentDetail[];
  operationalWarnings: string[];
};

type RequirementAssessmentDetail = {
  key: string;
  value: string;
  required: boolean;
  status: "proven" | "partial" | "needs_validation" | "absent";
  evidence: string[];
  reasoning: string;
};

// ── AI output types ──

type AiCategoryScore = {
  key: string;
  label: string;
  score: number;
  confidence: number;
  strengths: string[];
  risks: string[];
  reasoning: string;
};

type AiFitScoringOutput = {
  overallScore: number;
  fitBand: "direct_fit" | "adjacent_fit" | "weak_fit";
  interviewReadiness: "ready_now" | "borderline" | "not_for_this_role";
  fitBandReasoning: string;
  categoryScores: AiCategoryScore[];
  overallAssessment: string;
  strengths: string[];
  risks: string[];
  missingInformation: string[];
  confidence: number;
  uncertainty: { reasons: string[] };
};

// ── Default rubrics (used when no DB rubric exists) ──

const DEFAULT_RUBRICS: Record<string, FitScoringRubric> = {
  marketing: {
    schemaVersion: "fit_scoring_rubric.v1",
    roleFamily: "marketing",
    categories: [
      {
        key: "deneyim_uyumu",
        label: "Rol ve Deneyim Uyumu",
        weight: 0.36,
        description: "Adayin gecmis rollerinin ve toplam deneyiminin bu ilandaki pazarlama rolune ne kadar dogrudan baglandigi",
        deterministicSignals: ["recentRoles", "sectorSignals", "workHistorySignals", "estimatedYearsOfExperience"],
        scoringGuidance: "Sosyal medya, performance, growth, brand, content, CRM veya dijital pazarlamanin ilanda aranan alt alanina dogrudan baglanan hands-on deneyim yuksek puan alir; alakasiz sektorde gecen yil sayisi tek basina puan getirmez"
      },
      {
        key: "beceri_ve_arac_uyumu",
        label: "Beceri ve Araç Uyumu",
        weight: 0.26,
        description: "Ilanda aranan kanal, platform, arac ve teknik uygulama becerileri",
        deterministicSignals: ["skills", "certifications", "workHistorySignals"],
        scoringGuidance: "Sosyal medya platformlari, icerik planlama, paid media, analytics, community yonetimi, raporlama veya ilanda gecen araclarda somut hands-on kanit varsa yuksek puan ver; sadece genel ofis becerileri yeterli sayilmaz"
      },
      {
        key: "uygulama_ve_sonuc_kaniti",
        label: "Uygulama ve Sonuç Kanıtı",
        weight: 0.2,
        description: "Kampanya, icerik, buyume veya raporlama isini bizzat yurutup olculebilir sonuc uretebilme kaniti",
        deterministicSignals: ["workHistorySignals", "skills", "sectorSignals"],
        scoringGuidance: "Kampanya kurma, icerik takvimi yonetme, topluluk buyutme, optimizasyon, raporlama, lead veya etkileisim sonucu uretme gibi execution kanitlari yuksek puan alir; yalnizca koordinasyon anlatilari orta puanda kalir"
      },
      {
        key: "lokasyon_ve_calisma_modeli_uyumu",
        label: "Lokasyon ve Çalışma Modeli Uyumu",
        weight: 0,
        description: "Adayin lokasyonu, hibrit/ofis/remote ritmi ve fiziksel katilim beklentisi ile uyumu",
        deterministicSignals: ["locationSignals", "contactInfo", "recentRoles", "workHistorySignals"],
        scoringGuidance: "Lokasyon operasyonel bir warning boyutudur. Adayin lokasyonu, tasinma veya ulasim esnekligi recruiter icin ayri not olarak gorunmeli; overall fit skorunu veya diger kategori skorlarini dusuren ana eksen olmamalidir"
      },
      {
        key: "egitim_ve_sertifika_uyumu",
        label: "Eğitim ve Sertifika Uyumu",
        weight: 0.08,
        description: "Rol icin ilgili egitim gecmisi veya role anlamli katki saglayan sertifika varligi",
        deterministicSignals: ["educationSummary", "certifications"],
        scoringGuidance: "Ilgili egitim veya role anlamli sertifika varsa arti puan ver; bunlar eksik diye guclu role-fit adayi asiri cezalandirma"
      }
    ]
  },
  warehouse: {
    schemaVersion: "fit_scoring_rubric.v1",
    roleFamily: "warehouse",
    categories: [
      {
        key: "deneyim_uyumu",
        label: "Deneyim Uyumu",
        weight: 0.25,
        description: "Depo, lojistik veya ilgili sektorde is deneyimi",
        deterministicSignals: ["recentRoles", "sectorSignals", "workHistorySignals", "estimatedYearsOfExperience"],
        scoringGuidance: "Depo/lojistik deneyimi yuksek puan, ilgisiz sektor dusuk puan"
      },
      {
        key: "sertifika_belgeler",
        label: "Sertifika ve Belgeler",
        weight: 0.2,
        description: "Forklift, ehliyet, SRC gibi mesleki belgeler",
        deterministicSignals: ["certifications", "skills"],
        scoringGuidance: "Forklift sertifikasi veya ehliyet varsa yuksek puan"
      },
      {
        key: "fiziksel_uygunluk",
        label: "Fiziksel Uygunluk Sinyalleri",
        weight: 0.2,
        description: "Fiziksel is yapabilme sinyalleri",
        deterministicSignals: ["skills", "recentRoles"],
        scoringGuidance: "Depo, paketleme, yukleme gibi fiziksel is deneyimi varsa yuksek puan"
      },
      {
        key: "vardiya_esnekligi",
        label: "Vardiya Esnekligi",
        weight: 0.15,
        description: "Vardiyali calisma uygunlugu sinyalleri",
        deterministicSignals: ["workHistorySignals", "recentRoles"],
        scoringGuidance: "Vardiyali calisma gecmisi varsa yuksek puan"
      },
      {
        key: "genel_profil",
        label: "Genel Profil",
        weight: 0.2,
        description: "Lokasyon, istihdam bosuklari, iletisim bilgileri",
        deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo", "languages"],
        scoringGuidance: "Lokasyon uyumu, az bosluk, iletisim bilgisi tamsa yuksek puan"
      }
    ]
  },
  retail: {
    schemaVersion: "fit_scoring_rubric.v1",
    roleFamily: "retail",
    categories: [
      {
        key: "musteri_iliskisi",
        label: "Müşteri İlişkisi Deneyimi",
        weight: 0.25,
        description: "Musteri odakli is deneyimi",
        deterministicSignals: ["recentRoles", "sectorSignals", "skills"],
        scoringGuidance: "Perakende, musteri destek veya satis deneyimi varsa yuksek puan"
      },
      {
        key: "kasa_deneyimi",
        label: "Kasa ve POS Deneyimi",
        weight: 0.2,
        description: "Kasa islemleri, POS terminal kullanimi",
        deterministicSignals: ["skills", "recentRoles"],
        scoringGuidance: "Kasa islemleri, POS veya nakit yonetimi deneyimi varsa yuksek puan"
      },
      {
        key: "iletisim_becerisi",
        label: "İletişim Becerisi",
        weight: 0.2,
        description: "Iletisim ve dil becerileri",
        deterministicSignals: ["languages", "educationSummary"],
        scoringGuidance: "Birden fazla dil veya iletisim odakli egitim varsa yuksek puan"
      },
      {
        key: "uygunluk_vardiya",
        label: "Uygunluk ve Vardiya",
        weight: 0.15,
        description: "Calismo uygunlugu ve vardiya esnekligi",
        deterministicSignals: ["workHistorySignals", "recentRoles"],
        scoringGuidance: "Perakende sektorunde vardiyali calisma gecmisi varsa yuksek puan"
      },
      {
        key: "genel_profil",
        label: "Genel Profil",
        weight: 0.2,
        description: "Lokasyon, istihdam bosuklari, iletisim",
        deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo"],
        scoringGuidance: "Lokasyon uyumu, az bosluk, iletisim bilgisi tamsa yuksek puan"
      }
    ]
  },
  genel: {
    schemaVersion: "fit_scoring_rubric.v1",
    roleFamily: "genel",
    categories: [
      {
        key: "deneyim_uyumu",
        label: "Deneyim Uyumu",
        weight: 0.3,
        description: "Is deneyimi ve sektor uyumu",
        deterministicSignals: ["recentRoles", "sectorSignals", "workHistorySignals", "estimatedYearsOfExperience"],
        scoringGuidance: "Ilgili sektor deneyimi varsa yuksek puan"
      },
      {
        key: "beceri_uyumu",
        label: "Beceri Uyumu",
        weight: 0.25,
        description: "Teknik ve mesleki beceriler",
        deterministicSignals: ["skills", "certifications"],
        scoringGuidance: "Pozisyon icin gerekli beceriler varsa yuksek puan"
      },
      {
        key: "egitim_sertifika",
        label: "Eğitim ve Sertifika",
        weight: 0.2,
        description: "Egitim durumu ve mesleki sertifikalar",
        deterministicSignals: ["educationSummary", "certifications"],
        scoringGuidance: "Ilgili egitim veya sertifika varsa yuksek puan"
      },
      {
        key: "genel_profil",
        label: "Genel Profil",
        weight: 0.25,
        description: "Lokasyon, dil, istihdam bosuklari",
        deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo", "languages"],
        scoringGuidance: "Lokasyon uyumu, dil becerisi, az bosluk varsa yuksek puan"
      }
    ]
  }
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

const LOCATION_STOP_WORDS = new Set([
  "turkiye",
  "turkey",
  "merkez",
  "center",
  "sube",
  "ofis",
  "depo",
  "fabrika",
  "tesis",
  "avrupa",
  "anadolu",
  "yakasi",
  "yakasi",
  "yakasi",
  "mahallesi",
  "mah",
  "mah",
  "sokak",
  "cadde",
  "cd",
  "no",
  "is",
  "yeri",
  "lokasyon",
  "adres"
]);

const LOCATION_ALIAS_TO_CITY: Record<string, string> = {
  atasehir: "istanbul",
  bagcilar: "istanbul",
  bahcelievler: "istanbul",
  bakirkoy: "istanbul",
  basaksehir: "istanbul",
  besiktas: "istanbul",
  beylikduzu: "istanbul",
  cekmekoy: "istanbul",
  etiler: "istanbul",
  halkali: "istanbul",
  kadikoy: "istanbul",
  kagithane: "istanbul",
  kartal: "istanbul",
  levent: "istanbul",
  maltepe: "istanbul",
  maslak: "istanbul",
  mecidiyekoy: "istanbul",
  pendik: "istanbul",
  sancaktepe: "istanbul",
  sisli: "istanbul",
  umraniye: "istanbul",
  uskudar: "istanbul",
  bornova: "izmir",
  buca: "izmir",
  karsiyaka: "izmir",
  konak: "izmir",
  cankaya: "ankara",
  etimesgut: "ankara",
  kecioren: "ankara",
  mamak: "ankara",
  yenimahalle: "ankara"
};

const LOCATION_TRAVEL_GROUPS: Record<string, {
  city: string;
  side: "anatolian" | "european" | "central";
  distanceRank: number;
}> = {
  atasehir: { city: "istanbul", side: "anatolian", distanceRank: 1 },
  kadikoy: { city: "istanbul", side: "anatolian", distanceRank: 2 },
  cekmekoy: { city: "istanbul", side: "anatolian", distanceRank: 0 },
  halkali: { city: "istanbul", side: "european", distanceRank: 6 },
  kartal: { city: "istanbul", side: "anatolian", distanceRank: 4 },
  kagithane: { city: "istanbul", side: "european", distanceRank: 3 },
  maltepe: { city: "istanbul", side: "anatolian", distanceRank: 3 },
  pendik: { city: "istanbul", side: "anatolian", distanceRank: 5 },
  sancaktepe: { city: "istanbul", side: "anatolian", distanceRank: 1 },
  sisli: { city: "istanbul", side: "european", distanceRank: 3 },
  umraniye: { city: "istanbul", side: "anatolian", distanceRank: 0 },
  uskudar: { city: "istanbul", side: "anatolian", distanceRank: 2 },
  besiktas: { city: "istanbul", side: "european", distanceRank: 3 },
  etiler: { city: "istanbul", side: "european", distanceRank: 3 },
  basaksehir: { city: "istanbul", side: "european", distanceRank: 5 },
  bakirkoy: { city: "istanbul", side: "european", distanceRank: 4 },
  bahcelievler: { city: "istanbul", side: "european", distanceRank: 4 },
  bagcilar: { city: "istanbul", side: "european", distanceRank: 4 },
  beylikduzu: { city: "istanbul", side: "european", distanceRank: 7 },
  levent: { city: "istanbul", side: "european", distanceRank: 3 },
  maslak: { city: "istanbul", side: "european", distanceRank: 3 },
  mecidiyekoy: { city: "istanbul", side: "european", distanceRank: 3 },
  bornova: { city: "izmir", side: "central", distanceRank: 1 },
  buca: { city: "izmir", side: "central", distanceRank: 2 },
  karsiyaka: { city: "izmir", side: "central", distanceRank: 3 },
  konak: { city: "izmir", side: "central", distanceRank: 1 },
  cankaya: { city: "ankara", side: "central", distanceRank: 1 },
  etimesgut: { city: "ankara", side: "central", distanceRank: 3 },
  kecioren: { city: "ankara", side: "central", distanceRank: 2 },
  mamak: { city: "ankara", side: "central", distanceRank: 2 },
  yenimahalle: { city: "ankara", side: "central", distanceRank: 3 }
};

const FOREIGN_LOCATION_HINTS = [
  "almanya",
  "germany",
  "deutschland",
  "bulgaristan",
  "bulgaria",
  "sofia",
  "ermenistan",
  "armenia",
  "erivan",
  "yerevan",
  "bae",
  "uae",
  "birlesik arap emirlikleri",
  "dubai",
  "berlin",
  "france",
  "fransa",
  "paris",
  "united kingdom",
  "ingiltere",
  "london",
  "amerika",
  "america",
  "usa",
  "abd",
  "canada",
  "kanada",
  "hollanda",
  "netherlands"
];

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

// ── Fit Scoring Output Schema for OpenAI ──

function fitScoringOutputSchema(schemaName: string) {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    title: schemaName,
    type: "object",
    additionalProperties: false,
    required: [
      "overallScore",
      "fitBand",
      "interviewReadiness",
      "fitBandReasoning",
      "categoryScores",
      "overallAssessment",
      "strengths",
      "risks",
      "missingInformation",
      "confidence",
      "uncertainty"
    ],
    properties: {
      overallScore: { type: "number", minimum: 0, maximum: 100 },
      fitBand: {
        type: "string",
        enum: ["direct_fit", "adjacent_fit", "weak_fit"]
      },
      interviewReadiness: {
        type: "string",
        enum: ["ready_now", "borderline", "not_for_this_role"]
      },
      fitBandReasoning: { type: "string" },
      categoryScores: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "label", "score", "confidence", "strengths", "risks", "reasoning"],
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            score: { type: "number", minimum: 0, maximum: 100 },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            strengths: { type: "array", items: { type: "string" }, maxItems: 5 },
            risks: { type: "array", items: { type: "string" }, maxItems: 5 },
            reasoning: { type: "string" }
          }
        },
        maxItems: 6
      },
      overallAssessment: { type: "string" },
      strengths: { type: "array", items: { type: "string" }, maxItems: 10 },
      risks: { type: "array", items: { type: "string" }, maxItems: 10 },
      missingInformation: { type: "array", items: { type: "string" }, maxItems: 10 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      uncertainty: {
        type: "object",
        additionalProperties: false,
        required: ["reasons"],
        properties: {
          reasons: { type: "array", items: { type: "string" }, maxItems: 8 }
        }
      }
    }
  };
}

// ── Task Service ──

export class ApplicantFitScoringTaskService {
  private readonly cvDocumentContentService = new CvDocumentContentService();

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
        "APPLICANT_FIT_SCORING task'i icin applicationId zorunludur."
      );
    }

    // 1. Load application with job and candidate
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: applicationId, tenantId: context.tenantId },
      include: {
        candidate: true,
        job: {
          include: {
            requirements: { orderBy: { key: "asc" } }
          }
        }
      }
    });

    if (!application) {
      throw new TaskProcessingError("APPLICATION_NOT_FOUND", "Application bulunamadi.", false, {
        applicationId
      });
    }

    // 2. Load latest CV parsed profile
    const latestCvProfile = await this.prisma.cVParsedProfile.findFirst({
      where: {
        tenantId: context.tenantId,
        cvFile: { candidateId: application.candidateId }
      },
      orderBy: { createdAt: "desc" },
      include: {
        cvFile: {
          select: {
            id: true,
            originalName: true,
            storageKey: true,
            mimeType: true,
            blob: {
              select: {
                contentBytes: true
              }
            }
          }
        }
      }
    });

    if (!latestCvProfile) {
      throw new TaskProcessingError(
        "CV_PROFILE_NOT_FOUND",
        "Adayin CV profili bulunamadi. Once CV yukleyip parse edilmesi gerekiyor.",
        false,
        { candidateId: application.candidateId }
      );
    }

    const promptVersion = "applicant_fit_scoring.v15.tr.simple";

    // 3. Load parsed CV profile
    const profileJson = toRecord(latestCvProfile.profileJson);
    const extractedFacts = toRecord(profileJson.extractedFacts);
    const cvDocumentContext = await this.buildCvDocumentContext(latestCvProfile.cvFile);
    const jobContext: JobScoringContext = {
      title: application.job.title,
      roleFamily: application.job.roleFamily,
      locationText: application.job.locationText,
      shiftType: application.job.shiftType,
      jdText: application.job.jdText,
      requirementTexts: application.job.requirements.map((item) => `${item.key}: ${item.value}`)
    };
    const locationAnalysis = this.analyzeLocationFit({
      candidateLocationText: application.candidate.locationText,
      extractedLocationSignals: toArray(extractedFacts.locationSignals).filter(
        (item): item is string => typeof item === "string"
      ),
      jobLocationText: application.job.locationText,
      jobShiftType: application.job.shiftType,
      jobDescription: application.job.jdText,
      jobRequirementTexts: jobContext.requirementTexts,
      candidateProfileText: JSON.stringify({
        normalizedSummary: toRecord(profileJson.normalizedSummary),
        inferredObservations: toRecord(profileJson).inferredObservations ?? null,
        cvDocumentTextExcerpt: toRecord(cvDocumentContext).textExcerpt ?? null
      })
    });
    const requirementCoverage = this.buildRequirementCoverage(
      application.job.requirements.map((item) => ({
        key: item.key,
        value: item.value,
        required: item.required
      })),
      profileJson,
      cvDocumentContext
    );
    const requirementAssessment = this.buildRequirementAssessmentDetails(
      application.job.requirements.map((item) => ({
        key: item.key,
        value: item.value,
        required: item.required
      })),
      profileJson,
      cvDocumentContext
    );
    const coreRequirementAssessment = requirementAssessment.filter(
      (item) => !this.isOperationalRequirementKey(item.key)
    );
    const fitPromptCvProfile = this.buildFitPromptProfile({
      profileJson,
      locationAnalysis,
      parseConfidence: latestCvProfile.parseConfidence,
      extractionStatus: latestCvProfile.extractionStatus
    });
    const fitPromptCvDocumentContext = this.buildFitPromptCvDocumentContext(
      cvDocumentContext,
      locationAnalysis
    );
    const candidateEvidenceSnapshot = this.buildCandidateEvidenceSnapshot({
      extractedFacts,
      jobContext,
      requirementCoverage,
      locationAnalysis,
      cvDocumentContext
    });
    const rubric = await this.loadRubric(context.tenantId, context.taskRun.id, application.job.roleFamily);
    const rawRubricBase = rubric
      ? (toRecord(rubric.rubricJson) as unknown as FitScoringRubric)
      : this.getDefaultRubric(application.job.roleFamily);
    const rubricBase = this.normalizeRubricStructure(rawRubricBase, application.job.roleFamily);
    const rubricData = this.ensureLocationCategory(rubricBase, application.job.locationText);
    const deterministicScores = this.buildDeterministicScores(
      extractedFacts,
      rubricData.categories,
      locationAnalysis,
      jobContext
    );

    // 4. AI-first scoring
    const aiResult = await this.provider.generate({
      taskType: "APPLICANT_FIT_SCORING",
      schemaName: "applicant_fit_scoring_v1_tr",
      schema: fitScoringOutputSchema("applicant_fit_scoring_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt: [
        "Sen deneyimli bir recruiter gibi davranan bir CV degerlendirme asistanisin.",
        "Turkce cikti uret.",
        "Adayi yalnizca bu ilanin mevcut rolune gore degerlendir.",
        "Ilan gereksinimlerini, CV ozetini ve CV metnini birlikte okuyup adayin bu role ne kadar uyduguna karar ver.",
        "Skoru genel profesyonellige gore degil, bu role bugun mulakata alinabilirlik duzeyine gore ver.",
        "Tum skorlar 0-100 arasi olmali; 1-10 veya 1-5 skala kullanma.",
        "Guclu adaylari gereksiz yere bastirma; acikca alakasiz adaylari da oldugundan iyi gosterme.",
        "Eksik bilgi ile gercek riski ayir; kanitlanan bir capability'yi eksikmis gibi yazma.",
        "Lokasyon ve calisma modeli notlarini operasyonel warning gibi ele al; role, beceri ve execution uyumunun yerine koyma.",
        "Nihai ise alim karari verme; sadece tutarli, net ve recruiter gibi dogal bir degerlendirme uret."
      ].join(" "),
      userPrompt: JSON.stringify({
        task: "APPLICANT_FIT_SCORING",
        locale: "tr-TR",
        candidate: {
          fullName: application.candidate.fullName,
          source: application.candidate.source
        },
        job: {
          title: application.job.title,
          roleFamily: application.job.roleFamily,
          shiftType: application.job.shiftType,
          jdText: this.sanitizeJobDescriptionForFitPrompt(application.job.jdText),
          requirements: application.job.requirements
            .filter((r) => !this.isOperationalRequirementKey(r.key))
            .map((r) => ({
              key: r.key,
              value: r.value,
              required: r.required
            })),
          operationalRequirements: application.job.requirements
            .filter((r) => this.isOperationalRequirementKey(r.key))
            .map((r) => ({
              key: r.key,
              summary: this.summarizeOperationalRequirementValue(r.key, r.value),
              required: r.required
            }))
        },
        rubric: {
          roleFamily: rubricData.roleFamily,
          categories: rubricData.categories.map((category) => ({
            key: category.key,
            label: category.label,
            description: category.description,
            weight: category.weight
          }))
        },
        locationContext: this.buildFitPromptLocationContext(application, locationAnalysis),
        cvProfile: fitPromptCvProfile,
        cvDocumentContext: fitPromptCvDocumentContext,
        supportingContext: {
          requirementAssessment: coreRequirementAssessment.map((item) => ({
            key: item.key,
            summary: item.value,
            status: item.status,
            required: item.required
          })),
          candidateEvidence: {
            relevantRoleSignals: candidateEvidenceSnapshot.relevantRoleSignals,
            relevantExecutionSignals: candidateEvidenceSnapshot.relevantExecutionSignals,
            relevantSkillSignals: candidateEvidenceSnapshot.relevantSkillSignals
          }
        },
        instructions: [
          "overallScore 0-100 arasi sayi olmali",
          "categoryScores icindeki tum score alanlari da 0-100 arasi olmali",
          "1-10 veya 1-5 skala kullanma",
          "fitBand alanini zorunlu doldur: direct_fit, adjacent_fit veya weak_fit",
          "interviewReadiness alanini zorunlu doldur: ready_now, borderline veya not_for_this_role",
          "fitBandReasoning alaninda kisa ve net bir aciklama yaz",
          "categoryScores alaninda sadece rubric.categories icindeki kategorileri kullan; key ve label alanlarini ayni koru",
          "confidence alani 0-1 arasi olmali ve her adayda veri kalitesine gore degismeli",
          "strengths ve risks Turkce olmali",
          "overallAssessment Turkce, recruiter'in hizla anlayacagi bir ozet olmali",
          "Guclu yonler ve riskler role gore ayirt edici olsun",
          "Eksik bilgi ile riski ayir; ayni capability'yi hem strength hem missingInformation olarak yazma",
          "Skorlar, category reasoning'leri ve overall assessment birbiriyle tutarli olsun",
          "locationContext.candidateLocationProvided true ise adayin lokasyonu belirtilmemis deme",
          "Lokasyon kategorisi reasoning'ini locationContext'e gore yaz; ama lokasyonu diger kategori puanlarinin yerine koyma",
          "Lokasyon ve calisma modeli notlarini ana fit belirleyicisi gibi degil, operasyonel warning gibi ele al",
          "Kanitlanan bir capability'yi yalnizca derinligi net degil diye yokmus gibi puanlama"
        ]
      })
    });

    const aiData = aiResult.mode === "deterministic_fallback" || !aiResult.output
      ? null
      : this.parseAiOutput(aiResult.output);

    let rubricRoleFamily = rubricData.roleFamily;
    let rubricSource: "database" | "default" | "ai_first" = rubric ? "database" : "default";
    let overallScore = 0;
    let overallConfidence = 0;
    let overallAssessment = "";
    let uncertaintyReasons: string[] = [];
    let missingInfo: string[] = [];
    let allStrengths: string[] = [];
    let allRisks: string[] = [];
    let sanitizedCategoryScores: Array<{
      key: string;
      label: string;
      weight: number | null;
      score: number;
      confidence: number;
      deterministicScore: number | null;
      aiScore: number | null;
      strengths: string[];
      risks: string[];
      reasoning: string;
    }> = [];

    const mergedScores = aiData
      ? this.buildAiFirstScores({
          aiData,
          deterministicScores,
          categories: rubricData.categories,
          locationAnalysis
        })
      : this.mergeScores(
          deterministicScores,
          undefined,
          rubricData.categories,
          locationAnalysis
        );
    const mergedMissingInfo = this.sanitizeMissingInformation(
      this.uniqueList(mergedScores.missingInformation),
      locationAnalysis
    );

    const topLevelRisks = this.sanitizeRisks(
      this.uniqueList(aiData?.risks ?? []),
      mergedMissingInfo,
      locationAnalysis
    );
    const topLevelStrengths = this.pruneConflictingStrengths(
      this.sanitizeStrengths(aiData?.strengths ?? [], locationAnalysis, jobContext),
      topLevelRisks
    );

    missingInfo = mergedMissingInfo;
    uncertaintyReasons = this.sanitizeUncertaintyReasons(mergedScores.uncertaintyReasons, locationAnalysis);
    sanitizedCategoryScores = mergedScores.categoryScores.map((category) => ({
      key: category.key,
      label: rubricData.categories.find((item) => item.key === category.key)?.label ?? category.key,
      weight: rubricData.categories.find((item) => item.key === category.key)?.weight ?? null,
      score: this.clampScore(category.score),
      confidence: this.clampConfidence(category.confidence),
      deterministicScore: this.clampScore(category.deterministicScore),
      aiScore: category.aiScore === undefined ? null : this.clampScore(category.aiScore),
      strengths: this.sanitizeStrengths(category.strengths, locationAnalysis, jobContext),
      risks: this.sanitizeRisks(category.risks, missingInfo, locationAnalysis),
      reasoning: this.sanitizeCategoryReasoning(category.key, category.reasoning, locationAnalysis)
    })).map((category) => ({
      ...category,
      strengths: this.pruneConflictingStrengths(category.strengths, category.risks)
    }));

    overallScore = this.resolveCoherentOverallScore({
      aiOverallScore: aiData?.overallScore ?? null,
      categoryScores: sanitizedCategoryScores,
      categories: rubricData.categories
    });
    overallConfidence = this.calibrateAssessmentConfidence({
      aiConfidence: aiData?.confidence ?? mergedScores.confidence,
      parseConfidence: toNumberValue(latestCvProfile.parseConfidence, 0.5),
      extractionStatus: latestCvProfile.extractionStatus,
      missingInformationCount: missingInfo.length,
      uncertaintyReasonCount: uncertaintyReasons.length,
      categoryScores: sanitizedCategoryScores,
      documentCharCount: typeof cvDocumentContext?.charCount === "number" ? cvDocumentContext.charCount : null
    });
    overallAssessment = this.composeOverallAssessment(
      mergedScores.overallAssessment,
      locationAnalysis
    );

    allStrengths = this.dedupeByMeaning([
      ...topLevelStrengths,
      ...sanitizedCategoryScores.flatMap((category) => category.strengths)
    ]);
    allRisks = this.dedupeByMeaning([
      ...topLevelRisks,
      ...sanitizedCategoryScores.flatMap((category) => category.risks)
    ]).filter((item) => !this.looksLikeLocationSignal(item, locationAnalysis));

    // 5. Save ApplicantFitScore
    const fitScore = await this.prisma.applicantFitScore.create({
      data: {
        tenantId: context.tenantId,
        applicationId,
        aiTaskRunId: context.taskRun.id,
        overallScore,
        confidence: overallConfidence,
        subScoresJson: {
          schemaVersion: "fit_scoring_sub_scores.v1",
          rubricRoleFamily,
          categories: sanitizedCategoryScores.map((cs) => ({
            key: cs.key,
            label: cs.label,
            weight: cs.weight,
            score: cs.score,
            confidence: cs.confidence,
            deterministicScore: cs.deterministicScore,
            aiScore: cs.aiScore,
            strengths: cs.strengths,
            risks: cs.risks,
            reasoning: cs.reasoning
          }))
        } as unknown as Prisma.InputJsonValue,
        strengthsJson: allStrengths as unknown as Prisma.InputJsonValue,
        risksJson: allRisks as unknown as Prisma.InputJsonValue,
        missingInfoJson: missingInfo as unknown as Prisma.InputJsonValue,
        reasoningJson: {
          overallAssessment,
          fitBand: mergedScores.fitBand,
          interviewReadiness: mergedScores.interviewReadiness,
          fitBandReasoning: mergedScores.fitBandReasoning,
          uncertaintyReasons,
          providerMode: aiResult.mode,
          rubricSource
        } as unknown as Prisma.InputJsonValue,
        modelKey: aiResult.modelKey,
        promptVersion
      }
    });

    // 6. Return result
    const uncertaintyLevel = overallConfidence >= 0.7 ? "dusuk" : overallConfidence >= 0.4 ? "orta" : "yuksek";

    return {
      outputJson: asJsonObject({
        schemaVersion: "applicant_fit_scoring.v1.tr",
        provider: {
          mode: aiResult.mode,
          key: aiResult.providerKey,
          model: aiResult.modelKey
        },
        overallScore,
        confidence: overallConfidence,
        categoryScores: sanitizedCategoryScores,
        overallAssessment,
        calibration: {
          fitBand: mergedScores.fitBand,
          interviewReadiness: mergedScores.interviewReadiness,
          fitBandReasoning: mergedScores.fitBandReasoning
        },
        missingInformation: missingInfo,
        uncertainty: {
          level: uncertaintyLevel,
          reasons: uncertaintyReasons,
          confidence: overallConfidence
        },
        safety: {
          recruiterReviewRequired: true,
          autoDecisionApplied: false,
          autoRejectAllowed: false
        },
        additional: {
          fitScoreId: fitScore.id,
          rubricRoleFamily,
          cvFileId: latestCvProfile.cvFile?.id ?? null
        }
      }),
      uncertaintyJson: asJsonObject({
        level: uncertaintyLevel,
        confidence: overallConfidence,
        reasons: uncertaintyReasons
      }),
      guardrailFlags: asJsonObject(this.policy.getGuardrailFlags(AiTaskType.APPLICANT_FIT_SCORING)),
      providerKey: aiResult.providerKey,
      providerMode: aiResult.mode,
      modelKey: aiResult.modelKey,
      promptVersion: aiResult.promptVersion,
      policyVersion: this.policy.policyVersion,
      artifacts: {
        fitScoreId: fitScore.id
      }
    };
  }

  // ── Deterministic scoring ──

  private async buildCvDocumentContext(cvFile: {
    storageKey: string;
    originalName: string;
    mimeType: string;
    blob?: {
      contentBytes: Buffer | Uint8Array;
    } | null;
  } | null) {
    if (!cvFile) {
      return null;
    }

    try {
      const extraction = await this.cvDocumentContentService.extract({
        storageKey: cvFile.storageKey,
        originalName: cvFile.originalName,
        mimeType: cvFile.mimeType,
        contentBytes: cvFile.blob?.contentBytes ?? null
      });

      if (!extraction.text || extraction.text.trim().length === 0) {
        return {
          status: extraction.status,
          method: extraction.method,
          qualityScore: extraction.qualityScore,
          notes: extraction.notes
        };
      }

      return {
        status: extraction.status,
        method: extraction.method,
        qualityScore: extraction.qualityScore,
        charCount: extraction.charCount,
        notes: extraction.notes,
        textExcerpt: extraction.text.slice(0, 6000)
      };
    } catch {
      return null;
    }
  }

  private buildDeterministicScores(
    extractedFacts: Record<string, unknown>,
    categories: RubricCategory[],
    locationAnalysis: LocationFitAnalysis,
    jobContext: JobScoringContext
  ): Array<{
    key: string;
    score: number;
    signals: string[];
    strengths?: string[];
    risks?: string[];
    reasoning?: string;
  }> {
    return categories.map((category) => {
      if (this.isLocationCategory(category)) {
        return {
          key: category.key,
          score: locationAnalysis.score,
          signals: [...locationAnalysis.strengths, ...locationAnalysis.missingInformation].slice(0, 4),
          strengths: locationAnalysis.strengths,
          risks: locationAnalysis.risks,
          reasoning: locationAnalysis.reasoning
        };
      }

      let score = 18;
      const signals: string[] = [];

      for (const signalKey of category.deterministicSignals) {
        const signalValue = this.selectRelevantSignalValue({
          signalKey,
          category,
          extractedFacts,
          jobContext
        });

        if (!signalValue) continue;

        if (Array.isArray(signalValue) && signalValue.length > 0) {
          const bonus = Math.min(signalValue.length * 10, 40);
          score += bonus;
          signals.push(`${signalKey}: ${signalValue.length} sinyal`);
        } else if (typeof signalValue === "string" && signalValue.trim().length > 0) {
          score += 15;
          signals.push(`${signalKey}: mevcut`);
        } else if (typeof signalValue === "number" && signalValue > 0) {
          const bonus = Math.min(signalValue * 5, 30);
          score += bonus;
          signals.push(`${signalKey}: ${signalValue}`);
        } else if (typeof signalValue === "object" && signalValue !== null) {
          const keys = Object.keys(signalValue as Record<string, unknown>);
          if (keys.length > 0) {
            score += 10;
            signals.push(`${signalKey}: ${keys.length} alan`);
          }
        }
      }

      return {
        key: category.key,
        score: Math.min(Math.round(score), 100),
        signals
      };
    });
  }

  // ── Merge deterministic + AI ──

  private mergeScores(
    deterministicScores: Array<{
      key: string;
      score: number;
      signals: string[];
      strengths?: string[];
      risks?: string[];
      reasoning?: string;
    }>,
    aiOutput: Record<string, unknown> | undefined,
    categories: RubricCategory[],
    locationAnalysis: LocationFitAnalysis
  ): {
    categoryScores: Array<{
      key: string;
      score: number;
      confidence: number;
      deterministicScore: number;
      aiScore: number;
      strengths: string[];
      risks: string[];
      reasoning: string;
    }>;
    overallAssessment: string;
    fitBand: AiFitScoringOutput["fitBand"] | null;
    interviewReadiness: AiFitScoringOutput["interviewReadiness"] | null;
    fitBandReasoning: string | null;
    missingInformation: string[];
    confidence: number;
    uncertaintyReasons: string[];
  } {
    const aiData = aiOutput ? this.parseAiOutput(aiOutput) : null;
    const detWeight = aiData ? 0.45 : 1.0;
    const aiWeight = aiData ? 0.55 : 0.0;

    const categoryScores = categories.map((category) => {
      const det = deterministicScores.find((d) => d.key === category.key);
      const detScore = det?.score ?? 30;
      const aiCategory = aiData?.categoryScores.find((a) => a.key === category.key);
      const aiScore = aiCategory?.score ?? detScore;

      const blendedScore = Math.round(detScore * detWeight + aiScore * aiWeight);
      const confidence = aiCategory
        ? toNumberValue(aiCategory.confidence, 0.5)
        : 0.3;

      const isLocationCategory = this.isLocationCategory(category);
      const deterministicStrengths = ("strengths" in (det ?? {}))
        ? ((det as { strengths?: string[] }).strengths ?? det?.signals ?? [])
        : this.humanizeDeterministicSignals(det?.signals ?? []);
      const deterministicRisks = ("risks" in (det ?? {}))
        ? ((det as { risks?: string[] }).risks ?? [])
        : [];
      const aiStrengths = this.uniqueList(aiCategory?.strengths ?? []);

      return {
        key: category.key,
        score: isLocationCategory ? this.clampScore(detScore) : Math.min(blendedScore, 100),
        confidence: isLocationCategory ? locationAnalysis.locationConfidence : confidence,
        deterministicScore: detScore,
        aiScore: isLocationCategory ? this.clampScore(detScore) : aiScore,
        strengths: isLocationCategory
          ? this.uniqueList(deterministicStrengths)
          : (aiStrengths.length > 0 ? aiStrengths : this.uniqueList(deterministicStrengths)),
        risks: isLocationCategory
          ? this.uniqueList(deterministicRisks)
          : this.uniqueList([...(aiCategory?.risks ?? []), ...deterministicRisks]),
        reasoning: isLocationCategory
          ? this.buildLocationCategoryReasoning(locationAnalysis)
          : (
              (
                aiCategory?.reasoning
                ?? (("reasoning" in (det ?? {})) ? ((det as { reasoning?: string }).reasoning ?? "") : "")
              )
              || "Deterministik sinyal bazli degerlendirme."
            )
      };
    });

    return {
      categoryScores,
      overallAssessment: this.composeOverallAssessment(
        aiData?.overallAssessment ?? "CV profili deterministik sinyallerle degerlendirildi.",
        locationAnalysis
      ),
      fitBand: aiData?.fitBand ?? null,
      interviewReadiness: aiData?.interviewReadiness ?? null,
      fitBandReasoning: aiData?.fitBandReasoning ?? null,
      missingInformation: this.uniqueList([
        ...(aiData?.missingInformation ?? []),
        ...locationAnalysis.missingInformation
      ]),
      confidence: aiData?.confidence ?? 0.35,
      uncertaintyReasons: aiData?.uncertainty?.reasons ?? [
        "AI destegi olmadan sadece deterministik sinyaller kullanildi."
      ]
    };
  }

  private buildAiFirstScores(input: {
    aiData: AiFitScoringOutput;
    deterministicScores: Array<{
      key: string;
      score: number;
      signals: string[];
      strengths?: string[];
      risks?: string[];
      reasoning?: string;
    }>;
    categories: RubricCategory[];
    locationAnalysis: LocationFitAnalysis;
  }): {
    categoryScores: Array<{
      key: string;
      score: number;
      confidence: number;
      deterministicScore: number;
      aiScore: number;
      strengths: string[];
      risks: string[];
      reasoning: string;
    }>;
    overallAssessment: string;
    fitBand: AiFitScoringOutput["fitBand"] | null;
    interviewReadiness: AiFitScoringOutput["interviewReadiness"] | null;
    fitBandReasoning: string | null;
    missingInformation: string[];
    confidence: number;
    uncertaintyReasons: string[];
  } {
    const aiScaleMultiplier = this.resolveAiScoreScaleMultiplier({
      aiData: input.aiData,
      deterministicScores: input.deterministicScores,
      categories: input.categories
    });

    const categoryScores = input.categories.map((category) => {
      const det = input.deterministicScores.find((item) => item.key === category.key);
      const aiCategory = input.aiData.categoryScores.find((item) => item.key === category.key);
      const aiStrengths = this.uniqueList(aiCategory?.strengths ?? []);
      const aiRisks = this.uniqueList(aiCategory?.risks ?? []);
      const deterministicStrengths = ("strengths" in (det ?? {}))
        ? ((det as { strengths?: string[] }).strengths ?? det?.signals ?? [])
        : this.humanizeDeterministicSignals(det?.signals ?? []);
      const deterministicRisks = ("risks" in (det ?? {}))
        ? ((det as { risks?: string[] }).risks ?? [])
        : [];
      const isLocationCategory = this.isLocationCategory(category);
      const fallbackScore = det?.score ?? (isLocationCategory ? input.locationAnalysis.score : 35);
      const rawAiScore = aiCategory
        ? this.clampScore(aiCategory.score * aiScaleMultiplier)
        : fallbackScore;
      const deterministicScore = this.clampScore(fallbackScore);
      const aiScore = isLocationCategory
        ? guardLocationCategoryScore({
            aiScore: rawAiScore,
            deterministicScore,
            presenceMode: input.locationAnalysis.presenceMode,
            candidateFlexibility: input.locationAnalysis.candidateFlexibility,
            mismatchLevel: input.locationAnalysis.mismatchLevel,
            commuteSeverity: input.locationAnalysis.commuteSeverity
          })
        : rawAiScore;

      return {
        key: category.key,
        score: this.clampScore(aiScore),
        confidence: isLocationCategory
          ? input.locationAnalysis.locationConfidence
          : aiCategory ? this.clampConfidence(aiCategory.confidence) : 0.35,
        deterministicScore,
        aiScore: isLocationCategory ? deterministicScore : this.clampScore(aiScore),
        strengths: isLocationCategory
          ? this.uniqueList(input.locationAnalysis.strengths)
          : (aiStrengths.length > 0 ? aiStrengths : this.uniqueList(deterministicStrengths)).slice(0, 4),
        risks: isLocationCategory
          ? this.uniqueList(input.locationAnalysis.risks)
          : (aiRisks.length > 0 ? aiRisks : this.uniqueList(deterministicRisks)).slice(0, 4),
        reasoning: isLocationCategory
          ? this.buildLocationCategoryReasoning(input.locationAnalysis)
          : (
              (
                aiCategory?.reasoning
                ?? (("reasoning" in (det ?? {})) ? ((det as { reasoning?: string }).reasoning ?? "") : "")
              )
              || "AI recruiter degerlendirmesi role ve kanitlara gore olusturuldu."
            )
      };
    });

    return {
      categoryScores,
      overallAssessment: input.aiData.overallAssessment
        || "Aday, role ve ilandaki gereksinimlere gore AI-first recruiter mantigi ile degerlendirildi.",
      fitBand: input.aiData.fitBand,
      interviewReadiness: input.aiData.interviewReadiness,
      fitBandReasoning: input.aiData.fitBandReasoning || input.aiData.overallAssessment || null,
      missingInformation: input.aiData.missingInformation,
      confidence: input.aiData.confidence,
      uncertaintyReasons: input.aiData.uncertainty.reasons
    };
  }

  private resolveAiScoreScaleMultiplier(input: {
    aiData: AiFitScoringOutput;
    deterministicScores: Array<{
      key: string;
      score: number;
    }>;
    categories: RubricCategory[];
  }) {
    const nonLocationAiScores = input.categories
      .filter((category) => !this.isLocationCategory(category))
      .map((category) => input.aiData.categoryScores.find((item) => item.key === category.key)?.score ?? null)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

    if (nonLocationAiScores.length < 3) {
      return 1;
    }

    const maxAiScore = Math.max(...nonLocationAiScores);
    const averageAiScore = nonLocationAiScores.reduce((sum, score) => sum + score, 0) / nonLocationAiScores.length;

    if (maxAiScore > 10 || averageAiScore > 10) {
      return 1;
    }

    const deterministicReferenceScores = input.categories
      .filter((category) => !this.isLocationCategory(category))
      .map((category) => input.deterministicScores.find((item) => item.key === category.key)?.score ?? null)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    const deterministicAverage = deterministicReferenceScores.length > 0
      ? deterministicReferenceScores.reduce((sum, score) => sum + score, 0) / deterministicReferenceScores.length
      : 0;
    const aiStrengthCount = this.uniqueList([
      ...input.aiData.strengths,
      ...input.aiData.categoryScores.flatMap((item) => item.strengths)
    ]).length;
    const fitSuggestsInterviewable = input.aiData.fitBand === "direct_fit"
      || input.aiData.interviewReadiness === "ready_now"
      || (input.aiData.fitBand === "adjacent_fit" && input.aiData.interviewReadiness !== "not_for_this_role");

    if (fitSuggestsInterviewable) {
      return 10;
    }

    if (deterministicAverage >= 55) {
      return 10;
    }

    if (deterministicAverage >= 40 && aiStrengthCount >= 2) {
      return 10;
    }

    return 1;
  }

  private parseAiOutput(output: Record<string, unknown>): AiFitScoringOutput | null {
    try {
      const overallScore = this.clampScore(toNumberValue(output.overallScore, 50));
      const rawCategoryScores = toArray(output.categoryScores)
        .map((entry) => {
          const rec = toRecord(entry);
          const label = toStringValue(rec.label, "").trim();
          return {
            key: this.slugifyDimensionKey(toStringValue(rec.key, label || "dimension")),
            label: label || "Degerlendirme Boyutu",
            score: toNumberValue(rec.score, 50),
            confidence: toNumberValue(rec.confidence, 0.5),
            strengths: toArray(rec.strengths).filter((s): s is string => typeof s === "string"),
            risks: toArray(rec.risks).filter((s): s is string => typeof s === "string"),
            reasoning: toStringValue(rec.reasoning, "")
          };
        })
        .filter((cs) => cs.label.length > 0);
      const categoryScores = this.normalizeAiCategoryScoreScale(rawCategoryScores, overallScore);

      return {
        overallScore,
        fitBand: this.parseFitBand(output.fitBand),
        interviewReadiness: this.parseInterviewReadiness(output.interviewReadiness),
        fitBandReasoning: toStringValue(output.fitBandReasoning, ""),
        categoryScores,
        overallAssessment: toStringValue(output.overallAssessment, ""),
        strengths: toArray(output.strengths).filter((s): s is string => typeof s === "string"),
        risks: toArray(output.risks).filter((s): s is string => typeof s === "string"),
        missingInformation: toArray(output.missingInformation).filter((s): s is string => typeof s === "string"),
        confidence: toNumberValue(output.confidence, 0.5),
        uncertainty: {
          reasons: toArray(toRecord(output.uncertainty).reasons).filter(
            (s): s is string => typeof s === "string"
          )
        }
      };
    } catch {
      return null;
    }
  }

  private normalizeAiCategoryScoreScale(
    categoryScores: Array<{
      key: string;
      label: string;
      score: number;
      confidence: number;
      strengths: string[];
      risks: string[];
      reasoning: string;
    }>,
    overallScore: number
  ) {
    const scores = categoryScores
      .map((item) => item.score)
      .filter((value) => typeof value === "number" && Number.isFinite(value));

    if (scores.length < 3) {
      return categoryScores.map((item) => ({
        ...item,
        score: this.clampScore(item.score)
      }));
    }

    const maxScore = Math.max(...scores);
    const averageScore = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    const likelyTenPointScale = maxScore <= 10 && averageScore <= 10 && overallScore >= 35 && overallScore >= averageScore * 3;

    if (!likelyTenPointScale) {
      return categoryScores.map((item) => ({
        ...item,
        score: this.clampScore(item.score)
      }));
    }

    return categoryScores.map((item) => ({
      ...item,
      score: this.clampScore(item.score * 10)
    }));
  }

  private parseFitBand(value: unknown): AiFitScoringOutput["fitBand"] {
    const normalized = toStringValue(value, "").trim().toLocaleLowerCase("tr-TR");
    if (normalized === "direct_fit" || normalized === "adjacent_fit" || normalized === "weak_fit") {
      return normalized;
    }

    return "adjacent_fit";
  }

  private parseInterviewReadiness(value: unknown): AiFitScoringOutput["interviewReadiness"] {
    const normalized = toStringValue(value, "").trim().toLocaleLowerCase("tr-TR");
    if (normalized === "ready_now" || normalized === "borderline" || normalized === "not_for_this_role") {
      return normalized;
    }

    return "borderline";
  }

  // ── Weighted overall score ──

  private calculateWeightedOverall(
    categoryScores: Array<{ key: string; score: number }>,
    categories: RubricCategory[]
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const category of categories) {
      if (this.isLocationCategory(category)) {
        continue;
      }

      const cs = categoryScores.find((s) => s.key === category.key);
      if (cs) {
        weightedSum += cs.score * category.weight;
        totalWeight += category.weight;
      }
    }

    if (totalWeight === 0) return 50;
    return Math.round(weightedSum / totalWeight);
  }

  private resolveCoherentOverallScore(input: {
    aiOverallScore: number | null;
    categoryScores: Array<{
      key: string;
      score: number;
    }>;
    categories: RubricCategory[];
  }) {
    return this.calculateWeightedOverall(input.categoryScores, input.categories);
  }

  private buildRequirementCoverage(
    requirements: Array<{ key: string; value: string; required: boolean }>,
    profileJson: unknown,
    cvDocumentContext: Record<string, unknown> | null
  ): RequirementCoverage {
    const details = this.buildRequirementAssessmentDetails(requirements, profileJson, cvDocumentContext);
    const requiredDetails = details.filter(
      (item) => item.required && !this.isOperationalRequirementKey(item.key)
    );
    const operationalRequirements = details.filter(
      (item) => item.required && this.isOperationalRequirementKey(item.key)
    );
    const preferredDetails = details.filter((item) => !item.required);
    const matchedRequired = requiredDetails
      .filter((item) => item.status === "proven" || item.status === "partial")
      .map((item) => item.value);
    const partialRequired = requiredDetails
      .filter((item) => item.status === "partial")
      .map((item) => item.value);
    const needsValidationRequired = requiredDetails
      .filter((item) => item.status === "needs_validation")
      .map((item) => item.value);
    const uncoveredRequired = requiredDetails
      .filter((item) => item.status === "absent")
      .map((item) => item.value);
    const matchedPreferred = preferredDetails
      .filter((item) => item.status === "proven" || item.status === "partial")
      .map((item) => item.value);
    const weightedMatches = requiredDetails.reduce((sum, item) => {
      if (item.status === "proven") return sum + 1;
      if (item.status === "partial") return sum + 0.7;
      if (item.status === "needs_validation") return sum + 0.35;
      return sum;
    }, 0);
    const coverageRatio = requiredDetails.length === 0 ? 1 : weightedMatches / requiredDetails.length;

    return {
      requiredCount: requiredDetails.length,
      matchedRequired,
      partialRequired,
      needsValidationRequired,
      uncoveredRequired,
      matchedPreferred,
      coverageRatio,
      operationalRequirements,
      operationalWarnings: operationalRequirements
        .map((item) => this.describeOperationalRequirement(item))
        .filter(Boolean)
    };
  }

  private buildRequirementAssessmentDetails(
    requirements: Array<{ key: string; value: string; required: boolean }>,
    profileJson: unknown,
    cvDocumentContext: Record<string, unknown> | null
  ): RequirementAssessmentDetail[] {
    const evidenceCorpus = this.buildRequirementEvidenceCorpus(profileJson, cvDocumentContext);
    return requirements.map((item) => this.evaluateRequirementEvidence(item, evidenceCorpus));
  }

  private buildRequirementEvidenceCorpus(profileJson: unknown, cvDocumentContext: Record<string, unknown> | null) {
    const profile = toRecord(profileJson);
    const extractedFacts = toRecord(profile.extractedFacts);
    const normalizedSummary = toRecord(profile.normalizedSummary);

    return normalizeTurkishText([
      ...toArray(extractedFacts.skills).filter((item): item is string => typeof item === "string"),
      ...toArray(extractedFacts.recentRoles).filter((item): item is string => typeof item === "string"),
      ...toArray(extractedFacts.workHistorySignals).filter((item): item is string => typeof item === "string"),
      ...toArray(extractedFacts.sectorSignals).filter((item): item is string => typeof item === "string"),
      ...toArray(extractedFacts.certifications).filter((item): item is string => typeof item === "string"),
      ...toArray(extractedFacts.languages).filter((item): item is string => typeof item === "string"),
      ...toArray(normalizedSummary.likelyFitSignals).filter((item): item is string => typeof item === "string"),
      typeof normalizedSummary.shortSummary === "string" ? normalizedSummary.shortSummary : "",
      typeof normalizedSummary.coreWorkHistorySummary === "string"
        ? normalizedSummary.coreWorkHistorySummary
        : "",
      typeof cvDocumentContext?.textExcerpt === "string" ? cvDocumentContext.textExcerpt : ""
    ].join(" "));
  }

  private evaluateRequirementEvidence(
    requirement: { key: string; value: string; required: boolean },
    evidenceCorpus: string
  ): RequirementAssessmentDetail {
    const normalizedKey = normalizeTurkishText(requirement.key);
    const normalizedValue = normalizeTurkishText(requirement.value);

    const patternGroups = this.requirementPatternGroups(normalizedKey, normalizedValue);
    const evidence = patternGroups
      .filter((group) => group.pattern.test(evidenceCorpus))
      .map((group) => group.label);

    let status: RequirementAssessmentDetail["status"] = "absent";
    if (patternGroups.length > 0 && evidence.length >= Math.min(2, patternGroups.length)) {
      status = "proven";
    } else if (patternGroups.length > 0 && evidence.length === 1) {
      status = "partial";
    } else if (this.matchesRequirementEvidence(requirement.value, evidenceCorpus)) {
      status = "needs_validation";
    }

    if (patternGroups.length === 0) {
      status = this.matchesRequirementEvidence(requirement.value, evidenceCorpus)
        ? "needs_validation"
        : "absent";
    }

    return {
      key: requirement.key,
      value: requirement.value,
      required: requirement.required,
      status,
      evidence,
      reasoning: this.describeRequirementEvidence(status, evidence, requirement.value)
    };
  }

  private requirementPatternGroups(normalizedKey: string, normalizedValue: string) {
    const groups: Array<{ label: string; pattern: RegExp }> = [];

    if (/experience|deneyim/.test(normalizedKey)) {
      groups.push(
        { label: "performance marketing / paid media deneyimi", pattern: /(performance marketing|paid media|paid search|paid social|growth marketing|digital acquisition|performance marketing specialist|paid media specialist)/ },
        { label: "kidem veya yil sinyali", pattern: /(\b[4-9]\s*yil|\b1[0-9]\s*yil|senior|lead|manager|uzmani|specialist)/ }
      );
    }

    if (/lead|demand/.test(normalizedKey) || /lead generation|demand generation/.test(normalizedValue)) {
      groups.push(
        { label: "lead generation / demand generation", pattern: /(lead generation|demand generation|mql|sql|demo|pipeline|funnel|conversion optimization|donusum)/ }
      );
    }

    if (/analytics|attribution/.test(normalizedKey) || /ga4|gtm|attribution|rapor/.test(normalizedValue)) {
      groups.push(
        { label: "GA4 / analytics", pattern: /(ga4|google analytics 4|analytics)/ },
        { label: "GTM / tracking", pattern: /(gtm|tag manager|tracking|tag)/ },
        { label: "raporlama / attribution", pattern: /(attribution|dashboard|looker studio|reporting|raporlama)/ }
      );
    }

    if (/budget|butce/.test(normalizedKey) || /butce|optimizasyon/.test(normalizedValue)) {
      groups.push(
        { label: "butce / spend kaniti", pattern: /(butce|budget|media spend|m tl|tl medya butcesi|reklam butcesi)/ },
        { label: "optimizasyon / verimlilik", pattern: /(optimiz|optimization|roas|cac|cpl|cpa)/ }
      );
    }

    if (/hands_on/.test(normalizedKey) || /bireysel katk/i.test(normalizedValue)) {
      groups.push(
        { label: "hands-on execution", pattern: /(hands-on|bizzat|aktif olarak|ellerim kirlenmeye|kampanya optimize|hesaplarini bizzat optimize|kurdum|yonettim)/ },
        { label: "kampanya operasyonu", pattern: /(kampanya|ads|google|meta|linkedin)/ }
      );
    }

    if (/location/.test(normalizedKey) || /cekmekoy|hibrit|ofis/.test(normalizedValue)) {
      groups.push(
        { label: "hibrit / ofis katilimi", pattern: /(hibrit|hybrid|ofis|duzenli katilim|ofise gelebilirim)/ },
        { label: "ulasim / tasinma esnekligi", pattern: /(ulasim|tasinabilirim|relocation|istanbul'a tasinabilirim|duzenli gidip gelebilirim)/ }
      );
    }

    if (/work_model/.test(normalizedKey) || /remote-only/.test(normalizedValue)) {
      groups.push(
        { label: "hibrit veya ofis tercihi", pattern: /(hibrit|hybrid|ofis|remote disinda|uzaktan disinda)/ }
      );
    }

    if (/communication/.test(normalizedKey) || /satis|tasarim|urun/.test(normalizedValue)) {
      groups.push(
        { label: "satis ile koordinasyon", pattern: /(satis ekibi|sales)/ },
        { label: "tasarim veya urun ile koordinasyon", pattern: /(tasarim|design|urun|product|cross-functional|cross functional|ekiplerle)/ }
      );
    }

    if (/english/.test(normalizedKey) || /ingilizce/.test(normalizedValue)) {
      groups.push(
        { label: "ingilizce bilgisi", pattern: /(ingilizce|english|advanced english|fluent english)/ }
      );
    }

    return groups;
  }

  private describeRequirementEvidence(
    status: RequirementAssessmentDetail["status"],
    evidence: string[],
    requirementValue: string
  ) {
    if (status === "proven") {
      return evidence.length > 0
        ? `Gereksinim icin acik kanit bulundu: ${evidence.join(", ")}.`
        : "Gereksinim icin acik kanit bulundu.";
    }

    if (status === "partial") {
      return evidence.length > 0
        ? `Gereksinim kismen destekleniyor: ${evidence.join(", ")}.`
        : "Gereksinim kismen destekleniyor.";
    }

    if (status === "needs_validation") {
      return `Gereksinimle ilgili dolayli veya genel sinyal var; ayrinti recruiter tarafinda teyit edilmeli: ${requirementValue}.`;
    }

    return `Gereksinim icin belirgin kanit gorulmedi: ${requirementValue}.`;
  }

  private buildRoleDemandSummary(input: {
    jobContext: JobScoringContext;
    requirements: Array<{ key: string; value: string; required: boolean }>;
    locationAnalysis: LocationFitAnalysis;
  }) {
    return {
      title: input.jobContext.title,
      roleFamily: input.jobContext.roleFamily,
      coreRequirements: input.requirements
        .filter((item) => item.required && !this.isOperationalRequirementKey(item.key))
        .map((item) => item.value)
        .slice(0, 6),
      operationalRequirements: input.requirements
        .filter((item) => item.required && this.isOperationalRequirementKey(item.key))
        .map((item) => this.summarizeOperationalRequirementValue(item.key, item.value))
        .slice(0, 4),
      preferredSignals: input.requirements.filter((item) => !item.required).map((item) => item.value).slice(0, 4),
      workModelExpectation:
        input.locationAnalysis.presenceMode === "remote"
          ? "Rol uzaktan gorunuyor."
          : input.locationAnalysis.presenceMode === "hybrid"
            ? `Rol hibrit; haftalik ${input.locationAnalysis.officeDaysPerWeek ?? 3} gun civari fiziksel katilim bekleniyor.`
            : "Rol yerinde/fiziksel katilim bekliyor.",
      locationExpectation: `Operasyonel warning notu: ${this.buildOperationalLocationPromptWarning(input.locationAnalysis)} Bu not role-fit skorunu degil, recruiter follow-up alanini beslemelidir.`,
      locationCalibrationNotes: [
        `Commute siddeti: ${input.locationAnalysis.commuteSeverity}`,
        `Aday esnekligi: ${input.locationAnalysis.candidateFlexibility}`,
        `Lokasyon confidence: ${Math.round(input.locationAnalysis.locationConfidence * 100)}%`
      ]
    };
  }

  private buildScoreCalibrationGuide(jobContext: JobScoringContext) {
    const roleFamily = normalizeTurkishText(jobContext.roleFamily || "");

    if (roleFamily.includes("marketing") || /pazarlama|marketing|growth|paid|social/.test(normalizeTurkishText(jobContext.title))) {
      return {
        scoringPhilosophy: "Skor genel profesyonelligi degil, bu roldeki ise alinabilirlik derecesini olcmeli.",
        overallScoreAnchors: [
          "0-15: Rolle acikca alakasiz gecmis. Ornek: doktor, avukat veya ilgisiz operasyon gecmisi; pazarlama execution kaniti yok.",
          "16-39: Cok zayif uyum. Genel transfer edilebilir yetenekler olabilir ama cekirdek kanal veya kampanya deneyimi yok.",
          "40-54: Dusuk adjacent uyum. Yakin alan sinyali var ama role dogrudan execution kaniti zayif.",
          "55-68: Umut veren adjacent veya sinir aday. Role yakin, gorusmeye deger olabilir ama hala belirgin gap veya teyit ihtiyaci var.",
          "69-88: Guclu direct fit. Role dogrudan baglanan hands-on deneyim, ilgili kanal becerileri ve interview-worthy seviye mevcut.",
          "89-100: Cok guclu fit. Direct fit, tutarli execution kaniti, guclu sonuc alma sinyalleri ve dusuk kritik risk birlikte gorunuyor."
        ],
        categoryAnchors: [
          "Rol ve deneyim uyumu: Sadece role dogrudan baglanan yil ve gorevleri say; alakasiz alandaki uzun gecmis puani sisirmesin.",
          "Beceri ve arac uyumu: Google Ads, Meta Ads, LinkedIn Ads, GA4, GTM, paid social, reporting, campaign setup gibi cekirdek arac ve execution kanitlari yuksek puan sebebidir.",
          "Uygulama ve sonuc kaniti: Kampanya kurma, optimize etme, butce yonetme, lead generation veya olculebilir etki kaniti puani yukselten ana unsurdur.",
          "Lokasyon ve calisma modeli uyumu: Skoru belirleyen eksen degil, operasyonel warning boyutudur; deneyim ve becerinin yerine gecmez.",
          "Egitim ve sertifika uyumu: Dusuk agirlikli destek boyutudur; role-fit guclu adayi tek basina yukari veya asagi tasimaz."
        ],
        calibrationExamples: [
          "1-2 yil staj veya junior growth gecmisi + temel Meta/GA4 bilgisi + lokal aday: bu exact rolde genelde 16-39 bandinda kalir.",
          "Icerik/brand odakli ama paid/performance execution kaniti zayif aday: genelde 40-54 bandinda kalir.",
          "CRM/lifecycle veya analytics adjacent aday, B2B ve lead gen sinyali var ama butce/paid execution eksik: genelde 55-68 bandinda kalir.",
          "Ajans kokenli paid/performance aday, yakin donemde kampanya, butce ve optimizasyonu bizzat yonetmis ise genelde 72-88 bandinda olmalidir.",
          "Performance Marketing Manager title tasiyan ama hala kampanya hesaplarini bizzat optimize eden aday, direct-fit olarak 72+ bandinda kalabilir.",
          "Direct paid/performance marketer, aranan kanallar ve execution kaniti guclu, lokal veya makul commute aday: genelde 72-88 bandinda olmalidir.",
          "Direct fit cok guclu ama lokasyon ciddi riskli aday: direct-fit kaniti ve overall fit korunur; lokasyon recruiter warning'i ve operasyonel teyit ekseninde ele alinir."
        ],
        criticalReminders: [
          "Adayi daha uygun oldugu baska bir role gore degil, bu exact role gore puanla.",
          "Kanitin varligi ile derinligini ayir; capability varsa 'yok' gibi puanlama.",
          "Lokasyon avantaji weak-fit adayi kurtaramaz; lokasyon riski de strong direct-fit adayi tek basina ezmemeli.",
          "Lokasyon genelde warning ve operasyonel uygunluk sinyalidir; overall fit skorunun ana ekseni rol-fit'tir."
        ]
      };
    }

    return {
      scoringPhilosophy: "Skor, adayin bu role alinabilirlik ve role dogrudan yakinlik derecesini olcmeli.",
      overallScoreAnchors: [
        "0-20: Role acikca alakasiz gecmis",
        "21-39: Cok zayif uyum",
        "40-59: Kismi veya adjacent uyum",
        "60-69: Sinirda ama umut veren aday",
        "70-84: Guclu interview-worthy uyum",
        "85-100: Cok guclu, dusuk riskli direct fit"
      ],
      categoryAnchors: [
        "Alakasiz deneyim yil sayisi tek basina puan getirmez.",
        "Role dogrudan baglanan execution ve beceri kaniti yuksek puani hak eder.",
        "Eksik bilgi ile negatif risk ayni sey degildir."
      ]
    };
  }

  private buildCandidateEvidenceSnapshot(input: {
    extractedFacts: Record<string, unknown>;
    jobContext: JobScoringContext;
    requirementCoverage: RequirementCoverage;
    locationAnalysis: LocationFitAnalysis;
    cvDocumentContext: Record<string, unknown> | null;
  }) {
    const recentRoles = toArray(input.extractedFacts.recentRoles).filter(
      (item): item is string => typeof item === "string"
    );
    const sectorSignals = toArray(input.extractedFacts.sectorSignals).filter(
      (item): item is string => typeof item === "string"
    );
    const workHistorySignals = toArray(input.extractedFacts.workHistorySignals).filter(
      (item): item is string => typeof item === "string"
    );
    const skills = toArray(input.extractedFacts.skills).filter(
      (item): item is string => typeof item === "string"
    );
    const certifications = toArray(input.extractedFacts.certifications).filter(
      (item): item is string => typeof item === "string"
    );
    const languages = toArray(input.extractedFacts.languages).filter(
      (item): item is string => typeof item === "string"
    );

    const relevantRoles = this.uniqueList([
      ...recentRoles.filter((item) => this.signalMatchesJobContext(item, input.jobContext)),
      ...sectorSignals.filter((item) => this.signalMatchesJobContext(item, input.jobContext))
    ]).slice(0, 6);
    const relevantExecution = this.uniqueList(
      workHistorySignals.filter((item) => {
        const normalized = normalizeTurkishText(item);
        return this.signalMatchesJobContext(item, input.jobContext)
          || /kampanya|lead|donus|donusum|roas|cac|cpl|mql|sql|butce|optimiz|icerik|community|sosyal medya|rapor|dashboard|ga4|gtm|meta|google|linkedin/.test(
            normalized
          );
      })
    ).slice(0, 6);
    const relevantSkills = this.uniqueList(
      skills.filter((item) => this.signalMatchesJobContext(item, input.jobContext))
    ).slice(0, 6);
    const collaborationSignals = this.uniqueList(
      workHistorySignals.filter((item) => /ekip|satis|tasarim|urun|ajans|crm|isbir|cross/i.test(normalizeTurkishText(item)))
    ).slice(0, 4);
    const adjacentSignals = this.uniqueList([
      ...recentRoles.filter((item) => !this.signalMatchesJobContext(item, input.jobContext)),
      ...sectorSignals.filter((item) => !this.signalMatchesJobContext(item, input.jobContext)),
      ...skills.filter((item) => !this.signalMatchesJobContext(item, input.jobContext))
    ]).slice(0, 6);
    const provenCapabilityHints = this.buildProvenCapabilityHints({
      extractedFacts: input.extractedFacts,
      jobContext: input.jobContext,
      cvDocumentContext: input.cvDocumentContext
    });

    return {
      matchedRequired: input.requirementCoverage.matchedRequired.slice(0, 6),
      partialRequired: input.requirementCoverage.partialRequired.slice(0, 6),
      needsValidationRequired: input.requirementCoverage.needsValidationRequired.slice(0, 6),
      uncoveredRequired: input.requirementCoverage.uncoveredRequired.slice(0, 6),
      relevantRoleSignals: relevantRoles,
      relevantExecutionSignals: relevantExecution,
      relevantSkillSignals: relevantSkills,
      provenCapabilityHints,
      collaborationSignals,
      adjacentSignals,
      certificationSignals: certifications.slice(0, 4),
      languageSignals: languages.slice(0, 4),
      operationalLocationNote: {
        recruiterWarning: this.buildOperationalLocationPromptWarning(input.locationAnalysis),
        locationCategoryScoreHint: input.locationAnalysis.score,
        commuteSeverity: input.locationAnalysis.commuteSeverity,
        officeDaysPerWeek: input.locationAnalysis.officeDaysPerWeek,
        candidateFlexibility: input.locationAnalysis.candidateFlexibility,
        locationConfidence: input.locationAnalysis.locationConfidence,
        localitySummary: null,
        usePolicy: "Bu alan role-fit skorunu degil, recruiter warning anlatimini besler."
      },
      operationalRequirementWarnings: input.requirementCoverage.operationalWarnings.slice(0, 4),
      cvDocumentSummary: {
        hasDocumentText: Boolean(input.cvDocumentContext?.textExcerpt),
        extractionStatus: typeof input.cvDocumentContext?.status === "string" ? input.cvDocumentContext.status : null,
        charCount: typeof input.cvDocumentContext?.charCount === "number" ? input.cvDocumentContext.charCount : null
      }
    };
  }

  private buildProvenCapabilityHints(input: {
    extractedFacts: Record<string, unknown>;
    jobContext: JobScoringContext;
    cvDocumentContext: Record<string, unknown> | null;
  }) {
    const roleFamily = normalizeTurkishText(input.jobContext.roleFamily || "");
    const title = normalizeTurkishText(input.jobContext.title || "");
    const corpus = normalizeTurkishText([
      ...toArray(input.extractedFacts.recentRoles).filter((item): item is string => typeof item === "string"),
      ...toArray(input.extractedFacts.sectorSignals).filter((item): item is string => typeof item === "string"),
      ...toArray(input.extractedFacts.workHistorySignals).filter((item): item is string => typeof item === "string"),
      ...toArray(input.extractedFacts.skills).filter((item): item is string => typeof item === "string"),
      typeof input.cvDocumentContext?.textExcerpt === "string" ? input.cvDocumentContext.textExcerpt : ""
    ].join(" "));

    if (roleFamily.includes("marketing") || /marketing|pazarlama|performance|paid|social/.test(title)) {
      const hints: string[] = [];

      if (/(google ads|meta ads|linkedin ads|paid social|paid search|campaign setup|kampanya yonet|kampanya optimize)/.test(corpus)) {
        hints.push("Core paid media / campaign execution kaniti var");
      }

      if (/(lead generation|demand generation|mql|sql|demo|conversion|donusum|cpl|cac)/.test(corpus)) {
        hints.push("Lead generation / demand generation kaniti var");
      }

      if (/(ga4|google analytics 4|gtm|tag manager|attribution|dashboard|looker studio|reporting|raporlama)/.test(corpus)) {
        hints.push("Analytics, GA4, GTM veya raporlama kaniti var");
      }

      if (/(budget|butce|roas|optimizasyon|optimization|media spend|cpc|cpa)/.test(corpus)) {
        hints.push("Medya butcesi veya optimizasyon kaniti var");
      }

      if (/(satis|tasarim|urun|cross functional|cross-functional|crm|hubspot|ajans|agency|ekiplerle)/.test(corpus)) {
        hints.push("Cross-functional veya ajans isbirligi kaniti var");
      }

      if (/(hibrit calisabilirim|hybrid|ofise gelebilirim|tasinabilirim|istanbul'a tasinabilirim|relocation)/.test(corpus)) {
        hints.push("Hibrit katilim veya tasinma esnekligi kaniti var");
      }

      if (/(bizzat optimize|hands-on|ellerim kirlenmeye|bireysel katki|bizzat|aktif olarak yonetiyorum)/.test(corpus)) {
        hints.push("Hands-on bireysel katkici execution kaniti var");
      }

      return hints;
    }

    return [];
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
    const tokens = normalizeTurkishText(requirement)
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

  private sanitizeRisks(
    items: string[],
    missingInformation: string[],
    locationAnalysis: LocationFitAnalysis
  ) {
    const blockedPatterns = [
      /\bdil\b/i,
      /yüksek lisans/i
    ];

    return this.uniqueList(this.dedupeByMeaning(items)
      .map((item) => this.canonicalizeRisk(this.normalizeWarningText(item), locationAnalysis))
      .filter(Boolean)
      .filter((item) => !blockedPatterns.some((pattern) => pattern.test(item)))
      .filter((item) => !this.looksLikeMissingInformation(item))
      .filter((item) => !missingInformation.some((missing) => this.warningOverlap(item, missing))));
  }

  private sanitizeMissingInformation(items: string[], locationAnalysis: LocationFitAnalysis) {
    return this.dedupeByMeaning(items)
      .map((item) => this.normalizeWarningText(item))
      .filter(Boolean)
      .filter((item) => !this.looksLikeLocationSignal(item, locationAnalysis));
  }

  private sanitizeUncertaintyReasons(items: string[], locationAnalysis: LocationFitAnalysis) {
    const hasCandidateLocation = Boolean(locationAnalysis.candidateLocationText?.trim());
    return this.uniqueList(items)
      .map((item) => this.normalizeWarningText(item))
      .filter(Boolean)
      .filter((item) => {
        if (!hasCandidateLocation) {
          return true;
        }

        const normalized = normalizeTurkishText(item);
        return !/lokasyon.*belirtilmem|adayin lokasyonu belirtilmem/.test(normalized);
      });
  }

  private sanitizeCategoryReasoning(
    categoryKey: string,
    reasoning: string,
    locationAnalysis: LocationFitAnalysis
  ) {
    if (!this.isLocationCategory({ key: categoryKey, label: categoryKey })) {
      return reasoning;
    }

    const trimmed = reasoning.trim();
    const normalized = normalizeTurkishText(trimmed);
    if (!trimmed) {
      return this.buildLocationCategoryReasoning(locationAnalysis);
    }

    if (locationAnalysis.candidateLocationText && /lokasyon.*belirtilmem|adayin lokasyonu belirtilmem/.test(normalized)) {
      return this.buildLocationCategoryReasoning(locationAnalysis);
    }

    return reasoning;
  }

  private sanitizeStrengths(
    items: string[],
    locationAnalysis: LocationFitAnalysis,
    jobContext: JobScoringContext
  ) {
    const normalized = this.dedupeByMeaning(items)
      .map((item) => this.normalizeWarningText(item))
      .filter(Boolean)
      .filter((item) => !this.looksLikeIrrelevantCertificationStrength(item, jobContext))
      .filter((item) => !this.looksRoleIrrelevantStrength(item, jobContext));

    return normalized.filter((item) => !this.looksLikeLocationSignal(item, locationAnalysis));
  }

  private looksRoleIrrelevantStrength(item: string, jobContext: JobScoringContext) {
    const normalized = normalizeTurkishText(item);
    const looksDomainSpecific =
      /\bdeneyim|tecrube|sektor|yonetim|gorev|rol|uzman|icerik|pazarlama|satis|hekim|klinik|lojistik|perakende|depo|operasyon|musteri\b/.test(
        normalized
      );

    if (!looksDomainSpecific) {
      return false;
    }

    return !this.signalMatchesJobContext(item, jobContext);
  }

  private humanizeDeterministicSignals(signals: string[]) {
    return this.uniqueList(signals.map((signal) => {
      const key = signal.split(":")[0]?.trim();
      switch (key) {
        case "recentRoles":
          return "Is gecmisinde role yakin gorev sinyali var";
        case "sectorSignals":
          return "Ilgili sektorde deneyim sinyali var";
        case "workHistorySignals":
          return "Is gecmisi yeterli deneyim detayi iceriyor";
        case "skills":
          return "Pozisyona yakin beceriler tespit edildi";
        case "certifications":
          return "Ilgili belge veya sertifika sinyali var";
        case "educationSummary":
          return "Egitim gecmisi belirtilmis";
        case "contactInfo":
          return "Iletisim bilgileri mevcut";
        case "languages":
          return "Dil bilgileri belirtilmis";
        default:
          return "";
      }
    }).filter(Boolean));
  }

  private selectRelevantSignalValue(input: {
    signalKey: string;
    category: RubricCategory;
    extractedFacts: Record<string, unknown>;
    jobContext: JobScoringContext;
  }) {
    const signalValue = input.extractedFacts[input.signalKey];
    const categoryDescriptor = `${input.category.key} ${input.category.label}`;

    if ((input.signalKey === "certifications" || input.signalKey === "skills")
      && /sertifika|belge|certificate/i.test(categoryDescriptor)
      && !this.jobExplicitlyValuesCertification(input.jobContext)) {
      if (input.signalKey === "certifications") {
        return [];
      }

      if (Array.isArray(signalValue)) {
        return signalValue.filter((item) => typeof item === "string" && !/ehliyet|src|forklift/i.test(item));
      }
    }

    if (input.signalKey === "estimatedYearsOfExperience" && /deneyim/i.test(categoryDescriptor)) {
      if (!this.hasRoleRelevantExperienceEvidence(input.extractedFacts, input.jobContext)) {
        return null;
      }
    }

    if (
      Array.isArray(signalValue) &&
      ["recentRoles", "sectorSignals", "workHistorySignals", "skills"].includes(input.signalKey)
    ) {
      const relevantSignals = signalValue.filter(
        (item): item is string =>
          typeof item === "string" && this.signalMatchesJobContext(item, input.jobContext)
      );

      if (relevantSignals.length > 0) {
        return relevantSignals;
      }

      if (["recentRoles", "sectorSignals", "skills"].includes(input.signalKey)) {
        return [];
      }
    }

    return signalValue;
  }

  private hasRoleRelevantExperienceEvidence(
    extractedFacts: Record<string, unknown>,
    jobContext: JobScoringContext
  ) {
    const evidenceSignals = [
      ...toArray(extractedFacts.recentRoles).filter((item): item is string => typeof item === "string"),
      ...toArray(extractedFacts.sectorSignals).filter((item): item is string => typeof item === "string"),
      ...toArray(extractedFacts.workHistorySignals).filter((item): item is string => typeof item === "string")
    ];

    return evidenceSignals.some((item) => this.signalMatchesJobContext(item, jobContext));
  }

  private signalMatchesJobContext(value: string, jobContext: JobScoringContext) {
    const jobTokens = this.jobRelevanceTokens(jobContext);
    if (jobTokens.length === 0) {
      return true;
    }

    const valueTokens = normalizeTurkishText(value)
      .split(/[^a-z0-9]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
      .filter((item) => !this.ignoredJobRelevanceTokens().has(item));

    if (valueTokens.length === 0) {
      return false;
    }

    const matchedTokens = valueTokens.filter((token) => jobTokens.includes(token));
    if (valueTokens.length === 1) {
      return matchedTokens.length === 1;
    }

    return matchedTokens.length >= Math.min(2, valueTokens.length);
  }

  private jobRelevanceTokens(jobContext: JobScoringContext) {
    return [...new Set(
      normalizeTurkishText([
        jobContext.title,
        jobContext.jdText ?? "",
        jobContext.requirementTexts.join(" ")
      ].join(" "))
        .split(/[^a-z0-9]+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 3)
        .filter((item) => !this.ignoredJobRelevanceTokens().has(item))
    )];
  }

  private ignoredJobRelevanceTokens() {
    return new Set([
      "ve",
      "ile",
      "icin",
      "olan",
      "gore",
      "uyum",
      "deneyim",
      "tecrube",
      "tecrubesi",
      "uzman",
      "uzmani",
      "kidemli",
      "junior",
      "senior",
      "yonetim",
      "yonetici",
      "uzaktan",
      "hibrit",
      "remote",
      "ofis",
      "office",
      "tam",
      "zamanli",
      "yari",
      "ekip",
      "birim",
      "rol",
      "pozisyon",
      "personel",
      "personeli",
      "aday",
      "teknik",
      "beceri",
      "yetkinlik",
      "sorumluluk",
      "alan",
      "bolum",
      "departman",
      "iletisim"
    ]);
  }

  private uniqueList(items: string[]) {
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  }

  private dedupeByMeaning(items: string[]) {
    const deduped: string[] = [];

    for (const item of this.uniqueList(items.map((entry) => this.normalizeWarningText(entry)).filter(Boolean))) {
      const existingIndex = deduped.findIndex((existing) => this.warningOverlap(existing, item));
      if (existingIndex === -1) {
        deduped.push(item);
        continue;
      }

      const existing = deduped[existingIndex];
      if (!existing || item.length > existing.length) {
        deduped[existingIndex] = item;
      }
    }

    return deduped;
  }

  private pruneConflictingStrengths(strengths: string[], risks: string[]) {
    return this.dedupeByMeaning(strengths).filter((strength) => !risks.some((risk) => {
      if (this.warningOverlap(strength, risk)) {
        return true;
      }

      const overlappingTokens = this.warningTokens(strength).filter((token) => this.warningTokens(risk).includes(token));
      if (overlappingTokens.length === 0) {
        return false;
      }

      return /(sinirli|yetersiz|orta|zayif|eksik|gecis|olmayabilir|uyumsuz|zor)/i.test(
        normalizeTurkishText(risk)
      );
    }));
  }

  private clampScore(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, Math.round(value)));
  }

  private clampConfidence(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return 0;
    }

    const normalized = value > 1 ? value / 100 : value;
    return Math.min(1, Math.max(0, normalized));
  }

  private calibrateAssessmentConfidence(input: {
    aiConfidence: number | null | undefined;
    parseConfidence: number | null | undefined;
    extractionStatus: string | null | undefined;
    missingInformationCount: number;
    uncertaintyReasonCount: number;
    documentCharCount: number | null | undefined;
    categoryScores: Array<{
      confidence: number;
      strengths: string[];
      risks: string[];
      reasoning: string;
    }>;
  }) {
    const aiConfidence = this.clampConfidence(input.aiConfidence);
    const parseConfidence = this.clampConfidence(input.parseConfidence);
    const categoryConfidences = input.categoryScores
      .map((category) => this.clampConfidence(category.confidence))
      .filter((value) => Number.isFinite(value));
    const averageCategoryConfidence = categoryConfidences.length > 0
      ? categoryConfidences.reduce((sum, value) => sum + value, 0) / categoryConfidences.length
      : aiConfidence;
    const lowConfidenceCategoryCount = categoryConfidences.filter((value) => value < 0.45).length;
    const reasoningCoverageCount = input.categoryScores.filter((category) => category.reasoning.trim().length > 0).length;
    const evidenceSignalCount = this.uniqueList(
      input.categoryScores.flatMap((category) => [...category.strengths, ...category.risks])
    ).length;

    let score = aiConfidence * 0.42 + averageCategoryConfidence * 0.34 + parseConfidence * 0.24;

    if (input.extractionStatus && input.extractionStatus !== "EXTRACTED") {
      score -= input.extractionStatus === "PARTIAL" ? 0.06 : 0.12;
    }

    if (input.documentCharCount != null) {
      if (input.documentCharCount >= 3200) {
        score += 0.03;
      } else if (input.documentCharCount >= 1600) {
        score += 0.015;
      } else if (input.documentCharCount > 0 && input.documentCharCount < 700) {
        score -= 0.04;
      }
    }

    if (evidenceSignalCount >= 8) {
      score += 0.05;
    } else if (evidenceSignalCount >= 4) {
      score += 0.02;
    } else if (evidenceSignalCount <= 1) {
      score -= 0.06;
    }

    if (reasoningCoverageCount === input.categoryScores.length && input.categoryScores.length > 0) {
      score += 0.02;
    } else if (reasoningCoverageCount <= 1) {
      score -= 0.05;
    }

    if (input.missingInformationCount >= 5) {
      score -= 0.14;
    } else if (input.missingInformationCount >= 3) {
      score -= 0.08;
    } else if (input.missingInformationCount >= 1) {
      score -= 0.03;
    }

    if (input.uncertaintyReasonCount >= 4) {
      score -= 0.1;
    } else if (input.uncertaintyReasonCount >= 2) {
      score -= 0.05;
    }

    if (lowConfidenceCategoryCount >= 3) {
      score -= 0.08;
    } else if (lowConfidenceCategoryCount >= 1) {
      score -= 0.04;
    }

    return this.clampConfidence(score);
  }

  private slugifyDimensionKey(value: string) {
    const normalized = normalizeTurkishText(value)
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    return normalized || "dimension";
  }

  private normalizeWarningText(item: string) {
    return item
      .replace(/\s+/g, " ")
      .replace(/[.:;,]+$/g, "")
      .trim();
  }

  private looksLikeMissingInformation(item: string) {
    return /(eksik|belirtilmem|bilgisi yok|bilgi yok|teyit|dogrula|net degil|durumu|mevcut degil)/i.test(
      normalizeTurkishText(item)
    );
  }

  private warningOverlap(left: string, right: string) {
    const leftTokens = this.warningTokens(left);
    const rightTokens = this.warningTokens(right);
    if (leftTokens.length === 0 || rightTokens.length === 0) {
      return false;
    }

    const overlap = leftTokens.filter((token) => rightTokens.includes(token));
    return overlap.length >= Math.min(2, Math.min(leftTokens.length, rightTokens.length));
  }

  private warningTokens(value: string) {
    const ignored = new Set([
      "aday",
      "bilgi",
      "bilgisi",
      "eksik",
      "risk",
      "uyari",
      "kritik",
      "durumu",
      "teyit",
      "dogrula",
      "gerekiyor",
      "olabilir",
      "hakkinda",
      "konusunda",
      "icin",
      "ve",
      "ile",
      "yok",
      "mevcut",
      "degil"
    ]);

    return [...new Set(
      normalizeTurkishText(value)
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2 && !ignored.has(token))
    )];
  }

  private canonicalizeRisk(item: string, locationAnalysis: LocationFitAnalysis) {
    if (this.looksLikeLocationSignal(item, locationAnalysis) && locationAnalysis.risks[0]) {
      return locationAnalysis.risks[0];
    }

    return item;
  }

  private looksLikeLocationSignal(item: string, locationAnalysis: LocationFitAnalysis) {
    const normalized = normalizeTurkishText(item);
    if (/lokasyon|sehir|ilce|bolge/.test(normalized)) {
      return true;
    }

    const locationTexts = [locationAnalysis.candidateLocationText, locationAnalysis.jobLocationText]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => this.warningTokens(value));

    return locationTexts.some((token) => normalized.includes(token));
  }

  private looksLikeIrrelevantCertificationStrength(item: string, jobContext: JobScoringContext) {
    if (!/ehliyet|src|forklift|belge|sertifika/i.test(item)) {
      return false;
    }

    return !this.jobExplicitlyValuesCertification(jobContext);
  }

  private jobExplicitlyValuesCertification(jobContext: JobScoringContext) {
    const corpus = normalizeTurkishText([
      jobContext.title,
      jobContext.jdText ?? "",
      jobContext.requirementTexts.join(" ")
    ].join(" "));

    return /\behliyet\b|\bsrc\b|forklift|reach truck|transpalet|surucu|sofor|sevkiyat|dagitim|arac/i.test(corpus);
  }

  // ── Rubric loading ──

  private async loadRubric(tenantId: string, taskRunId: string, roleFamily: string) {
    const run = await this.prisma.aiTaskRun.findUnique({
      where: { id: taskRunId },
      select: { rubricId: true }
    });

    if (run?.rubricId) {
      const byId = await this.prisma.scoringRubric.findFirst({
        where: { id: run.rubricId, tenantId, isActive: true }
      });
      if (byId) return byId;
    }

    const aliases = this.resolveRoleFamilyAliases(roleFamily);
    const roleSpecificAliases = aliases.filter((domain) => domain !== "genel");

    for (const domain of roleSpecificAliases) {
      const byRole = await this.prisma.scoringRubric.findFirst({
        where: { tenantId, domain, isActive: true },
        orderBy: { version: "desc" }
      });

      if (byRole) {
        return byRole;
      }
    }

    const hasRoleSpecificDefault = roleSpecificAliases.some((domain) => Boolean(DEFAULT_RUBRICS[domain]));
    if (hasRoleSpecificDefault) {
      return null;
    }

    return this.prisma.scoringRubric.findFirst({
      where: { tenantId, domain: "genel", isActive: true },
      orderBy: { version: "desc" }
    });
  }

  private getDefaultRubric(roleFamily: string): FitScoringRubric {
    for (const alias of this.resolveRoleFamilyAliases(roleFamily)) {
      if (DEFAULT_RUBRICS[alias]) {
        return DEFAULT_RUBRICS[alias] as FitScoringRubric;
      }
    }

    return DEFAULT_RUBRICS["genel"] as FitScoringRubric;
  }

  private normalizeRubricStructure(rubric: FitScoringRubric, roleFamily: string): FitScoringRubric {
    const aliases = this.resolveRoleFamilyAliases(roleFamily);

    if (aliases.includes("marketing")) {
      const marketingRubric = DEFAULT_RUBRICS["marketing"] as FitScoringRubric;
      return {
        ...marketingRubric,
        categories: marketingRubric.categories.map((category) => ({
          ...category
        }))
      };
    }

    return rubric;
  }

  private resolveRoleFamilyAliases(roleFamily: string) {
    const normalized = normalizeTurkishText(roleFamily ?? "").trim();
    const aliases = new Set<string>();

    if (normalized.length > 0) {
      aliases.add(normalized);
    }

    if (/pazarlama|marketing|growth|performance|dijital/.test(normalized)) {
      aliases.add("marketing");
      aliases.add("pazarlama");
    }

    if (/depo|lojistik|warehouse/.test(normalized)) {
      aliases.add("warehouse");
    }

    if (/perakende|magaza|retail/.test(normalized)) {
      aliases.add("retail");
    }

    aliases.add("genel");
    return [...aliases];
  }

  private ensureLocationCategory(rubric: FitScoringRubric, jobLocationText?: string | null): FitScoringRubric {
    if (!jobLocationText?.trim()) {
      return rubric;
    }

    if (rubric.categories.some((category) => this.isLocationCategory(category))) {
      return rubric;
    }

    return {
      ...rubric,
      categories: [
        ...rubric.categories,
        {
          key: "lokasyon_uyumu",
          label: "Lokasyon Uyumu",
          weight: 0,
          description: "Aday lokasyonunun is yeriyle il ve ilce-bolge bazinda uyumu",
          deterministicSignals: ["locationSignals"],
          scoringGuidance: "Lokasyon operasyonel bir warning boyutudur; ayni ilce veya ayni bolge olumlu operasyonel sinyal olabilir ama overall fit skorunu etkilemez. Farkli il veya ulke ise recruiter warning'i ve fiziksel uygunluk teyidi odakli ele alinir"
        }
      ]
    };
  }

  private isLocationCategory(category: Pick<RubricCategory, "key" | "label">) {
    return /lokasyon|location/i.test(category.key) || /lokasyon|location/i.test(category.label);
  }

  private composeOverallAssessment(baseAssessment: string, _locationAnalysis: LocationFitAnalysis) {
    return baseAssessment.trim();
  }

  private isOperationalRequirementKey(key: string) {
    const normalized = normalizeTurkishText(key ?? "");
    return normalized === "location"
      || normalized === "work_model"
      || /lokasyon|location|work_model|calisma modeli|calisma_modeli|remote|hibrit/.test(normalized);
  }

  private describeOperationalRequirement(detail: RequirementAssessmentDetail) {
    if (detail.status === "proven") {
      return "";
    }

    const normalizedKey = normalizeTurkishText(detail.key);
    if (/lokasyon|location/.test(normalizedKey)) {
      return "Lokasyon ve fiziksel katilim konusu recruiter tarafinda teyit edilmeli.";
    }

    if (/work_model|calisma modeli|calisma_modeli|remote|hibrit/.test(normalizedKey)) {
      return "Calisma modeli ve ofis ritmi recruiter tarafinda teyit edilmeli.";
    }

    return "Operasyonel uygunluk teyidi gerekli.";
  }

  private summarizeOperationalRequirementValue(key: string, value: string) {
    const normalizedKey = normalizeTurkishText(key);
    const normalizedValue = normalizeTurkishText(value);

    if (/lokasyon|location/.test(normalizedKey)) {
      return "Rol fiziksel katilim gerektiren bir lokasyon beklentisi tasiyor.";
    }

    if (/work_model|calisma modeli|calisma_modeli|remote|hibrit/.test(normalizedKey)) {
      return /remote-only|remote only|uzaktan disinda/.test(normalizedValue)
        ? "Rol remote-only uygun degildir; hibrit veya ofis ritmi beklenir."
        : "Rolun calisma modeli hibrit veya ofis katilimi beklentisi iceriyor.";
    }

    return "Operasyonel uygunluk beklentisi mevcut.";
  }

  private sanitizeJobDescriptionForFitPrompt(jdText: string | null | undefined) {
    if (typeof jdText !== "string" || jdText.trim().length === 0) {
      return jdText ?? null;
    }

    const sentences = jdText
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const filtered = sentences.filter((sentence) => {
      const normalized = normalizeTurkishText(sentence);
      return !/(cekmekoy|istanbul|lokasyon|hibrit|hybrid|remote-only|remote only|ofis|fiziksel katilim|haftada [0-9]+ gun|gun remote)/.test(
        normalized
      );
    });

    const sanitized = (filtered.length > 0 ? filtered : sentences).join(" ").trim();
    return sanitized.length > 0 ? sanitized : jdText;
  }

  private buildOperationalLocationPromptWarning(locationAnalysis: LocationFitAnalysis) {
    if (locationAnalysis.presenceMode === "remote") {
      return "Rol uzaktan gorundugu icin lokasyon ikincil bir operasyonel not olarak ele alinmali.";
    }

    if (locationAnalysis.mismatchLevel === "same_locality") {
      return "Fiziksel katilim acisindan belirgin bir lokasyon engeli sinyali yok; yine de recruiter teyidi yapilabilir.";
    }

    if (locationAnalysis.mismatchLevel === "same_city") {
      return locationAnalysis.commuteSeverity === "minimal" || locationAnalysis.commuteSeverity === "light"
        ? "Ayni sehir icinde yonetilebilir bir fiziksel katilim riski gorunuyor; gerekirse recruiter teyidi yapilabilir."
        : "Ayni sehir icinde ama commute yuku recruiter tarafinda teyit edilmesi gereken bir operasyonel not olarak ele alinmali.";
    }

    if (locationAnalysis.mismatchLevel === "cross_city" || locationAnalysis.mismatchLevel === "cross_country") {
      return "Fiziksel katilim gerektiren duzende lokasyon operasyonel teyit gerektiriyor; bunu role-fit yerine recruiter warning'i olarak ele al.";
    }

    return "Lokasyon bilgisi role-fit yerine operasyonel warning olarak ele alinmali.";
  }

  private buildLocationCategoryReasoning(locationAnalysis: LocationFitAnalysis) {
    const candidateLocation = locationAnalysis.candidateLocationText?.trim();
    const jobLocation = locationAnalysis.jobLocationText?.trim();

    if (!candidateLocation) {
      return "Adayin lokasyonu CV veya profil verisinde net gorunmuyor; hibrit duzen icin recruiter teyidi gerekir.";
    }

    if (locationAnalysis.presenceMode === "remote") {
      return `Adayin lokasyonu ${candidateLocation}. Rol uzaktan gorundugu icin lokasyon ikincil bir operasyonel not olarak ele alinmali.`;
    }

    if (locationAnalysis.mismatchLevel === "same_locality") {
      return `Adayin lokasyonu ${candidateLocation}. Is lokasyonu${jobLocation ? ` ${jobLocation}` : ""} ile operasyonel olarak guclu uyum gosteriyor.`;
    }

    if (locationAnalysis.mismatchLevel === "same_city") {
      return locationAnalysis.commuteSeverity === "minimal" || locationAnalysis.commuteSeverity === "light"
        ? `Adayin lokasyonu ${candidateLocation}. Ayni sehir icinde ve hibrit duzen icin yonetilebilir gorunuyor.`
        : `Adayin lokasyonu ${candidateLocation}. Ayni sehirde olsa da duzenli ofis yolculugu recruiter tarafinda teyit edilmelidir.`;
    }

    if (locationAnalysis.mismatchLevel === "cross_city" || locationAnalysis.mismatchLevel === "cross_country") {
      return `Adayin lokasyonu ${candidateLocation}. Hibrit veya ofis gerektiren duzen icin operasyonel teyit gerekir; bu not role-fit yerine warning olarak ele alinmalidir.`;
    }

    return `Adayin lokasyonu ${candidateLocation}. Lokasyon bilgisi operasyonel bir follow-up konusu olarak ele alinmalidir.`;
  }

  private buildFitPromptLocationContext(
    application: {
      candidate: { locationText: string | null };
      job: { locationText: string | null; shiftType: string | null };
    },
    locationAnalysis: LocationFitAnalysis
  ) {
    return {
      candidateLocationProvided: Boolean(application.candidate.locationText?.trim()),
      candidateLocationText: application.candidate.locationText,
      jobLocationText: application.job.locationText,
      workModel: application.job.shiftType,
      mismatchLevel: locationAnalysis.mismatchLevel,
      commuteSeverity: locationAnalysis.commuteSeverity,
      recruiterWarning: this.buildOperationalLocationPromptWarning(locationAnalysis),
      guidance: "Bu alan sadece lokasyon ve calisma modeli uyumu kategorisi ile ilgili reasoning ve uncertainty icindir; role, beceri ve execution skorlarinin yerine gecmez."
    };
  }

  private buildFitPromptProfile(input: {
    profileJson: Record<string, unknown>;
    locationAnalysis: LocationFitAnalysis;
    parseConfidence: unknown;
    extractionStatus: unknown;
  }) {
    const locationTerms = this.buildLocationRedactionTerms({
      locationAnalysis: input.locationAnalysis,
      extractedFacts: toRecord(input.profileJson.extractedFacts)
    });
    const extractedFacts = {
      ...toRecord(input.profileJson.extractedFacts),
      locationSignals: []
    };

    return {
      extractedFacts: this.redactLocationMentionsInUnknown(extractedFacts, locationTerms),
      normalizedSummary: this.redactLocationMentionsInUnknown(
        toRecord(input.profileJson.normalizedSummary),
        locationTerms
      ),
      inferredObservations: this.redactLocationMentionsInUnknown(
        toRecord(input.profileJson).inferredObservations ?? null,
        locationTerms
      ),
      missingCriticalInformation: this.redactLocationMentionsInUnknown(
        toRecord(input.profileJson).missingCriticalInformation ?? null,
        locationTerms
      ),
      parseConfidence: input.parseConfidence,
      extractionStatus: input.extractionStatus
    };
  }

  private buildFitPromptCvDocumentContext(
    cvDocumentContext: Record<string, unknown> | null,
    locationAnalysis: LocationFitAnalysis
  ) {
    if (!cvDocumentContext) {
      return null;
    }

    const locationTerms = this.buildLocationRedactionTerms({
      locationAnalysis,
      extractedFacts: {}
    });

    return this.redactLocationMentionsInUnknown(cvDocumentContext, locationTerms);
  }

  private toGenericOperationalLocationRisks(locationAnalysis: LocationFitAnalysis) {
    if (locationAnalysis.presenceMode === "remote" || locationAnalysis.risks.length === 0) {
      return [];
    }

    if (locationAnalysis.mismatchLevel === "same_locality") {
      return [];
    }

    if (locationAnalysis.mismatchLevel === "same_city") {
      return ["Fiziksel katilim gerektiren duzende commute teyidi gerekebilir."];
    }

    return ["Fiziksel katilim gerektiren duzende operasyonel lokasyon teyidi gerekebilir."];
  }

  private toGenericOperationalLocationMissingInfo(locationAnalysis: LocationFitAnalysis) {
    if (locationAnalysis.presenceMode === "remote" || locationAnalysis.missingInformation.length === 0) {
      return [];
    }

    return ["Fiziksel katilim ritmi recruiter tarafinda teyit edilmeli."];
  }

  private buildLocationRedactionTerms(input: {
    locationAnalysis: LocationFitAnalysis;
    extractedFacts: Record<string, unknown>;
  }) {
    const rawTerms = [
      input.locationAnalysis.candidateLocationText,
      input.locationAnalysis.jobLocationText,
      input.locationAnalysis.localitySummary,
      ...toArray(input.extractedFacts.locationSignals).filter((item): item is string => typeof item === "string")
    ]
      .flatMap((value) =>
        typeof value === "string"
          ? value
              .split(/[\\/,\-|()]/)
              .map((item) => item.trim())
              .filter((item) => item.length >= 3)
          : []
      )
      .filter(Boolean);

    return this.uniqueList(rawTerms)
      .filter((item) => !/^(hibrit|hybrid|remote|ofis|onsite)$/i.test(item))
      .sort((left, right) => right.length - left.length);
  }

  private redactLocationMentionsInUnknown(value: unknown, terms: string[]): unknown {
    if (typeof value === "string") {
      return this.redactLocationMentionsInString(value, terms);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactLocationMentionsInUnknown(item, terms));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
          key,
          key === "locationSignals"
            ? []
            : this.redactLocationMentionsInUnknown(entry, terms)
        ])
      );
    }

    return value;
  }

  private redactLocationMentionsInString(value: string, terms: string[]) {
    let next = value;
    for (const term of terms) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      next = next.replace(new RegExp(escaped, "gi"), "[lokasyon]");
    }

    return next;
  }

  private analyzeLocationFit(input: {
    candidateLocationText?: string | null;
    extractedLocationSignals: string[];
    jobLocationText?: string | null;
    jobShiftType?: string | null;
    jobDescription?: string | null;
    jobRequirementTexts?: string[];
    candidateProfileText?: string | null;
  }): LocationFitAnalysis {
    const jobLocationText = input.jobLocationText?.trim() || null;
    const candidateLocationText = input.candidateLocationText?.trim()
      || input.extractedLocationSignals.find((item) => item.trim().length > 0)
      || null;
    const presenceMode = this.inferJobPresenceMode({
      shiftType: input.jobShiftType,
      jobLocationText,
      jobDescription: input.jobDescription,
      requirementTexts: input.jobRequirementTexts ?? []
    });
    const officeDaysPerWeek = this.inferOfficeDaysPerWeek({
      shiftType: input.jobShiftType,
      jobDescription: input.jobDescription,
      requirementTexts: input.jobRequirementTexts ?? [],
      presenceMode
    });
    const candidateFlexibility = this.inferCandidateFlexibility(input.candidateProfileText);

    if (!jobLocationText) {
      return {
        score: presenceMode === "remote" ? 84 : 70,
        reasoning: presenceMode === "remote"
          ? "Rol uzaktan gorundugu icin lokasyon bilgisi ikincil degerlendirildi."
          : "Ilan lokasyonu belirtilmedigi icin lokasyon uyumu notr degerlendirildi.",
        strengths: [],
        risks: [],
        missingInformation: [],
        candidateLocationText,
        jobLocationText: null,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "ambiguous",
        commuteSeverity: "unknown",
        officeDaysPerWeek,
        locationConfidence: 0.32,
        localitySummary: null
      };
    }

    if (!candidateLocationText) {
      return {
        score: presenceMode === "remote" ? 82 : 60,
        reasoning: presenceMode === "remote"
          ? "Rol uzaktan gorundugu icin aday lokasyonu kritik degil; yine de ekip ve saat uyumu teyit edilmeli."
          : "Adayin guncel lokasyonu CV'de net gorunmedigi icin lokasyon uyumu sinirli degerlendirildi.",
        strengths: [],
        risks: [],
        missingInformation: presenceMode === "remote"
          ? ["Adayin calisma saatleri ve ekip ile senkronizasyon uygunlugu teyit edilmeli"]
          : ["Adayin guncel lokasyonu veya calisabilecegi bolge teyit edilmeli"],
        candidateLocationText: null,
        jobLocationText,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "ambiguous",
        commuteSeverity: "unknown",
        officeDaysPerWeek,
        locationConfidence: 0.42,
        localitySummary: null
      };
    }

    if (presenceMode === "remote") {
      return {
        score: 84,
        reasoning: `Rol uzaktan gorundugu icin adayin ${candidateLocationText} lokasyonunda olmasi tek basina risk sayilmadi.`,
        strengths: [],
        risks: [],
        missingInformation: [],
        candidateLocationText,
        jobLocationText,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "ambiguous",
        commuteSeverity: "unknown",
        officeDaysPerWeek,
        locationConfidence: 0.78,
        localitySummary: null
      };
    }

    const normalizedJob = normalizeTurkishText(jobLocationText);
    const normalizedCandidate = normalizeTurkishText(candidateLocationText);
    const jobCity = this.inferLocationCity(normalizedJob);
    const candidateCity = this.inferLocationCity(normalizedCandidate);
    const jobCountry = this.inferLocationCountry(normalizedJob, jobCity);
    const candidateCountry = this.inferLocationCountry(normalizedCandidate, candidateCity);
    const jobLocalities = this.extractLocationTokens(normalizedJob, jobCity);
    const candidateLocalities = this.extractLocationTokens(normalizedCandidate, candidateCity);
    const sharedLocalities = jobLocalities.filter((token) => candidateLocalities.includes(token));
    const jobPrimaryLocality = this.pickPrimaryLocality(jobLocalities);
    const candidatePrimaryLocality = this.pickPrimaryLocality(candidateLocalities);
    const localitySummary = [jobPrimaryLocality, candidatePrimaryLocality]
      .filter((item): item is string => Boolean(item))
      .map((item) => this.toDisplayLocation(item))
      .join(" / ") || null;

    if (sharedLocalities.length > 0) {
      return {
        score: 95,
        reasoning: `Adayin lokasyonu is lokasyonuyla ayni bolgede gorunuyor (${jobLocationText} / ${candidateLocationText}).`,
        strengths: [`Lokasyon ayni bolgeye isaret ediyor: ${candidateLocationText}`],
        risks: [],
        missingInformation: [],
        candidateLocationText,
        jobLocationText,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "same_locality",
        commuteSeverity: "minimal",
        officeDaysPerWeek,
        locationConfidence: 0.96,
        localitySummary
      };
    }

    if (jobCountry === "tr" && candidateCountry === "foreign") {
      const relocationNote = candidateFlexibility === "relocation_open"
        ? " CV'de tasinma veya yer degistirme esnekligi sinyali bulundugu icin bu risk kismen yumusuyor."
        : "";
      const score = this.buildCrossCountryLocationScoreHint({
        presenceMode,
        officeDaysPerWeek,
        candidateFlexibility
      });
      return {
        score,
        reasoning: presenceMode === "hybrid"
          ? `Aday lokasyonu ${candidateLocationText}, is lokasyonu ${jobLocationText}; hibrit rolde duzenli fiziksel katilim icin ciddi lokasyon uyumsuzlugu bulunuyor.${relocationNote}`
          : `Aday lokasyonu ${candidateLocationText}, is lokasyonu ${jobLocationText}; ofis veya sahada fiziksel katilim beklentisiyle ciddi lokasyon uyumsuzlugu bulunuyor.${relocationNote}`,
        strengths: [],
        risks: [
          `Adayin lokasyonu ${jobLocationText} ile ayni ulke veya sehirde gorunmuyor (${candidateLocationText})`,
          ...(candidateFlexibility === "remote_only"
            ? ["Aday uzaktan calisma tercihini one cikariyor; rolun fiziksel katilim beklentisiyle uyumsuz olabilir"]
            : [])
        ],
        missingInformation: candidateFlexibility === "relocation_open"
          ? []
          : ["Adayin tasinma veya uzun sureli fiziksel ofis katilim esnekligi teyit edilmeli"],
        candidateLocationText,
        jobLocationText,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "cross_country",
        commuteSeverity: "extreme",
        officeDaysPerWeek,
        locationConfidence: 0.93,
        localitySummary
      };
    }

    if (jobCity && candidateCity && jobCity === candidateCity) {
      if (jobLocalities.length > 0 && candidateLocalities.length > 0) {
        const commuteContext = this.inferSameCityCommuteSeverity({
          city: jobCity,
          jobLocality: jobPrimaryLocality,
          candidateLocality: candidatePrimaryLocality
        });
        const sameCityScore = this.buildSameCityLocationScoreHint({
          presenceMode,
          officeDaysPerWeek,
          candidateFlexibility,
          commuteSeverity: commuteContext.severity
        });
        const commuteStrengths = [
          `Aday ve is yeri ayni ilde: ${this.toDisplayLocation(jobCity)}`,
          ...(commuteContext.severity === "light" || commuteContext.severity === "minimal"
            ? ["Ilce/bolge hattinin duzenli ulasim acisindan yonetilebilir olma ihtimali yuksek"]
            : []),
          ...(candidateFlexibility === "commute_open" || candidateFlexibility === "relocation_open"
            ? ["Aday hibrit/ofis duzenine fiziksel katilim konusunda istekli gorunuyor"]
            : [])
        ];
        const commuteRisks = [
          ...(
            commuteContext.severity === "heavy"
            || commuteContext.severity === "severe"
            || commuteContext.severity === "extreme"
              ? [
                  `${candidateLocationText} ile ${jobLocationText} arasindaki duzenli ofis yolculugu yorucu olabilir`
                ]
              : []
          ),
          ...(candidateFlexibility === "remote_only"
            ? ["Aday uzaktan calisma tercihini one cikariyor; rolun fiziksel katilim beklentisiyle uyumsuz olabilir"]
            : []),
          ...(candidateFlexibility === "relocation_resistant"
            ? ["Aday tasinma veya duzenli ofis katiliminda esnek gorunmuyor"]
            : [])
        ];
        const missingInformation = (
          commuteContext.severity === "moderate"
          || commuteContext.severity === "heavy"
          || commuteContext.severity === "severe"
          || commuteContext.severity === "extreme"
        ) && candidateFlexibility === "unknown"
          ? ["Adayin bu lokasyona haftalik ofis katilimini surdurup surduremeyecegi teyit edilmeli"]
          : [];
        return {
          score: sameCityScore,
          reasoning: presenceMode === "hybrid"
            ? `${commuteContext.reasoning} Rol hibrit oldugu icin haftalik fiziksel katilim yukunu commute siddeti ve adayin esnekligi birlikte belirler (${jobLocationText} / ${candidateLocationText}).`
            : `${commuteContext.reasoning} Fiziksel katilim beklentisi nedeniyle gunluk ulasim yuku yine goz onunde bulundurulmalidir (${jobLocationText} / ${candidateLocationText}).`,
          strengths: this.uniqueList(commuteStrengths),
          risks: this.uniqueList(commuteRisks),
          missingInformation,
          candidateLocationText,
          jobLocationText,
          presenceMode,
          candidateFlexibility,
          mismatchLevel: "same_city",
          commuteSeverity: commuteContext.severity,
          officeDaysPerWeek,
          locationConfidence: commuteContext.confidence,
          localitySummary
        };
      }

      return {
        score: this.buildSameCityLocationScoreHint({
          presenceMode,
          officeDaysPerWeek,
          candidateFlexibility,
          commuteSeverity: "moderate"
        }),
        reasoning: `Aday ve is lokasyonu ayni ilde gorunuyor (${this.toDisplayLocation(jobCity)}), ancak ilce detaylari net olmadigi icin commute siddeti tam ayrisamadi.`,
        strengths: [`Aday ve is yeri ayni ilde: ${this.toDisplayLocation(jobCity)}`],
        risks: [],
        missingInformation: ["Ilce veya duzenli ulasim bilgisi netlesirse lokasyon yorumu daha isabetli olur"],
        candidateLocationText,
        jobLocationText,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "same_city",
        commuteSeverity: "unknown",
        officeDaysPerWeek,
        locationConfidence: 0.7,
        localitySummary
      };
    }

    if (jobCity && candidateCity && jobCity !== candidateCity) {
      const relocationNote = candidateFlexibility === "relocation_open"
        ? " CV'de tasinma veya seyahat esnekligi sinyali bulundugu icin bu risk kismen yumusuyor."
        : "";
      const score = this.buildCrossCityLocationScoreHint({
        presenceMode,
        officeDaysPerWeek,
        candidateFlexibility
      });
      return {
        score,
        reasoning: presenceMode === "hybrid"
          ? `Aday lokasyonu ${candidateLocationText}, is lokasyonu ${jobLocationText}; hibrit duzende periyodik ofis katilimi icin ulasim veya tasinma esnekligi teyit edilmeli.${relocationNote}`
          : `Aday lokasyonu ${candidateLocationText}, is lokasyonu ${jobLocationText}; duzenli fiziksel katilim beklentisi icin tasinma veya ulasim esnekligi teyit edilmeli.${relocationNote}`,
        strengths: [],
        risks: [
          `Adayin lokasyonu ${jobLocationText}'dan farkli (${candidateLocationText})`,
          ...(candidateFlexibility === "remote_only"
            ? ["Aday uzaktan calisma tercihini one cikariyor; rolun fiziksel katilim beklentisiyle uyumsuz olabilir"]
            : [])
        ],
        missingInformation: candidateFlexibility === "relocation_open"
          ? []
          : ["Adayin duzenli ofis ulasimi veya tasinma esnekligi teyit edilmeli"],
        candidateLocationText,
        jobLocationText,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "cross_city",
        commuteSeverity: "severe",
        officeDaysPerWeek,
        locationConfidence: 0.9,
        localitySummary
      };
    }

    if (jobCountry === "tr" && candidateCountry === "tr") {
      return {
        score: presenceMode === "hybrid" ? 52 : 44,
        reasoning: `Lokasyon verisi ayni ulke icinde gorunuyor ancak il-ilce eslesmesi net kurulamadigi icin fiziksel katilim riski tamamen giderilemedi (${jobLocationText} / ${candidateLocationText}).`,
        strengths: [],
        risks: [`Adayin ${jobLocationText} lokasyonuna duzenli fiziksel ulasimi net degil (${candidateLocationText})`],
        missingInformation: ["Adayin ofise duzenli ulasim veya tasinma uygunlugu teyit edilmeli"],
        candidateLocationText,
        jobLocationText,
        presenceMode,
        candidateFlexibility,
        mismatchLevel: "ambiguous",
        commuteSeverity: "unknown",
        officeDaysPerWeek,
        locationConfidence: 0.55,
        localitySummary
      };
    }

    return {
      score: presenceMode === "hybrid" ? 46 : 38,
      reasoning: `Lokasyon verisi mevcut ancak il-ilce eslesmesi net kurulamadigi icin lokasyon uyumu kismen belirsiz kaldi (${candidateLocationText}).`,
      strengths: [],
      risks: [`Adayin ${jobLocationText} lokasyonuna fiziksel uygunlugu net degil (${candidateLocationText})`],
      missingInformation: ["Adayin calisabilecegi bolge ve ulasim uygunlugu teyit edilmeli"],
      candidateLocationText,
      jobLocationText,
      presenceMode,
      candidateFlexibility,
      mismatchLevel: "ambiguous",
      commuteSeverity: "unknown",
      officeDaysPerWeek,
      locationConfidence: 0.42,
      localitySummary
    };
  }

  private extractCity(value: string) {
    const tokens = value
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1);

    return TURKISH_CITIES.find((city) => tokens.includes(city)) ?? null;
  }

  private inferLocationCity(value: string) {
    const directMatch = this.extractCity(value);
    if (directMatch) {
      return directMatch;
    }

    const tokens = this.extractLocationTokens(value, null);
    for (const token of tokens) {
      const mapped = LOCATION_ALIAS_TO_CITY[token];
      if (mapped) {
        return mapped;
      }
    }

    return null;
  }

  private inferLocationCountry(value: string, city: string | null) {
    if (city || /\bturkiye\b|\bturkey\b/.test(value)) {
      return "tr" as const;
    }

    if (FOREIGN_LOCATION_HINTS.some((hint) => value.includes(hint))) {
      return "foreign" as const;
    }

    return null;
  }

  private extractLocationTokens(value: string, city: string | null) {
    return [...new Set(
      value
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length > 2)
        .filter((token) => token !== city)
        .filter((token) => !LOCATION_STOP_WORDS.has(token))
    )];
  }

  private toDisplayLocation(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private pickPrimaryLocality(localities: string[]) {
    return localities.find((item) => item in LOCATION_ALIAS_TO_CITY) ?? localities[0] ?? null;
  }

  private inferJobPresenceMode(input: {
    shiftType?: string | null;
    jobLocationText?: string | null;
    jobDescription?: string | null;
    requirementTexts: string[];
  }) {
    const corpus = normalizeTurkishText([
      input.shiftType,
      input.jobLocationText,
      input.jobDescription,
      ...input.requirementTexts
    ].filter(Boolean).join(" "));

    if (!corpus) {
      return "onsite" as const;
    }

    if (/remote|uzaktan|tamamen uzaktan|full remote/.test(corpus)
      && !/hibrit|hybrid|ofis|office|yerinde|onsite/.test(corpus)) {
      return "remote" as const;
    }

    if (/hibrit|hybrid/.test(corpus)) {
      return "hybrid" as const;
    }

    return "onsite" as const;
  }

  private inferOfficeDaysPerWeek(input: {
    shiftType?: string | null;
    jobDescription?: string | null;
    requirementTexts: string[];
    presenceMode: "remote" | "hybrid" | "onsite";
  }) {
    const corpus = normalizeTurkishText([
      input.shiftType,
      input.jobDescription,
      ...input.requirementTexts
    ].filter(Boolean).join(" "));

    if (input.presenceMode === "remote") {
      return 0;
    }

    const explicitMatch = corpus.match(/haftada\s*([0-5])\s*gun/) ?? corpus.match(/([0-5])\s*gun\s*(ofis|office)/);
    if (explicitMatch) {
      return Math.min(5, Math.max(0, Number(explicitMatch[1] ?? "0")));
    }

    if (/tam zamanli ofis|haftanin tamami|haftada bes gun|5 gun/.test(corpus)) {
      return 5;
    }

    if (input.presenceMode === "hybrid") {
      return 3;
    }

    return 5;
  }

  private inferCandidateFlexibility(candidateProfileText?: string | null) {
    const corpus = normalizeTurkishText(candidateProfileText ?? "");

    if (!corpus) {
      return "unknown" as const;
    }

    if (/sadece uzaktan|yalnizca uzaktan|remote only|tamamen uzaktan/.test(corpus)) {
      return "remote_only" as const;
    }

    if (
      /yer degistirmeyi dusunmuyorum|yer degistirmem|tasinmayi dusunmuyorum|tasinma dusunmuyorum|tasinma planim bulunmuyor|tasinma istemiyorum|tasinma istegim yok|tasinma dusunmuyor|tasinamam|hibrit calismayi dusunmuyorum|ofise duzenli gelemem|duzenli ofise gelemem|yalnizca bulundugum sehirde|bulundugum sehirde kalmak istiyorum|ofis duzenine acik degilim|kalici bir ofis duzenine acik degilim/.test(
        corpus
      )
    ) {
      return "relocation_resistant" as const;
    }

    if (
      /tasinabil|relocation|seyahat engelim yok|duzenli ofise gelebil|ofise gelebilirim|ofis duzeni benim icin uygun|ofis duzeniyle calisabilirim|duzenli ulasimim var|ofisine duzenli ulasim|hibrit calisabilirim|hibrit veya ofis/.test(
        corpus
      )
    ) {
      if (/tasinabil|relocation|yer degistirebil|istanbul'a tasinabilirim|istanbula tasinabilirim/.test(corpus)) {
        return "relocation_open" as const;
      }

      return "commute_open" as const;
    }

    return "unknown" as const;
  }

  private inferSameCityCommuteSeverity(input: {
    city: string;
    jobLocality: string | null;
    candidateLocality: string | null;
  }): {
    severity: CommuteSeverity;
    confidence: number;
    reasoning: string;
  } {
    if (!input.jobLocality || !input.candidateLocality) {
      return {
        severity: "unknown" as const,
        confidence: 0.62,
        reasoning: "Aday ve is yeri ayni ilde gorunuyor ancak ilce detaylari commute siddetini net ayristirmiyor."
      };
    }

    if (input.jobLocality === input.candidateLocality) {
      return {
        severity: "minimal" as const,
        confidence: 0.95,
        reasoning: `Aday ve is lokasyonu ayni ilcede gorunuyor (${this.toDisplayLocation(input.jobLocality)}).`
      };
    }

    const jobGroup = LOCATION_TRAVEL_GROUPS[input.jobLocality];
    const candidateGroup = LOCATION_TRAVEL_GROUPS[input.candidateLocality];
    if (!jobGroup || !candidateGroup || jobGroup.city !== input.city || candidateGroup.city !== input.city) {
      return {
        severity: "moderate" as const,
        confidence: 0.72,
        reasoning: `Aday ve is lokasyonu ayni ilde fakat ${this.toDisplayLocation(input.candidateLocality)} -> ${this.toDisplayLocation(input.jobLocality)} hattinin commute siddeti sadece kismen ayrisabildi.`
      };
    }

    const rankDiff = Math.abs(jobGroup.distanceRank - candidateGroup.distanceRank);
    if (jobGroup.side === candidateGroup.side) {
      const severity: CommuteSeverity = rankDiff === 0
        ? "light"
        : rankDiff <= 2
          ? "moderate"
          : rankDiff <= 4
            ? "heavy"
            : "severe";
      const reasoning = severity === "light"
        ? `Aday ve is lokasyonu ayni yakada ve gorece yakin ilcelerde gorunuyor (${this.toDisplayLocation(input.candidateLocality)} -> ${this.toDisplayLocation(input.jobLocality)}).`
        : severity === "moderate"
          ? `Aday ve is lokasyonu ayni yakada ancak orta seviyede commute yukune isaret eden ilcelerde gorunuyor (${this.toDisplayLocation(input.candidateLocality)} -> ${this.toDisplayLocation(input.jobLocality)}).`
          : `Aday ve is lokasyonu ayni yakada olsa da duzenli ofis gidis gelisi yorucu olabilecek ilcelerde gorunuyor (${this.toDisplayLocation(input.candidateLocality)} -> ${this.toDisplayLocation(input.jobLocality)}).`;
      return {
        severity,
        confidence: 0.9,
        reasoning
      };
    }

    const severity: CommuteSeverity = rankDiff >= 4 || Math.max(jobGroup.distanceRank, candidateGroup.distanceRank) >= 6
      ? "extreme"
      : "severe";
    return {
      severity,
      confidence: 0.9,
      reasoning: severity === "extreme"
        ? `Aday ve is lokasyonu ayni ilde olsa da farkli yakalarda ve uzun commute olusturabilecek ilcelerde gorunuyor (${this.toDisplayLocation(input.candidateLocality)} -> ${this.toDisplayLocation(input.jobLocality)}).`
        : `Aday ve is lokasyonu ayni ilde fakat farkli yakalarda gorunuyor; duzenli ulasim yuku dikkatle ele alinmali (${this.toDisplayLocation(input.candidateLocality)} -> ${this.toDisplayLocation(input.jobLocality)}).`
    };
  }

  private buildSameCityLocationScoreHint(input: {
    presenceMode: "remote" | "hybrid" | "onsite";
    officeDaysPerWeek: number | null;
    candidateFlexibility: CandidateFlexibility;
    commuteSeverity: CommuteSeverity;
  }) {
    const officeBurden = input.officeDaysPerWeek ?? (input.presenceMode === "onsite" ? 5 : 3);
    const severityBase: Record<Exclude<CommuteSeverity, "unknown">, number> = {
      minimal: 95,
      light: 86,
      moderate: officeBurden >= 4 ? 74 : 80,
      heavy: officeBurden >= 4 ? 58 : 64,
      severe: officeBurden >= 4 ? 42 : 48,
      extreme: officeBurden >= 4 ? 26 : 34
    };
    let score = input.commuteSeverity === "unknown" ? 72 : severityBase[input.commuteSeverity];

    if (input.presenceMode === "onsite") {
      score -= 4;
    } else if (officeBurden <= 2) {
      score += 4;
    }

    if (input.candidateFlexibility === "commute_open") {
      score += 6;
    } else if (input.candidateFlexibility === "relocation_open") {
      score += 8;
    } else if (input.candidateFlexibility === "relocation_resistant") {
      score -= 10;
    } else if (input.candidateFlexibility === "remote_only") {
      score -= 18;
    }

    return this.clampScore(score);
  }

  private buildCrossCityLocationScoreHint(input: {
    presenceMode: "remote" | "hybrid" | "onsite";
    officeDaysPerWeek: number | null;
    candidateFlexibility: CandidateFlexibility;
  }) {
    const officeBurden = input.officeDaysPerWeek ?? (input.presenceMode === "onsite" ? 5 : 3);
    let score = officeBurden >= 4 ? 24 : 30;

    if (input.candidateFlexibility === "commute_open") {
      score += 8;
    } else if (input.candidateFlexibility === "relocation_open") {
      score += 18;
    } else if (input.candidateFlexibility === "relocation_resistant") {
      score -= 8;
    } else if (input.candidateFlexibility === "remote_only") {
      score -= 14;
    }

    return this.clampScore(score);
  }

  private buildCrossCountryLocationScoreHint(input: {
    presenceMode: "remote" | "hybrid" | "onsite";
    officeDaysPerWeek: number | null;
    candidateFlexibility: CandidateFlexibility;
  }) {
    const officeBurden = input.officeDaysPerWeek ?? (input.presenceMode === "onsite" ? 5 : 3);
    let score = officeBurden >= 4 ? 14 : 18;

    if (input.candidateFlexibility === "relocation_open") {
      score += 16;
    } else if (input.candidateFlexibility === "commute_open") {
      score += 4;
    } else if (input.candidateFlexibility === "relocation_resistant") {
      score -= 6;
    } else if (input.candidateFlexibility === "remote_only") {
      score -= 10;
    }

    return this.clampScore(score);
  }
}
