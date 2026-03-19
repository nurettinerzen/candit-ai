import "dotenv/config";
import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join, resolve } from "path";
import {
  ApplicationStage,
  AuditActorType,
  FeatureFlagType,
  InterviewMode,
  InterviewSessionStatus,
  Recommendation,
  Role,
  UserStatus,
  WorkflowStatus,
  type Prisma
} from "@prisma/client";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const tenantId = "ten_demo";
const workspaceId = "wrk_demo_ops";
const recruiterId = "usr_recruiter_demo";
const sessionAccessTokens = {
  sess_demo_1: "demo_voice_token_sess_1",
  sess_demo_2: "demo_voice_token_sess_2",
  sess_demo_3: "demo_voice_token_sess_3"
} as const;

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function candidateInterviewUrl(sessionId: keyof typeof sessionAccessTokens) {
  const base = process.env.PUBLIC_WEB_BASE_URL?.trim() || "http://localhost:3000";
  const normalizedBase = base.replace(/\/+$/, "");
  const token = sessionAccessTokens[sessionId];
  return `${normalizedBase}/gorusme/${sessionId}?token=${token}`;
}

function resolveWorkspaceRoot() {
  let current = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = resolve(current, "..");

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return process.cwd();
}

function resolveStorageRoot() {
  const configured = process.env.FILE_STORAGE_ROOT?.trim();
  const workspaceRoot = resolveWorkspaceRoot();
  const raw = configured && configured.length > 0 ? configured : "data/storage";

  return raw.startsWith("/") ? raw : resolve(workspaceRoot, raw);
}

async function writeSeedCvFile(storageKey: string, content: string) {
  const storageRoot = resolveStorageRoot();
  const absolutePath = resolve(storageRoot, storageKey.replace(/^\/+/, ""));

  if (!absolutePath.startsWith(storageRoot)) {
    throw new Error(`Invalid storage key for seed file: ${storageKey}`);
  }

  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");

  const checksumSha256 = createHash("sha256").update(content, "utf8").digest("hex");

  return {
    sizeBytes: Buffer.byteLength(content, "utf8"),
    checksumSha256
  };
}

async function upsertUsers() {
  const users = [
    {
      id: "usr_admin_demo",
      email: "admin@demo.local",
      fullName: "Demo Admin",
      role: Role.ADMIN
    },
    {
      id: "usr_recruiter_demo",
      email: "recruiter@demo.local",
      fullName: "Demo Recruiter",
      role: Role.RECRUITER
    },
    {
      id: "usr_hm_demo",
      email: "hm@demo.local",
      fullName: "Demo Hiring Manager",
      role: Role.HIRING_MANAGER
    }
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        tenantId,
        fullName: user.fullName,
        email: user.email.toLowerCase(),
        status: UserStatus.ACTIVE
      },
      create: {
        id: user.id,
        tenantId,
        email: user.email.toLowerCase(),
        fullName: user.fullName,
        status: UserStatus.ACTIVE
      }
    });

    await prisma.userRoleBinding.upsert({
      where: {
        tenantId_userId_role: {
          tenantId,
          userId: user.id,
          role: user.role
        }
      },
      update: {},
      create: {
        tenantId,
        userId: user.id,
        role: user.role
      }
    });
  }
}

async function upsertFeatureFlags() {
  const flags: Array<{ key: string; value: boolean; description: string }> = [
    {
      key: "auto_stage_change_enabled",
      value: false,
      description: "V1 kurali: stage gecisleri insan aksiyonu ile yapilir."
    },
    {
      key: "ai_followup_enabled",
      value: true,
      description: "Template icinde sinirli AI follow-up acik."
    },
    {
      key: "ai.cv_parsing.enabled",
      value: true,
      description: "CV parsing assistive flow acik."
    },
    {
      key: "ai.job_requirement_interpretation.enabled",
      value: true,
      description: "Job requirement interpretation acik."
    },
    {
      key: "ai.candidate_fit_assistance.enabled",
      value: true,
      description: "Candidate-fit assistance acik."
    },
    {
      key: "ai.screening_support.enabled",
      value: true,
      description: "Screening support acik."
    },
    {
      key: "ai.interview_preparation.enabled",
      value: false,
      description: "Interview preparation bir sonraki faz."
    },
    {
      key: "ai.interview_orchestration.enabled",
      value: true,
      description: "Web sesli, template kontrollu interview orchestration acik."
    },
    {
      key: "ai.transcript_summarization.enabled",
      value: false,
      description: "Transcript summarization sonraki faz."
    },
    {
      key: "ai.report_generation.enabled",
      value: true,
      description: "Rapor uretimi demo icin acik."
    },
    {
      key: "ai.recommendation_generation.enabled",
      value: true,
      description: "Oneri uretimi demo icin acik."
    },
    {
      key: "ai.system_triggers.application_created.screening_support.enabled",
      value: true,
      description: "Application olusunca screening support otomatik kuyruklanabilir."
    },
    {
      key: "ai.system_triggers.stage_review_pack.enabled",
      value: true,
      description:
        "Interview tamamlanip recruiter review'a gecildiginde report/recommendation paket tetiklenebilir."
    },
    {
      key: "ai.system_triggers.interview_completed.review_pack.enabled",
      value: true,
      description:
        "Interview session tamamlandiginda report/recommendation paket tetiklenebilir."
    },
    {
      key: "ai.auto_reject.enabled",
      value: false,
      description: "V1 kurali: otomatik red yasak."
    },
    {
      key: "ai.applicant_fit_scoring.enabled",
      value: true,
      description: "CV kategori bazli fit scoring acik."
    }
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key: flag.key
        }
      },
      update: {
        type: FeatureFlagType.BOOLEAN,
        value: flag.value,
        description: flag.description
      },
      create: {
        tenantId,
        key: flag.key,
        type: FeatureFlagType.BOOLEAN,
        value: flag.value,
        description: flag.description
      }
    });
  }
}

async function upsertIntegrationConnections() {
  const connections = [
    {
      // Google Meet: Needs GOOGLE_OAUTH_CLIENT_ID/SECRET + user OAuth consent
      // Status NOT_CONNECTED until real OAuth credentials are provided
      id: "conn_demo_google_meet",
      provider: "GOOGLE_MEET" as const,
      status: "INACTIVE" as const,
      displayName: "Google Meet — OAuth credentials required",
      configJson: {
        calendarId: "primary",
        meetingIdPrefix: "gm",
        calendarEventPrefix: "gcal-demo",
        provisioningMode: "google_calendar_api",
        _setup_hint: "Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI in .env"
      },
      credentialsJson: {},
      lastError: "oauth_not_configured"
    },
    {
      // Google Calendar: Needs same Google OAuth credentials
      // Provides free/busy query + event creation with Google Meet conference
      id: "conn_demo_google_calendar",
      provider: "GOOGLE_CALENDAR" as const,
      status: "INACTIVE" as const,
      displayName: "Google Calendar — OAuth credentials required",
      configJson: {
        calendarId: "primary",
        provisioningMode: "google_calendar_api",
        _setup_hint: "Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI in .env"
      },
      credentialsJson: {},
      lastError: "oauth_not_configured"
    },
    {
      // Calendly: Needs CALENDLY_OAUTH_CLIENT_ID/SECRET or personal access token
      // Supports webhook-driven scheduling + direct booking via scheduling links
      id: "conn_demo_calendly",
      provider: "CALENDLY" as const,
      status: "INACTIVE" as const,
      displayName: "Calendly — OAuth or personal token required",
      configJson: {
        schedulingUrlTemplate: "https://calendly.com/demo-org/{sessionId}",
        webhookSigningSecretConfigured: false,
        _setup_hint: "Set CALENDLY_OAUTH_CLIENT_ID, CALENDLY_OAUTH_CLIENT_SECRET, or provide personalAccessToken in credentials"
      },
      credentialsJson: {},
      lastError: "oauth_not_configured"
    },
    {
      id: "conn_demo_zoom_template",
      provider: "ZOOM" as const,
      status: "ACTIVE" as const,
      displayName: "Zoom Template (Provider Ready)",
      configJson: {
        baseMeetingUrl: "https://zoom.demo.local",
        meetingPathPrefix: "rooms",
        meetingIdPrefix: "zoom",
        provisioningMode: "provider_connection_template"
      },
      credentialsJson: {
        apiKey: "placeholder_only_no_real_secret"
      },
      lastError: null
    }
  ];

  for (const connection of connections) {
    await prisma.integrationConnection.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider: connection.provider
        }
      },
      update: {
        status: connection.status,
        displayName: connection.displayName,
        configJson: connection.configJson,
        credentialsJson: connection.credentialsJson,
        lastVerifiedAt: connection.lastError ? null : hoursAgo(2),
        lastError: connection.lastError
      },
      create: {
        id: connection.id,
        tenantId,
        provider: connection.provider,
        status: connection.status,
        displayName: connection.displayName,
        configJson: connection.configJson,
        credentialsJson: connection.credentialsJson,
        lastVerifiedAt: connection.lastError ? null : hoursAgo(2),
        lastError: connection.lastError
      }
    });
  }

  const oauthCredentialConnections = await prisma.integrationConnection.findMany({
    where: {
      tenantId,
      provider: {
        in: ["CALENDLY", "GOOGLE_CALENDAR", "GOOGLE_MEET"]
      }
    },
    select: {
      id: true,
      provider: true
    }
  });

  for (const connection of oauthCredentialConnections) {
    await prisma.integrationCredential.upsert({
      where: {
        connectionId: connection.id
      },
      update: {
        status: "MISSING",
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        lastError: "seed_placeholder_credentials_missing"
      },
      create: {
        tenantId,
        connectionId: connection.id,
        provider: connection.provider,
        authType: "oauth2",
        status: "MISSING",
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        lastError: "seed_placeholder_credentials_missing",
        metadata: {
          seeded: true,
          note: "ready_after_config"
        }
      }
    });
  }
}

async function upsertPromptTemplatesAndRubrics() {
  const templates = [
    {
      id: "prompt_cv_parsing_v1",
      key: "cv_parsing_tr_v1",
      stage: "CV_PARSING",
      version: 1
    },
    {
      id: "prompt_screening_support_v1",
      key: "screening_support_tr_v1",
      stage: "SCREENING_SUPPORT",
      version: 1
    },
    {
      id: "prompt_report_generation_v1",
      key: "report_generation_tr_v1",
      stage: "REPORT_GENERATION",
      version: 1
    },
    {
      id: "prompt_recommendation_generation_v1",
      key: "recommendation_generation_tr_v1",
      stage: "RECOMMENDATION_GENERATION",
      version: 1
    }
  ];

  for (const template of templates) {
    await prisma.aiPromptTemplate.upsert({
      where: { id: template.id },
      update: {
        key: template.key,
        stage: template.stage as never,
        version: template.version,
        locale: "tr",
        systemPrompt:
          "Yalnizca Turkce cevap ver. AI sadece yardimci cikarim yapar. Nihai karari insan verir.",
        userPrompt: "JSON schema ile uyumlu cikti uret."
      },
      create: {
        id: template.id,
        tenantId,
        key: template.key,
        stage: template.stage as never,
        version: template.version,
        locale: "tr",
        systemPrompt:
          "Yalnizca Turkce cevap ver. AI sadece yardimci cikarim yapar. Nihai karari insan verir.",
        userPrompt: "JSON schema ile uyumlu cikti uret.",
        outputSchema: {
          type: "object",
          additionalProperties: true
        }
      }
    });
  }

  await prisma.scoringRubric.upsert({
    where: { id: "rubric_warehouse_v1" },
    update: {
      domain: "warehouse",
      rubricJson: {
        dimensions: [
          { key: "relevant_experience", weight: 0.35 },
          { key: "shift_fit", weight: 0.2 },
          { key: "reliability_signals", weight: 0.2 },
          { key: "communication_clarity", weight: 0.15 },
          { key: "safety_awareness", weight: 0.1 }
        ]
      },
      isActive: true
    },
    create: {
      id: "rubric_warehouse_v1",
      tenantId,
      key: "warehouse_screening",
      version: 1,
      domain: "warehouse",
      rubricJson: {
        dimensions: [
          { key: "relevant_experience", weight: 0.35 },
          { key: "shift_fit", weight: 0.2 },
          { key: "reliability_signals", weight: 0.2 },
          { key: "communication_clarity", weight: 0.15 },
          { key: "safety_awareness", weight: 0.1 }
        ]
      },
      isActive: true
    }
  });

  // ── Fit Scoring Rubrics ──

  const fitScoringRubrics = [
    {
      id: "rubric_fit_warehouse_v1",
      key: "fit_scoring_warehouse",
      domain: "warehouse",
      rubricJson: {
        schemaVersion: "fit_scoring_rubric.v1",
        roleFamily: "warehouse",
        categories: [
          {
            key: "deneyim_uyumu", label: "Deneyim Uyumu", weight: 0.25,
            description: "Depo, lojistik veya ilgili sektorde is deneyimi",
            deterministicSignals: ["recentRoles", "sectorSignals", "workHistorySignals", "estimatedYearsOfExperience"],
            scoringGuidance: "Depo/lojistik deneyimi yuksek puan, ilgisiz sektor dusuk puan"
          },
          {
            key: "sertifika_belgeler", label: "Sertifika ve Belgeler", weight: 0.2,
            description: "Forklift, ehliyet, SRC gibi mesleki belgeler",
            deterministicSignals: ["certifications", "skills"],
            scoringGuidance: "Forklift sertifikasi veya ehliyet varsa yuksek puan"
          },
          {
            key: "fiziksel_uygunluk", label: "Fiziksel Uygunluk Sinyalleri", weight: 0.2,
            description: "Fiziksel is yapabilme sinyalleri",
            deterministicSignals: ["skills", "recentRoles"],
            scoringGuidance: "Depo, paketleme, yukleme gibi fiziksel is deneyimi varsa yuksek puan"
          },
          {
            key: "vardiya_esnekligi", label: "Vardiya Esnekligi", weight: 0.15,
            description: "Vardiyali calisma uygunlugu sinyalleri",
            deterministicSignals: ["workHistorySignals", "recentRoles"],
            scoringGuidance: "Vardiyali calisma gecmisi varsa yuksek puan"
          },
          {
            key: "genel_profil", label: "Genel Profil", weight: 0.2,
            description: "Lokasyon, istihdam bosuklari, iletisim bilgileri",
            deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo", "languages"],
            scoringGuidance: "Lokasyon uyumu, az bosluk, iletisim bilgisi tamsa yuksek puan"
          }
        ]
      }
    },
    {
      id: "rubric_fit_retail_v1",
      key: "fit_scoring_retail",
      domain: "retail",
      rubricJson: {
        schemaVersion: "fit_scoring_rubric.v1",
        roleFamily: "retail",
        categories: [
          {
            key: "musteri_iliskisi", label: "Musteri Iliskisi Deneyimi", weight: 0.25,
            description: "Musteri odakli is deneyimi",
            deterministicSignals: ["recentRoles", "sectorSignals", "skills"],
            scoringGuidance: "Perakende, musteri destek veya satis deneyimi varsa yuksek puan"
          },
          {
            key: "kasa_deneyimi", label: "Kasa ve POS Deneyimi", weight: 0.2,
            description: "Kasa islemleri, POS terminal kullanimi",
            deterministicSignals: ["skills", "recentRoles"],
            scoringGuidance: "Kasa islemleri, POS veya nakit yonetimi deneyimi varsa yuksek puan"
          },
          {
            key: "iletisim_becerisi", label: "Iletisim Becerisi", weight: 0.2,
            description: "Iletisim ve dil becerileri",
            deterministicSignals: ["languages", "educationSummary"],
            scoringGuidance: "Birden fazla dil veya iletisim odakli egitim varsa yuksek puan"
          },
          {
            key: "uygunluk_vardiya", label: "Uygunluk ve Vardiya", weight: 0.15,
            description: "Calisma uygunlugu ve vardiya esnekligi",
            deterministicSignals: ["workHistorySignals", "recentRoles"],
            scoringGuidance: "Perakende sektorunde vardiyali calisma gecmisi varsa yuksek puan"
          },
          {
            key: "genel_profil", label: "Genel Profil", weight: 0.2,
            description: "Lokasyon, istihdam bosuklari, iletisim",
            deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo"],
            scoringGuidance: "Lokasyon uyumu, az bosluk, iletisim bilgisi tamsa yuksek puan"
          }
        ]
      }
    },
    {
      id: "rubric_fit_genel_v1",
      key: "fit_scoring_genel",
      domain: "genel",
      rubricJson: {
        schemaVersion: "fit_scoring_rubric.v1",
        roleFamily: "genel",
        categories: [
          {
            key: "deneyim_uyumu", label: "Deneyim Uyumu", weight: 0.3,
            description: "Is deneyimi ve sektor uyumu",
            deterministicSignals: ["recentRoles", "sectorSignals", "workHistorySignals", "estimatedYearsOfExperience"],
            scoringGuidance: "Ilgili sektor deneyimi varsa yuksek puan"
          },
          {
            key: "beceri_uyumu", label: "Beceri Uyumu", weight: 0.25,
            description: "Teknik ve mesleki beceriler",
            deterministicSignals: ["skills", "certifications"],
            scoringGuidance: "Pozisyon icin gerekli beceriler varsa yuksek puan"
          },
          {
            key: "egitim_sertifika", label: "Egitim ve Sertifika", weight: 0.2,
            description: "Egitim durumu ve mesleki sertifikalar",
            deterministicSignals: ["educationSummary", "certifications"],
            scoringGuidance: "Ilgili egitim veya sertifika varsa yuksek puan"
          },
          {
            key: "genel_profil", label: "Genel Profil", weight: 0.25,
            description: "Lokasyon, dil, istihdam bosuklari",
            deterministicSignals: ["locationSignals", "employmentGaps", "contactInfo", "languages"],
            scoringGuidance: "Lokasyon uyumu, dil becerisi, az bosluk varsa yuksek puan"
          }
        ]
      }
    }
  ];

  for (const rubric of fitScoringRubrics) {
    await prisma.scoringRubric.upsert({
      where: { id: rubric.id },
      update: {
        domain: rubric.domain,
        rubricJson: rubric.rubricJson,
        isActive: true
      },
      create: {
        id: rubric.id,
        tenantId,
        key: rubric.key,
        version: 1,
        domain: rubric.domain,
        rubricJson: rubric.rubricJson,
        isActive: true
      }
    });
  }
}

async function upsertJobs() {
  const jobs = [
    {
      id: "job_demo_warehouse",
      title: "Depo Operasyon Personeli",
      roleFamily: "warehouse",
      locationText: "Istanbul",
      shiftType: "vardiyali",
      salaryMin: 28000,
      salaryMax: 36000,
      status: "PUBLISHED",
      jdText:
        "Depo operasyonunda urun toplama, stok kontrolu, el terminali kullanimi ve guvenli ekipman prosedurleri.",
      requirements: [
        { id: "req_demo_shift", key: "shift_availability", value: "gece/hafta sonu vardiyasi", required: true },
        { id: "req_demo_lift", key: "physical_fit", value: "20 kg kaldirma", required: true }
      ]
    },
    {
      id: "job_demo_cashier",
      title: "Market Kasiyeri",
      roleFamily: "retail",
      locationText: "Ankara",
      shiftType: "tam_zamanli",
      salaryMin: 25000,
      salaryMax: 31000,
      status: "PUBLISHED",
      jdText: "Kasa islemleri, musteri karsilama, raf duzeni ve gun sonu kasa kapanis surecleri.",
      requirements: [
        { id: "req_demo_cashier_1", key: "customer_communication", value: "temel musteri iletisim", required: true },
        { id: "req_demo_cashier_2", key: "weekend_availability", value: "hafta sonu calisma", required: true }
      ]
    },
    {
      id: "job_demo_support",
      title: "Musteri Destek Temsilcisi",
      roleFamily: "entry_support",
      locationText: "Izmir",
      shiftType: "hibrit",
      salaryMin: 29000,
      salaryMax: 38000,
      status: "PUBLISHED",
      jdText: "Telefon/WhatsApp destek taleplerini yonetme, kayit acma ve ilk seviye cozum saglama.",
      requirements: [
        { id: "req_demo_support_1", key: "turkish_fluency", value: "akici turkce", required: true },
        { id: "req_demo_support_2", key: "basic_computer", value: "temel bilgisayar kullanimi", required: true }
      ]
    }
  ] as const;

  for (const job of jobs) {
    await prisma.job.upsert({
      where: { id: job.id },
      update: {
        tenantId,
        workspaceId,
        title: job.title,
        roleFamily: job.roleFamily,
        locationText: job.locationText,
        shiftType: job.shiftType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        status: job.status as never,
        jdText: job.jdText,
        createdBy: recruiterId
      },
      create: {
        id: job.id,
        tenantId,
        workspaceId,
        title: job.title,
        roleFamily: job.roleFamily,
        locationText: job.locationText,
        shiftType: job.shiftType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        status: job.status as never,
        jdText: job.jdText,
        createdBy: recruiterId
      }
    });

    for (const requirement of job.requirements) {
      await prisma.jobRequirement.upsert({
        where: { id: requirement.id },
        update: {
          tenantId,
          jobId: job.id,
          key: requirement.key,
          value: requirement.value,
          required: requirement.required
        },
        create: {
          id: requirement.id,
          tenantId,
          jobId: job.id,
          key: requirement.key,
          value: requirement.value,
          required: requirement.required
        }
      });
    }
  }
}

async function upsertCandidates() {
  const candidates = [
    {
      id: "cand_demo_ahmet",
      fullName: "Ahmet Kaya",
      phone: "905551112233",
      email: "ahmet.kaya@example.com",
      source: "referral"
    },
    {
      id: "cand_demo_zeynep",
      fullName: "Zeynep Demir",
      phone: "905559991122",
      email: "zeynep.demir@example.com",
      source: "kariyer_portali"
    },
    {
      id: "cand_demo_mehmet",
      fullName: "Mehmet Arslan",
      phone: "905554442211",
      email: "mehmet.arslan@example.com",
      source: "walk_in"
    },
    {
      id: "cand_demo_esra",
      fullName: "Esra Yilmaz",
      phone: "905557771133",
      email: "esra.yilmaz@example.com",
      source: "kariyer_portali"
    }
  ] as const;

  for (const candidate of candidates) {
    await prisma.candidate.upsert({
      where: { id: candidate.id },
      update: {
        tenantId,
        fullName: candidate.fullName,
        phone: candidate.phone,
        email: candidate.email,
        source: candidate.source
      },
      create: {
        id: candidate.id,
        tenantId,
        fullName: candidate.fullName,
        phone: candidate.phone,
        email: candidate.email,
        source: candidate.source
      }
    });
  }
}

async function upsertInterviewFoundation() {
  const templates = [
    {
      id: "tpl_demo_warehouse_v1",
      name: "Depo Operasyon Sesli İlk Görüşme V1",
      roleFamily: "warehouse",
      blocks: [
        {
          key: "recent_experience",
          questionKey: "q_exp_01",
          category: "recent_experience",
          prompt: "Son işinizde günlük görevlerinizi ve sorumluluklarınızı anlatır mısınız?",
          followUps: ["Son görevinizde sizi en çok zorlayan konu neydi?"],
          maxFollowUps: 1,
          minWords: 9,
          required: true
        },
        {
          key: "shift_availability",
          questionKey: "q_shift_01",
          category: "shift_availability",
          prompt: "Vardiyalı çalışma için uygunluğunuzu paylaşır mısınız?",
          followUps: ["Gece ve hafta sonu vardiyasında çalışmanız gerekirse nasıl planlarsınız?"],
          maxFollowUps: 1,
          minWords: 8,
          required: true
        },
        {
          key: "location_commute",
          questionKey: "q_location_01",
          category: "location_commute",
          prompt: "İşe ulaşım planınızı kısaca anlatır mısınız?",
          followUps: ["Yoğun saatlerde ulaşımda aksama olursa alternatifiniz nedir?"],
          maxFollowUps: 1,
          minWords: 7,
          required: true
        },
        {
          key: "motivation_communication",
          questionKey: "q_motivation_01",
          category: "motivation",
          prompt: "Bu rolü neden istiyorsunuz ve ekibe nasıl katkı sağlarsınız?",
          followUps: ["Son işinizde ekip iletişimiyle ilgili bir örnek paylaşır mısınız?"],
          maxFollowUps: 1,
          minWords: 10,
          required: true
        }
      ]
    },
    {
      id: "tpl_demo_retail_v1",
      name: "Perakende/Kasiyer Sesli İlk Görüşme V1",
      roleFamily: "retail",
      blocks: [
        {
          key: "recent_experience",
          questionKey: "q_cash_01",
          category: "recent_experience",
          prompt: "Yoğun kasa saatlerinde nasıl önceliklendirme yaptığınızı anlatır mısınız?",
          followUps: ["Aynı anda birden çok müşteri beklediğinde nasıl ilerlersiniz?"],
          maxFollowUps: 1,
          minWords: 8,
          required: true
        },
        {
          key: "customer_handling",
          questionKey: "q_customer_01",
          category: "communication",
          prompt: "Zor bir müşteri durumunu nasıl yönettiğinize dair örnek verir misiniz?",
          followUps: ["Durumu sakinleştirmek için kullandığınız yaklaşım neydi?"],
          maxFollowUps: 1,
          minWords: 9,
          required: true
        },
        {
          key: "shift_availability",
          questionKey: "q_shift_01",
          category: "shift_availability",
          prompt: "Hafta sonu ve akşam vardiyası için uygunluk durumunuz nedir?",
          followUps: ["Vardiya değişikliği gerektiğinde ne kadar esneksiniz?"],
          maxFollowUps: 1,
          minWords: 7,
          required: true
        }
      ]
    }
  ] as const;

  for (const template of templates) {
    await prisma.interviewTemplate.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        roleFamily: template.roleFamily,
        templateJson: {
          language: "tr-TR",
          introPrompt:
            "Merhaba, ben şirketimizin ilk görüşme asistanıyım. Soruları sırayla soracağım.",
          closingPrompt:
            "Teşekkür ederim. Görüşme çıktısı recruiter ekibi tarafından değerlendirilecek.",
          durationTargetMin: 16,
          blocks: template.blocks
        },
        rubricJson: {
          dimensions: [
            { key: "relevant_experience", weight: 0.32 },
            { key: "communication_clarity", weight: 0.22 },
            { key: "shift_fit", weight: 0.2 },
            { key: "motivation", weight: 0.16 },
            { key: "reliability_signals", weight: 0.1 }
          ]
        },
        isActive: true
      },
      create: {
        id: template.id,
        tenantId,
        name: template.name,
        roleFamily: template.roleFamily,
        templateJson: {
          language: "tr-TR",
          introPrompt:
            "Merhaba, ben şirketimizin ilk görüşme asistanıyım. Soruları sırayla soracağım.",
          closingPrompt:
            "Teşekkür ederim. Görüşme çıktısı recruiter ekibi tarafından değerlendirilecek.",
          durationTargetMin: 16,
          blocks: template.blocks
        },
        rubricJson: {
          dimensions: [
            { key: "relevant_experience", weight: 0.32 },
            { key: "communication_clarity", weight: 0.22 },
            { key: "shift_fit", weight: 0.2 },
            { key: "motivation", weight: 0.16 },
            { key: "reliability_signals", weight: 0.1 }
          ]
        },
        version: 1,
        isActive: true
      }
    });
  }

  await prisma.consentRecord.upsert({
    where: { id: "con_demo_1" },
    update: {
      consentGiven: true,
      noticeVersion: "kvkk_tr_v1_2026_03"
    },
    create: {
      id: "con_demo_1",
      tenantId,
      candidateId: "cand_demo_ahmet",
      context: "INTERVIEW_RECORDING",
      consentGiven: true,
      noticeVersion: "kvkk_tr_v1_2026_03",
      policyVersion: "policy_v1"
    }
  });

  await prisma.interviewSession.upsert({
    where: { id: "sess_demo_1" },
    update: {
      status: InterviewSessionStatus.COMPLETED,
      mode: InterviewMode.VOICE,
      scheduledAt: hoursAgo(23),
      scheduledBy: recruiterId,
      schedulingSource: "manual_recruiter",
      interviewerName: "Fatma Kaya",
      interviewType: "Yapılandırılmış Sesli Ön Görüşme",
      meetingProvider: null,
      meetingProviderSource: "web_voice_session_v1",
      meetingConnectionId: null,
      meetingJoinUrl: candidateInterviewUrl("sess_demo_1"),
      meetingExternalRef: "voice-sess_demo_1",
      meetingCalendarEventRef: null,
      candidateAccessToken: sessionAccessTokens.sess_demo_1,
      candidateAccessExpiresAt: hoursFromNow(96),
      candidateLocale: "tr-TR",
      runtimeMode: "guided_voice_turn_v1",
      runtimeProviderMode: "browser_native",
      voiceInputProvider: "browser_web_speech_api",
      voiceOutputProvider: "browser_speech_synthesis",
      currentQuestionIndex: 3,
      currentFollowUpCount: 0,
      currentQuestionKey: "q_motivation_01",
      completedReasonCode: "candidate_completed",
      lastCandidateActivityAt: hoursAgo(21),
      startedAt: hoursAgo(22),
      endedAt: hoursAgo(21)
    },
    create: {
      id: "sess_demo_1",
      tenantId,
      applicationId: "app_demo_ahmet_warehouse",
      templateId: "tpl_demo_warehouse_v1",
      mode: InterviewMode.VOICE,
      status: InterviewSessionStatus.COMPLETED,
      scheduledAt: hoursAgo(23),
      scheduledBy: recruiterId,
      schedulingSource: "manual_recruiter",
      interviewerName: "Fatma Kaya",
      interviewType: "Yapılandırılmış Sesli Ön Görüşme",
      meetingProviderSource: "web_voice_session_v1",
      meetingJoinUrl: candidateInterviewUrl("sess_demo_1"),
      meetingExternalRef: "voice-sess_demo_1",
      candidateAccessToken: sessionAccessTokens.sess_demo_1,
      candidateAccessExpiresAt: hoursFromNow(96),
      candidateLocale: "tr-TR",
      runtimeMode: "guided_voice_turn_v1",
      runtimeProviderMode: "browser_native",
      voiceInputProvider: "browser_web_speech_api",
      voiceOutputProvider: "browser_speech_synthesis",
      currentQuestionIndex: 3,
      currentFollowUpCount: 0,
      currentQuestionKey: "q_motivation_01",
      completedReasonCode: "candidate_completed",
      lastCandidateActivityAt: hoursAgo(21),
      startedAt: hoursAgo(22),
      endedAt: hoursAgo(21),
      consentRecordId: "con_demo_1"
    }
  });

  await prisma.interviewSession.upsert({
    where: { id: "sess_demo_2" },
    update: {
      status: InterviewSessionStatus.SCHEDULED,
      mode: InterviewMode.VOICE,
      scheduledAt: hoursFromNow(18),
      scheduledBy: recruiterId,
      schedulingSource: "manual_recruiter",
      scheduleNote: "Aday vardiya çıkışı sonrasında web sesli görüşmeye bağlanacak.",
      interviewerName: "Merve Cetin",
      interviewType: "Yapılandırılmış Sesli Ön Görüşme",
      meetingProvider: null,
      meetingProviderSource: "web_voice_session_v1",
      meetingConnectionId: null,
      meetingJoinUrl: candidateInterviewUrl("sess_demo_2"),
      meetingExternalRef: "voice-sess_demo_2",
      meetingCalendarEventRef: null,
      candidateAccessToken: sessionAccessTokens.sess_demo_2,
      candidateAccessExpiresAt: hoursFromNow(120),
      candidateLocale: "tr-TR",
      runtimeMode: "guided_voice_turn_v1",
      runtimeProviderMode: "browser_native",
      voiceInputProvider: null,
      voiceOutputProvider: null,
      currentQuestionIndex: 0,
      currentFollowUpCount: 0,
      currentQuestionKey: null,
      completedReasonCode: null,
      lastCandidateActivityAt: null,
      startedAt: null,
      endedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancelReasonCode: null
    },
    create: {
      id: "sess_demo_2",
      tenantId,
      applicationId: "app_demo_zeynep_cashier",
      templateId: "tpl_demo_retail_v1",
      mode: InterviewMode.VOICE,
      status: InterviewSessionStatus.SCHEDULED,
      scheduledAt: hoursFromNow(18),
      scheduledBy: recruiterId,
      schedulingSource: "manual_recruiter",
      scheduleNote: "Aday vardiya çıkışı sonrasında web sesli görüşmeye bağlanacak.",
      interviewerName: "Merve Cetin",
      interviewType: "Yapılandırılmış Sesli Ön Görüşme",
      meetingProviderSource: "web_voice_session_v1",
      meetingJoinUrl: candidateInterviewUrl("sess_demo_2"),
      meetingExternalRef: "voice-sess_demo_2",
      candidateAccessToken: sessionAccessTokens.sess_demo_2,
      candidateAccessExpiresAt: hoursFromNow(120),
      candidateLocale: "tr-TR",
      runtimeMode: "guided_voice_turn_v1",
      runtimeProviderMode: "browser_native",
      currentQuestionIndex: 0,
      currentFollowUpCount: 0
    }
  });

  await prisma.interviewSession.upsert({
    where: { id: "sess_demo_3" },
    update: {
      status: InterviewSessionStatus.FAILED,
      mode: InterviewMode.VOICE,
      scheduledAt: hoursAgo(6),
      scheduledBy: recruiterId,
      schedulingSource: "manual_recruiter",
      scheduleNote: "Aday görüşmeyi başlattı ancak yarıda bıraktı.",
      interviewerName: "Merve Cetin",
      interviewType: "Yapılandırılmış Sesli Ön Görüşme",
      meetingProvider: null,
      meetingProviderSource: "web_voice_session_v1",
      meetingConnectionId: null,
      meetingJoinUrl: candidateInterviewUrl("sess_demo_3"),
      meetingExternalRef: "voice-sess_demo_3",
      meetingCalendarEventRef: null,
      candidateAccessToken: sessionAccessTokens.sess_demo_3,
      candidateAccessExpiresAt: hoursFromNow(48),
      candidateLocale: "tr-TR",
      runtimeMode: "guided_voice_turn_v1",
      runtimeProviderMode: "manual_fallback",
      voiceInputProvider: "manual_text_fallback",
      voiceOutputProvider: "browser_speech_synthesis",
      currentQuestionIndex: 1,
      currentFollowUpCount: 1,
      currentQuestionKey: "q_customer_01",
      startedAt: hoursAgo(5.8),
      endedAt: hoursAgo(5),
      abandonedAt: hoursAgo(5),
      completedReasonCode: "candidate_abandoned",
      lastCandidateActivityAt: hoursAgo(5.2),
      cancelledAt: null,
      cancelledBy: null,
      cancelReasonCode: null,
      rescheduleCount: 1,
      lastRescheduledAt: hoursAgo(7),
      lastRescheduledBy: recruiterId,
      lastRescheduleReasonCode: "candidate_requested"
    },
    create: {
      id: "sess_demo_3",
      tenantId,
      applicationId: "app_demo_esra_cashier",
      templateId: "tpl_demo_retail_v1",
      mode: InterviewMode.VOICE,
      status: InterviewSessionStatus.FAILED,
      scheduledAt: hoursAgo(6),
      scheduledBy: recruiterId,
      schedulingSource: "manual_recruiter",
      scheduleNote: "Aday görüşmeyi başlattı ancak yarıda bıraktı.",
      interviewerName: "Merve Cetin",
      interviewType: "Yapılandırılmış Sesli Ön Görüşme",
      meetingProviderSource: "web_voice_session_v1",
      meetingJoinUrl: candidateInterviewUrl("sess_demo_3"),
      meetingExternalRef: "voice-sess_demo_3",
      candidateAccessToken: sessionAccessTokens.sess_demo_3,
      candidateAccessExpiresAt: hoursFromNow(48),
      candidateLocale: "tr-TR",
      runtimeMode: "guided_voice_turn_v1",
      runtimeProviderMode: "manual_fallback",
      voiceInputProvider: "manual_text_fallback",
      voiceOutputProvider: "browser_speech_synthesis",
      currentQuestionIndex: 1,
      currentFollowUpCount: 1,
      currentQuestionKey: "q_customer_01",
      startedAt: hoursAgo(5.8),
      abandonedAt: hoursAgo(5),
      completedReasonCode: "candidate_abandoned",
      lastCandidateActivityAt: hoursAgo(5.2),
      endedAt: hoursAgo(5),
      rescheduleCount: 1,
      lastRescheduledAt: hoursAgo(7),
      lastRescheduledBy: recruiterId,
      lastRescheduleReasonCode: "candidate_requested"
    }
  });

  await prisma.externalIdentityMapping.deleteMany({
    where: {
      tenantId,
      internalEntityType: "InterviewSession",
      internalEntityId: {
        in: ["sess_demo_1", "sess_demo_2", "sess_demo_3"]
      }
    }
  });

  await prisma.transcript.upsert({
    where: { sessionId: "sess_demo_1" },
    update: {
      ownerType: "INTERVIEW_SESSION",
      ownerId: "sess_demo_1",
      ingestionMethod: "stream_segments",
      ingestionStatus: "available",
      qualityScore: 0.87,
      qualityStatus: "VERIFIED",
      qualityReviewedBy: recruiterId,
      qualityReviewedAt: hoursAgo(20),
      finalizedAt: hoursAgo(20)
    },
    create: {
      id: "trn_demo_1",
      tenantId,
      sessionId: "sess_demo_1",
      ownerType: "INTERVIEW_SESSION",
      ownerId: "sess_demo_1",
      language: "tr-TR",
      sttModel: "browser_web_speech_api",
      ingestionMethod: "stream_segments",
      ingestionStatus: "available",
      qualityScore: 0.87,
      qualityStatus: "VERIFIED",
      qualityReviewedBy: recruiterId,
      qualityReviewedAt: hoursAgo(20),
      finalizedAt: hoursAgo(20)
    }
  });

  const segments = [
    {
      id: "seg_demo_1",
      speaker: "AI",
      text: "Merhaba Ahmet Bey, son işinizde günlük görevlerinizi ve sorumluluklarınızı anlatır mısınız?",
      startMs: 1000,
      endMs: 6100,
      confidence: null
    },
    {
      id: "seg_demo_2",
      speaker: "CANDIDATE",
      text: "Son işimde ürün toplama, barkod kontrolü ve sevkiyat hazırlama yaptım. Vardiyalı düzende çalıştım.",
      startMs: 6400,
      endMs: 12900,
      confidence: 0.88
    },
    {
      id: "seg_demo_3",
      speaker: "AI",
      text: "Vardiyalı çalışma için uygunluğunuzu biraz daha açabilir misiniz?",
      startMs: 13400,
      endMs: 18800,
      confidence: null
    },
    {
      id: "seg_demo_4",
      speaker: "CANDIDATE",
      text: "Gece ve hafta sonu vardiyasında çalışabilirim. Ulaşım için servis hattını kullanıyorum.",
      startMs: 19100,
      endMs: 26000,
      confidence: 0.9
    },
    {
      id: "seg_demo_5",
      speaker: "AI",
      text: "Forklift belgeniz ve ekip iletişimi tarafını da kısaca aktarır mısınız?",
      startMs: 26500,
      endMs: 32000,
      confidence: null
    },
    {
      id: "seg_demo_6",
      speaker: "CANDIDATE",
      text: "Belgem yenilemede, iki hafta içinde teslim alacağım. Ekip içinde vardiya teslimlerini yazılı yapıyorum.",
      startMs: 32300,
      endMs: 40200,
      confidence: 0.87
    }
  ] as const;

  for (const segment of segments) {
    await prisma.transcriptSegment.upsert({
      where: { id: segment.id },
      update: {
        tenantId,
        transcriptId: "trn_demo_1",
        speaker: segment.speaker as never,
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
        confidence: segment.confidence
      },
      create: {
        id: segment.id,
        tenantId,
        transcriptId: "trn_demo_1",
        speaker: segment.speaker as never,
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
        confidence: segment.confidence
      }
    });
  }

  await prisma.transcript.upsert({
    where: { sessionId: "sess_demo_3" },
    update: {
      ownerType: "INTERVIEW_SESSION",
      ownerId: "sess_demo_3",
      language: "tr-TR",
      sttModel: "manual_text_fallback",
      ingestionMethod: "stream_segments",
      ingestionStatus: "available",
      qualityStatus: "DRAFT",
      qualityScore: null,
      qualityReviewedBy: null,
      qualityReviewedAt: null,
      finalizedAt: null
    },
    create: {
      id: "trn_demo_3",
      tenantId,
      sessionId: "sess_demo_3",
      ownerType: "INTERVIEW_SESSION",
      ownerId: "sess_demo_3",
      language: "tr-TR",
      sttModel: "manual_text_fallback",
      ingestionMethod: "stream_segments",
      ingestionStatus: "available",
      qualityStatus: "DRAFT"
    }
  });

  const abortedSegments = [
    {
      id: "seg_demo_3_1",
      speaker: "AI",
      text: "Yoğun kasa saatlerinde nasıl önceliklendirme yaptığınızı anlatır mısınız?",
      startMs: 1000,
      endMs: 5600,
      confidence: null
    },
    {
      id: "seg_demo_3_2",
      speaker: "CANDIDATE",
      text: "Önce kasa kuyruğunu azaltırım, sonra iade işlemlerini sıraya koyarım.",
      startMs: 5900,
      endMs: 11800,
      confidence: 0.82
    },
    {
      id: "seg_demo_3_3",
      speaker: "AI",
      text: "Aynı anda birden çok müşteri beklediğinde nasıl ilerlersiniz?",
      startMs: 12100,
      endMs: 16500,
      confidence: null
    }
  ] as const;

  for (const segment of abortedSegments) {
    await prisma.transcriptSegment.upsert({
      where: { id: segment.id },
      update: {
        tenantId,
        transcriptId: "trn_demo_3",
        speaker: segment.speaker as never,
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
        confidence: segment.confidence
      },
      create: {
        id: segment.id,
        tenantId,
        transcriptId: "trn_demo_3",
        speaker: segment.speaker as never,
        text: segment.text,
        startMs: segment.startMs,
        endMs: segment.endMs,
        confidence: segment.confidence
      }
    });
  }

  const turns = [
    {
      id: "turn_demo_ahmet_1",
      sessionId: "sess_demo_1",
      sequenceNo: 1,
      blockKey: "recent_experience",
      questionKey: "q_exp_01",
      category: "recent_experience",
      kind: "PRIMARY",
      promptText: "Merhaba, son işinizde günlük görevlerinizi ve sorumluluklarınızı anlatır mısınız?",
      followUpDepth: 0,
      answerText:
        "Son işimde ürün toplama, barkod kontrolü ve sevkiyat hazırlama yaptım. Vardiyalı düzende çalıştım.",
      completionStatus: "ANSWERED",
      transitionDecision: "advance_candidate",
      decisionReason: "cevap_yeterli",
      promptSegmentId: "seg_demo_1",
      answerSegmentId: "seg_demo_2"
    },
    {
      id: "turn_demo_ahmet_2",
      sessionId: "sess_demo_1",
      sequenceNo: 2,
      blockKey: "shift_availability",
      questionKey: "q_shift_01",
      category: "shift_availability",
      kind: "PRIMARY",
      promptText: "Vardiyalı çalışma için uygunluğunuzu biraz daha açabilir misiniz?",
      followUpDepth: 0,
      answerText:
        "Gece ve hafta sonu vardiyasında çalışabilirim. Ulaşım için servis hattını kullanıyorum.",
      completionStatus: "ANSWERED",
      transitionDecision: "advance_candidate",
      decisionReason: "cevap_yeterli",
      promptSegmentId: "seg_demo_3",
      answerSegmentId: "seg_demo_4"
    },
    {
      id: "turn_demo_ahmet_3",
      sessionId: "sess_demo_1",
      sequenceNo: 3,
      blockKey: "motivation_communication",
      questionKey: "q_motivation_01",
      category: "motivation",
      kind: "PRIMARY",
      promptText: "Forklift belgeniz ve ekip iletişimi tarafını da kısaca aktarır mısınız?",
      followUpDepth: 0,
      answerText:
        "Belgem yenilemede, iki hafta içinde teslim alacağım. Ekip içinde vardiya teslimlerini yazılı yapıyorum.",
      completionStatus: "ANSWERED",
      transitionDecision: "advance_candidate",
      decisionReason: "cevap_yeterli",
      promptSegmentId: "seg_demo_5",
      answerSegmentId: "seg_demo_6"
    },
    {
      id: "turn_demo_esra_1",
      sessionId: "sess_demo_3",
      sequenceNo: 1,
      blockKey: "recent_experience",
      questionKey: "q_cash_01",
      category: "recent_experience",
      kind: "PRIMARY",
      promptText: "Yoğun kasa saatlerinde nasıl önceliklendirme yaptığınızı anlatır mısınız?",
      followUpDepth: 0,
      answerText: "Önce kasa kuyruğunu azaltırım, sonra iade işlemlerini sıraya koyarım.",
      completionStatus: "ANSWERED",
      transitionDecision: "follow_up_candidate",
      decisionReason: "cevap_temel_duzey",
      promptSegmentId: "seg_demo_3_1",
      answerSegmentId: "seg_demo_3_2"
    },
    {
      id: "turn_demo_esra_2",
      sessionId: "sess_demo_3",
      sequenceNo: 2,
      blockKey: "recent_experience",
      questionKey: "q_cash_01",
      category: "recent_experience",
      kind: "FOLLOW_UP",
      promptText: "Aynı anda birden çok müşteri beklediğinde nasıl ilerlersiniz?",
      followUpDepth: 1,
      answerText: null,
      completionStatus: "ASKED",
      transitionDecision: null,
      decisionReason: null,
      promptSegmentId: "seg_demo_3_3",
      answerSegmentId: null
    }
  ] as const;

  for (const turn of turns) {
    await prisma.interviewTurn.upsert({
      where: { id: turn.id },
      update: {
        tenantId,
        sessionId: turn.sessionId,
        sequenceNo: turn.sequenceNo,
        blockKey: turn.blockKey,
        questionKey: turn.questionKey,
        category: turn.category,
        kind: turn.kind,
        promptText: turn.promptText,
        followUpDepth: turn.followUpDepth,
        answerText: turn.answerText,
        completionStatus: turn.completionStatus,
        transitionDecision: turn.transitionDecision,
        decisionReason: turn.decisionReason,
        promptSegmentId: turn.promptSegmentId,
        answerSegmentId: turn.answerSegmentId,
        answerSource: "voice_browser",
        answerLanguage: "tr-TR",
        answerConfidence: turn.answerText ? 0.84 : null,
        answerSubmittedAt: turn.answerText ? hoursAgo(21) : null,
        metadata: {
          source: "seed_voice_runtime"
        }
      },
      create: {
        id: turn.id,
        tenantId,
        sessionId: turn.sessionId,
        sequenceNo: turn.sequenceNo,
        blockKey: turn.blockKey,
        questionKey: turn.questionKey,
        category: turn.category,
        kind: turn.kind,
        promptText: turn.promptText,
        followUpDepth: turn.followUpDepth,
        answerText: turn.answerText,
        completionStatus: turn.completionStatus,
        transitionDecision: turn.transitionDecision,
        decisionReason: turn.decisionReason,
        promptSegmentId: turn.promptSegmentId,
        answerSegmentId: turn.answerSegmentId,
        answerSource: "voice_browser",
        answerLanguage: "tr-TR",
        answerConfidence: turn.answerText ? 0.84 : null,
        answerSubmittedAt: turn.answerText ? hoursAgo(21) : null,
        metadata: {
          source: "seed_voice_runtime"
        }
      }
    });
  }
}

async function upsertSchedulingWorkflowSeeds() {
  const workflows = [
    {
      id: "swf_demo_internal_fallback",
      applicationId: "app_demo_zeynep_cashier",
      provider: null,
      state: "SLOT_PROPOSAL_READY",
      status: "ACTIVE",
      recruiterConstraintsJson: {
        timezone: "Europe/Istanbul",
        slotDurationMinutes: 45,
        windows: [
          {
            start: hoursFromNow(24).toISOString(),
            end: hoursFromNow(27).toISOString()
          }
        ]
      },
      candidateAvailabilityJson: {
        timezone: "Europe/Istanbul",
        windows: [
          {
            start: hoursFromNow(25).toISOString(),
            end: hoursFromNow(28).toISOString()
          }
        ]
      },
      proposedSlotsJson: [
        {
          slotId: "slot_demo_internal_1",
          start: hoursFromNow(25).toISOString(),
          end: hoursFromNow(25.75).toISOString(),
          source: "intersection"
        }
      ],
      selectedSlotJson: null,
      bookingResultJson: null
    },
    {
      id: "swf_demo_calendly_needs_auth",
      applicationId: "app_demo_mehmet_support",
      provider: "CALENDLY",
      state: "SLOT_SELECTED",
      status: "ACTIVE",
      recruiterConstraintsJson: {
        timezone: "Europe/Istanbul",
        slotDurationMinutes: 30,
        windows: [
          {
            start: hoursFromNow(40).toISOString(),
            end: hoursFromNow(43).toISOString()
          }
        ]
      },
      candidateAvailabilityJson: {
        timezone: "Europe/Istanbul",
        windows: [
          {
            start: hoursFromNow(40.5).toISOString(),
            end: hoursFromNow(42.5).toISOString()
          }
        ]
      },
      proposedSlotsJson: [
        {
          slotId: "slot_demo_calendly_1",
          start: hoursFromNow(41).toISOString(),
          end: hoursFromNow(41.5).toISOString(),
          source: "intersection"
        }
      ],
      selectedSlotJson: {
        slotId: "slot_demo_calendly_1",
        start: hoursFromNow(41).toISOString(),
        end: hoursFromNow(41.5).toISOString(),
        source: "intersection"
      },
      bookingResultJson: {
        status: "awaiting_calendly_auth"
      }
    },
    {
      id: "swf_demo_provider_ready",
      applicationId: "app_demo_ahmet_warehouse",
      provider: "ZOOM",
      state: "BOOKED",
      status: "COMPLETED",
      recruiterConstraintsJson: {
        timezone: "Europe/Istanbul",
        slotDurationMinutes: 45
      },
      candidateAvailabilityJson: {
        timezone: "Europe/Istanbul"
      },
      proposedSlotsJson: [
        {
          slotId: "slot_demo_ready_1",
          start: hoursAgo(24).toISOString(),
          end: hoursAgo(23.25).toISOString(),
          source: "template_provider"
        }
      ],
      selectedSlotJson: {
        slotId: "slot_demo_ready_1",
        start: hoursAgo(24).toISOString(),
        end: hoursAgo(23.25).toISOString(),
        source: "template_provider"
      },
      bookingResultJson: {
        provider: "ZOOM",
        providerSource: "provider_connection_template",
        joinUrl: "https://zoom.demo.local/rooms/zoom-seed"
      }
    }
  ] as const;

  for (const workflow of workflows) {
    await prisma.schedulingWorkflow.upsert({
      where: {
        id: workflow.id
      },
      update: {
        tenantId,
        applicationId: workflow.applicationId,
        provider: workflow.provider as never,
        source: "assistant",
        state: workflow.state as never,
        status: workflow.status as never,
        recruiterConstraintsJson: workflow.recruiterConstraintsJson,
        candidateAvailabilityJson: workflow.candidateAvailabilityJson,
        proposedSlotsJson: workflow.proposedSlotsJson as Prisma.InputJsonValue,
        selectedSlotJson: workflow.selectedSlotJson as Prisma.InputJsonValue,
        bookingResultJson: workflow.bookingResultJson as Prisma.InputJsonValue,
        conversationContextJson: {
          seeded: true
        },
        initiatedBy: recruiterId,
        updatedBy: recruiterId,
        lastError: null
      },
      create: {
        id: workflow.id,
        tenantId,
        applicationId: workflow.applicationId,
        provider: workflow.provider as never,
        source: "assistant",
        state: workflow.state as never,
        status: workflow.status as never,
        recruiterConstraintsJson: workflow.recruiterConstraintsJson,
        candidateAvailabilityJson: workflow.candidateAvailabilityJson,
        proposedSlotsJson: workflow.proposedSlotsJson as Prisma.InputJsonValue,
        selectedSlotJson: workflow.selectedSlotJson as Prisma.InputJsonValue,
        bookingResultJson: workflow.bookingResultJson as Prisma.InputJsonValue,
        conversationContextJson: {
          seeded: true
        },
        initiatedBy: recruiterId,
        updatedBy: recruiterId
      }
    });
  }
}

async function upsertApplications() {
  const applications = [
    {
      id: "app_demo_ahmet_warehouse",
      candidateId: "cand_demo_ahmet",
      jobId: "job_demo_warehouse",
      currentStage: ApplicationStage.RECRUITER_REVIEW,
      aiRecommendation: Recommendation.HOLD
    },
    {
      id: "app_demo_zeynep_cashier",
      candidateId: "cand_demo_zeynep",
      jobId: "job_demo_cashier",
      currentStage: ApplicationStage.INTERVIEW_SCHEDULED,
      aiRecommendation: null
    },
    {
      id: "app_demo_mehmet_support",
      candidateId: "cand_demo_mehmet",
      jobId: "job_demo_support",
      currentStage: ApplicationStage.APPLIED,
      aiRecommendation: null
    },
    {
      id: "app_demo_esra_cashier",
      candidateId: "cand_demo_esra",
      jobId: "job_demo_cashier",
      currentStage: ApplicationStage.SCREENING,
      aiRecommendation: null
    }
  ] as const;

  for (const application of applications) {
    await prisma.candidateApplication.upsert({
      where: { id: application.id },
      update: {
        tenantId,
        candidateId: application.candidateId,
        jobId: application.jobId,
        currentStage: application.currentStage,
        stageUpdatedAt: hoursAgo(12),
        aiRecommendation: application.aiRecommendation,
        humanDecisionRequired: true
      },
      create: {
        id: application.id,
        tenantId,
        candidateId: application.candidateId,
        jobId: application.jobId,
        currentStage: application.currentStage,
        stageUpdatedAt: hoursAgo(12),
        aiRecommendation: application.aiRecommendation,
        humanDecisionRequired: true
      }
    });
  }

  const stageHistory = [
    {
      id: "stg_demo_ahmet_1",
      applicationId: "app_demo_ahmet_warehouse",
      fromStage: null,
      toStage: ApplicationStage.APPLIED,
      reasonCode: "application_created",
      changedBy: recruiterId,
      changedAt: hoursAgo(48)
    },
    {
      id: "stg_demo_ahmet_2",
      applicationId: "app_demo_ahmet_warehouse",
      fromStage: ApplicationStage.APPLIED,
      toStage: ApplicationStage.INTERVIEW_COMPLETED,
      reasonCode: "interview_finished",
      changedBy: recruiterId,
      changedAt: hoursAgo(23)
    },
    {
      id: "stg_demo_ahmet_3",
      applicationId: "app_demo_ahmet_warehouse",
      fromStage: ApplicationStage.INTERVIEW_COMPLETED,
      toStage: ApplicationStage.RECRUITER_REVIEW,
      reasonCode: "review_pack_ready",
      changedBy: recruiterId,
      changedAt: hoursAgo(20)
    },
    {
      id: "stg_demo_zeynep_1",
      applicationId: "app_demo_zeynep_cashier",
      fromStage: null,
      toStage: ApplicationStage.APPLIED,
      reasonCode: "application_created",
      changedBy: recruiterId,
      changedAt: hoursAgo(36)
    },
    {
      id: "stg_demo_zeynep_2",
      applicationId: "app_demo_zeynep_cashier",
      fromStage: ApplicationStage.APPLIED,
      toStage: ApplicationStage.SCREENING,
      reasonCode: "screening_started",
      changedBy: recruiterId,
      changedAt: hoursAgo(30)
    },
    {
      id: "stg_demo_zeynep_3",
      applicationId: "app_demo_zeynep_cashier",
      fromStage: ApplicationStage.SCREENING,
      toStage: ApplicationStage.INTERVIEW_SCHEDULED,
      reasonCode: "interview_session_scheduled",
      changedBy: recruiterId,
      changedAt: hoursAgo(4)
    },
    {
      id: "stg_demo_mehmet_1",
      applicationId: "app_demo_mehmet_support",
      fromStage: null,
      toStage: ApplicationStage.APPLIED,
      reasonCode: "application_created",
      changedBy: recruiterId,
      changedAt: hoursAgo(10)
    },
    {
      id: "stg_demo_esra_1",
      applicationId: "app_demo_esra_cashier",
      fromStage: null,
      toStage: ApplicationStage.APPLIED,
      reasonCode: "application_created",
      changedBy: recruiterId,
      changedAt: hoursAgo(18)
    },
    {
      id: "stg_demo_esra_2",
      applicationId: "app_demo_esra_cashier",
      fromStage: ApplicationStage.APPLIED,
      toStage: ApplicationStage.SCREENING,
      reasonCode: "screening_started",
      changedBy: recruiterId,
      changedAt: hoursAgo(16)
    },
    {
      id: "stg_demo_esra_3",
      applicationId: "app_demo_esra_cashier",
      fromStage: ApplicationStage.SCREENING,
      toStage: ApplicationStage.INTERVIEW_SCHEDULED,
      reasonCode: "interview_session_scheduled",
      changedBy: recruiterId,
      changedAt: hoursAgo(8)
    },
    {
      id: "stg_demo_esra_4",
      applicationId: "app_demo_esra_cashier",
      fromStage: ApplicationStage.INTERVIEW_SCHEDULED,
      toStage: ApplicationStage.SCREENING,
      reasonCode: "interview_session_abandoned",
      changedBy: recruiterId,
      changedAt: hoursAgo(5)
    }
  ] as const;

  for (const item of stageHistory) {
    await prisma.candidateStageHistory.upsert({
      where: { id: item.id },
      update: {
        tenantId,
        applicationId: item.applicationId,
        fromStage: item.fromStage,
        toStage: item.toStage,
        reasonCode: item.reasonCode,
        changedBy: item.changedBy,
        changedAt: item.changedAt
      },
      create: {
        id: item.id,
        tenantId,
        applicationId: item.applicationId,
        fromStage: item.fromStage,
        toStage: item.toStage,
        reasonCode: item.reasonCode,
        changedBy: item.changedBy,
        changedAt: item.changedAt
      }
    });
  }
}

async function upsertCvData() {
  const files = [
    {
      id: "cv_demo_ahmet_1",
      candidateId: "cand_demo_ahmet",
      originalName: "ahmet-kaya-cv.txt",
      uploadedAt: hoursAgo(72),
      profileId: "cv_profile_demo_ahmet",
      aiTaskRunId: "task_demo_ahmet_cv",
      content: [
        "Ahmet Kaya",
        "Telefon: +90 555 111 22 33",
        "E-posta: ahmet.kaya@example.com",
        "Lokasyon: Istanbul",
        "",
        "Deneyim",
        "2021 - 2024 | Depo Operasyon Personeli | Kuzey Lojistik",
        "2019 - 2021 | Depo Elemani | Anadolu Dagitim",
        "Gorevler: urun toplama, sevkiyat hazirlama, stok kontrolu, el terminali kullanimi",
        "",
        "Egitim",
        "Meslek Lisesi - Lojistik (2018)",
        "",
        "Sertifikalar",
        "Forklift Operator Sertifikasi (yenileme surecinde)",
        "",
        "Beceriler",
        "forklift, stok sayimi, vardiya duzeni, ekip koordinasyonu",
        "",
        "Diller",
        "Turkce, temel Ingilizce"
      ].join("\n"),
      profileJson: {
        schemaVersion: "cv_profile.v1.tr",
        source: {
          cvFileId: "cv_demo_ahmet_1",
          candidateId: "cand_demo_ahmet",
          extractionStatus: "extracted",
          extractionMethod: "utf8_plain_text",
          providerMode: "deterministic_fallback",
          providerKey: "deterministic-fallback",
          parsedAt: hoursAgo(70).toISOString()
        },
        extractedFacts: {
          fullName: "Ahmet Kaya",
          contacts: {
            emails: ["ahmet.kaya@example.com"],
            phones: ["905551112233"]
          },
          languages: ["Turkce", "Ingilizce"],
          workHistorySignals: [
            "2021 - 2024 | Depo Operasyon Personeli | Kuzey Lojistik",
            "2019 - 2021 | Depo Elemani | Anadolu Dagitim"
          ],
          recentRoles: ["Depo Operasyon Personeli"],
          sectorSignals: ["Depo/Lojistik"],
          yearsExperienceEstimate: 5,
          educationSummary: ["Meslek Lisesi - Lojistik (2018)"],
          certifications: ["Forklift Operator Sertifikasi (yenileme surecinde)"],
          skills: ["forklift", "stok sayimi", "vardiya duzeni"],
          locationSignals: ["Istanbul"]
        },
        normalizedSummary: {
          shortSummary: "Adayin depo ve vardiya deneyimi role uyum sinyali veriyor.",
          coreWorkHistorySummary:
            "Depo operasyonu, stok kontrolu ve sevkiyat hazirlama adimlarinda deneyim mevcut.",
          likelyFitSignals: ["Depo/Lojistik", "Vardiya uyumu"],
          recruiterFollowUpTopics: ["Forklift sertifika belgesinin dogrulanmasi"]
        },
        inferredObservations: [
          {
            observation: "Depo operasyonunda hizli adapte olma ihtimali yuksek olabilir.",
            confidence: 0.64,
            rationale: "Birden fazla depo rol sinyali bulundu.",
            uncertain: true
          }
        ],
        missingCriticalInformation: ["sertifika_dogrulama_dokumani"],
        uncertaintyNotes: ["Forklift sertifikasi yenileme sureci tamamlanmamis olabilir."],
        aiSections: {
          facts: [
            "Aday depo operasyonunda 5 yila yakin deneyim sinyali veriyor.",
            "Vardiya calisma sinyali mevcut."
          ],
          interpretation: [
            "Sertifika dogrulamasi tamamlanmadan nihai karar verilmemeli."
          ],
          recommendation: {
            summary: "Sertifika teyidi sonrasi recruiter degerlendirmesi ile ilerleyin.",
            action: "Belgeyi dogrulayip screening notunu guncelleyin.",
            recommendedOutcome: "REVIEW"
          }
        }
      },
      parseConfidence: 0.78
    },
    {
      id: "cv_demo_zeynep_1",
      candidateId: "cand_demo_zeynep",
      originalName: "zeynep-demir-cv.txt",
      uploadedAt: hoursAgo(40),
      profileId: "cv_profile_demo_zeynep",
      aiTaskRunId: null,
      content: [
        "Zeynep Demir",
        "Telefon: +90 555 999 11 22",
        "E-posta: zeynep.demir@example.com",
        "Lokasyon: Ankara",
        "",
        "Deneyim",
        "2022 - 2024 | Kasiyer | Mahalle Market",
        "2021 - 2022 | Satis Danismani | Perakende Magaza",
        "Gorevler: kasa islemleri, iade sureci, musteri karsilama",
        "",
        "Egitim",
        "Anadolu Lisesi (2020)",
        "",
        "Beceriler",
        "kasa islemleri, musteri iletisim, vardiya planina uyum",
        "",
        "Diller",
        "Turkce"
      ].join("\n"),
      profileJson: {
        schemaVersion: "cv_profile.v1.tr",
        source: {
          cvFileId: "cv_demo_zeynep_1",
          candidateId: "cand_demo_zeynep",
          extractionStatus: "extracted",
          extractionMethod: "utf8_plain_text",
          providerMode: "deterministic_fallback",
          providerKey: "deterministic-fallback",
          parsedAt: hoursAgo(38).toISOString()
        },
        extractedFacts: {
          fullName: "Zeynep Demir",
          contacts: {
            emails: ["zeynep.demir@example.com"],
            phones: ["905559991122"]
          },
          languages: ["Turkce"],
          workHistorySignals: [
            "2022 - 2024 | Kasiyer | Mahalle Market",
            "2021 - 2022 | Satis Danismani | Perakende Magaza"
          ],
          recentRoles: ["Kasiyer", "Satis Danismani"],
          sectorSignals: ["Perakende"],
          yearsExperienceEstimate: 3,
          educationSummary: ["Anadolu Lisesi (2020)"],
          certifications: [],
          skills: ["kasa islemleri", "musteri iletisim", "vardiya uyumu"],
          locationSignals: ["Ankara"]
        },
        normalizedSummary: {
          shortSummary: "Perakende ve kasa deneyimi kasiyer rolune temel uyum sinyali veriyor.",
          coreWorkHistorySummary:
            "Kasada operasyon, musteri iletisim ve iade sureci deneyimi bulunuyor.",
          likelyFitSignals: ["Kasiyer", "Musteri iletisim"],
          recruiterFollowUpTopics: ["Hafta sonu vardiya esnekliginin teyidi"]
        },
        inferredObservations: [],
        missingCriticalInformation: [],
        uncertaintyNotes: [],
        aiSections: {
          facts: [
            "Adayin kasiyer ve satis danismani deneyimi var.",
            "Musteri iletisim sinyalleri mevcut."
          ],
          interpretation: [
            "Perakende rolune gecis icin temel yeterlilik sinyali goruluyor."
          ],
          recommendation: {
            summary: "Kisa bir musteri senaryosu gorusmesi sonrasi screening tamamlanabilir.",
            action: "Musteri memnuniyeti senaryosu ile follow-up yapin.",
            recommendedOutcome: "REVIEW"
          }
        }
      },
      parseConfidence: 0.81
    }
  ] as const;

  for (const file of files) {
    const storageKey = `${tenantId}/candidates/${file.candidateId}/${file.id}/${file.id}.txt`;
    const stored = await writeSeedCvFile(storageKey, file.content);

    await prisma.cVFile.upsert({
      where: { id: file.id },
      update: {
        tenantId,
        candidateId: file.candidateId,
        storageKey,
        originalName: file.originalName,
        mimeType: "text/plain",
        sizeBytes: stored.sizeBytes,
        storageProvider: "local_fs",
        checksumSha256: stored.checksumSha256,
        uploadedBy: recruiterId,
        isPrimary: true,
        uploadedAt: file.uploadedAt
      },
      create: {
        id: file.id,
        tenantId,
        candidateId: file.candidateId,
        storageKey,
        originalName: file.originalName,
        mimeType: "text/plain",
        sizeBytes: stored.sizeBytes,
        storageProvider: "local_fs",
        checksumSha256: stored.checksumSha256,
        uploadedBy: recruiterId,
        isPrimary: true,
        uploadedAt: file.uploadedAt
      }
    });

    await prisma.cVParsedProfile.upsert({
      where: { id: file.profileId },
      update: {
        tenantId,
        cvFileId: file.id,
        aiTaskRunId: file.aiTaskRunId,
        profileJson: file.profileJson,
        parseConfidence: file.parseConfidence,
        requiresManualReview: false,
        providerMode: "deterministic_fallback",
        providerKey: "deterministic-fallback",
        modelKey: "deterministic-fallback",
        uncertaintyJson: {
          level: "orta",
          confidence: file.parseConfidence,
          reasons:
            file.id === "cv_demo_ahmet_1"
              ? ["Sertifika dogrulamasi tamamlanmadi."]
              : []
        }
      },
      create: {
        id: file.profileId,
        tenantId,
        cvFileId: file.id,
        aiTaskRunId: file.aiTaskRunId,
        profileJson: file.profileJson as Prisma.InputJsonValue,
        parseConfidence: file.parseConfidence,
        requiresManualReview: false,
        providerMode: "deterministic_fallback",
        providerKey: "deterministic-fallback",
        modelKey: "deterministic-fallback",
        uncertaintyJson: {
          level: "orta",
          confidence: file.parseConfidence,
          reasons:
            file.id === "cv_demo_ahmet_1"
              ? ["Sertifika dogrulamasi tamamlanmadi."]
              : []
        }
      }
    });
  }
}

async function upsertAiArtifacts() {
  await prisma.aiReport.upsert({
    where: { id: "rep_demo_ahmet_1" },
    update: {
      transcriptId: "trn_demo_1",
      rubricKey: "interview_template:tpl_demo_warehouse_v1",
      rubricVersion: 1,
      recommendation: Recommendation.HOLD,
      confidence: 0.79,
      overallScore: 0.74,
      modelName: "deterministic-fallback",
      promptVersion: "report_generation_tr_v1:v1",
      reportJson: {
        schemaVersion: "ai_report.v1.tr",
        sections: {
          facts: [
            "Adayin depo deneyimi mevcut.",
            "Gece vardiyasinda calisma beyan edildi.",
            "Interview transcriptinde vardiya uyumu sinyali var."
          ],
          interpretation: [
            "Pozisyona temel operasyon uyumu iyi gorunuyor.",
            "Forklift sertifika teyidi tamamlanmadan kesin ilerleme onerilmez."
          ],
          recommendation: {
            summary: "Aday uygun gorunmekle birlikte sertifika teyidi sonrasi karar verilmelidir.",
            action: "Sertifika dogrulama adimini tamamlayip tekrar degerlendir.",
            recommendedOutcome: "HOLD"
          },
          flags: [
            {
              code: "CERTIFICATE_VERIFICATION_REQUIRED",
              severity: "medium",
              note: "Forklift sertifika dokumaninin guncel kopyasi bekleniyor."
            }
          ],
          missingInformation: ["forklift_sertifikasi_dogrulama"]
        },
        uncertainty: {
          level: "orta",
          confidence: 0.79,
          reasons: ["Belge teyidi tamamlanmadi."]
        },
        evidenceLinks: [
          {
            sourceType: "transcript_segment",
            sourceRef: "seg_demo_2",
            claim: "Aday gece vardiyasi deneyimini belirtti."
          },
          {
            sourceType: "transcript_segment",
            sourceRef: "seg_demo_6",
            claim: "Sertifika yenileme sureci devam ediyor."
          }
        ]
      }
    },
    create: {
      id: "rep_demo_ahmet_1",
      tenantId,
      applicationId: "app_demo_ahmet_warehouse",
      sessionId: "sess_demo_1",
      transcriptId: "trn_demo_1",
      rubricKey: "interview_template:tpl_demo_warehouse_v1",
      rubricVersion: 1,
      reportJson: {
        schemaVersion: "ai_report.v1.tr",
        sections: {
          facts: [
            "Adayin depo deneyimi mevcut.",
            "Gece vardiyasinda calisma beyan edildi.",
            "Interview transcriptinde vardiya uyumu sinyali var."
          ],
          interpretation: [
            "Pozisyona temel operasyon uyumu iyi gorunuyor.",
            "Forklift sertifika teyidi tamamlanmadan kesin ilerleme onerilmez."
          ],
          recommendation: {
            summary: "Aday uygun gorunmekle birlikte sertifika teyidi sonrasi karar verilmelidir.",
            action: "Sertifika dogrulama adimini tamamlayip tekrar degerlendir.",
            recommendedOutcome: "HOLD"
          },
          flags: [
            {
              code: "CERTIFICATE_VERIFICATION_REQUIRED",
              severity: "medium",
              note: "Forklift sertifika dokumaninin guncel kopyasi bekleniyor."
            }
          ],
          missingInformation: ["forklift_sertifikasi_dogrulama"]
        },
        uncertainty: {
          level: "orta",
          confidence: 0.79,
          reasons: ["Belge teyidi tamamlanmadi."]
        },
        evidenceLinks: [
          {
            sourceType: "transcript_segment",
            sourceRef: "seg_demo_2",
            claim: "Aday gece vardiyasi deneyimini belirtti."
          },
          {
            sourceType: "transcript_segment",
            sourceRef: "seg_demo_6",
            claim: "Sertifika yenileme sureci devam ediyor."
          }
        ]
      },
      overallScore: 0.74,
      recommendation: Recommendation.HOLD,
      confidence: 0.79,
      modelName: "deterministic-fallback",
      promptVersion: "report_generation_tr_v1:v1"
    }
  });

  const evidence = [
    {
      id: "ev_demo_ahmet_1",
      evidenceType: "transcript_segment",
      evidenceRef: "seg_demo_2",
      claimText: "Aday gece vardiyasi tecrubesini aktardi.",
      transcriptSegmentId: "seg_demo_2"
    },
    {
      id: "ev_demo_ahmet_2",
      evidenceType: "transcript_segment",
      evidenceRef: "seg_demo_6",
      claimText: "Sertifika yenileme sureci oldugu belirtildi.",
      transcriptSegmentId: "seg_demo_6"
    }
  ] as const;

  for (const item of evidence) {
    await prisma.aiEvidenceLink.upsert({
      where: { id: item.id },
      update: {
        tenantId,
        reportId: "rep_demo_ahmet_1",
        evidenceType: item.evidenceType,
        evidenceRef: item.evidenceRef,
        claimText: item.claimText,
        transcriptSegmentId: item.transcriptSegmentId
      },
      create: {
        id: item.id,
        tenantId,
        reportId: "rep_demo_ahmet_1",
        evidenceType: item.evidenceType,
        evidenceRef: item.evidenceRef,
        claimText: item.claimText,
        transcriptSegmentId: item.transcriptSegmentId
      }
    });
  }

  await prisma.aiRun.upsert({
    where: { id: "airun_demo_ahmet_report" },
    update: {
      tenantId,
      reportId: "rep_demo_ahmet_1",
      modelId: "deterministic-fallback",
      promptVersion: "report_generation_tr_v1:v1",
      policyVersion: "policy.v1.non_autonomous"
    },
    create: {
      id: "airun_demo_ahmet_report",
      tenantId,
      reportId: "rep_demo_ahmet_1",
      modelId: "deterministic-fallback",
      promptVersion: "report_generation_tr_v1:v1",
      policyVersion: "policy.v1.non_autonomous",
      inputArtifacts: {
        applicationId: "app_demo_ahmet_warehouse",
        sessionId: "sess_demo_1",
        transcriptSegmentCount: 6
      },
      outputArtifacts: {
        reportId: "rep_demo_ahmet_1",
        recommendation: "HOLD"
      }
    }
  });
}

async function upsertWorkflowJobsAndTaskRuns() {
  const workflowJobs = [
    {
      id: "wf_demo_cv_ahmet",
      type: "cv_parse",
      status: WorkflowStatus.SUCCEEDED,
      payload: { taskRunId: "task_demo_ahmet_cv" }
    },
    {
      id: "wf_demo_screening_ahmet",
      type: "screening_support",
      status: WorkflowStatus.SUCCEEDED,
      payload: { taskRunId: "task_demo_ahmet_screening" }
    },
    {
      id: "wf_demo_report_ahmet",
      type: "report_generation",
      status: WorkflowStatus.SUCCEEDED,
      payload: { taskRunId: "task_demo_ahmet_report" }
    },
    {
      id: "wf_demo_reco_ahmet",
      type: "recommendation_generation",
      status: WorkflowStatus.SUCCEEDED,
      payload: { taskRunId: "task_demo_ahmet_recommendation" }
    },
    {
      id: "wf_demo_screening_zeynep",
      type: "screening_support",
      status: WorkflowStatus.SUCCEEDED,
      payload: { taskRunId: "task_demo_zeynep_screening" }
    },
    {
      id: "wf_demo_report_esra_failed",
      type: "report_generation",
      status: WorkflowStatus.FAILED,
      payload: { taskRunId: "task_demo_esra_report_failed" }
    }
  ] as const;

  for (const job of workflowJobs) {
    await prisma.workflowJob.upsert({
      where: { id: job.id },
      update: {
        tenantId,
        type: job.type,
        payload: job.payload as Prisma.InputJsonValue,
        status: job.status,
        attempts: job.status === WorkflowStatus.FAILED ? 2 : 1
      },
      create: {
        id: job.id,
        tenantId,
        type: job.type,
        payload: job.payload as Prisma.InputJsonValue,
        status: job.status,
        attempts: job.status === WorkflowStatus.FAILED ? 2 : 1,
        maxAttempts: 5
      }
    });
  }

  const taskRuns = [
    {
      id: "task_demo_ahmet_cv",
      taskType: "CV_PARSING",
      status: "SUCCEEDED",
      workflowJobId: "wf_demo_cv_ahmet",
      candidateId: "cand_demo_ahmet",
      jobId: "job_demo_warehouse",
      applicationId: "app_demo_ahmet_warehouse",
      outputJson: {
        schemaVersion: "cv_parsing.v1.tr",
        provider: {
          mode: "deterministic_fallback",
          key: "deterministic-fallback",
          marker: "generated-without-LLM"
        },
        sections: {
          facts: ["2 yil depo deneyimi", "gece vardiyasi deneyimi"],
          interpretation: ["sertifika dogrulamasi bekleniyor"]
        }
      },
      uncertaintyJson: { level: "orta", confidence: 0.78, reasons: ["Sertifika teyidi bekleniyor."] },
      errorMessage: null
    },
    {
      id: "task_demo_ahmet_screening",
      taskType: "SCREENING_SUPPORT",
      status: "SUCCEEDED",
      workflowJobId: "wf_demo_screening_ahmet",
      candidateId: "cand_demo_ahmet",
      jobId: "job_demo_warehouse",
      applicationId: "app_demo_ahmet_warehouse",
      outputJson: {
        schemaVersion: "screening_support.v1.tr",
        provider: {
          mode: "deterministic_fallback",
          key: "deterministic-fallback",
          marker: "generated-without-LLM"
        },
        sections: {
          facts: [
            "Aday vardiya uygunlugu sinyali verdi.",
            "Depo operasyon deneyimi role iliskin temel uyum gosteriyor."
          ],
          interpretation: [
            "Sertifika dogrulama adimi tamamlanmadan ilerleme karari riskli olabilir."
          ],
          recommendation: {
            summary: "Sertifika kontrolu sonrasi ilerletme degerlendirilebilir.",
            action: "Belge teyidi tamamlanana kadar recruiter review'da tut.",
            recommendedOutcome: "REVIEW"
          },
          flags: [
            {
              code: "CERTIFICATE_VERIFICATION_REQUIRED",
              severity: "medium",
              note: "Belge teyidi tamamlanmadan nihai karar verilmemeli."
            }
          ],
          missingInformation: ["forklift_sertifikasi_dogrulama"]
        },
        uncertainty: {
          level: "orta",
          reasons: ["Belge teyidi eksik."],
          confidence: 0.72
        },
        evidenceLinks: [
          {
            sourceType: "cv_file",
            sourceRef: "cv_demo_ahmet_1",
            claim: "CV metninde depo operasyon ve vardiya deneyimi bildirildi."
          },
          {
            sourceType: "application",
            sourceRef: "app_demo_ahmet_warehouse",
            claim: "Basvuru stage bilgisi screening baglami olarak kullanildi."
          }
        ],
        additional: {
          screeningSupport: {
            applicationId: "app_demo_ahmet_warehouse",
            candidateId: "cand_demo_ahmet",
            jobId: "job_demo_warehouse",
            stage: "RECRUITER_REVIEW",
            shortSummary: "Aday role temel uyum sinyali veriyor ancak sertifika teyidi kritik.",
            strengths: ["Depo operasyon deneyimi", "Vardiya uyum sinyali"],
            risks: ["Sertifika dogrulamasi eksik"],
            likelyFitObservations: ["Depo/Lojistik role gecis icin pozitif sinyal"],
            followUpTopics: ["Forklift sertifika belgesinin guncel kopyasi"],
            missingInformation: ["forklift_sertifikasi_dogrulama"],
            evidenceReferences: [
              {
                sourceType: "cv_file",
                sourceRef: "cv_demo_ahmet_1",
                claim: "Vardiya ve operasyon deneyimi metinde yer aliyor."
              }
            ],
            uncertainty: {
              reasons: ["Belge teyidi eksik."],
              confidence: 0.72
            }
          }
        }
      },
      uncertaintyJson: { level: "orta", confidence: 0.72, reasons: ["Belge teyidi eksik."] },
      errorMessage: null
    },
    {
      id: "task_demo_ahmet_report",
      taskType: "REPORT_GENERATION",
      status: "SUCCEEDED",
      workflowJobId: "wf_demo_report_ahmet",
      candidateId: "cand_demo_ahmet",
      jobId: "job_demo_warehouse",
      applicationId: "app_demo_ahmet_warehouse",
      sessionId: "sess_demo_1",
      aiReportId: "rep_demo_ahmet_1",
      outputJson: {
        schemaVersion: "report_generation.v1.tr",
        provider: {
          mode: "deterministic_fallback",
          key: "deterministic-fallback",
          marker: "generated-without-LLM"
        },
        additional: {
          reportId: "rep_demo_ahmet_1"
        }
      },
      uncertaintyJson: { level: "orta", confidence: 0.79, reasons: ["Belge teyidi eksik."] },
      errorMessage: null
    },
    {
      id: "task_demo_ahmet_recommendation",
      taskType: "RECOMMENDATION_GENERATION",
      status: "SUCCEEDED",
      workflowJobId: "wf_demo_reco_ahmet",
      candidateId: "cand_demo_ahmet",
      jobId: "job_demo_warehouse",
      applicationId: "app_demo_ahmet_warehouse",
      sessionId: "sess_demo_1",
      aiReportId: "rep_demo_ahmet_1",
      outputJson: {
        schemaVersion: "recommendation_generation.v1.tr",
        provider: {
          mode: "deterministic_fallback",
          key: "deterministic-fallback",
          marker: "generated-without-LLM"
        },
        additional: {
          recommendationId: "rec_demo_ahmet_1"
        }
      },
      uncertaintyJson: { level: "orta", confidence: 0.76, reasons: ["Belge teyidi eksik."] },
      errorMessage: null
    },
    {
      id: "task_demo_zeynep_screening",
      taskType: "SCREENING_SUPPORT",
      status: "SUCCEEDED",
      workflowJobId: "wf_demo_screening_zeynep",
      candidateId: "cand_demo_zeynep",
      jobId: "job_demo_cashier",
      applicationId: "app_demo_zeynep_cashier",
      outputJson: {
        schemaVersion: "screening_support.v1.tr",
        provider: {
          mode: "deterministic_fallback",
          key: "deterministic-fallback",
          marker: "generated-without-LLM"
        },
        sections: {
          facts: [
            "Adayin market ve kasa deneyimi mevcut.",
            "Musteri iletisim sinyali goruluyor."
          ],
          interpretation: [
            "Perakende rolune gecis icin temel sinyaller olumlu ancak role-play teyidi onerilir."
          ],
          recommendation: {
            summary: "Musteri iletisim senaryosu sonrasi karar verilmesi uygun.",
            action: "Kisa bir role-play ile teyit et.",
            recommendedOutcome: "REVIEW"
          },
          flags: [
            {
              code: "MANUAL_INTERACTION_CHECK",
              severity: "low",
              note: "Musteri iletisim becerisi canli senaryo ile teyit edilmeli."
            }
          ],
          missingInformation: []
        },
        uncertainty: {
          level: "dusuk",
          reasons: ["Temel screening bilgisi yeterli."],
          confidence: 0.82
        },
        evidenceLinks: [
          {
            sourceType: "cv_file",
            sourceRef: "cv_demo_zeynep_1",
            claim: "Kasiyer ve satis danismani deneyimi CV metninde yer aliyor."
          }
        ],
        additional: {
          screeningSupport: {
            applicationId: "app_demo_zeynep_cashier",
            candidateId: "cand_demo_zeynep",
            jobId: "job_demo_cashier",
            stage: "SCREENING",
            shortSummary: "Perakende deneyimi sayesinde role temel uyum sinyali guclu.",
            strengths: ["Kasiyer deneyimi", "Musteri iletisim deneyimi"],
            risks: ["Canli musteri senaryosu dogrulamasi gerekli"],
            likelyFitObservations: ["Kasiyer role gecis icin pozitif sinyal"],
            followUpTopics: ["Hafta sonu vardiya uygunlugu", "Yogun kasa akisinda performans"],
            missingInformation: [],
            evidenceReferences: [
              {
                sourceType: "cv_file",
                sourceRef: "cv_demo_zeynep_1",
                claim: "Kasa islemleri ve musteri karsilama deneyimi mevcut."
              }
            ],
            uncertainty: {
              reasons: ["Temel screening bilgisi yeterli."],
              confidence: 0.82
            }
          }
        }
      },
      uncertaintyJson: { level: "dusuk", confidence: 0.82, reasons: ["Temel screening bilgisi yeterli."] },
      errorMessage: null
    },
    {
      id: "task_demo_esra_report_failed",
      taskType: "REPORT_GENERATION",
      status: "FAILED",
      workflowJobId: "wf_demo_report_esra_failed",
      candidateId: "cand_demo_esra",
      jobId: "job_demo_cashier",
      applicationId: "app_demo_esra_cashier",
      outputJson: {
        schemaVersion: "ai_task_error.v1",
        status: "failed",
        error: {
          code: "SESSION_REQUIRED",
          message: "REPORT_GENERATION icin tamamlanmis interview session bulunamadi."
        }
      },
      uncertaintyJson: {
        level: "yuksek",
        reasons: ["Mulakat oturumu olmadigi icin rapor uretilemedi."],
        recoverable: true
      },
      errorMessage: "REPORT_GENERATION task'i icin interview session baglami bulunamadi."
    }
  ] as const;

  for (const run of taskRuns) {
    await prisma.aiTaskRun.upsert({
      where: { id: run.id },
      update: {
        tenantId,
        taskType: run.taskType as never,
        status: run.status as never,
        automationLevel: "MANUAL_WITH_AI_SUPPORT",
        candidateId: run.candidateId,
        jobId: run.jobId,
        applicationId: run.applicationId,
        sessionId: "sessionId" in run ? run.sessionId ?? null : null,
        aiReportId: "aiReportId" in run ? run.aiReportId ?? null : null,
        promptTemplateId:
          run.taskType === "CV_PARSING"
            ? "prompt_cv_parsing_v1"
            : run.taskType === "SCREENING_SUPPORT"
              ? "prompt_screening_support_v1"
              : run.taskType === "REPORT_GENERATION"
                ? "prompt_report_generation_v1"
                : "prompt_recommendation_generation_v1",
        rubricId: run.taskType === "SCREENING_SUPPORT" ? "rubric_warehouse_v1" : null,
        workflowJobId: run.workflowJobId,
        inputJson: {
          triggerSource: run.id.includes("zeynep") || run.id.includes("esra") ? "system" : "manual",
          triggerReasonCode: run.id.includes("zeynep") || run.id.includes("esra")
            ? "application_created_screening_support"
            : "recruiter_manual_trigger"
        },
        outputJson: run.outputJson as Prisma.InputJsonValue,
        uncertaintyJson: run.uncertaintyJson as Prisma.InputJsonValue,
        guardrailFlags: {
          policyVersion: "policy.v1.non_autonomous",
          autoDecisionApplied: false,
          autoRejectAllowed: false,
          recruiterReviewRequired: true
        },
        providerKey: "deterministic-fallback",
        modelKey: "deterministic-fallback",
        promptVersion:
          run.taskType === "CV_PARSING"
            ? "cv_parsing_tr_v1:v1"
            : run.taskType === "SCREENING_SUPPORT"
              ? "screening_support_tr_v1:v1"
              : run.taskType === "REPORT_GENERATION"
                ? "report_generation_tr_v1:v1"
                : "recommendation_generation_tr_v1:v1",
        policyVersion: "policy.v1.non_autonomous",
        requestedBy: recruiterId,
        startedAt: hoursAgo(20),
        completedAt: hoursAgo(19),
        errorMessage: run.errorMessage
      },
      create: {
        id: run.id,
        tenantId,
        taskType: run.taskType as never,
        status: run.status as never,
        automationLevel: "MANUAL_WITH_AI_SUPPORT",
        candidateId: run.candidateId,
        jobId: run.jobId,
        applicationId: run.applicationId,
        sessionId: "sessionId" in run ? run.sessionId ?? null : null,
        aiReportId: "aiReportId" in run ? run.aiReportId ?? null : null,
        promptTemplateId:
          run.taskType === "CV_PARSING"
            ? "prompt_cv_parsing_v1"
            : run.taskType === "SCREENING_SUPPORT"
              ? "prompt_screening_support_v1"
              : run.taskType === "REPORT_GENERATION"
                ? "prompt_report_generation_v1"
                : "prompt_recommendation_generation_v1",
        rubricId: run.taskType === "SCREENING_SUPPORT" ? "rubric_warehouse_v1" : null,
        workflowJobId: run.workflowJobId,
        inputJson: {
          triggerSource: run.id.includes("zeynep") || run.id.includes("esra") ? "system" : "manual",
          triggerReasonCode: run.id.includes("zeynep") || run.id.includes("esra")
            ? "application_created_screening_support"
            : "recruiter_manual_trigger"
        },
        outputJson: run.outputJson as Prisma.InputJsonValue,
        uncertaintyJson: run.uncertaintyJson as Prisma.InputJsonValue,
        guardrailFlags: {
          policyVersion: "policy.v1.non_autonomous",
          autoDecisionApplied: false,
          autoRejectAllowed: false,
          recruiterReviewRequired: true
        },
        providerKey: "deterministic-fallback",
        modelKey: "deterministic-fallback",
        promptVersion:
          run.taskType === "CV_PARSING"
            ? "cv_parsing_tr_v1:v1"
            : run.taskType === "SCREENING_SUPPORT"
              ? "screening_support_tr_v1:v1"
              : run.taskType === "REPORT_GENERATION"
                ? "report_generation_tr_v1:v1"
                : "recommendation_generation_tr_v1:v1",
        policyVersion: "policy.v1.non_autonomous",
        requestedBy: recruiterId,
        startedAt: hoursAgo(20),
        completedAt: hoursAgo(19),
        errorMessage: run.errorMessage
      }
    });
  }
}

async function upsertApplicationRecommendations() {
  await prisma.applicationRecommendation.upsert({
    where: { id: "rec_demo_ahmet_1" },
    update: {
      tenantId,
      applicationId: "app_demo_ahmet_warehouse",
      sessionId: "sess_demo_1",
      aiTaskRunId: "task_demo_ahmet_recommendation",
      rubricKey: "interview_template:tpl_demo_warehouse_v1",
      rubricVersion: 1,
      recommendation: Recommendation.HOLD,
      confidence: 0.76,
      summaryText: "Adayi recruiter review asamasinda tutup sertifika teyidi sonrasi karar verin.",
      rationaleJson: {
        schemaVersion: "application_recommendation.v1.tr",
        facts: ["Depo deneyimi mevcut.", "Vardiya uyumu sinyali pozitif."],
        interpretation: ["Sertifika teyidi tamamlanmadan ilerleme riski bulunuyor."],
        recommendation: {
          summary: "Belge teyidi sonrasi aday yeniden degerlendirilsin.",
          action: "Sertifika dokumani teyit adimini tamamla.",
          recommendedOutcome: "HOLD"
        },
        flags: [
          {
            code: "CERT_CHECK_PENDING",
            severity: "medium",
            note: "Belge teyidi bitmeden final ilerleme onerilmez."
          }
        ],
        missingInformation: ["forklift_sertifika_pdf"],
        evidenceLinks: [
          {
            sourceType: "transcript_segment",
            sourceRef: "seg_demo_2",
            claim: "Aday sertifika yenilemesinin devam ettigini belirtti."
          }
        ]
      },
      uncertaintyJson: {
        level: "orta",
        confidence: 0.76,
        reasons: ["Sertifika teyidi henuz tamamlanmadi."]
      },
      evidenceCount: 1,
      requiresHumanApproval: true,
      createdBy: recruiterId
    },
    create: {
      id: "rec_demo_ahmet_1",
      tenantId,
      applicationId: "app_demo_ahmet_warehouse",
      sessionId: "sess_demo_1",
      aiTaskRunId: "task_demo_ahmet_recommendation",
      rubricKey: "interview_template:tpl_demo_warehouse_v1",
      rubricVersion: 1,
      recommendation: Recommendation.HOLD,
      confidence: 0.76,
      summaryText: "Adayi recruiter review asamasinda tutup sertifika teyidi sonrasi karar verin.",
      rationaleJson: {
        schemaVersion: "application_recommendation.v1.tr",
        facts: ["Depo deneyimi mevcut.", "Vardiya uyumu sinyali pozitif."],
        interpretation: ["Sertifika teyidi tamamlanmadan ilerleme riski bulunuyor."],
        recommendation: {
          summary: "Belge teyidi sonrasi aday yeniden degerlendirilsin.",
          action: "Sertifika dokumani teyit adimini tamamla.",
          recommendedOutcome: "HOLD"
        },
        flags: [
          {
            code: "CERT_CHECK_PENDING",
            severity: "medium",
            note: "Belge teyidi bitmeden final ilerleme onerilmez."
          }
        ],
        missingInformation: ["forklift_sertifika_pdf"],
        evidenceLinks: [
          {
            sourceType: "transcript_segment",
            sourceRef: "seg_demo_2",
            claim: "Aday sertifika yenilemesinin devam ettigini belirtti."
          }
        ]
      },
      uncertaintyJson: {
        level: "orta",
        confidence: 0.76,
        reasons: ["Sertifika teyidi henuz tamamlanmadi."]
      },
      evidenceCount: 1,
      requiresHumanApproval: true,
      createdBy: recruiterId
    }
  });
}

async function upsertApprovalsAuditAndEvents() {
  await prisma.humanApproval.upsert({
    where: { id: "approval_demo_ahmet_1" },
    update: {
      tenantId,
      actionType: "application.decision",
      entityType: "CandidateApplication",
      entityId: "app_demo_ahmet_warehouse",
      requestedBy: recruiterId,
      approvedBy: recruiterId,
      reasonCode: "manual_recruiter_decision",
      recommendationId: "rec_demo_ahmet_1",
      aiTaskRunId: "task_demo_ahmet_recommendation",
      metadata: {
        decision: "hold",
        aiReportId: "rep_demo_ahmet_1"
      }
    },
    create: {
      id: "approval_demo_ahmet_1",
      tenantId,
      actionType: "application.decision",
      entityType: "CandidateApplication",
      entityId: "app_demo_ahmet_warehouse",
      requestedBy: recruiterId,
      approvedBy: recruiterId,
      reasonCode: "manual_recruiter_decision",
      recommendationId: "rec_demo_ahmet_1",
      aiTaskRunId: "task_demo_ahmet_recommendation",
      metadata: {
        decision: "hold",
        aiReportId: "rep_demo_ahmet_1"
      }
    }
  });

  const auditEntries = [
    {
      id: "aud_demo_seed_bootstrap",
      action: "seed.bootstrap",
      entityType: "Tenant",
      entityId: tenantId,
      actorType: AuditActorType.SYSTEM,
      metadata: { note: "Demo tenant bootstrap tamamlandi." }
    },
    {
      id: "aud_demo_application_decision",
      action: "application.decision",
      entityType: "CandidateApplication",
      entityId: "app_demo_ahmet_warehouse",
      actorType: AuditActorType.USER,
      metadata: {
        decision: "hold",
        humanApprovedBy: recruiterId
      }
    },
    {
      id: "aud_demo_ai_task_failed",
      action: "ai.task_run.failed",
      entityType: "AiTaskRun",
      entityId: "task_demo_esra_report_failed",
      actorType: AuditActorType.SYSTEM,
      metadata: {
        reason: "SESSION_REQUIRED"
      }
    },
    {
      id: "aud_demo_interview_scheduled",
      action: "interview.session.scheduled",
      entityType: "InterviewSession",
      entityId: "sess_demo_2",
      actorType: AuditActorType.USER,
      metadata: {
        applicationId: "app_demo_zeynep_cashier",
        mode: "MEETING_LINK",
        providerSource: "provider_connection_template"
      }
    },
    {
      id: "aud_demo_interview_abandoned",
      action: "interview.session.abandoned",
      entityType: "InterviewSession",
      entityId: "sess_demo_3",
      actorType: AuditActorType.SYSTEM,
      metadata: {
        applicationId: "app_demo_esra_cashier",
        reasonCode: "candidate_abandoned"
      }
    }
  ] as const;

  for (const entry of auditEntries) {
    await prisma.auditLog.upsert({
      where: { id: entry.id },
      update: {
        tenantId,
        actorUserId: entry.actorType === AuditActorType.USER ? recruiterId : null,
        actorType: entry.actorType,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata as Prisma.InputJsonValue
      },
      create: {
        id: entry.id,
        tenantId,
        actorUserId: entry.actorType === AuditActorType.USER ? recruiterId : null,
        actorType: entry.actorType,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata as Prisma.InputJsonValue
      }
    });
  }

  const domainEvents = [
    {
      id: "event_demo_application_created",
      aggregateType: "CandidateApplication",
      aggregateId: "app_demo_mehmet_support",
      eventType: "application.created"
    },
    {
      id: "event_demo_interview_scheduled",
      aggregateType: "InterviewSession",
      aggregateId: "sess_demo_2",
      eventType: "interview.session.scheduled"
    },
    {
      id: "event_demo_interview_abandoned",
      aggregateType: "InterviewSession",
      aggregateId: "sess_demo_3",
      eventType: "interview.session.abandoned"
    },
    {
      id: "event_demo_transcript_ingested",
      aggregateType: "Transcript",
      aggregateId: "trn_demo_1",
      eventType: "interview.transcript.ingested"
    },
    {
      id: "event_demo_report_generated",
      aggregateType: "AiReport",
      aggregateId: "rep_demo_ahmet_1",
      eventType: "ai.report.generated"
    },
    {
      id: "event_demo_recommendation_generated",
      aggregateType: "ApplicationRecommendation",
      aggregateId: "rec_demo_ahmet_1",
      eventType: "application.recommendation.generated"
    },
    {
      id: "event_demo_report_failed",
      aggregateType: "CandidateApplication",
      aggregateId: "app_demo_esra_cashier",
      eventType: "application.report.failed"
    }
  ] as const;

  for (const event of domainEvents) {
    await prisma.domainEvent.upsert({
      where: { id: event.id },
      update: {
        tenantId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: {
          source: "seed",
          tenantId
        },
        status: "PENDING"
      },
      create: {
        id: event.id,
        tenantId,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: {
          source: "seed",
          tenantId
        },
        status: "PENDING"
      }
    });
  }
}

async function seed() {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {
      name: "Demo Istihdam Teknolojileri",
      locale: "tr-TR",
      timezone: "Europe/Istanbul",
      status: "ACTIVE"
    },
    create: {
      id: tenantId,
      name: "Demo Istihdam Teknolojileri",
      locale: "tr-TR",
      timezone: "Europe/Istanbul",
      status: "ACTIVE"
    }
  });

  await prisma.workspace.upsert({
    where: { id: workspaceId },
    update: {
      tenantId,
      name: "Operasyon"
    },
    create: {
      id: workspaceId,
      tenantId,
      name: "Operasyon"
    }
  });

  await upsertUsers();
  await upsertFeatureFlags();
  await upsertIntegrationConnections();
  await upsertPromptTemplatesAndRubrics();
  await upsertJobs();
  await upsertCandidates();
  await upsertApplications();
  await upsertInterviewFoundation();
  await upsertSchedulingWorkflowSeeds();
  await upsertCvData();
  await upsertAiArtifacts();
  await upsertWorkflowJobsAndTaskRuns();
  await upsertApplicationRecommendations();
  await upsertApprovalsAuditAndEvents();
  await upsertInboxDemoData();

  console.log("Seed tamamlandi.");
  console.log("Tenant ID:", tenantId);
  console.log("Demo kullanicilar:");
  console.log("- admin@demo.local (admin)");
  console.log("- recruiter@demo.local (recruiter)");
  console.log("- hm@demo.local (hiring_manager)");
  console.log("Sifre (.env DEV_LOGIN_PASSWORD): demo12345");
  console.log("Demo basvurular:");
  console.log("- app_demo_mehmet_support: interview yok (aday intake asamasi)");
  console.log("- app_demo_zeynep_cashier: interview schedule edildi (session aktif)");
  console.log("- app_demo_ahmet_warehouse: completed interview + transcript + report + recommendation");
  console.log("- app_demo_esra_cashier: yarida birakilan voice interview + rapor hatasi (incomplete state)");
}

async function upsertInboxDemoData() {
  const jobId = "job_demo_warehouse";

  const inboxCandidates = [
    { id: "cand_inbox_ayse", fullName: "Ayşe Doğan", phone: "05321112233", email: "ayse.dogan@email.com", source: "email", locationText: "İstanbul", yearsOfExperience: 4, externalRef: null, externalSource: null },
    { id: "cand_inbox_ali", fullName: "Ali Yılmaz", phone: "05332223344", email: "ali.yilmaz@email.com", source: "kariyer_net", locationText: "İstanbul", yearsOfExperience: 3, externalRef: "KN-44821", externalSource: "kariyer_net" },
    { id: "cand_inbox_emre", fullName: "Emre Polat", phone: "05343334455", email: "emre.polat@email.com", source: "agency", locationText: "İstanbul", yearsOfExperience: 2, externalRef: null, externalSource: null },
    { id: "cand_inbox_elif", fullName: "Elif Şahin", phone: "05354445566", email: "elif.sahin@email.com", source: "kariyer_net", locationText: "İstanbul", yearsOfExperience: 2, externalRef: "KN-44835", externalSource: "kariyer_net" },
    { id: "cand_inbox_fatma", fullName: "Fatma Öztürk", phone: "05365556677", email: "fatma.ozturk@email.com", source: "referral", locationText: "Kocaeli", yearsOfExperience: 1, externalRef: null, externalSource: null },
    { id: "cand_inbox_murat", fullName: "Murat Koç", phone: "05376667788", email: "murat.koc@email.com", source: "walk_in", locationText: "İstanbul", yearsOfExperience: 1, externalRef: null, externalSource: null },
    { id: "cand_inbox_selin", fullName: "Selin Taş", phone: "05387778899", email: "selin.tas@email.com", source: "eleman_net", locationText: "İstanbul", yearsOfExperience: 1, externalRef: null, externalSource: null },
    { id: "cand_inbox_derya", fullName: "Derya Kurt", phone: "05398889900", email: null, source: "phone", locationText: "İstanbul", yearsOfExperience: null, externalRef: null, externalSource: null },
    { id: "cand_inbox_hasan", fullName: "Hasan Çelik", phone: "05401112233", email: "hasan.celik@email.com", source: "csv_import", locationText: "Bursa", yearsOfExperience: 0, externalRef: null, externalSource: null },
    { id: "cand_inbox_burak", fullName: "Burak Acar", phone: "05412223344", email: "burak.acar@email.com", source: "manual", locationText: "Ankara", yearsOfExperience: 0, externalRef: null, externalSource: null }
  ];

  const stages: ApplicationStage[] = [
    ApplicationStage.APPLIED,
    ApplicationStage.SCREENING,
    ApplicationStage.INTERVIEW_SCHEDULED,
    ApplicationStage.APPLIED,
    ApplicationStage.APPLIED,
    ApplicationStage.APPLIED,
    ApplicationStage.SCREENING,
    ApplicationStage.INTERVIEW_SCHEDULED,
    ApplicationStage.RECRUITER_REVIEW,
    ApplicationStage.REJECTED
  ];

  for (let i = 0; i < inboxCandidates.length; i++) {
    const c = inboxCandidates[i]!;
    const stage = stages[i] ?? ApplicationStage.APPLIED;
    const suffix = c.id.split("_").pop()!;
    const appId = `app_inbox_${suffix}`;

    await prisma.candidate.upsert({
      where: { id: c.id },
      update: { locationText: c.locationText, yearsOfExperience: c.yearsOfExperience, externalRef: c.externalRef, externalSource: c.externalSource },
      create: {
        id: c.id,
        tenantId,
        fullName: c.fullName,
        phone: c.phone,
        email: c.email,
        source: c.source,
        locationText: c.locationText,
        yearsOfExperience: c.yearsOfExperience,
        externalRef: c.externalRef,
        externalSource: c.externalSource
      }
    });

    await prisma.candidateApplication.upsert({
      where: { id: appId },
      update: { currentStage: stage },
      create: {
        id: appId,
        tenantId,
        candidateId: c.id,
        jobId,
        currentStage: stage,
        stageUpdatedAt: hoursAgo(48 - i * 4)
      }
    });

    await prisma.candidateStageHistory.upsert({
      where: { id: `ash_inbox_${suffix}_init` },
      update: {},
      create: {
        id: `ash_inbox_${suffix}_init`,
        tenantId,
        applicationId: appId,
        fromStage: null,
        toStage: ApplicationStage.APPLIED,
        reasonCode: "initial_application",
        changedBy: recruiterId
      }
    });
  }

  // Fit scores for 7 out of 10 candidates (last 3 are unscored)
  const fitScores = [
    { candidateKey: "ayse", overall: 0.91, confidence: 0.92, exp: { score: 0.95, reason: "4 yıl depo deneyimi, vardiya liderliği tecrübesi", confidence: 0.95 }, loc: { score: 0.98, reason: "İstanbul — tam uyumlu", confidence: 0.99 }, shift: { score: 0.90, reason: "Gece vardiyası deneyimi mevcut", confidence: 0.88 }, role: { score: 0.88, reason: "Depo operasyon elemanı profili ile birebir örtüşme", confidence: 0.90 }, strengths: ["Vardiya liderliği deneyimi", "Gece çalışma deneyimi", "İstanbul lokasyonunda"], risks: [], missing: [] },
    { candidateKey: "ali", overall: 0.88, confidence: 0.90, exp: { score: 0.90, reason: "3 yıl depo deneyimi", confidence: 0.92 }, loc: { score: 0.98, reason: "İstanbul — tam uyumlu", confidence: 0.99 }, shift: { score: 0.85, reason: "Gece vardiyası kabul ediyor", confidence: 0.88 }, role: { score: 0.85, reason: "Depo operasyon deneyimi uyumlu", confidence: 0.87 }, strengths: ["Depo deneyimi yeterli", "Gece vardiyasına açık"], risks: [], missing: [] },
    { candidateKey: "emre", overall: 0.85, confidence: 0.87, exp: { score: 0.82, reason: "2 yıl depo + forklift sertifikası", confidence: 0.90 }, loc: { score: 0.98, reason: "İstanbul — tam uyumlu", confidence: 0.99 }, shift: { score: 0.80, reason: "Vardiya tercihi belirtilmemiş", confidence: 0.70 }, role: { score: 0.85, reason: "Forklift sertifikası ek avantaj", confidence: 0.88 }, strengths: ["Forklift sertifikası", "İstanbul lokasyonunda"], risks: ["Vardiya tercihi belirsiz"], missing: [] },
    { candidateKey: "elif", overall: 0.82, confidence: 0.85, exp: { score: 0.78, reason: "2 yıl lojistik deneyimi, depo değil", confidence: 0.80 }, loc: { score: 0.98, reason: "İstanbul — tam uyumlu", confidence: 0.99 }, shift: { score: 0.75, reason: "Esnek çalışma saati tercih ediyor", confidence: 0.78 }, role: { score: 0.80, reason: "Lojistik deneyimi kısmen uyumlu", confidence: 0.82 }, strengths: ["Lojistik sektör deneyimi", "Esnek çalışma isteği"], risks: ["Doğrudan depo deneyimi yok"], missing: [] },
    { candidateKey: "fatma", overall: 0.62, confidence: 0.75, exp: { score: 0.55, reason: "Perakende deneyimi, depo değil", confidence: 0.70 }, loc: { score: 0.60, reason: "Kocaeli — ulaşım mesafesi riskli", confidence: 0.75 }, shift: { score: 0.40, reason: "Gece vardiyası istemiyor", confidence: 0.85 }, role: { score: 0.70, reason: "Perakende deneyimi kısmen uyumlu", confidence: 0.72 }, strengths: ["Perakende sektörü deneyimi"], risks: ["Gece vardiyası istemiyor", "Kocaeli lokasyonunda"], missing: [] },
    { candidateKey: "murat", overall: 0.55, confidence: 0.72, exp: { score: 0.50, reason: "1 yıl üretim deneyimi", confidence: 0.70 }, loc: { score: 0.98, reason: "İstanbul — tam uyumlu", confidence: 0.99 }, shift: { score: 0.30, reason: "Sadece gündüz vardiyası", confidence: 0.90 }, role: { score: 0.55, reason: "Üretim deneyimi kısmen uyumlu", confidence: 0.68 }, strengths: ["İstanbul lokasyonunda"], risks: ["Sadece gündüz vardiyası", "Depo deneyimi yok"], missing: [] },
    { candidateKey: "selin", overall: 0.48, confidence: 0.68, exp: { score: 0.35, reason: "Müşteri hizmetleri, fiziksel iş deneyimi yok", confidence: 0.72 }, loc: { score: 0.98, reason: "İstanbul — tam uyumlu", confidence: 0.99 }, shift: { score: 0.50, reason: "Vardiya çalışmaya açık ama deneyimsiz", confidence: 0.60 }, role: { score: 0.40, reason: "Eğitim gerekli, farklı sektör", confidence: 0.65 }, strengths: ["İletişim becerileri"], risks: ["Fiziksel iş deneyimi yok", "Eğitim gerekli"], missing: [] }
  ];

  for (const fs of fitScores) {
    const appId = `app_inbox_${fs.candidateKey}`;
    const scoreId = `fit_inbox_${fs.candidateKey}`;

    await prisma.applicantFitScore.upsert({
      where: { id: scoreId },
      update: { overallScore: fs.overall, confidence: fs.confidence },
      create: {
        id: scoreId,
        tenantId,
        applicationId: appId,
        overallScore: fs.overall,
        confidence: fs.confidence,
        subScoresJson: {
          experienceFit: fs.exp,
          locationFit: fs.loc,
          shiftFit: fs.shift,
          roleFit: fs.role
        },
        strengthsJson: fs.strengths,
        risksJson: fs.risks,
        missingInfoJson: fs.missing,
        reasoningJson: `Aday profili analiz edildi. Toplam uyum skoru: ${Math.round(fs.overall * 100)}/100.`
      }
    });
  }

  // Recruiter notes
  const notes = [
    { id: "note_inbox_1", appId: "app_inbox_ayse", text: "Çok güçlü profil, hemen ön elemeye alınmalı. Vardiya liderliği deneyimi öne çıkıyor." },
    { id: "note_inbox_2", appId: "app_inbox_emre", text: "Ajans üzerinden geldi. Forklift sertifikası doğrulanmalı." },
    { id: "note_inbox_3", appId: "app_inbox_fatma", text: "Kocaeli'den geliyor, ulaşım konusunda net bilgi alınmalı. Gece vardiyasına kapalı." }
  ];

  for (const n of notes) {
    await prisma.recruiterNote.upsert({
      where: { id: n.id },
      update: { noteText: n.text },
      create: {
        id: n.id,
        tenantId,
        applicationId: n.appId,
        authorUserId: recruiterId,
        noteText: n.text
      }
    });
  }

  console.log("Inbox demo data: 10 candidates, 7 fit scores, 3 notes.");

  // ── Scheduling workflow demo data ──
  // Create a scheduling workflow for Zeynep's interview (already at INTERVIEW_SCHEDULED)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 2);

  const demoSlots = [];
  for (let dayOff = 0; dayOff < 3; dayOff++) {
    const slotDate = new Date(tomorrow);
    slotDate.setDate(slotDate.getDate() + dayOff);
    if (slotDate.getDay() === 0 || slotDate.getDay() === 6) continue;
    for (let hour = 10; hour <= 16; hour += 2) {
      const start = new Date(slotDate);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(30);
      demoSlots.push({
        slotId: `slot_${start.toISOString()}`,
        start: start.toISOString(),
        end: end.toISOString(),
        source: "auto_generated"
      });
    }
  }

  const demoToken = "sched_demo_zeynep_1234";

  await prisma.schedulingWorkflow.upsert({
    where: { id: "swf_demo_zeynep" },
    update: {},
    create: {
      id: "swf_demo_zeynep",
      tenantId,
      applicationId: "app_demo_zeynep_cashier",
      initiatedBy: recruiterId,
      updatedBy: recruiterId,
      source: "assistant",
      state: "SLOT_PROPOSAL_READY",
      status: "ACTIVE",
      recruiterConstraintsJson: {
        slotDurationMinutes: 30,
        timezone: "Europe/Istanbul",
        windows: demoSlots.map(s => ({ start: s.start, end: s.end }))
      },
      candidateAvailabilityJson: {
        windows: demoSlots.map(s => ({ start: s.start, end: s.end })),
        source: "auto_generated"
      },
      proposedSlotsJson: demoSlots,
      conversationContextJson: {
        candidateAccessToken: demoToken,
        autoGenerated: true
      }
    }
  });

  // Create human approval record for the demo
  await prisma.humanApproval.upsert({
    where: { id: "ha_demo_zeynep_interview" },
    update: {},
    create: {
      id: "ha_demo_zeynep_interview",
      tenantId,
      actionType: "recruiter_approved_for_interview",
      entityType: "CandidateApplication",
      entityId: "app_demo_zeynep_cashier",
      requestedBy: recruiterId,
      approvedBy: recruiterId,
      metadata: {
        candidateId: "cand_demo_zeynep",
        jobId: "job_demo_cashier",
        reason: "recruiter_manual_approval"
      }
    }
  });

  console.log(`Scheduling workflow demo: swf_demo_zeynep (token: ${demoToken})`);
  console.log(`Demo scheduling URL: http://localhost:3000/randevu/swf_demo_zeynep?token=${demoToken}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
