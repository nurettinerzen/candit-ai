import { Body, Controller, Get, Param, Post , Inject} from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import { AsyncJobsService, ASYNC_JOB_TYPES, type AsyncJobType } from "./async-jobs.service";

class CreateAsyncJobRequest {
  @IsIn(ASYNC_JOB_TYPES)
  type!: AsyncJobType;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  traceId?: string;
}

@Controller("async-jobs")
export class AsyncJobsController {
  constructor(@Inject(AsyncJobsService) private readonly asyncJobsService: AsyncJobsService) {}

  @Post()
  @Permissions("interview.session.manage")
  create(
    @CurrentTenant() tenantId: string,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: CreateAsyncJobRequest
  ) {
    return this.asyncJobsService.create(tenantId, {
      type: body.type,
      payload: body.payload,
      traceId: body.traceId ?? requestContext?.traceId
    });
  }

  @Get(":id")
  @Permissions("interview.session.manage")
  getById(@CurrentTenant() tenantId: string, @Param("id") id: string) {
    return this.asyncJobsService.getById(tenantId, id);
  }
}
