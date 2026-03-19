import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query
, Inject} from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { Permissions } from "../../common/decorators/permissions.decorator";
import { CurrentContext } from "../../common/decorators/current-context.decorator";
import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestContext } from "../../common/interfaces/request-context.interface";
import type { RequestUser } from "../../common/interfaces/request-user.interface";
import { AiOrchestrationService } from "../ai-orchestration/ai-orchestration.service";
import { ApplicationAutomationService } from "./application-automation.service";
import { ApplicationsService } from "./applications.service";
import { FitScoringService } from "./fit-scoring.service";
import { RecruiterNotesService } from "./recruiter-notes.service";

const APPLICATION_STAGES = [
  "APPLIED",
  "SCREENING",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "RECRUITER_REVIEW",
  "HIRING_MANAGER_REVIEW",
  "OFFER",
  "REJECTED",
  "HIRED"
] as const;

type StageValue = (typeof APPLICATION_STAGES)[number];

class CreateApplicationBody {
  @IsString()
  candidateId!: string;

  @IsString()
  jobId!: string;
}

class StageTransitionRequestBody {
  @IsIn(APPLICATION_STAGES)
  @Transform(({ value }) => (value === undefined ? undefined : String(value).toUpperCase()))
  toStage!: StageValue;

  @IsString()
  @MinLength(3)
  reasonCode!: string;
}

class DecisionRequestBody {
  @IsIn(["advance", "hold", "reject"])
  decision!: "advance" | "hold" | "reject";

  @IsString()
  reasonCode!: string;

  @IsString()
  aiReportId!: string;

  @IsString()
  humanApprovedBy!: string;
}

class NoteBody {
  @IsString()
  @MinLength(1)
  noteText!: string;
}

class BulkApproveInterviewBody {
  @IsArray()
  @IsString({ each: true })
  applicationIds!: string[];
}

class QuickActionBody {
  @IsIn(["shortlist", "reject", "hold", "trigger_screening", "trigger_fit_score", "invite_interview"])
  action!: string;

  @IsString()
  @IsOptional()
  reasonCode?: string;

  @IsString()
  @IsOptional()
  note?: string;
}

@Controller("applications")
export class ApplicationsController {
  constructor(
    @Inject(ApplicationsService) private readonly applicationsService: ApplicationsService,
    @Inject(ApplicationAutomationService) private readonly applicationAutomationService: ApplicationAutomationService,
    @Inject(FitScoringService) private readonly fitScoringService: FitScoringService,
    @Inject(RecruiterNotesService) private readonly recruiterNotesService: RecruiterNotesService,
    @Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService
  ) {}

  @Get()
  @Permissions("candidate.read")
  list(
    @CurrentTenant() tenantId: string,
    @Query("stage") stage?: string,
    @Query("jobId") jobId?: string
  ) {
    const normalizedStage = stage ? String(stage).toUpperCase() : undefined;

    if (normalizedStage && !APPLICATION_STAGES.includes(normalizedStage as StageValue)) {
      throw new ForbiddenException("Gecersiz stage filtresi.");
    }

    return this.applicationsService.list(tenantId, normalizedStage as StageValue | undefined, jobId);
  }

  @Get(":id")
  @Permissions("candidate.read")
  getById(@Param("id") id: string, @CurrentTenant() tenantId: string) {
    return this.applicationsService.getById(tenantId, id);
  }

  @Post()
  @Permissions("candidate.create")
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: CreateApplicationBody
  ) {
    return this.applicationsService.create({
      tenantId,
      candidateId: body.candidateId,
      jobId: body.jobId,
      createdBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post(":id/stage-transition")
  @Permissions("candidate.move_stage")
  stageTransition(
    @Param("id") applicationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: StageTransitionRequestBody
  ) {
    return this.applicationsService.stageTransition({
      tenantId,
      applicationId,
      toStage: body.toStage,
      reasonCode: body.reasonCode,
      changedBy: user.userId,
      traceId: requestContext?.traceId
    });
  }

  @Post(":id/decision")
  @Permissions("candidate.move_stage")
  decision(
    @Param("id") applicationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: DecisionRequestBody
  ) {
    return this.applicationsService.decision({
      tenantId,
      applicationId,
      aiReportId: body.aiReportId,
      reasonCode: body.reasonCode,
      decision: body.decision,
      changedBy: user.userId,
      humanApprovedBy: body.humanApprovedBy,
      traceId: requestContext?.traceId
    });
  }

  @Get(":id/fit-score/latest")
  @Permissions("candidate.read")
  getFitScore(@Param("id") applicationId: string, @CurrentTenant() tenantId: string) {
    return this.fitScoringService.getLatest(tenantId, applicationId);
  }

  @Get(":id/notes")
  @Permissions("candidate.read")
  listNotes(@Param("id") applicationId: string, @CurrentTenant() tenantId: string) {
    return this.recruiterNotesService.list(tenantId, applicationId);
  }

  @Post(":id/notes")
  @Permissions("candidate.create")
  addNote(
    @Param("id") applicationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: NoteBody
  ) {
    return this.recruiterNotesService.create(tenantId, applicationId, user.userId, body.noteText);
  }

  @Post(":id/quick-action")
  @Permissions("candidate.move_stage")
  async quickAction(
    @Param("id") applicationId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: QuickActionBody
  ) {
    const traceId = requestContext?.traceId;

    if (body.note) {
      await this.recruiterNotesService.create(tenantId, applicationId, user.userId, body.note);
    }

    switch (body.action) {
      case "shortlist":
        return this.applicationsService.stageTransition({
          tenantId, applicationId, toStage: "SCREENING", reasonCode: body.reasonCode ?? "shortlisted", changedBy: user.userId, traceId
        });
      case "reject":
        return this.applicationsService.stageTransition({
          tenantId, applicationId, toStage: "REJECTED", reasonCode: body.reasonCode ?? "rejected_by_recruiter", changedBy: user.userId, traceId
        });
      case "hold": {
        const app = await this.applicationsService.getById(tenantId, applicationId);

        if (app.currentStage === "RECRUITER_REVIEW") {
          return { status: "held", action: body.action, applicationId };
        }

        const transition = await this.applicationsService.stageTransition({
          tenantId,
          applicationId,
          toStage: "RECRUITER_REVIEW",
          reasonCode: body.reasonCode ?? "held_by_recruiter",
          changedBy: user.userId,
          traceId
        });

        return { status: "held", action: body.action, applicationId, transition };
      }
      case "trigger_screening": {
        const app = await this.applicationsService.getById(tenantId, applicationId);

        if (app.currentStage === "APPLIED") {
          await this.applicationsService.stageTransition({
            tenantId,
            applicationId,
            toStage: "SCREENING",
            reasonCode: body.reasonCode ?? "screening_triggered_by_recruiter",
            changedBy: user.userId,
            traceId
          });
        }

        const taskRun = await this.aiOrchestrationService.createTaskRun({
          tenantId,
          requestedBy: user.userId,
          taskType: "SCREENING_SUPPORT" as import("@prisma/client").AiTaskType,
          applicationId,
          candidateId: app.candidateId,
          jobId: app.jobId,
          triggerSource: "manual",
          triggerReasonCode: "quick_action_trigger_screening",
          traceId,
          input: { triggerSource: "manual" }
        });

        return { status: "queued", action: body.action, applicationId, taskRunId: taskRun.taskRunId };
      }
      case "trigger_fit_score": {
        const app = await this.applicationsService.getById(tenantId, applicationId);
        const taskRun = await this.aiOrchestrationService.createTaskRun({
          tenantId,
          requestedBy: user.userId,
          taskType: "APPLICANT_FIT_SCORING" as import("@prisma/client").AiTaskType,
          applicationId,
          candidateId: app.candidateId,
          jobId: app.jobId,
          triggerSource: "manual",
          triggerReasonCode: "quick_action_trigger_fit_score",
          traceId,
          input: { triggerSource: "manual" }
        });
        return { status: "queued", action: body.action, applicationId, taskRunId: taskRun.taskRunId };
      }
      case "invite_interview": {
        const app = await this.applicationsService.getById(tenantId, applicationId);
        const result = await this.applicationAutomationService.onRecruiterApprovedForInterview({
          tenantId,
          applicationId,
          candidateId: app.candidateId,
          jobId: app.jobId,
          requestedBy: user.userId,
          traceId
        });
        return { action: body.action, ...result };
      }
      default:
        return { status: "ok", action: body.action, applicationId };
    }
  }

  @Post("bulk-approve-interview")
  @Permissions("candidate.move_stage")
  async bulkApproveInterview(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @CurrentContext() requestContext: RequestContext | undefined,
    @Body() body: BulkApproveInterviewBody
  ) {
    const results = [];
    for (const applicationId of body.applicationIds) {
      try {
        const app = await this.applicationsService.getById(tenantId, applicationId);
        const result = await this.applicationAutomationService.onRecruiterApprovedForInterview({
          tenantId,
          applicationId,
          candidateId: app.candidateId,
          jobId: app.jobId,
          requestedBy: user.userId,
          traceId: requestContext?.traceId
        });
        results.push({ ...result, applicationId });
      } catch (error) {
        results.push({ applicationId, status: "error", error: error instanceof Error ? error.message : "unknown" });
      }
    }
    return { total: body.applicationIds.length, results };
  }
}
