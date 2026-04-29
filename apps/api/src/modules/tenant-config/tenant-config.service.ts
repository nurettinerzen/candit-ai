import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";

const DEFAULT_HIRING_SETTINGS = {
  departments: [
    "Operasyon",
    "Satış",
    "Pazarlama",
    "İnsan Kaynakları",
    "Finans",
    "Muhasebe",
    "Bilgi Teknolojileri",
    "Yazılım Geliştirme"
  ],
  titleLevels: [
    "Asistan",
    "Uzman Yardımcısı",
    "Uzman",
    "Kıdemli Uzman",
    "Takım Lideri",
    "Yönetici",
    "Müdür"
  ],
  competencyLibrary: {
    core: ["Analitik düşünme", "Takım çalışması", "Sahiplenme"],
    functional: [".NET", "REST API", "MS SQL", "Git"],
    managerial: ["Karar verme", "Takım koçluğu", "Önceliklendirme"]
  },
  evaluationPresets: {
    schoolDepartments: ["Bilgisayar Mühendisliği", "Yazılım Mühendisliği"],
    certificates: [],
    tools: [".NET", "MS SQL", "Git"],
    languages: ["İngilizce", "Türkçe"]
  },
  referenceCheckTemplate: {
    closedEndedQuestions: [
      "Adayı tekrar aynı görev için değerlendirir misiniz?",
      "Aday ekip çalışmasına uyumlu muydu?",
      "Aday teslim tarihlerini karşılama konusunda güvenilir miydi?"
    ],
    openEndedQuestions: [
      "Adayın güçlü yönleri nelerdi?",
      "Gelişim alanı olarak en çok hangi konuda geri bildirim verirdiniz?",
      "Birlikte çalıştığınız dönemde öne çıkan somut bir örnek paylaşabilir misiniz?"
    ]
  },
  dataProcessingConsent: {
    noticeVersion: "kvkk_data_processing_tr_v1_2026_04",
    policyVersion: "policy_v1",
    summary: "Aday verilerini işe alım değerlendirme süreci kapsamında işleriz.",
    explicitText:
      "Aday verilerimin işe alım değerlendirme, referans kontrolü, mülakat planlama ve uygun pozisyonlarda yeniden değerlendirme amaçlarıyla işlenmesini kabul ediyorum."
  },
  approvalFlow: {
    enabled: false,
    approverRole: "MANAGER",
    stages: ["OFFER", "HIRED"],
    notes: null
  },
  notificationDefaults: {
    responseSlaDays: 15
  }
} as const;

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object" && "enabled" in value) {
    return Boolean((value as { enabled?: unknown }).enabled);
  }

  return fallback;
}

function normalizeOptionalString(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function normalizeUrl(value: string | undefined, fieldLabel: string) {
  const raw = normalizeOptionalString(value, 500);
  if (!raw) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("invalid_protocol");
    }

    return url.toString();
  } catch {
    throw new BadRequestException(`${fieldLabel} geçerli bir bağlantı olmalıdır.`);
  }
}

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function normalizeStringList(value: unknown, maxLength = 120) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.slice(0, maxLength))
    )
  );
}

function normalizePositiveInteger(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

function normalizeHiringSettings(value: unknown) {
  const root = asObject(value);
  const competencyLibrary = asObject(root.competencyLibrary);
  const evaluationPresets = asObject(root.evaluationPresets);
  const referenceCheckTemplate = asObject(root.referenceCheckTemplate);
  const dataProcessingConsent = asObject(root.dataProcessingConsent);
  const approvalFlow = asObject(root.approvalFlow);
  const notificationDefaults = asObject(root.notificationDefaults);
  const allowedApprovalStages = [
    "APPLIED",
    "TALENT_POOL",
    "SHORTLISTED",
    "SCREENING",
    "INTERVIEW_SCHEDULED",
    "INTERVIEW_COMPLETED",
    "RECRUITER_REVIEW",
    "HIRING_MANAGER_REVIEW",
    "OFFER",
    "REJECTED",
    "HIRED"
  ];
  const approverRole =
    approvalFlow.approverRole === "OWNER" ||
    approvalFlow.approverRole === "MANAGER" ||
    approvalFlow.approverRole === "STAFF"
      ? approvalFlow.approverRole
      : DEFAULT_HIRING_SETTINGS.approvalFlow.approverRole;

  return {
    departments: (() => {
      const values = normalizeStringList(root.departments);
      return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.departments];
    })(),
    titleLevels: (() => {
      const values = normalizeStringList(root.titleLevels);
      return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.titleLevels];
    })(),
    competencyLibrary: {
      core: (() => {
        const values = normalizeStringList(competencyLibrary.core);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.competencyLibrary.core];
      })(),
      functional: (() => {
        const values = normalizeStringList(competencyLibrary.functional);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.competencyLibrary.functional];
      })(),
      managerial: (() => {
        const values = normalizeStringList(competencyLibrary.managerial);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.competencyLibrary.managerial];
      })()
    },
    evaluationPresets: {
      schoolDepartments: (() => {
        const values = normalizeStringList(evaluationPresets.schoolDepartments);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.evaluationPresets.schoolDepartments];
      })(),
      certificates: normalizeStringList(evaluationPresets.certificates),
      tools: (() => {
        const values = normalizeStringList(evaluationPresets.tools);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.evaluationPresets.tools];
      })(),
      languages: (() => {
        const values = normalizeStringList(evaluationPresets.languages);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.evaluationPresets.languages];
      })()
    },
    referenceCheckTemplate: {
      closedEndedQuestions: (() => {
        const values = normalizeStringList(referenceCheckTemplate.closedEndedQuestions, 220);
        return values.length > 0
          ? values
          : [...DEFAULT_HIRING_SETTINGS.referenceCheckTemplate.closedEndedQuestions];
      })(),
      openEndedQuestions: (() => {
        const values = normalizeStringList(referenceCheckTemplate.openEndedQuestions, 220);
        return values.length > 0
          ? values
          : [...DEFAULT_HIRING_SETTINGS.referenceCheckTemplate.openEndedQuestions];
      })()
    },
    dataProcessingConsent: {
      noticeVersion:
        normalizeOptionalString(
          typeof dataProcessingConsent.noticeVersion === "string"
            ? dataProcessingConsent.noticeVersion
            : undefined,
          120
        ) ?? DEFAULT_HIRING_SETTINGS.dataProcessingConsent.noticeVersion,
      policyVersion: normalizeOptionalString(
        typeof dataProcessingConsent.policyVersion === "string"
          ? dataProcessingConsent.policyVersion
          : undefined,
        120
      ),
      summary:
        normalizeOptionalString(
          typeof dataProcessingConsent.summary === "string" ? dataProcessingConsent.summary : undefined,
          500
        ) ?? DEFAULT_HIRING_SETTINGS.dataProcessingConsent.summary,
      explicitText:
        normalizeOptionalString(
          typeof dataProcessingConsent.explicitText === "string"
            ? dataProcessingConsent.explicitText
            : undefined,
          4000
        ) ?? DEFAULT_HIRING_SETTINGS.dataProcessingConsent.explicitText
    },
    approvalFlow: {
      enabled:
        typeof approvalFlow.enabled === "boolean"
          ? approvalFlow.enabled
          : DEFAULT_HIRING_SETTINGS.approvalFlow.enabled,
      approverRole,
      stages: (() => {
        const values = normalizeStringList(approvalFlow.stages, 60).filter((stage) =>
          allowedApprovalStages.includes(stage)
        );
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.approvalFlow.stages];
      })(),
      notes: normalizeOptionalString(
        typeof approvalFlow.notes === "string" ? approvalFlow.notes : undefined,
        2000
      )
    },
    notificationDefaults: {
      responseSlaDays: normalizePositiveInteger(
        notificationDefaults.responseSlaDays,
        DEFAULT_HIRING_SETTINGS.notificationDefaults.responseSlaDays
      )
    }
  };
}

@Injectable()
export class TenantConfigService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async getRuntimeConfiguration(tenantId: string) {
    const flags = await this.featureFlagsService.list(tenantId);

    const findFlag = (key: string, fallback: boolean) =>
      asBoolean(flags.find((flag) => flag.key === key)?.value, fallback);

    return {
      tenantId,
      runtime: {
        appMode: this.runtimeConfig.runtimeMode,
        authMode: this.runtimeConfig.authMode,
        demoMode: this.runtimeConfig.isDemoMode
      },
      safety: {
        allowDevHeaderAuth: this.runtimeConfig.allowDevHeaderAuth,
        allowDemoShortcuts: this.runtimeConfig.allowDemoShortcuts,
        autoRejectAllowed: false,
        humanDecisionRequired: true
      },
      ai: {
        cvParsing: findFlag("ai.cv_parsing.enabled", true),
        screeningSupport: findFlag("ai.screening_support.enabled", true),
        reportGeneration: findFlag("ai.report_generation.enabled", true),
        recommendationGeneration: findFlag("ai.recommendation_generation.enabled", true),
        triggerOnApplicationCreated: findFlag(
          "ai.system_triggers.application_created.screening_support.enabled",
          true
        ),
        triggerOnStageReviewPack: findFlag("ai.system_triggers.stage_review_pack.enabled", true),
        triggerOnInterviewCompletedReviewPack: findFlag(
          "ai.system_triggers.interview_completed.review_pack.enabled",
          true
        )
      },
      providers: this.runtimeConfig.providerReadiness,
      launchBoundaries: this.runtimeConfig.launchBoundaries,
      launchWarnings: this.runtimeConfig.getProviderConfigurationWarnings(),
      models: this.runtimeConfig.openAiConfig.models
    };
  }

  async getProfile(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        logoUrl: true,
        profileSummary: true,
        locale: true,
        timezone: true
      }
    });

    if (!tenant) {
      throw new BadRequestException("Şirket profili bulunamadı.");
    }

    return {
      tenantId: tenant.id,
      companyName: tenant.name,
      websiteUrl: tenant.websiteUrl,
      logoUrl: tenant.logoUrl,
      profileSummary: tenant.profileSummary,
      locale: tenant.locale,
      timezone: tenant.timezone
    };
  }

  async updateProfile(
    tenantId: string,
    input: {
      companyName: string;
      websiteUrl?: string;
      logoUrl?: string;
      profileSummary?: string;
    }
  ) {
    const companyName = input.companyName.trim();

    if (companyName.length < 2) {
      throw new BadRequestException("Şirket adı en az 2 karakter olmalıdır.");
    }

    const tenant = await this.prisma.tenant.update({
      where: {
        id: tenantId
      },
      data: {
        name: companyName,
        websiteUrl: normalizeUrl(input.websiteUrl, "Web sitesi"),
        logoUrl: normalizeUrl(input.logoUrl, "Logo bağlantısı"),
        profileSummary: normalizeOptionalString(input.profileSummary, 2000)
      },
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        logoUrl: true,
        profileSummary: true,
        locale: true,
        timezone: true
      }
    });

    return {
      tenantId: tenant.id,
      companyName: tenant.name,
      websiteUrl: tenant.websiteUrl,
      logoUrl: tenant.logoUrl,
      profileSummary: tenant.profileSummary,
      locale: tenant.locale,
      timezone: tenant.timezone
    };
  }

  async getHiringSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      select: {
        id: true,
        hiringSettingsJson: true
      }
    });

    if (!tenant) {
      throw new BadRequestException("İşe alım ayarları bulunamadı.");
    }

    return {
      tenantId: tenant.id,
      settings: normalizeHiringSettings(tenant.hiringSettingsJson)
    };
  }

  async updateHiringSettings(
    tenantId: string,
    input: Record<string, unknown>
  ) {
    const normalized = normalizeHiringSettings(input);

    const tenant = await this.prisma.tenant.update({
      where: {
        id: tenantId
      },
      data: {
        hiringSettingsJson: normalized
      },
      select: {
        id: true,
        hiringSettingsJson: true
      }
    });

    return {
      tenantId: tenant.id,
      settings: normalizeHiringSettings(tenant.hiringSettingsJson)
    };
  }
}
