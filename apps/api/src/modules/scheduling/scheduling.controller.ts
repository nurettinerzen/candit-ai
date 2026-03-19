import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query
} from "@nestjs/common";
import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import type { IntegrationProvider } from "@prisma/client";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { Public } from "../../common/decorators/public.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { SchedulingService } from "./scheduling.service";

const SCHEDULING_PROVIDERS = ["CALENDLY", "GOOGLE_CALENDAR", "GOOGLE_MEET"] as const;

class CreateWorkflowBody {
  @IsString()
  applicationId!: string;

  @IsIn(SCHEDULING_PROVIDERS)
  @IsOptional()
  provider?: IntegrationProvider;
}

class RecruiterConstraintsBody {
  @IsObject()
  recruiterConstraints!: Record<string, unknown>;
}

class CandidateAvailabilityBody {
  @IsObject()
  candidateAvailability!: Record<string, unknown>;
}

class SelectSlotBody {
  @IsString()
  slotId!: string;
}

class BookSlotBody {
  @IsIn(SCHEDULING_PROVIDERS)
  @IsOptional()
  provider?: IntegrationProvider;
}

class CancelWorkflowBody {
  @IsString()
  @IsOptional()
  reasonCode?: string;
}

class WorkflowListQuery {
  @IsString()
  @IsOptional()
  applicationId?: string;
}

@Controller("scheduling")
export class SchedulingController {
  constructor(@Inject(SchedulingService) private readonly schedulingService: SchedulingService) {}

  @Get("workflows")
  @Permissions("interview.schedule")
  list(
    @CurrentTenant() tenantId: string,
    @Query() query: WorkflowListQuery
  ) {
    return this.schedulingService.listWorkflows(tenantId, query.applicationId);
  }

  @Post("workflows")
  @Permissions("interview.schedule")
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: CreateWorkflowBody
  ) {
    return this.schedulingService.createWorkflow({
      tenantId,
      applicationId: body.applicationId,
      initiatedBy: user.userId,
      provider: body.provider,
      traceId: requestContext?.traceId
    });
  }

  @Post("workflows/:id/recruiter-constraints")
  @Permissions("interview.schedule")
  setRecruiterConstraints(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") workflowId: string,
    @Body() body: RecruiterConstraintsBody
  ) {
    return this.schedulingService.setRecruiterConstraints({
      tenantId,
      workflowId,
      recruiterConstraints: body.recruiterConstraints,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("workflows/:id/candidate-availability")
  @Permissions("interview.schedule")
  setCandidateAvailability(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") workflowId: string,
    @Body() body: CandidateAvailabilityBody
  ) {
    return this.schedulingService.setCandidateAvailability({
      tenantId,
      workflowId,
      candidateAvailability: body.candidateAvailability,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("workflows/:id/propose-slots")
  @Permissions("interview.schedule")
  proposeSlots(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") workflowId: string
  ) {
    return this.schedulingService.proposeSlots({
      tenantId,
      workflowId,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("workflows/:id/select-slot")
  @Permissions("interview.schedule")
  selectSlot(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") workflowId: string,
    @Body() body: SelectSlotBody
  ) {
    return this.schedulingService.selectSlot({
      tenantId,
      workflowId,
      slotId: body.slotId,
      requestedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post("workflows/:id/book")
  @Permissions("interview.schedule")
  book(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") workflowId: string,
    @Body() body: BookSlotBody
  ) {
    return this.schedulingService.bookSelectedSlot({
      tenantId,
      workflowId,
      requestedBy: user.userId,
      provider: body.provider,
      traceId: requestContext?.traceId
    });
  }

  @Post("workflows/:id/cancel")
  @Permissions("interview.schedule")
  cancel(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") workflowId: string,
    @Body() body: CancelWorkflowBody
  ) {
    return this.schedulingService.cancelWorkflow({
      tenantId,
      workflowId,
      requestedBy: user.userId,
      reasonCode: body.reasonCode,
      traceId: requestContext?.traceId
    });
  }

  @Post("workflows/:id/reschedule-request")
  @Permissions("interview.schedule")
  requestReschedule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Param("id") workflowId: string,
    @Body() body: CancelWorkflowBody
  ) {
    return this.schedulingService.requestReschedule({
      tenantId,
      workflowId,
      requestedBy: user.userId,
      reasonCode: body.reasonCode,
      traceId: requestContext?.traceId
    });
  }

  // ── Public candidate-facing scheduling endpoints ──

  @Public()
  @Get("public/workflows/:id")
  getPublicWorkflow(
    @Param("id") workflowId: string,
    @Query("token") token: string
  ) {
    return this.schedulingService.getPublicWorkflow(workflowId, token);
  }

  @Public()
  @Post("public/workflows/:id/select-slot")
  publicSelectSlot(
    @Param("id") workflowId: string,
    @Query("token") token: string,
    @Body() body: SelectSlotBody
  ) {
    return this.schedulingService.publicSelectSlotAndBook(workflowId, token, body.slotId);
  }

  @Public()
  @Get("public/workflows/:id/confirmation")
  getPublicConfirmation(
    @Param("id") workflowId: string,
    @Query("token") token: string
  ) {
    return this.schedulingService.getPublicConfirmation(workflowId, token);
  }
}
