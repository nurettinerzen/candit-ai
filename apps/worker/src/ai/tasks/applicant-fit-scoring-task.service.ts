import { AiTaskType, type Prisma, PrismaClient } from "@prisma/client";
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

type LocationFitAnalysis = {
  score: number;
  reasoning: string;
  strengths: string[];
  risks: string[];
  missingInformation: string[];
  candidateLocationText: string | null;
  jobLocationText: string | null;
};

type JobScoringContext = {
  title: string;
  roleFamily: string;
  locationText: string | null;
  jdText: string | null;
  requirementTexts: string[];
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
        label: "Musteri Iliskisi Deneyimi",
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
        label: "Iletisim Becerisi",
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
        label: "Egitim ve Sertifika",
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
      "categoryScores",
      "overallAssessment",
      "strengths",
      "risks",
      "missingInformation",
      "confidence",
      "uncertainty"
    ],
    properties: {
      overallScore: { type: "number" },
      categoryScores: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "label", "score", "confidence", "strengths", "risks", "reasoning"],
          properties: {
            key: { type: "string" },
            label: { type: "string" },
            score: { type: "number" },
            confidence: { type: "number" },
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
      confidence: { type: "number" },
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
      include: { cvFile: { select: { id: true, originalName: true } } }
    });

    if (!latestCvProfile) {
      throw new TaskProcessingError(
        "CV_PROFILE_NOT_FOUND",
        "Adayin CV profili bulunamadi. Once CV yukleyip parse edilmesi gerekiyor.",
        false,
        { candidateId: application.candidateId }
      );
    }

    const promptVersion = "applicant_fit_scoring.v5.tr";

    // 3. Load parsed CV profile
    const profileJson = toRecord(latestCvProfile.profileJson);
    const extractedFacts = toRecord(profileJson.extractedFacts);
    const jobContext: JobScoringContext = {
      title: application.job.title,
      roleFamily: application.job.roleFamily,
      locationText: application.job.locationText,
      jdText: application.job.jdText,
      requirementTexts: application.job.requirements.map((item) => `${item.key}: ${item.value}`)
    };
    const locationAnalysis = this.analyzeLocationFit({
      candidateLocationText: application.candidate.locationText,
      extractedLocationSignals: toArray(extractedFacts.locationSignals).filter(
        (item): item is string => typeof item === "string"
      ),
      jobLocationText: application.job.locationText
    });

    // 4. AI-first scoring
    const aiResult = await this.provider.generate({
      taskType: "APPLICANT_FIT_SCORING",
      schemaName: "applicant_fit_scoring_v1_tr",
      schema: fitScoringOutputSchema("applicant_fit_scoring_v1_tr"),
      promptVersion,
      preferProviderKey: context.taskRun.providerKey,
      systemPrompt: [
        "Sen bir profesyonel IK uzmani CV degerlendirme asistanisin.",
        "Turkce cikti uret.",
        "Adayi rolin ihtiyacina gore butuncul degerlendir.",
        "Sabit rubric veya sabit agirlik kullanma; bu rol icin en anlamli 3-5 degerlendirme boyutunu kendin sec.",
        "overallScore alani 0-100 arasi genel uyum skorudur.",
        "Guclu yonleri, uyarilari ve eksik bilgileri ayri ayri ver.",
        "Guclu yonler sadece adayin bu rol icin ayirt edici avantajlarini temsil etsin.",
        "Uyarilar sadece role etkisi olabilecek dikkat noktalarini temsil etsin.",
        "Ayni temayi birden fazla maddede ya da farkli listelerde tekrar etme.",
        "Skorlar, yazili degerlendirme ile tutarli olsun; belirgin uyumsuzluk varsa orta-yuksek puan verme.",
        "Eksik bilgi, recruiter'in soruyla tamamlayabilecegi bosluktur.",
        "Uyari, role etkisi olabilecek ama nihai karari otomatik belirlemeyen dikkat noktasi olsun.",
        "Pozisyonda fiziksel bulunma veya duzenli ulasim onemliyse lokasyon/ulasim uyumunu acikca yorumla.",
        "Role acik katkisi olmayan genel veya varsayilan nitelikleri guclu yon olarak one cikarma.",
        "Ham teknik notlar veya 'x sinyal' gibi ic aciklamalar yazma.",
        "Nihai karar verme, sadece degerlendirme yap."
      ].join(" "),
      userPrompt: JSON.stringify({
        task: "APPLICANT_FIT_SCORING",
        locale: "tr-TR",
        candidate: {
          fullName: application.candidate.fullName,
          source: application.candidate.source,
          locationText: application.candidate.locationText
        },
        job: {
          title: application.job.title,
          roleFamily: application.job.roleFamily,
          locationText: application.job.locationText,
          requirements: application.job.requirements.map((r) => ({
            key: r.key,
            value: r.value,
            required: r.required
          }))
        },
        cvProfile: {
          extractedFacts,
          normalizedSummary: toRecord(profileJson.normalizedSummary),
          inferredObservations: toRecord(profileJson).inferredObservations ?? null,
          missingCriticalInformation: toRecord(profileJson).missingCriticalInformation ?? null,
          parseConfidence: latestCvProfile.parseConfidence,
          extractionStatus: latestCvProfile.extractionStatus
        },
        locationContext: {
          jobLocationText: application.job.locationText,
          candidateLocationText: application.candidate.locationText,
          extractedLocationSignals: toArray(extractedFacts.locationSignals).filter(
            (item): item is string => typeof item === "string"
          ),
          principles: [
            "Lokasyon puani, rolun fiziksel bulunma ihtiyaci ile adayin gercek ulasim/yer degistirme uygunlugunu yansitsin",
            "Benzer vakalarda benzer puanlar ver; ayni derecede uzak adaylara tutarli davran",
            "Elindeki veri yetersizse bunu eksik bilgi veya uyari olarak belirt, ama puani metinle celistirme"
          ]
        },
        instructions: [
          "overallScore 0-100 arasi sayi olmali",
          "categoryScores alaninda bu rol icin en onemli 3-4 degerlendirme boyutunu sec",
          "Is lokasyonu belliyse bu boyutlardan biri mutlaka lokasyon veya ulasim uyumu olmali",
          "Her boyut icin key kisa bir slug, label ise recruiter'in gorecegi Turkce baslik olsun",
          "confidence alani 0-1 arasi olmali — HER ADAY ICIN FARKLI OLMALI, sabit bir deger yazma",
          "confidence degerlendirmesi icin su kurallari uygula: CV'de acik kanit ve detayli bilgi varsa 0.80-0.95 arasi; orta duzeyde bilgi varsa 0.55-0.75 arasi; CV kisitli veya belirsiz bilgi iceriyorsa 0.25-0.50 arasi; veri neredeyse yoksa 0.10-0.25 arasi ver",
          "Farkli adaylar farkli veri kalitesine sahiptir — her adayin confidence degeri gercekten farkli olmali, hepsine benzer deger verme",
          "strengths ve risks Turkce olmali",
          "overallAssessment Turkce bir ozet cumlesi olmali",
          "Guclu yonler, role gore ayirt edici ve karar kalitesini artiran kanita dayali noktalar olsun",
          "Eksik bilgi, CV'de acikca yer almayan ve recruiter'in soruyla tamamlayabilecegi maddeler olsun",
          "Uyarilar, eksik bilginin tekrari degil; rolde negatif etki yaratabilecek somut uyumsuzluk veya zayifliklari anlatsin",
          "Ayni seyi iki farkli maddede veya farkli listelerde tekrar etme",
          "Lokasyon, deneyim, liderlik gibi ayni temayi hem arti hem eksi yonde yazma; en dogru listede bir kez yaz",
          "Skor ile yazdigin aciklamalar birbiriyle mantikli ve orantili olsun"
        ]
      })
    });

    const aiData = aiResult.mode === "deterministic_fallback" || !aiResult.output
      ? null
      : this.parseAiOutput(aiResult.output);

    let rubricRoleFamily = application.job.roleFamily || null;
    let rubricSource: "database" | "default" | "ai_first" = "ai_first";
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

    if (aiData && aiData.categoryScores.length > 0) {
      missingInfo = this.sanitizeMissingInformation(aiData.missingInformation, locationAnalysis);
      sanitizedCategoryScores = aiData.categoryScores.slice(0, 6).map((category, index) => ({
        key: category.key || `dimension_${index + 1}`,
        label: category.label || `Degerlendirme Boyutu ${index + 1}`,
        weight: null,
        score: this.clampScore(category.score),
        confidence: this.clampConfidence(category.confidence),
        deterministicScore: null,
        aiScore: this.clampScore(category.score),
        strengths: this.sanitizeStrengths(category.strengths, locationAnalysis, jobContext),
        risks: this.sanitizeRisks(category.risks, missingInfo, locationAnalysis),
        reasoning: category.reasoning.trim()
      })).map((category) => ({
        ...category,
        strengths: this.pruneConflictingStrengths(category.strengths, category.risks)
      }));

      const topLevelRisks = this.sanitizeRisks(aiData.risks, missingInfo, locationAnalysis);
      const topLevelStrengths = this.pruneConflictingStrengths(
        this.sanitizeStrengths(aiData.strengths, locationAnalysis, jobContext),
        topLevelRisks
      );

      allStrengths = this.dedupeByMeaning([
        ...topLevelStrengths,
        ...sanitizedCategoryScores.flatMap((category) => category.strengths)
      ]);
      allRisks = this.dedupeByMeaning([
        ...topLevelRisks,
        ...sanitizedCategoryScores.flatMap((category) => category.risks)
      ]);
      overallScore = this.clampScore(aiData.overallScore);
      overallConfidence = this.calibrateAssessmentConfidence({
        aiConfidence: aiData.confidence,
        parseConfidence: toNumberValue(latestCvProfile.parseConfidence, 0.5),
        extractionStatus: latestCvProfile.extractionStatus,
        missingInformationCount: missingInfo.length
      });
      overallAssessment = aiData.overallAssessment.trim() || "Aday profili yapay zeka destekli olarak degerlendirildi.";
      uncertaintyReasons = this.uniqueList(aiData.uncertainty.reasons);
    } else {
      const rubric = await this.loadRubric(context.tenantId, context.taskRun.id, application.job.roleFamily);
      const rubricBase = rubric
        ? (toRecord(rubric.rubricJson) as unknown as FitScoringRubric)
        : this.getDefaultRubric(application.job.roleFamily);
      const rubricData = this.ensureLocationCategory(rubricBase, application.job.locationText);
      const deterministicScores = this.buildDeterministicScores(
        extractedFacts,
        rubricData.categories,
        locationAnalysis,
        jobContext
      );
      const mergedScores = this.mergeScores(
        deterministicScores,
        undefined,
        rubricData.categories,
        locationAnalysis
      );

      rubricRoleFamily = rubricData.roleFamily;
      rubricSource = rubric ? "database" : "default";
      overallScore = this.calculateWeightedOverall(mergedScores.categoryScores, rubricData.categories);
      overallConfidence = this.clampConfidence(mergedScores.confidence);
      overallAssessment = mergedScores.overallAssessment;
      uncertaintyReasons = mergedScores.uncertaintyReasons;
      missingInfo = this.sanitizeMissingInformation(mergedScores.missingInformation, locationAnalysis);
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
        reasoning: category.reasoning
      }));
      allStrengths = this.uniqueList(sanitizedCategoryScores.flatMap((category) => category.strengths));
      allRisks = this.uniqueList(sanitizedCategoryScores.flatMap((category) => category.risks));
    }

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

      let score = 30; // Base score
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
        score: Math.min(blendedScore, 100),
        confidence,
        deterministicScore: detScore,
        aiScore,
        strengths: isLocationCategory
          ? this.uniqueList(deterministicStrengths)
          : (aiStrengths.length > 0 ? aiStrengths : this.uniqueList(deterministicStrengths)),
        risks: isLocationCategory
          ? this.uniqueList(deterministicRisks)
          : this.uniqueList([...(aiCategory?.risks ?? []), ...deterministicRisks]),
        reasoning: (
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

  private parseAiOutput(output: Record<string, unknown>): AiFitScoringOutput | null {
    try {
      const categoryScores = toArray(output.categoryScores)
        .map((entry) => {
          const rec = toRecord(entry);
          const label = toStringValue(rec.label, "").trim();
          return {
            key: this.slugifyDimensionKey(toStringValue(rec.key, label || "dimension")),
            label: label || "Degerlendirme Boyutu",
            score: this.clampScore(toNumberValue(rec.score, 50)),
            confidence: toNumberValue(rec.confidence, 0.5),
            strengths: toArray(rec.strengths).filter((s): s is string => typeof s === "string"),
            risks: toArray(rec.risks).filter((s): s is string => typeof s === "string"),
            reasoning: toStringValue(rec.reasoning, "")
          };
        })
        .filter((cs) => cs.label.length > 0);

      return {
        overallScore: this.clampScore(toNumberValue(output.overallScore, 50)),
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

  // ── Weighted overall score ──

  private calculateWeightedOverall(
    categoryScores: Array<{ key: string; score: number }>,
    categories: RubricCategory[]
  ): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const category of categories) {
      const cs = categoryScores.find((s) => s.key === category.key);
      if (cs) {
        weightedSum += cs.score * category.weight;
        totalWeight += category.weight;
      }
    }

    if (totalWeight === 0) return 50;
    return Math.round(weightedSum / totalWeight);
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

    return this.dedupeByMeaning(items)
      .map((item) => this.canonicalizeRisk(this.normalizeWarningText(item), locationAnalysis))
      .filter(Boolean)
      .filter((item) => !blockedPatterns.some((pattern) => pattern.test(item)))
      .filter((item) => !this.looksLikeMissingInformation(item))
      .filter((item) => !missingInformation.some((missing) => this.warningOverlap(item, missing)));
  }

  private sanitizeMissingInformation(items: string[], locationAnalysis: LocationFitAnalysis) {
    return this.dedupeByMeaning(items)
      .map((item) => this.normalizeWarningText(item))
      .filter(Boolean)
      .filter((item) => {
        if (!locationAnalysis.jobLocationText || !locationAnalysis.candidateLocationText) {
          return true;
        }

        if (!this.looksLikeLocationSignal(item, locationAnalysis)) {
          return true;
        }

        return /tasin|ulasim|esneklik|servis|seyahat|remote|hibrit|vardiya/i.test(
          normalizeTurkishText(item)
        );
      });
  }

  private sanitizeStrengths(
    items: string[],
    locationAnalysis: LocationFitAnalysis,
    jobContext: JobScoringContext
  ) {
    const normalized = this.dedupeByMeaning(items)
      .map((item) => this.normalizeWarningText(item))
      .filter(Boolean)
      .filter((item) => !this.looksLikeIrrelevantCertificationStrength(item, jobContext));

    if (locationAnalysis.score >= 80) {
      return normalized;
    }

    return normalized.filter((item) => !this.looksLikeLocationSignal(item, locationAnalysis));
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

    return signalValue;
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
  }) {
    let score = this.clampConfidence(input.aiConfidence);
    const parseConfidence = this.clampConfidence(input.parseConfidence);

    score = score * 0.72 + parseConfidence * 0.28;

    if (input.extractionStatus && input.extractionStatus !== "EXTRACTED") {
      score -= 0.08;
    }
    if (input.missingInformationCount >= 4) {
      score -= 0.08;
    } else if (input.missingInformationCount >= 2) {
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

    // Try roleFamily first, then fallback to "genel"
    const byRole = await this.prisma.scoringRubric.findFirst({
      where: { tenantId, domain: roleFamily, isActive: true },
      orderBy: { version: "desc" }
    });

    if (byRole) return byRole;

    return this.prisma.scoringRubric.findFirst({
      where: { tenantId, domain: "genel", isActive: true },
      orderBy: { version: "desc" }
    });
  }

  private getDefaultRubric(roleFamily: string): FitScoringRubric {
    return DEFAULT_RUBRICS[roleFamily] ?? DEFAULT_RUBRICS["genel"] as FitScoringRubric;
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
          weight: 0.08,
          description: "Aday lokasyonunun is yeriyle il ve ilce-bolge bazinda uyumu",
          deterministicSignals: ["locationSignals"],
          scoringGuidance: "Ayni ilce veya ayni bolge yuksek, ayni il farkli bolge orta, farkli il dusuk puan"
        }
      ]
    };
  }

  private isLocationCategory(category: Pick<RubricCategory, "key" | "label">) {
    return /lokasyon|location/i.test(category.key) || /lokasyon|location/i.test(category.label);
  }

  private composeOverallAssessment(baseAssessment: string, locationAnalysis: LocationFitAnalysis) {
    const base = baseAssessment.trim();
    if (!locationAnalysis.reasoning) {
      return base;
    }

    if (normalizeTurkishText(base).includes(normalizeTurkishText(locationAnalysis.reasoning))) {
      return base;
    }

    return `${base} ${locationAnalysis.reasoning}`.trim();
  }

  private analyzeLocationFit(input: {
    candidateLocationText?: string | null;
    extractedLocationSignals: string[];
    jobLocationText?: string | null;
  }): LocationFitAnalysis {
    const jobLocationText = input.jobLocationText?.trim() || null;
    const candidateLocationText = input.candidateLocationText?.trim()
      || input.extractedLocationSignals.find((item) => item.trim().length > 0)
      || null;

    if (!jobLocationText) {
      return {
        score: 70,
        reasoning: "Ilan lokasyonu belirtilmedigi icin lokasyon uyumu notr degerlendirildi.",
        strengths: [],
        risks: [],
        missingInformation: [],
        candidateLocationText,
        jobLocationText: null
      };
    }

    if (!candidateLocationText) {
        return {
          score: 60,
          reasoning: "Adayin guncel lokasyonu CV'de net gorunmedigi icin lokasyon uyumu sinirli degerlendirildi.",
          strengths: [],
          risks: [],
          missingInformation: ["Adayin guncel lokasyonu veya calisabilecegi bolge teyit edilmeli"],
        candidateLocationText: null,
        jobLocationText
      };
    }

    const normalizedJob = normalizeTurkishText(jobLocationText);
    const normalizedCandidate = normalizeTurkishText(candidateLocationText);
    const jobCity = this.extractCity(normalizedJob);
    const candidateCity = this.extractCity(normalizedCandidate);
    const jobLocalities = this.extractLocationTokens(normalizedJob, jobCity);
    const candidateLocalities = this.extractLocationTokens(normalizedCandidate, candidateCity);
    const sharedLocalities = jobLocalities.filter((token) => candidateLocalities.includes(token));

    if (jobCity && candidateCity && jobCity === candidateCity) {
      if (sharedLocalities.length > 0) {
        return {
          score: 95,
          reasoning: `Adayin lokasyonu is lokasyonuyla ayni bolgede gorunuyor (${jobLocationText} / ${candidateLocationText}).`,
          strengths: [`Lokasyon ayni bolgeye isaret ediyor: ${candidateLocationText}`],
          risks: [],
          missingInformation: [],
          candidateLocationText,
          jobLocationText
        };
      }

      if (jobLocalities.length > 0 && candidateLocalities.length > 0) {
        return {
          score: 65,
          reasoning: `Aday ve is lokasyonu ayni ilde ancak farkli ilce veya bolgede gorunuyor (${jobLocationText} / ${candidateLocationText}).`,
          strengths: [`Aday ve is yeri ayni ilde: ${this.toDisplayLocation(jobCity)}`],
          risks: [`Ayni ilde olsa da farkli ilce veya bolge ulasim acisindan dezavantaj yaratabilir (${candidateLocationText})`],
          missingInformation: [],
          candidateLocationText,
          jobLocationText
        };
      }

      return {
        score: 88,
        reasoning: `Aday ve is lokasyonu ayni ilde gorunuyor (${this.toDisplayLocation(jobCity)}).`,
        strengths: [`Aday ve is yeri ayni ilde: ${this.toDisplayLocation(jobCity)}`],
        risks: [],
        missingInformation: [],
        candidateLocationText,
        jobLocationText
      };
    }

    if (jobCity && candidateCity && jobCity !== candidateCity) {
      return {
        score: 55,
        reasoning: `Aday lokasyonu ${candidateLocationText}, is lokasyonu ${jobLocationText}; farkli iller icin tasinma veya ulasim esnekligi teyit edilmeli.`,
        strengths: [],
        risks: [`Adayin lokasyonu ${jobLocationText}'dan farkli (${candidateLocationText})`],
        missingInformation: [],
        candidateLocationText,
        jobLocationText
      };
    }

    return {
      score: 65,
      reasoning: `Lokasyon verisi mevcut ancak il-ilce eslesmesi net kurulamadigi icin lokasyon uyumu kismen belirsiz kaldi (${candidateLocationText}).`,
      strengths: [],
      risks: [],
      missingInformation: ["Adayin calisabilecegi bolge ve ulasim uygunlugu teyit edilmeli"],
      candidateLocationText,
      jobLocationText
    };
  }

  private extractCity(value: string) {
    return TURKISH_CITIES.find((city) => value.includes(city)) ?? null;
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
}
