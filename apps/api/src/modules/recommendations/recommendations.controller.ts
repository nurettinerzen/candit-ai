import { Controller, Get, Param, Query , Inject} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { RecommendationsService } from "./recommendations.service";

class RecommendationsQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

@Controller("recommendations")
export class RecommendationsController {
  constructor(@Inject(RecommendationsService) private readonly recommendationsService: RecommendationsService) {}

  @Get("applications/:applicationId")
  @Permissions("recommendation.read")
  listByApplication(
    @CurrentTenant() tenantId: string,
    @Param("applicationId") applicationId: string,
    @Query() query: RecommendationsQuery
  ) {
    return this.recommendationsService.listByApplication(tenantId, applicationId, query.limit);
  }

  @Get("applications/:applicationId/latest")
  @Permissions("recommendation.read")
  latestByApplication(
    @CurrentTenant() tenantId: string,
    @Param("applicationId") applicationId: string
  ) {
    return this.recommendationsService.latestByApplication(tenantId, applicationId);
  }

  @Get(":id")
  @Permissions("recommendation.read")
  getById(@CurrentTenant() tenantId: string, @Param("id") recommendationId: string) {
    return this.recommendationsService.getById(tenantId, recommendationId);
  }
}
