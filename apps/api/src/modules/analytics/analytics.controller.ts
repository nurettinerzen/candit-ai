import { Controller, Get , Inject} from "@nestjs/common";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { BillingService } from "../billing/billing.service";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
    @Inject(BillingService) private readonly billingService: BillingService
  ) {}

  @Get("funnel")
  @Permissions("job.read")
  funnel(@CurrentTenant() tenantId: string) {
    return this.analyticsService.funnel(tenantId);
  }

  @Get("time-to-hire")
  @Permissions("job.read")
  async timeToHire(@CurrentTenant() tenantId: string) {
    await this.billingService.assertFeatureEnabled(tenantId, "advancedReporting");
    return this.analyticsService.timeToHire(tenantId);
  }

  @Get("interview-quality")
  @Permissions("job.read")
  async interviewQuality(@CurrentTenant() tenantId: string) {
    await this.billingService.assertFeatureEnabled(tenantId, "advancedReporting");
    return this.analyticsService.interviewQuality(tenantId);
  }
}
