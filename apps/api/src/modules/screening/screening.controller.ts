import { Body, Controller, Get, Param, Post, Query , Inject} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { ScreeningService } from "./screening.service";

class ScreeningQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;
}

class TriggerScreeningRequest {
  @IsString()
  @IsOptional()
  providerKey?: string;
}

@Controller("screening")
export class ScreeningController {
  constructor(@Inject(ScreeningService) private readonly screeningService: ScreeningService) {}

  @Post("applications/:applicationId/trigger")
  @Permissions("screening.run")
  trigger(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("applicationId") applicationId: string,
    @Body() body: TriggerScreeningRequest
  ) {
    return this.screeningService.trigger({
      tenantId,
      applicationId,
      requestedBy: user.userId,
      traceId: requestContext?.traceId,
      providerKey: body.providerKey
    });
  }

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
