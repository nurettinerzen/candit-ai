import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Req
} from "@nestjs/common";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min
} from "class-validator";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { BillingService } from "./billing.service";

const PLAN_KEYS = ["FLEX", "STARTER", "GROWTH"] as const;
const ADDON_KEYS = [
  "JOB_CREDIT_PACK_1",
  "JOB_CREDIT_PACK_3",
  "CANDIDATE_PROCESSING_PACK_50",
  "INTERVIEW_PACK_10",
  "INTERVIEW_PACK_25",
  "CANDIDATE_PROCESSING_PACK_100"
] as const;

class PlanCheckoutBody {
  @IsIn(PLAN_KEYS)
  planKey!: (typeof PLAN_KEYS)[number];

  @IsEmail()
  @IsOptional()
  billingEmail?: string;
}

class AddOnCheckoutBody {
  @IsIn(ADDON_KEYS)
  addOnKey!: (typeof ADDON_KEYS)[number];

  @IsEmail()
  @IsOptional()
  billingEmail?: string;
}

class EnterpriseCheckoutBody {
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

  @IsString()
  @IsOptional()
  note?: string;
}

class SendCheckoutLinkBody {
  @IsString()
  checkoutSessionId!: string;

  @IsEmail()
  email!: string;
}

@Controller("billing")
export class BillingController {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Get("overview")
  @Permissions("job.read")
  overview(@CurrentTenant() tenantId: string, @CurrentUser() user: RequestUser) {
    return this.billingService.getOverview(tenantId, user.email);
  }

  @Post("checkout/plan")
  @Permissions("tenant.manage")
  createPlanCheckout(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: PlanCheckoutBody
  ) {
    return this.billingService.createPlanCheckoutSession({
      tenantId,
      requestedBy: user.userId,
      planKey: body.planKey,
      billingEmail: body.billingEmail
    });
  }

  @Post("checkout/addon")
  @Permissions("tenant.manage")
  createAddOnCheckout(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: AddOnCheckoutBody
  ) {
    return this.billingService.createAddOnCheckoutSession({
      tenantId,
      requestedBy: user.userId,
      addOnKey: body.addOnKey,
      billingEmail: body.billingEmail
    });
  }

  @Post("checkout/enterprise")
  @Permissions("tenant.manage")
  createEnterpriseCheckout(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: EnterpriseCheckoutBody
  ) {
    return this.billingService.createEnterpriseOfferCheckoutSession({
      tenantId,
      requestedBy: user.userId,
      requestedByEmail: user.email,
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

  @Post("checkout/send-link")
  @Permissions("tenant.manage")
  sendCheckoutLink(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: SendCheckoutLinkBody
  ) {
    return this.billingService.sendCheckoutLink({
      tenantId,
      checkoutSessionId: body.checkoutSessionId,
      email: body.email,
      requestedBy: user.userId,
      requestedByEmail: user.email
    });
  }

  @Post("customer-portal")
  @Permissions("tenant.manage")
  createCustomerPortal(@CurrentTenant() tenantId: string) {
    return this.billingService.createCustomerPortalSession({ tenantId });
  }

  @Post("subscription/cancel")
  @Permissions("tenant.manage")
  scheduleSubscriptionCancellation(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser
  ) {
    return this.billingService.scheduleSubscriptionCancellation({
      tenantId,
      requestedBy: user.userId
    });
  }

  @Post("subscription/resume")
  @Permissions("tenant.manage")
  resumeScheduledCancellation(@CurrentTenant() tenantId: string) {
    return this.billingService.resumeScheduledCancellation({ tenantId });
  }

  @Public()
  @Post("webhooks/stripe")
  stripeWebhook(
    @Headers("stripe-signature") signature: string | undefined,
    @Req() request: Request
  ) {
    return this.billingService.handleStripeWebhook(signature, request.body as Buffer | string);
  }
}
