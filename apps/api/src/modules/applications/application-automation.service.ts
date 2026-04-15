import { BadRequestException, Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { ApplicationStage, AuditActorType, type AiTaskType, type Prisma } from "@prisma/client";
import { AiOrchestrationService } from "../ai-orchestration/ai-orchestration.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { InterviewsService } from "../interviews/interviews.service";
import { PrismaService } from "../../prisma/prisma.service";

const TASK_TO_FLAG: Record<AiTaskType, string> = {
  CV_PARSING: "ai.cv_parsing.enabled",
  JOB_REQUIREMENT_INTERPRETATION: "ai.job_requirement_interpretation.enabled",
  CANDIDATE_FIT_ASSISTANCE: "ai.candidate_fit_assistance.enabled",
  SCREENING_SUPPORT: "ai.screening_support.enabled",
  INTERVIEW_PREPARATION: "ai.interview_preparation.enabled",
  INTERVIEW_ORCHESTRATION: "ai.interview_orchestration.enabled",
  TRANSCRIPT_SUMMARIZATION: "ai.transcript_summarization.enabled",
  REPORT_GENERATION: "ai.report_generation.enabled",
  RECOMMENDATION_GENERATION: "ai.recommendation_generation.enabled",
  APPLICANT_FIT_SCORING: "ai.applicant_fit_scoring.enabled"
};

const SYSTEM_TRIGGER_FLAGS = {
  ON_APPLICATION_CREATED: "ai.system_triggers.application_created.screening_support.enabled",
  ON_STAGE_REVIEW_PACK: "ai.system_triggers.stage_review_pack.enabled"
} as const;

type SupportedAiTaskType =
  | "CV_PARSING"
  | "SCREENING_SUPPORT"
  | "REPORT_GENERATION"
  | "RECOMMENDATION_GENERATION";

@Injectable()
export class ApplicationAutomationService {
  private readonly logger = new Logger(ApplicationAutomationService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(AiOrchestrationService) private readonly aiOrchestrationService: AiOrchestrationService,
    @Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService,
    @Inject(InterviewsService) private readonly interviewsService: InterviewsService
  ) {}

  previewInterviewQuestionnaire(input: {
    tenantId: string;
    applicationId: string;
    templateId?: string;
  }) {
    return this.interviewsService.previewOnDemandQuestionnaire(input);
  }

  async onApplicationCreated(input: {
    tenantId: string;
    applicationId: string;
    candidateId: string;
    jobId: string;
    requestedBy: string;
    traceId?: string;
  }) {
    try {
      const enabled = await this.featureFlagsService.isEnabled(
        input.tenantId,
        SYSTEM_TRIGGER_FLAGS.ON_APPLICATION_CREATED,
        false
      );

      if (!enabled) {
        await this.logSystemTrigger({
          tenantId: input.tenantId,
          applicationId: input.applicationId,
          action: "skipped",
          taskType: "SCREENING_SUPPORT",
          reason: "system_trigger_flag_disabled",
          requestedBy: input.requestedBy,
          traceId: input.traceId
        });
        return;
      }

      await this.enqueueSystemTask({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        candidateId: input.candidateId,
        jobId: input.jobId,
        requestedBy: input.requestedBy,
        taskType: "SCREENING_SUPPORT",
        triggerReasonCode: "application_created_screening_support",
        traceId: input.traceId
      });
    } catch (error) {
      await this.logSystemTrigger({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        action: "failed",
        taskType: "SCREENING_SUPPORT",
        reason: error instanceof Error ? error.message : "unknown_error",
        requestedBy: input.requestedBy,
        traceId: input.traceId
      });
    }
  }

  async onStageTransition(input: {
    tenantId: string;
    applicationId: string;
    candidateId: string;
    jobId: string;
    fromStage: ApplicationStage;
    toStage: ApplicationStage;
    changedBy: string;
    traceId?: string;
  }) {
    if (
      input.fromStage !== ApplicationStage.INTERVIEW_COMPLETED ||
      input.toStage !== ApplicationStage.RECRUITER_REVIEW
    ) {
      return;
    }

    const reviewPackEnabled = await this.featureFlagsService.isEnabled(
      input.tenantId,
      SYSTEM_TRIGGER_FLAGS.ON_STAGE_REVIEW_PACK,
      false
    );

    if (!reviewPackEnabled) {
      await this.logSystemTrigger({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        action: "skipped",
        taskType: "REPORT_GENERATION",
        reason: "stage_review_pack_flag_disabled",
        requestedBy: input.changedBy,
        traceId: input.traceId
      });
      return;
    }

    const latestCompletedSession = await this.prisma.interviewSession.findFirst({
      where: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        status: "COMPLETED"
      },
      select: {
        id: true
      },
      orderBy: {
        endedAt: "desc"
      }
    });

    if (!latestCompletedSession) {
      await this.logSystemTrigger({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        action: "skipped",
        taskType: "REPORT_GENERATION",
        reason: "completed_interview_session_missing",
        requestedBy: input.changedBy,
        traceId: input.traceId
      });
    } else {
      await this.enqueueSystemTask({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        candidateId: input.candidateId,
        jobId: input.jobId,
        sessionId: latestCompletedSession.id,
        requestedBy: input.changedBy,
        taskType: "REPORT_GENERATION",
        triggerReasonCode: "stage_transition_review_pack",
        traceId: input.traceId
      });
    }

    await this.enqueueSystemTask({
      tenantId: input.tenantId,
      applicationId: input.applicationId,
      candidateId: input.candidateId,
      jobId: input.jobId,
      requestedBy: input.changedBy,
      taskType: "RECOMMENDATION_GENERATION",
      triggerReasonCode: "stage_transition_review_pack",
      traceId: input.traceId
    });
  }

  private async enqueueSystemTask(input: {
    tenantId: string;
    applicationId: string;
    candidateId: string;
    jobId: string;
    sessionId?: string;
    requestedBy: string;
    taskType: SupportedAiTaskType;
    triggerReasonCode: string;
    traceId?: string;
  }) {
    try {
      const taskEnabled = await this.featureFlagsService.isEnabled(
        input.tenantId,
        TASK_TO_FLAG[input.taskType],
        false
      );

      if (!taskEnabled) {
        await this.logSystemTrigger({
          tenantId: input.tenantId,
          applicationId: input.applicationId,
          action: "skipped",
          taskType: input.taskType,
          reason: "task_feature_flag_disabled",
          requestedBy: input.requestedBy,
          traceId: input.traceId
        });
        return;
      }

      const task = await this.aiOrchestrationService.createTaskRun({
        tenantId: input.tenantId,
        requestedBy: input.requestedBy,
        taskType: input.taskType,
        triggerSource: "system",
        triggerReasonCode: input.triggerReasonCode,
        traceId: input.traceId,
        candidateId: input.candidateId,
        jobId: input.jobId,
        applicationId: input.applicationId,
        sessionId: input.sessionId,
        input: {
          triggerSource: "system",
          triggerReasonCode: input.triggerReasonCode,
          generatedBy: "application-automation.service",
          applicationId: input.applicationId
        }
      });

      await this.logSystemTrigger({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        action: "enqueued",
        taskType: input.taskType,
        reason: input.triggerReasonCode,
        requestedBy: input.requestedBy,
        traceId: input.traceId,
        metadata: {
          taskRunId: task.taskRunId,
          workflowJobId: task.workflowJobId
        }
      });
    } catch (error) {
      await this.logSystemTrigger({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        action: "failed",
        taskType: input.taskType,
        reason: error instanceof Error ? error.message : "unknown_error",
        requestedBy: input.requestedBy,
        traceId: input.traceId
      });
    }
  }

  async onRecruiterApprovedForInterview(input: {
    tenantId: string;
    applicationId: string;
    candidateId: string;
    jobId: string;
    templateId?: string;
    questionnaire?: Array<{
      key?: string;
      questionKey?: string;
      category?: string;
      prompt: string;
      followUps?: string[];
    }>;
    requestedBy: string;
    traceId?: string;
  }) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: input.applicationId, tenantId: input.tenantId },
      include: {
        candidate: { select: { fullName: true, email: true } },
        job: { select: { title: true, status: true } }
      }
    });

    if (!application) {
      throw new NotFoundException("Basvuru bulunamadi.");
    }

    if (!application.candidate.email?.trim()) {
      throw new BadRequestException("Aday için e-posta adresi bulunamadı.");
    }

    if (application.job.status === "ARCHIVED") {
      throw new BadRequestException("Arşivli ilanda aşama değiştirilemez.");
    }

    await this.prisma.humanApproval.create({
      data: {
        tenantId: input.tenantId,
        actionType: "recruiter_approved_for_interview",
        entityType: "CandidateApplication",
        entityId: input.applicationId,
        requestedBy: input.requestedBy,
        approvedBy: input.requestedBy,
        metadata: {
          candidateId: input.candidateId,
          jobId: input.jobId,
          reason: "recruiter_manual_approval",
          templateId: input.templateId ?? null,
          questionCount: input.questionnaire?.length ?? null
        } as Prisma.InputJsonValue
      }
    });

    const interviewSession = await this.interviewsService.inviteOnDemandVoiceSession({
      tenantId: input.tenantId,
      applicationId: input.applicationId,
      templateId: input.templateId,
      questionnaire: input.questionnaire,
      requestedBy: input.requestedBy,
      traceId: input.traceId,
      scheduleNote: "on_demand_ai_first_interview"
    });

    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.requestedBy,
        actorType: AuditActorType.USER,
        action: "application.approved_for_interview",
        entityType: "CandidateApplication",
        entityId: input.applicationId,
        traceId: input.traceId,
        metadata: {
          sessionId: interviewSession.id,
          interviewLink: interviewSession.meetingJoinUrl,
          expiresAt: interviewSession.candidateAccessExpiresAt?.toISOString() ?? null
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CandidateApplication",
        aggregateId: input.applicationId,
        eventType: "application.approved_for_interview",
        traceId: input.traceId,
        payload: {
          sessionId: interviewSession.id,
          interviewLink: interviewSession.meetingJoinUrl,
          requestedBy: input.requestedBy,
          candidateEmail: application.candidate.email,
          expiresAt: interviewSession.candidateAccessExpiresAt?.toISOString() ?? null
        }
      })
    ]);

    this.logger.log(
      `Application ${input.applicationId} approved for on-demand AI interview. Session: ${interviewSession.id}`
    );

    return {
      interviewLink: interviewSession.meetingJoinUrl,
      sessionId: interviewSession.id,
      applicationId: input.applicationId,
      expiresAt: interviewSession.candidateAccessExpiresAt?.toISOString() ?? null,
      status: "ok"
    };
  }

  private async logSystemTrigger(input: {
    tenantId: string;
    applicationId: string;
    action: "enqueued" | "skipped" | "failed";
    taskType: SupportedAiTaskType;
    reason: string;
    requestedBy: string;
    traceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await Promise.all([
      this.auditWriterService.write({
        tenantId: input.tenantId,
        actorUserId: input.requestedBy,
        actorType: AuditActorType.SYSTEM,
        action: `ai.system_trigger.${input.action}`,
        entityType: "CandidateApplication",
        entityId: input.applicationId,
        traceId: input.traceId,
        metadata: {
          taskType: input.taskType,
          reason: input.reason,
          ...(input.metadata ?? {})
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CandidateApplication",
        aggregateId: input.applicationId,
        eventType: `ai.system_trigger.${input.action}`,
        traceId: input.traceId,
        payload: {
          taskType: input.taskType,
          reason: input.reason,
          requestedBy: input.requestedBy,
          ...(input.metadata ?? {})
        }
      })
    ]);
  }
}
