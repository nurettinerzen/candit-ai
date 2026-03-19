import { Injectable, Inject} from "@nestjs/common";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { RuntimeConfigService } from "../../config/runtime-config.service";

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value && typeof value === "object" && "enabled" in value) {
    return Boolean((value as { enabled?: unknown }).enabled);
  }

  return fallback;
}

@Injectable()
export class TenantConfigService {
  constructor(
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
      models: this.runtimeConfig.openAiConfig.models
    };
  }
}
