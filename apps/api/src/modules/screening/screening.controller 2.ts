import { Controller, Get, Param, Query } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { ScreeningService } from "./screening.service";

class ScreeningQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

@Controller("screening")
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

  @Get("applications/:applicationId")
  @Permissions("screening.run")
  listByApplication(
    @CurrentTenant() tenantId: string,
    @Param("applicationId") applicationId: string,
    @Query() query: ScreeningQuery
  ) {
    return this.screeningService.listByApplication(tenantId, applicationId, query.limit);
  }

  @Get("applications/:applicationId/latest")
  @Permissions("screening.run")
  latestByApplication(
    @CurrentTenant() tenantId: string,
    @Param("applicationId") applicationId: string
  ) {
    return this.screeningService.latestByApplication(tenantId, applicationId);
  }
}
