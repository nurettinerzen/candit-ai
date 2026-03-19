import { Controller, Get, Param, Query , Inject} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Min } from "class-validator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { ReportsService } from "./reports.service";

class ReportsQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

@Controller("reports")
export class ReportsController {
  constructor(@Inject(ReportsService) private readonly reportsService: ReportsService) {}

  @Get("applications/:applicationId")
  @Permissions("report.read")
  listByApplication(
    @CurrentTenant() tenantId: string,
    @Param("applicationId") applicationId: string,
    @Query() query: ReportsQuery
  ) {
    return this.reportsService.listByApplication(tenantId, applicationId, query.limit);
  }

  @Get(":id")
  @Permissions("report.read")
  getById(@CurrentTenant() tenantId: string, @Param("id") reportId: string) {
    return this.reportsService.getById(tenantId, reportId);
  }
}
