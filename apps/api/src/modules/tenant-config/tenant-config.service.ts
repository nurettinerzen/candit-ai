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
    core: ["Analitik düşünme", "İletişim becerisi", "Sorumluluk bilinci", "Organizasyon ve planlama"],
    functional: ["Süreç yönetimi", "Paydaş koordinasyonu", "Problem çözme"],
    technical: [".NET", "REST API", "MS SQL", "Git"],
    managerial: ["Karar verme", "Takım koçluğu", "Önceliklendirme"]
  },
  competencyDefinitions: [
    {
      name: "Analitik düşünme",
      category: "core",
      definition: "Veriyi, problemi ve bağlamı parçalarına ayırarak neden-sonuç ilişkisi kurabilme.",
      expectedBehavior:
        "Adayın belirsiz bir problemi nasıl yapılandırdığını, hangi verileri kullandığını ve kararını nasıl gerekçelendirdiğini somut örnekle anlatması beklenir."
    },
    {
      name: "İletişim becerisi",
      category: "core",
      definition: "Bilgiyi doğru kişiye, doğru açıklıkta ve iş birliğini güçlendirecek şekilde aktarabilme.",
      expectedBehavior:
        "Adayın zor bir paydaş veya ekip iletişimi örneğinde mesajı nasıl netleştirdiğini ve sonucu nasıl takip ettiğini açıklaması beklenir."
    },
    {
      name: "Sorumluluk bilinci",
      category: "core",
      definition: "Sahip olduğu işi takip etme, sonucu üstlenme ve aksiyonları zamanında tamamlama yaklaşımı.",
      expectedBehavior:
        "Adayın aksayan bir işte sorumluluk alıp nasıl toparladığını ve sonucu nasıl ölçtüğünü paylaşması beklenir."
    }
  ],
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
  },
  messageTemplates: {
    application_received_v1: {
      subject: "{{companyName}} – Başvurunuz alındı",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için başvurunuz tarafımıza ulaştı.\n\nEkibimiz başvurunuzu değerlendirmeye aldı. Süreçte yeni bir adım olduğunda sizinle tekrar paylaşacağız.",
      ctaLabel: null
    },
    application_shortlisted_v1: {
      subject: "{{companyName}} – Ön değerlendirme olumlu",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için başvurunuz ön değerlendirmede olumlu ilerledi.\n\nSüreçteki sonraki adımı ayrıca paylaşacağız.",
      ctaLabel: null
    },
    application_advanced_v1: {
      subject: "{{companyName}} – Başvurunuz ilerledi",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için değerlendirme süreciniz bir sonraki aşamaya taşındı.\n\nYeni adım netleştiğinde sizinle iletişime geçeceğiz.",
      ctaLabel: null
    },
    application_on_hold_v1: {
      subject: "{{companyName}} – Değerlendirme devam ediyor",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için değerlendirmeniz devam ediyor.\n\nSüreçte kısa bir bekleme oluştu. Yeni gelişme olduğunda sizi bilgilendireceğiz.",
      ctaLabel: null
    },
    application_talent_pool_v1: {
      subject: "{{companyName}} – Yetenek havuzu bilgilendirmesi",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için mevcut aşamada ilerleyemiyoruz; ancak profilinizi uygun fırsatlar için yetenek havuzumuzda değerlendirmek isteriz.\n\nUygun bir pozisyon oluştuğunda sizinle tekrar iletişime geçebiliriz.",
      ctaLabel: null
    },
    application_rejected_v1: {
      subject: "{{companyName}} – Başvuru güncellemesi",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için başvurunuzu değerlendirdik.\n\nBu aşamada sürece sizinle devam edemeyeceğiz.\n\nBaşvurunuz ve zamanınız için teşekkür eder, kariyer yolculuğunuzda başarılar dileriz.",
      ctaLabel: null
    },
    interview_scheduled_v1: {
      subject: "{{companyName}} – Görüşmeniz planlandı",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için görüşmeniz planlandı.\n\nGörüşme detaylarını ve bağlantıyı aşağıda bulabilirsiniz.",
      ctaLabel: "Görüşme Detaylarını Aç"
    },
    interview_rescheduled_v1: {
      subject: "{{companyName}} – Görüşmeniz güncellendi",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için görüşme planınız güncellendi.\n\nYeni görüşme detaylarını aşağıdaki bağlantıdan inceleyebilirsiniz.",
      ctaLabel: "Görüşme Detaylarını Aç"
    },
    interview_cancelled_v1: {
      subject: "{{companyName}} – Görüşme iptal edildi",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için planlanan görüşme iptal edilmiştir.\n\nSüreçle ilgili yeni bir gelişme olursa sizinle ayrıca iletişime geçeceğiz.",
      ctaLabel: null
    },
    interview_invitation_on_demand_v1: {
      subject: "{{companyName}} – İlk görüşme davetiniz",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonuna yaptığınız başvuru olumlu değerlendirilmiştir. Sizi ilk görüşmeye davet etmekten memnuniyet duyarız.\n\nGörüşmeyi size uygun bir zamanda aşağıdaki bağlantıdan başlatabilirsiniz.",
      ctaLabel: "Görüşmeyi Başlat"
    },
    interview_invitation_reminder_v1: {
      subject: "{{companyName}} – Görüşme hatırlatması",
      body:
        "Merhaba {{candidateName}},\n\n{{companyName}} bünyesindeki {{jobTitle}} pozisyonu için görüşme davetiniz hâlâ geçerlidir.\n\nSüre dolmadan aşağıdaki bağlantıdan görüşmenizi başlatabilirsiniz.",
      ctaLabel: "Görüşmeyi Başlat"
    }
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

function normalizeCompetencyCategory(value: unknown) {
  return value === "core" || value === "functional" || value === "technical" || value === "managerial"
    ? value
    : null;
}

function normalizeCompetencyDefinitions(value: unknown) {
  if (!Array.isArray(value)) {
    return [...DEFAULT_HIRING_SETTINGS.competencyDefinitions];
  }

  const seen = new Set<string>();
  const normalized = value
    .map((item) => {
      const row = asObject(item);
      const category = normalizeCompetencyCategory(row.category);
      const name = normalizeOptionalString(typeof row.name === "string" ? row.name : undefined, 120);
      const definition = normalizeOptionalString(
        typeof row.definition === "string" ? row.definition : undefined,
        1000
      );

      if (!category || !name || !definition) {
        return null;
      }

      const dedupeKey = `${category}:${name.toLocaleLowerCase("tr-TR")}`;
      if (seen.has(dedupeKey)) {
        return null;
      }
      seen.add(dedupeKey);

      return {
        name,
        category,
        definition,
        expectedBehavior: normalizeOptionalString(
          typeof row.expectedBehavior === "string" ? row.expectedBehavior : undefined,
          1500
        )
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return normalized.length > 0 ? normalized : [...DEFAULT_HIRING_SETTINGS.competencyDefinitions];
}

function normalizeMessageTemplates(value: unknown) {
  const templates = asObject(value);
  const normalized: Record<string, { subject: string; body: string; ctaLabel: string | null }> = {};

  for (const [key, rawTemplate] of Object.entries(templates)) {
    const safeKey = normalizeOptionalString(key, 120);
    const row = asObject(rawTemplate);
    const subject = normalizeOptionalString(typeof row.subject === "string" ? row.subject : undefined, 240);
    const body = normalizeOptionalString(typeof row.body === "string" ? row.body : undefined, 5000);

    if (!safeKey || !subject || !body) {
      continue;
    }

    normalized[safeKey] = {
      subject,
      body,
      ctaLabel: normalizeOptionalString(typeof row.ctaLabel === "string" ? row.ctaLabel : undefined, 80)
    };
  }

  return {
    ...DEFAULT_HIRING_SETTINGS.messageTemplates,
    ...normalized
  };
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
      technical: (() => {
        const values = normalizeStringList(competencyLibrary.technical);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.competencyLibrary.technical];
      })(),
      managerial: (() => {
        const values = normalizeStringList(competencyLibrary.managerial);
        return values.length > 0 ? values : [...DEFAULT_HIRING_SETTINGS.competencyLibrary.managerial];
      })()
    },
    competencyDefinitions: normalizeCompetencyDefinitions(root.competencyDefinitions),
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
    },
    messageTemplates: normalizeMessageTemplates(root.messageTemplates)
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
