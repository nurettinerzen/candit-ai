import { BadRequestException, Controller, Get, Param, Query , Inject} from "@nestjs/common";
import { ApplicationStage } from "@prisma/client";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { ReadModelsService } from "./read-models.service";

@Controller("read-models")
export class ReadModelsController {
  constructor(@Inject(ReadModelsService) private readonly readModelsService: ReadModelsService) {}

  @Get("recruiter-overview")
  @Permissions("job.read")
  recruiterOverview(@CurrentTenant() tenantId: string) {
    return this.readModelsService.recruiterOverview(tenantId);
  }

  @Get("applications")
  @Permissions("candidate.read")
  recruiterApplications(
    @CurrentTenant() tenantId: string,
    @Query("stage") stage?: string,
    @Query("jobId") jobId?: string
  ) {
    const normalizedStage = stage ? String(stage).toUpperCase() : undefined;

    if (
      normalizedStage &&
      ![
        "APPLIED",
        "SCREENING",
        "INTERVIEW_SCHEDULED",
        "INTERVIEW_COMPLETED",
        "RECRUITER_REVIEW",
        "HIRING_MANAGER_REVIEW",
        "OFFER",
        "REJECTED",
        "HIRED"
      ].includes(normalizedStage)
    ) {
      throw new BadRequestException("Gecersiz stage filtresi.");
    }

    return this.readModelsService.recruiterApplications(tenantId, {
      stage: normalizedStage as ApplicationStage | undefined,
      jobId: jobId ?? undefined
    });
  }

  @Get("applications/:id")
  @Permissions("candidate.read")
  applicationDetail(@CurrentTenant() tenantId: string, @Param("id") id: string) {
    return this.readModelsService.applicationDetail(tenantId, id);
  }

  @Get("ai-support-center")
  @Permissions("ai.task.read")
  aiSupportCenter(@CurrentTenant() tenantId: string) {
    return this.readModelsService.aiSupportCenter(tenantId);
  }

  @Get("provider-health")
  @Permissions("ai.task.read")
  providerHealthDashboard(@CurrentTenant() tenantId: string) {
    return this.readModelsService.providerHealthDashboard(tenantId);
  }

  @Get("infrastructure-readiness")
  @Permissions("ai.task.read")
  infrastructureReadiness(@CurrentTenant() tenantId: string) {
    return this.readModelsService.infrastructureReadiness(tenantId);
  }
}
