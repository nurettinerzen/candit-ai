import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query
, Inject} from "@nestjs/common";
import { ApplicationStage } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MinLength, ValidateNested } from "class-validator";
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
import { InterviewsService } from "../interviews/interviews.service";

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

class BulkDeleteApplicationsBody {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  applicationIds!: string[];
}

class InterviewQuestionDraftItemBody {
  @IsString()
  @MinLength(3)
  prompt!: string;

  @IsString()
  @IsOptional()
  key?: string;

  @IsString()
  @IsOptional()
  questionKey?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  followUps?: string[];
}

class QuickActionBody {
  @IsIn([
    "shortlist",
    "reject",
    "hold",
    "trigger_screening",
    "trigger_fit_score",
    "invite_interview",
    "reinvite_interview",
    "advance",
    "send_reminder"
  ])
  action!: string;

  @IsString()
  @IsOptional()
  reasonCode?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterviewQuestionDraftItemBody)
  @IsOptional()
  questionnaire?: InterviewQuestionDraftItemBody[];
}

class InterviewQuestionnaireQuery {
  @IsString()
  @IsOptional()
  templateId?: string;
}

@Controller("applications")
export class ApplicationsController {
  constructor(
    @Inject(ApplicationsService) private readonly applicationsService: ApplicationsService,
    @Inject(ApplicationAutomationService) private readonly applicationAutomationService: ApplicationAutomationService,
    @Inject(FitScoringService) private readonly fitScoringService: FitScoringService,
    @Inject(RecruiterNotesService) private readonly recruiterNotesService: RecruiterNotesService,
    @Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService,
    @Inject(InterviewsService) private readonly interviewsService: InterviewsService
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

  @Get(":id/interview-questionnaire")
  @Permissions("candidate.read")
  previewInterviewQuestionnaire(
    @Param("id") applicationId: string,
    @CurrentTenant() tenantId: string,
    @Query() query: InterviewQuestionnaireQuery
  ) {
    return this.applicationAutomationService.previewInterviewQuestionnaire({
      tenantId,
      applicationId,
      templateId: query.templateId
    });
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

  @Post("bulk-delete")
  @Permissions("candidate.move_stage")
  bulkDelete(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: BulkDeleteApplicationsBody
  ) {
    return this.applicationsService.deleteMany({
      tenantId,
      applicationIds: body.applicationIds,
      deletedBy: user.userId
    });
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

    await this.applicationsService.assertJobActionable(tenantId, applicationId);

    if (body.note) {
      await this.recruiterNotesService.create(tenantId, applicationId, user.userId, body.note);
    }

    switch (body.action) {
      // ── Mülakata Davet Et: Ön Eleme Tamamlandı → AI Mülakat ──
      case "invite_interview":
      case "reinvite_interview":
      case "advance":
      case "shortlist": {
        const app = await this.applicationsService.getById(tenantId, applicationId);
        const result = await this.applicationAutomationService.onRecruiterApprovedForInterview({
          tenantId,
          applicationId,
          candidateId: app.candidateId,
          jobId: app.jobId,
          templateId: body.templateId,
          questionnaire: body.questionnaire,
          requestedBy: user.userId,
          traceId
        });
        return { action: body.action, ...result };
      }

      // ── Reddet: Herhangi bir aşamadan reddedilebilir ──
      case "reject":
        return this.applicationsService.decision({
          tenantId,
          applicationId,
          aiReportId: "manual_quick_action_reject",
          reasonCode: body.reasonCode ?? "rejected_by_recruiter",
          decision: "reject",
          changedBy: user.userId,
          humanApprovedBy: user.userId,
          traceId
        });

      case "send_reminder":
        return this.interviewsService.sendInvitationReminder({
          tenantId,
          applicationId,
          requestedBy: user.userId,
          traceId
        });

      // ── Legacy actions — backward compatibility ──
      case "hold":
        return { status: "ok", action: body.action, applicationId, message: "Beklet aksiyonu kaldırıldı." };
      case "trigger_screening": {
        const app = await this.applicationsService.getById(tenantId, applicationId);
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
          templateId: undefined,
          questionnaire: undefined,
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
