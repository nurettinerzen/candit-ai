import { Injectable, Inject, Logger } from "@nestjs/common";
import { randomUUID } from "crypto";
import { ApplicationStage, AuditActorType, SchedulingWorkflowState, SchedulingWorkflowStatus, type AiTaskType, type Prisma } from "@prisma/client";
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
    requestedBy: string;
    traceId?: string;
  }) {
    const application = await this.prisma.candidateApplication.findFirst({
      where: { id: input.applicationId, tenantId: input.tenantId },
      include: {
        candidate: { select: { fullName: true, email: true } },
        job: { select: { title: true } }
      }
    });

    if (!application) {
      throw new Error("Basvuru bulunamadi.");
    }

    if (!application.candidate.email?.trim()) {
      throw new Error("Aday için e-posta adresi bulunamadı.");
    }

    // Record human approval
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
          reason: "recruiter_manual_approval"
        } as Prisma.InputJsonValue
      }
    });

    // Generate next 5 business days availability windows (9:00-18:00 Istanbul)
    const proposedSlots = this.generateDefaultSlots();
    const candidateToken = `sched_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const webBaseUrl = (process.env.PUBLIC_WEB_BASE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

    // Create scheduling workflow
    const workflow = await this.prisma.schedulingWorkflow.create({
      data: {
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        initiatedBy: input.requestedBy,
        updatedBy: input.requestedBy,
        source: "assistant",
        state: SchedulingWorkflowState.SLOT_PROPOSAL_READY,
        status: SchedulingWorkflowStatus.ACTIVE,
        recruiterConstraintsJson: {
          slotDurationMinutes: 30,
          timezone: "Europe/Istanbul",
          windows: proposedSlots.map(s => ({ start: s.start, end: s.end }))
        } as Prisma.InputJsonValue,
        candidateAvailabilityJson: {
          windows: proposedSlots.map(s => ({ start: s.start, end: s.end })),
          source: "auto_generated"
        } as Prisma.InputJsonValue,
        proposedSlotsJson: proposedSlots as unknown as Prisma.InputJsonValue,
        conversationContextJson: {
          candidateAccessToken: candidateToken,
          autoGenerated: true
        } as Prisma.InputJsonValue
      }
    });

    const schedulingLink = `${webBaseUrl}/randevu/${workflow.id}?token=${candidateToken}`;
    let interviewSession: Awaited<ReturnType<InterviewsService["schedule"]>>;

    try {
      interviewSession = await this.interviewsService.schedule({
        tenantId: input.tenantId,
        applicationId: input.applicationId,
        mode: "VOICE",
        scheduledAt: new Date().toISOString(),
        schedulingSource: "recruiter_direct_invite",
        scheduleNote: "direct_ai_interview_invitation",
        requestedBy: input.requestedBy,
        traceId: input.traceId,
        notificationMetadata: {
          emailVariant: "direct_ai_interview_invite",
          primaryCtaLabel: "Şimdi Başla",
          secondaryLink: schedulingLink,
          secondaryCtaLabel: "Daha Sonra Planla",
          hideScheduledAt: true
        }
      });
    } catch (error) {
      await this.prisma.schedulingWorkflow.update({
        where: {
          id: workflow.id
        },
        data: {
          state: SchedulingWorkflowState.CANCELLED,
          status: SchedulingWorkflowStatus.CANCELLED,
          lastError: error instanceof Error ? error.message : "direct_interview_session_failed",
          updatedBy: input.requestedBy
        }
      });
      throw error;
    }

    await this.prisma.schedulingWorkflow.update({
      where: {
        id: workflow.id
      },
      data: {
        sessionId: interviewSession.id,
        updatedBy: input.requestedBy
      }
    });

    // Audit + domain event
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
          workflowId: workflow.id,
          candidateToken,
          schedulingLink,
          sessionId: interviewSession.id,
          interviewLink: interviewSession.meetingJoinUrl
        }
      }),
      this.domainEventsService.append({
        tenantId: input.tenantId,
        aggregateType: "CandidateApplication",
        aggregateId: input.applicationId,
        eventType: "application.approved_for_interview",
        traceId: input.traceId,
        payload: {
          workflowId: workflow.id,
          sessionId: interviewSession.id,
          schedulingLink,
          interviewLink: interviewSession.meetingJoinUrl,
          requestedBy: input.requestedBy,
          candidateEmail: application.candidate.email
        }
      })
    ]);

    this.logger.log(
      `Application ${input.applicationId} approved for direct interview. Workflow: ${workflow.id}, Session: ${interviewSession.id}`
    );

    return {
      workflowId: workflow.id,
      candidateToken,
      schedulingLink,
      interviewLink: interviewSession.meetingJoinUrl,
      sessionId: interviewSession.id,
      applicationId: input.applicationId,
      status: "ok"
    };
  }

  private generateDefaultSlots(): Array<{ slotId: string; start: string; end: string; source: string }> {
    const slots: Array<{ slotId: string; start: string; end: string; source: string }> = [];
    const now = new Date();
    let daysAdded = 0;
    let dayOffset = 1;

    while (daysAdded < 5 && dayOffset < 14) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      const dayOfWeek = date.getDay();

      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        for (let hour = 9; hour < 18; hour++) {
          const slotStart = new Date(date);
          slotStart.setHours(hour, 0, 0, 0);
          const slotEnd = new Date(slotStart);
          slotEnd.setMinutes(30);

          slots.push({
            slotId: `slot_${slotStart.toISOString()}`,
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            source: "auto_generated"
          });

          if (slots.length >= 20) break;
        }
        daysAdded++;
      }
      dayOffset++;
      if (slots.length >= 20) break;
    }

    return slots;
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
