import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { RuntimeConfigService } from "../../config/runtime-config.service";
import { PrismaService } from "../../prisma/prisma.service";

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
}
