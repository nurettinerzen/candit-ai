import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query
, Inject} from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import type { AiTaskType } from "@prisma/client";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { AiOrchestrationService } from "./ai-orchestration.service";

const AI_TASK_TYPES = [
  "CV_PARSING",
  "JOB_REQUIREMENT_INTERPRETATION",
  "CANDIDATE_FIT_ASSISTANCE",
  "SCREENING_SUPPORT",
  "INTERVIEW_PREPARATION",
  "INTERVIEW_ORCHESTRATION",
  "TRANSCRIPT_SUMMARIZATION",
  "REPORT_GENERATION",
  "RECOMMENDATION_GENERATION"
] as const;

type AiTaskTypeValue = (typeof AI_TASK_TYPES)[number];

class CreateAiTaskRunBody {
  @IsIn(AI_TASK_TYPES)
  @Transform(({ value }) => (value === undefined ? undefined : String(value).toUpperCase()))
  taskType!: AiTaskTypeValue;

  @IsObject()
  input!: Record<string, unknown>;

  @IsString()
  @IsOptional()
  traceId?: string;

  @IsString()
  @IsOptional()
  candidateId?: string;

  @IsString()
  @IsOptional()
  jobId?: string;

  @IsString()
  @IsOptional()
  applicationId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  aiReportId?: string;

  @IsString()
  @IsOptional()
  promptTemplateId?: string;

  @IsString()
  @IsOptional()
  rubricId?: string;

  @IsString()
  @IsOptional()
  providerKey?: string;

  @IsString()
  @IsOptional()
  humanApprovedBy?: string;
}

@Controller("ai/task-runs")
export class AiOrchestrationController {
  constructor(@Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService) {}

  @Post()
  @Permissions("ai.task.request")
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: CreateAiTaskRunBody
  ) {
    return this.aiOrchestrationService.createTaskRun({
      tenantId,
      requestedBy: user.userId,
      taskType: body.taskType,
      input: body.input,
      traceId: body.traceId ?? requestContext?.traceId,
      candidateId: body.candidateId,
      jobId: body.jobId,
      applicationId: body.applicationId,
      sessionId: body.sessionId,
      aiReportId: body.aiReportId,
      promptTemplateId: body.promptTemplateId,
      rubricId: body.rubricId,
      providerKey: body.providerKey,
      humanApprovedBy: body.humanApprovedBy
    });
  }

  @Get("providers")
  @Permissions("ai.task.read")
  listProviders() {
    return this.aiOrchestrationService.listProviders();
  }

  @Get()
  @Permissions("ai.task.read")
  list(
    @CurrentTenant() tenantId: string,
    @Query("taskType") taskType?: string,
    @Query("applicationId") applicationId?: string
  ) {
    const normalizedType = taskType ? String(taskType).toUpperCase() : undefined;

    if (normalizedType && !AI_TASK_TYPES.includes(normalizedType as AiTaskTypeValue)) {
      throw new BadRequestException("Gecersiz taskType filtresi.");
    }

    return this.aiOrchestrationService.listTaskRuns(tenantId, {
      taskType: normalizedType as AiTaskType | undefined,
      applicationId
    });
  }

  @Get(":id")
  @Permissions("ai.task.read")
  getById(@CurrentTenant() tenantId: string, @Param("id") id: string) {
    return this.aiOrchestrationService.getTaskRun(tenantId, id);
  }
}
