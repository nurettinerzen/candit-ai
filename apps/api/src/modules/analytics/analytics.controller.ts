import { Controller, Get , Inject} from "@nestjs/common";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analyticsService: AnalyticsService) {}

  @Get("funnel")
  @Permissions("job.read")
  funnel(@CurrentTenant() tenantId: string) {
    return this.analyticsService.funnel(tenantId);
  }

  @Get("time-to-hire")
  @Permissions("job.read")
  timeToHire(@CurrentTenant() tenantId: string) {
    return this.analyticsService.timeToHire(tenantId);
  }

  @Get("interview-quality")
  @Permissions("job.read")
  interviewQuality(@CurrentTenant() tenantId: string) {
    return this.analyticsService.interviewQuality(tenantId);
  }
}
