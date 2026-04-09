import { BadRequestException, Injectable, Inject} from "@nestjs/common";
import { FeatureFlagType, Prisma } from "@prisma/client";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FeatureFlagsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RuntimeConfigService) private readonly runtimeConfig: RuntimeConfigService
  ) {}

  async list(tenantId: string) {
    await this.ensureDefaults(tenantId);

    return this.prisma.featureFlag.findMany({
      where: {
        tenantId
      },
      orderBy: {
        key: "asc"
      }
    });
  }

  async update(
    tenantId: string,
    key: string,
    input: { type?: FeatureFlagType; value: Prisma.InputJsonValue; description?: string }
  ) {
    if (this.runtimeConfig.isProduction && key.startsWith("demo.")) {
      throw new BadRequestException("Production ortamında demo.* flag güncellenemez.");
    }

    if (key.startsWith("dev.") && !this.runtimeConfig.allowDemoShortcuts) {
      throw new BadRequestException("dev.* bayrakları sadece demo/development modunda güncellenebilir.");
    }

    if (key === "ai.auto_reject.enabled" && input.value === true) {
      throw new BadRequestException("V1 kuralina gore ai.auto_reject.enabled true olamaz.");
    }

    return this.prisma.featureFlag.upsert({
      where: {
        tenantId_key: {
          tenantId,
          key
        }
      },
      create: {
        tenantId,
        key,
        type: input.type ?? FeatureFlagType.BOOLEAN,
        value: input.value,
        description: input.description
      },
      update: {
        type: input.type,
        value: input.value,
        description: input.description
      }
    });
  }

  async isEnabled(tenantId: string, key: string, defaultValue = false) {
    await this.ensureDefaults(tenantId);

    const flag = await this.prisma.featureFlag.findUnique({
      where: {
        tenantId_key: {
          tenantId,
          key
        }
      }
    });

    if (!flag) {
      return defaultValue;
    }

    if (typeof flag.value === "boolean") {
      return flag.value;
    }

    if (
      typeof flag.value === "object" &&
      flag.value !== null &&
      "enabled" in flag.value &&
      typeof (flag.value as { enabled?: unknown }).enabled === "boolean"
    ) {
      return (flag.value as { enabled: boolean }).enabled;
    }

    return defaultValue;
  }

  private async ensureDefaults(tenantId: string) {
    const defaults = [
      {
        key: "auto_stage_change_enabled",
        type: FeatureFlagType.BOOLEAN,
        value: false,
        description: "V1'de AI tek başına stage değiştiremez."
      },
      {
        key: "ai_followup_enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "Template içinde sınırlı follow-up soruları aktif."
      },
      {
        key: "ai.cv_parsing.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "CV parsing yardımcı AI akışlarını aç/kapat."
      },
      {
        key: "ai.job_requirement_interpretation.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "Job requirement yorumlama yardımcısını aç/kapat."
      },
      {
        key: "ai.candidate_fit_assistance.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "Aday-job fit yardımcı analizi aç/kapat."
      },
      {
        key: "ai.screening_support.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "Yapılandırılmış screening yardımcısını aç/kapat."
      },
      {
        key: "ai.interview_preparation.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: false,
        description: "Görüşme hazırlık yardımcısı (V1.5) aç/kapat."
      },
      {
        key: "ai.interview_orchestration.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: false,
        description: "AI görüşme orkestrasyonu (future) aç/kapat."
      },
      {
        key: "ai.transcript_summarization.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: false,
        description: "Transkript özetleme (future) aç/kapat."
      },
      {
        key: "ai.report_generation.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "AI rapor uretimi (V1 demo) ac/kapat."
      },
      {
        key: "ai.applicant_fit_scoring.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "Aday uyum skoru uretimi (V1 demo) ac/kapat."
      },
      {
        key: "ai.recommendation_generation.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "AI recommendation uretimi (V1 demo) ac/kapat."
      },
      {
        key: "ai.system_triggers.application_created.screening_support.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description: "Application create sonrasinda SCREENING_SUPPORT otomatik kuyruklamasi."
      },
      {
        key: "ai.system_triggers.stage_review_pack.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description:
          "INTERVIEW_COMPLETED -> RECRUITER_REVIEW gecisinde report/recommendation paketini otomatik kuyrukla."
      },
      {
        key: "ai.system_triggers.interview_completed.review_pack.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: true,
        description:
          "Interview session COMPLETED oldugunda report/recommendation paketini otomatik kuyrukla."
      },
      {
        key: "ai.auto_reject.enabled",
        type: FeatureFlagType.BOOLEAN,
        value: false,
        description: "V1 kurali geregi her zaman false kalmalidir."
      }
    ];

    await this.prisma.$transaction(
      defaults.map((flag) =>
        this.prisma.featureFlag.upsert({
          where: {
            tenantId_key: {
              tenantId,
              key: flag.key
            }
          },
          create: {
            tenantId,
            key: flag.key,
            type: flag.type,
            value: flag.value,
            description: flag.description
          },
          update: {}
        })
      )
    );
  }
}
