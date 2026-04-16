import { Body, Controller, ForbiddenException, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from "class-validator";
import {
  BillingAccountStatus,
  BillingPlanKey,
  FeatureFlagType,
  PublicLeadStatus,
  TenantStatus
} from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { BILLING_PLAN_CATALOG } from "../billing/billing-catalog";
import { InternalAdminService } from "./internal-admin.service";

const FLAG_TYPES = ["BOOLEAN", "MULTIVARIATE", "KILL_SWITCH"] as const;
const GLOBAL_AUTH_FLAG_KEYS = [
  "auth.email_verification.required",
  "auth.email_verification.send_email"
] as const;
type FlagType = (typeof FLAG_TYPES)[number];

class AdminAccountQuery {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsIn(["ALL", "FLEX", "STARTER", "GROWTH", "ENTERPRISE"])
  planKey?: "ALL" | "FLEX" | "STARTER" | "GROWTH" | "ENTERPRISE";

  @IsOptional()
  @IsIn(["ALL", "ACTIVE", "SUSPENDED", "DELETED"])
  status?: "ALL" | "ACTIVE" | "SUSPENDED" | "DELETED";
}

class RedAlertQuery {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  windowDays?: number;

  @IsOptional()
  @IsIn(["ALL", "APPLICATION", "SECURITY", "ASSISTANT", "OPERATIONS"])
  category?: "ALL" | "APPLICATION" | "SECURITY" | "ASSISTANT" | "OPERATIONS";

  @IsOptional()
  @IsIn(["ALL", "critical", "warning"])
  severity?: "ALL" | "critical" | "warning";
}

class PublicLeadQuery {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsIn(["ALL", "NEW", "REVIEWING", "CONTACTED", "ARCHIVED"])
  status?: "ALL" | "NEW" | "REVIEWING" | "CONTACTED" | "ARCHIVED";
}

class UpdatePublicLeadStatusBody {
  @IsEnum(PublicLeadStatus)
  status!: PublicLeadStatus;
}

class UpdateAccountStatusBody {
  @IsEnum(TenantStatus)
  status!: TenantStatus;
}

class UpdateAccountPlanBody {
  @IsEnum(BillingPlanKey)
  planKey!: BillingPlanKey;

  @IsOptional()
  @IsEmail()
  billingEmail?: string;

  @IsOptional()
  @IsEnum(BillingAccountStatus)
  status?: BillingAccountStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyAmountCents?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  seatsIncluded?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeJobsIncluded?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  candidateProcessingIncluded?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  aiInterviewsIncluded?: number;

  @IsOptional()
  @IsBoolean()
  advancedReporting?: boolean;

  @IsOptional()
  @IsBoolean()
  calendarIntegrations?: boolean;

  @IsOptional()
  @IsBoolean()
  brandedCandidateExperience?: boolean;

  @IsOptional()
  @IsBoolean()
  customIntegrations?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

class CreateQuotaGrantBody {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  seats?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  activeJobs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  candidateProcessing?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  aiInterviews?: number;
}

class CreateEnterpriseCustomerBody {
  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsString()
  @MinLength(2)
  ownerFullName!: string;

  @IsEmail()
  ownerEmail!: string;

  @IsEmail()
  billingEmail!: string;

  @IsInt()
  @Min(1)
  monthlyAmountCents!: number;

  @IsInt()
  @Min(1)
  seatsIncluded!: number;

  @IsInt()
  @Min(1)
  activeJobsIncluded!: number;

  @IsInt()
  @Min(1)
  candidateProcessingIncluded!: number;

  @IsInt()
  @Min(1)
  aiInterviewsIncluded!: number;

  @IsBoolean()
  advancedReporting!: boolean;

  @IsBoolean()
  calendarIntegrations!: boolean;

  @IsBoolean()
  brandedCandidateExperience!: boolean;

  @IsBoolean()
  customIntegrations!: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

class UpdateGlobalAuthFlagBody {
  @IsIn(FLAG_TYPES)
  @IsOptional()
  type?: FlagType;

  @IsBoolean()
  value!: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

@Controller("internal-admin")
export class InternalAdminController {
  constructor(@Inject(InternalAdminService) private readonly internalAdminService: InternalAdminService) {}

  @Get("dashboard")
  @Permissions("tenant.manage")
  dashboard(@CurrentUser() user: RequestUser) {
    return this.internalAdminService.getDashboard(user.email);
  }

  @Get("auth-flags")
  @Permissions("tenant.manage")
  authFlags(@CurrentUser() user: RequestUser) {
    return this.internalAdminService.listGlobalAuthFlags(user.email);
  }

  @Patch("auth-flags/:key")
  @Permissions("tenant.manage")
  updateAuthFlag(
    @CurrentUser() user: RequestUser,
    @Param("key") key: string,
    @Body() body: UpdateGlobalAuthFlagBody
  ) {
    if (!GLOBAL_AUTH_FLAG_KEYS.includes(key as (typeof GLOBAL_AUTH_FLAG_KEYS)[number])) {
      throw new ForbiddenException("Bu global auth flag anahtari desteklenmiyor.");
    }

    return this.internalAdminService.updateGlobalAuthFlag({
      key,
      actorEmail: user.email,
      value: body.value,
      type: (body.type as FeatureFlagType | undefined) ?? FeatureFlagType.BOOLEAN,
      description: body.description
    });
  }

  @Get("red-alert")
  @Permissions("tenant.manage")
  redAlert(@CurrentUser() user: RequestUser, @Query() query: RedAlertQuery) {
    return this.internalAdminService.getRedAlerts(
      {
        windowDays: query.windowDays ?? 7,
        category: query.category ?? "ALL",
        severity: query.severity ?? "ALL"
      },
      user.email
    );
  }

  @Get("public-leads")
  @Permissions("tenant.manage")
  publicLeads(@CurrentUser() user: RequestUser, @Query() query: PublicLeadQuery) {
    return this.internalAdminService.listPublicLeads(
      {
        query: query.query,
        status: query.status ?? "ALL"
      },
      user.email
    );
  }

  @Get("accounts")
  @Permissions("tenant.manage")
  accounts(@CurrentUser() user: RequestUser, @Query() query: AdminAccountQuery) {
    return this.internalAdminService.listAccounts(
      {
        query: query.query,
        planKey: query.planKey ?? "ALL",
        status: query.status ?? "ALL"
      },
      user.email
    );
  }

  @Get("accounts/:tenantId")
  @Permissions("tenant.manage")
  accountDetail(@CurrentUser() user: RequestUser, @Param("tenantId") tenantId: string) {
    return this.internalAdminService.getAccountDetail(tenantId, user.email);
  }

  @Patch("accounts/:tenantId/status")
  @Permissions("tenant.manage")
  updateAccountStatus(
    @CurrentUser() user: RequestUser,
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateAccountStatusBody
  ) {
    return this.internalAdminService.updateAccountStatus({
      tenantId,
      actorUserId: user.userId,
      actorEmail: user.email,
      status: body.status
    });
  }

  @Post("accounts/:tenantId/plan")
  @Permissions("tenant.manage")
  updateAccountPlan(
    @CurrentUser() user: RequestUser,
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateAccountPlanBody
  ) {
    const plan = body.planKey === BillingPlanKey.ENTERPRISE ? null : body.planKey;
    const catalogPlan = plan ? body.planKey : null;
    const defaults =
      catalogPlan && catalogPlan !== BillingPlanKey.ENTERPRISE
        ? BILLING_PLAN_CATALOG[catalogPlan]
        : null;

    return this.internalAdminService.updateAccountPlan({
      tenantId,
      actorUserId: user.userId,
      actorEmail: user.email,
      billingEmail: body.billingEmail,
      planKey: body.planKey,
      status: body.status,
      monthlyAmountCents: body.planKey === BillingPlanKey.ENTERPRISE ? body.monthlyAmountCents ?? null : defaults?.monthlyAmountCents ?? null,
      seatsIncluded: body.seatsIncluded ?? defaults?.seatsIncluded ?? 1,
      activeJobsIncluded: body.activeJobsIncluded ?? defaults?.activeJobsIncluded ?? 1,
      candidateProcessingIncluded:
        body.candidateProcessingIncluded ?? defaults?.candidateProcessingIncluded ?? 1,
      aiInterviewsIncluded: body.aiInterviewsIncluded ?? defaults?.aiInterviewsIncluded ?? 1,
      features: {
        advancedReporting: body.advancedReporting ?? defaults?.features.advancedReporting ?? true,
        calendarIntegrations: body.calendarIntegrations ?? defaults?.features.calendarIntegrations ?? true,
        brandedCandidateExperience:
          body.brandedCandidateExperience ?? defaults?.features.brandedCandidateExperience ?? true,
        customIntegrations: body.customIntegrations ?? defaults?.features.customIntegrations ?? true
      },
      note: body.note
    });
  }

  @Post("accounts/:tenantId/quota-grants")
  @Permissions("tenant.manage")
  createQuotaGrant(
    @CurrentUser() user: RequestUser,
    @Param("tenantId") tenantId: string,
    @Body() body: CreateQuotaGrantBody
  ) {
    return this.internalAdminService.createQuotaGrant({
      tenantId,
      actorUserId: user.userId,
      actorEmail: user.email,
      label: body.label,
      seats: body.seats,
      activeJobs: body.activeJobs,
      candidateProcessing: body.candidateProcessing,
      aiInterviews: body.aiInterviews
    });
  }

  @Post("accounts/:tenantId/reset-owner-password")
  @Permissions("tenant.manage")
  sendOwnerResetInvite(@CurrentUser() user: RequestUser, @Param("tenantId") tenantId: string) {
    return this.internalAdminService.sendOwnerResetInvite({
      tenantId,
      actorUserId: user.userId,
      actorEmail: user.email
    });
  }

  @Patch("public-leads/:leadId/status")
  @Permissions("tenant.manage")
  updatePublicLeadStatus(
    @CurrentUser() user: RequestUser,
    @Param("leadId") leadId: string,
    @Body() body: UpdatePublicLeadStatusBody
  ) {
    return this.internalAdminService.updatePublicLeadStatus(
      {
        leadId,
        actorEmail: user.email,
        status: body.status
      }
    );
  }

  @Get("enterprise")
  @Permissions("tenant.manage")
  enterprise(@CurrentUser() user: RequestUser, @Query() query: Omit<AdminAccountQuery, "planKey">) {
    return this.internalAdminService.listEnterpriseAccounts(
      {
        query: query.query,
        status: query.status ?? "ALL"
      },
      user.email
    );
  }

  @Post("enterprise/customers")
  @Permissions("tenant.manage")
  createEnterpriseCustomer(@CurrentUser() user: RequestUser, @Body() body: CreateEnterpriseCustomerBody) {
    return this.internalAdminService.createEnterpriseCustomer({
      actorUserId: user.userId,
      actorEmail: user.email,
      companyName: body.companyName,
      ownerFullName: body.ownerFullName,
      ownerEmail: body.ownerEmail,
      billingEmail: body.billingEmail,
      monthlyAmountCents: body.monthlyAmountCents,
      seatsIncluded: body.seatsIncluded,
      activeJobsIncluded: body.activeJobsIncluded,
      candidateProcessingIncluded: body.candidateProcessingIncluded,
      aiInterviewsIncluded: body.aiInterviewsIncluded,
      features: {
        advancedReporting: body.advancedReporting,
        calendarIntegrations: body.calendarIntegrations,
        brandedCandidateExperience: body.brandedCandidateExperience,
        customIntegrations: body.customIntegrations
      },
      note: body.note
    });
  }
}
