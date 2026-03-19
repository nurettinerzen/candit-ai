import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException, Inject} from "@nestjs/common";
import {
  AiAutomationLevel,
  AiTaskStatus,
  AiTaskType,
  AuditActorType,
  Prisma
} from "@prisma/client";
import { AsyncJobsService, type AsyncJobType } from "../async-jobs/async-jobs.service";
import { AuditWriterService } from "../audit/audit-writer.service";
import { DomainEventsService } from "../domain-events/domain-events.service";
import { FeatureFlagsService } from "../feature-flags/feature-flags.service";
import { HumanApprovalService } from "../policy/human-approval.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AiProviderRegistryService } from "./providers/ai-provider-registry.service";

export type CreateAiTaskRunInput = {
  tenantId: string;
  requestedBy: string;
  taskType: AiTaskType;
  input: Record<string, unknown>;
  triggerSource?: "manual" | "system";
  triggerReasonCode?: string;
  traceId?: string;
  candidateId?: string;
  jobId?: string;
  applicationId?: string;
  sessionId?: string;
  aiReportId?: string;
  promptTemplateId?: string;
  rubricId?: string;
  providerKey?: string;
  humanApprovedBy?: string;
};

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

const TASK_TO_JOB_TYPE: Record<AiTaskType, AsyncJobType> = {
  CV_PARSING: "cv_parse",
  JOB_REQUIREMENT_INTERPRETATION: "job_requirement_interpretation",
  CANDIDATE_FIT_ASSISTANCE: "candidate_fit_assistance",
  SCREENING_SUPPORT: "screening_support",
  INTERVIEW_PREPARATION: "interview_preparation",
  INTERVIEW_ORCHESTRATION: "interview_orchestration",
  TRANSCRIPT_SUMMARIZATION: "transcript_summarization",
  REPORT_GENERATION: "report_generation",
  RECOMMENDATION_GENERATION: "recommendation_generation",
  APPLICANT_FIT_SCORING: "applicant_fit_scoring"
};

const TASK_TO_AUTOMATION_LEVEL: Record<AiTaskType, AiAutomationLevel> = {
  CV_PARSING: AiAutomationLevel.ASSISTED,
  JOB_REQUIREMENT_INTERPRETATION: AiAutomationLevel.ASSISTED,
  CANDIDATE_FIT_ASSISTANCE: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
  SCREENING_SUPPORT: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
  INTERVIEW_PREPARATION: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
  INTERVIEW_ORCHESTRATION: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
  TRANSCRIPT_SUMMARIZATION: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
  REPORT_GENERATION: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
  RECOMMENDATION_GENERATION: AiAutomationLevel.MANUAL_WITH_AI_SUPPORT,
  APPLICANT_FIT_SCORING: AiAutomationLevel.ASSISTED
};

@Injectable()
export class AiOrchestrationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AsyncJobsService) private readonly asyncJobsService: AsyncJobsService,
    @Inject(FeatureFlagsService) private readonly featureFlagsService: FeatureFlagsService,
    @Inject(DomainEventsService) private readonly domainEventsService: DomainEventsService,
    @Inject(AuditWriterService) private readonly auditWriterService: AuditWriterService,
    @Inject(HumanApprovalService) private readonly humanApprovalService: HumanApprovalService,
    @Inject(AiProviderRegistryService) private readonly aiProviderRegistry: AiProviderRegistryService
  ) {}

  async createTaskRun(input: CreateAiTaskRunInput) {
    await this.validateFeatureFlag(input.tenantId, input.taskType);
    await this.validateReferences(input);
    const triggerSource = input.triggerSource ?? "manual";
    const normalizedInput = {
      ...input.input,
      triggerSource,
      triggerReasonCode: input.triggerReasonCode ?? null
    };

    if (input.taskType === AiTaskType.INTERVIEW_ORCHESTRATION) {
      this.humanApprovalService.assertRequesterMatchesApprover(
        input.requestedBy,
        input.humanApprovedBy
      );
    }

    const selectedProvider = this.aiProviderRegistry.getProvider(input.providerKey).key;
    const automationLevel = TASK_TO_AUTOMATION_LEVEL[input.taskType];
    const asyncJobType = TASK_TO_JOB_TYPE[input.taskType];

    if (!automationLevel || !asyncJobType) {
      throw new BadRequestException(`Desteklenmeyen AI taskType: ${input.taskType}`);
    }

    const taskRun = await this.prisma.aiTaskRun.create({
      data: {
        tenantId: input.tenantId,
        taskType: input.taskType,
        status: AiTaskStatus.PENDING,
        automationLevel,
        candidateId: input.candidateId,
        jobId: input.jobId,
        applicationId: input.applicationId,
        sessionId: input.sessionId,
        aiReportId: input.aiReportId,
        promptTemplateId: input.promptTemplateId,
        rubricId: input.rubricId,
        inputJson: normalizedInput as Prisma.InputJsonValue,
        providerKey: selectedProvider,
        requestedBy: input.requestedBy,
        humanApprovedBy: input.humanApprovedBy
      }
    });

    const workflowJob = await this.asyncJobsService.create(input.tenantId, {
      type: asyncJobType,
      payload: {
        taskRunId: taskRun.id,
        taskType: input.taskType,
        candidateId: input.candidateId,
        jobId: input.jobId,
        applicationId: input.applicationId,
        sessionId: input.sessionId,
        input: normalizedInput
      },
      traceId: input.traceId
    });

    const updatedTaskRun = await this.prisma.aiTaskRun.update({
      where: { id: taskRun.id },
      data: {
        status: AiTaskStatus.QUEUED,
        workflowJobId: workflowJob.jobId
      }
    });

    if (input.taskType === AiTaskType.INTERVIEW_ORCHESTRATION) {
      await this.humanApprovalService.record({
        tenantId: input.tenantId,
        actionType: "ai.interview_orchestration.requested",
        entityType: "AiTaskRun",
        entityId: updatedTaskRun.id,
        requestedBy: input.requestedBy,
        approvedBy: input.humanApprovedBy ?? "",
        reasonCode: "interview_orchestration_requested",
        aiTaskRunId: updatedTaskRun.id,
        metadata: {
          taskType: input.taskType,
          workflowJobId: workflowJob.jobId
        }
      });
    }

    await this.domainEventsService.append({
      tenantId: input.tenantId,
      aggregateType: "AiTaskRun",
      aggregateId: updatedTaskRun.id,
      eventType: "ai.task_run.requested",
      traceId: input.traceId,
      payload: {
        taskType: input.taskType,
        workflowJobId: workflowJob.jobId,
        candidateId: input.candidateId,
        jobId: input.jobId,
        applicationId: input.applicationId,
        sessionId: input.sessionId,
        triggerSource,
        triggerReasonCode: input.triggerReasonCode
      }
    });

    await this.auditWriterService.write({
      tenantId: input.tenantId,
      actorUserId: input.requestedBy,
      action: "ai.task_run.requested",
      entityType: "AiTaskRun",
      entityId: updatedTaskRun.id,
      traceId: input.traceId,
      metadata: {
        taskType: input.taskType,
        automationLevel: updatedTaskRun.automationLevel,
        providerKey: selectedProvider,
        workflowJobId: workflowJob.jobId,
        candidateId: input.candidateId,
        jobId: input.jobId,
        applicationId: input.applicationId,
        sessionId: input.sessionId,
        triggerSource,
        triggerReasonCode: input.triggerReasonCode
      }
    });

    if (
      updatedTaskRun.applicationId &&
      (input.taskType === AiTaskType.REPORT_GENERATION ||
        input.taskType === AiTaskType.RECOMMENDATION_GENERATION)
    ) {
      const eventType =
        input.taskType === AiTaskType.REPORT_GENERATION
          ? "application.report.requested"
          : "application.recommendation.requested";

      const action =
        input.taskType === AiTaskType.REPORT_GENERATION
          ? "application.report.requested"
          : "application.recommendation.requested";

      await Promise.all([
        this.domainEventsService.append({
          tenantId: input.tenantId,
          aggregateType: "CandidateApplication",
          aggregateId: updatedTaskRun.applicationId,
          eventType,
          traceId: input.traceId,
          payload: {
            taskRunId: updatedTaskRun.id,
            applicationId: updatedTaskRun.applicationId,
            sessionId: updatedTaskRun.sessionId,
            requestedBy: input.requestedBy,
            triggerSource,
            triggerReasonCode: input.triggerReasonCode
          }
        }),
        this.auditWriterService.write({
          tenantId: input.tenantId,
          actorType:
            input.triggerSource === "system" ? AuditActorType.SYSTEM : AuditActorType.USER,
          actorUserId: input.requestedBy,
          action,
          entityType: "CandidateApplication",
          entityId: updatedTaskRun.applicationId,
          traceId: input.traceId,
          metadata: {
            taskRunId: updatedTaskRun.id,
            taskType: input.taskType,
            sessionId: updatedTaskRun.sessionId,
            triggerSource,
            triggerReasonCode: input.triggerReasonCode
          }
        })
      ]);
    }

    return {
      taskRunId: updatedTaskRun.id,
      taskType: updatedTaskRun.taskType,
      status: updatedTaskRun.status,
      automationLevel: updatedTaskRun.automationLevel,
      workflowJobId: updatedTaskRun.workflowJobId,
      createdAt: updatedTaskRun.createdAt.toISOString()
    };
  }

  async getTaskRun(tenantId: string, taskRunId: string) {
    const taskRun = await this.prisma.aiTaskRun.findFirst({
      where: {
        id: taskRunId,
        tenantId
      },
      include: {
        recommendations: {
          orderBy: {
            createdAt: "desc"
          },
          take: 3
        }
      }
    });

    if (!taskRun) {
      throw new NotFoundException("AI task run bulunamadi.");
    }

    return taskRun;
  }

  listTaskRuns(tenantId: string, filters?: { taskType?: AiTaskType; applicationId?: string }) {
    return this.prisma.aiTaskRun.findMany({
      where: {
        tenantId,
        ...(filters?.taskType ? { taskType: filters.taskType } : {}),
        ...(filters?.applicationId ? { applicationId: filters.applicationId } : {})
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100
    });
  }

  listProviders() {
    return this.aiProviderRegistry.listProviderKeys();
  }

  getProviderStatus() {
    return {
      defaultProvider: this.aiProviderRegistry.resolveDefaultProviderKey(),
      providers: this.aiProviderRegistry.listProviderStatuses()
    };
  }

  private async validateFeatureFlag(tenantId: string, taskType: AiTaskType) {
    const flagKey = TASK_TO_FLAG[taskType];

    if (!flagKey) {
      throw new BadRequestException(`Feature flag baglantisi bulunamadi: ${taskType}`);
    }

    const isEnabled = await this.featureFlagsService.isEnabled(tenantId, flagKey, false);

    if (!isEnabled) {
      throw new ForbiddenException(`Feature flag kapali: ${flagKey}`);
    }

    const autoRejectEnabled = await this.featureFlagsService.isEnabled(
      tenantId,
      "ai.auto_reject.enabled",
      false
    );

    if (autoRejectEnabled) {
      throw new ForbiddenException("V1 kurali: ai.auto_reject.enabled acik olamaz.");
    }
  }

  private async validateReferences(input: CreateAiTaskRunInput) {
    if (input.taskType === AiTaskType.CV_PARSING && !input.candidateId) {
      throw new BadRequestException(
        "CV_PARSING task'i icin candidateId zorunludur."
      );
    }

    if (input.taskType === AiTaskType.SCREENING_SUPPORT && !input.applicationId) {
      throw new BadRequestException(
        "SCREENING_SUPPORT task'i icin applicationId zorunludur."
      );
    }

    if (input.taskType === AiTaskType.REPORT_GENERATION && !input.applicationId) {
      throw new BadRequestException(
        "REPORT_GENERATION task'i icin applicationId zorunludur."
      );
    }

    if (input.taskType === AiTaskType.RECOMMENDATION_GENERATION && !input.applicationId) {
      throw new BadRequestException(
        "RECOMMENDATION_GENERATION task'i icin applicationId zorunludur."
      );
    }

    if (
      input.taskType === AiTaskType.TRANSCRIPT_SUMMARIZATION &&
      !input.sessionId
    ) {
      throw new BadRequestException(
        "TRANSCRIPT_SUMMARIZATION task'i icin sessionId zorunludur."
      );
    }

    if (
      !input.candidateId &&
      !input.jobId &&
      !input.applicationId &&
      !input.sessionId
    ) {
      throw new BadRequestException(
        "En az bir iliski alani zorunlu: candidateId/jobId/applicationId/sessionId."
      );
    }

    if (input.candidateId) {
      const candidate = await this.prisma.candidate.findFirst({
        where: {
          id: input.candidateId,
          tenantId: input.tenantId,
          deletedAt: null
        },
        select: { id: true }
      });

      if (!candidate) {
        throw new NotFoundException("Aday bulunamadi.");
      }
    }

    if (input.jobId) {
      const job = await this.prisma.job.findFirst({
        where: {
          id: input.jobId,
          tenantId: input.tenantId,
          archivedAt: null
        },
        select: { id: true }
      });

      if (!job) {
        throw new NotFoundException("Job bulunamadi.");
      }
    }

    if (input.applicationId) {
      const application = await this.prisma.candidateApplication.findFirst({
        where: {
          id: input.applicationId,
          tenantId: input.tenantId
        },
        select: {
          id: true,
          candidateId: true,
          jobId: true
        }
      });

      if (!application) {
        throw new NotFoundException("Application bulunamadi.");
      }

      if (input.candidateId && application.candidateId !== input.candidateId) {
        throw new BadRequestException(
          "candidateId verilen application ile ayni adaya ait olmalidir."
        );
      }

      if (input.jobId && application.jobId !== input.jobId) {
        throw new BadRequestException(
          "jobId verilen application ile ayni ilani isaret etmelidir."
        );
      }
    }

    if (input.sessionId) {
      const session = await this.prisma.interviewSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: input.tenantId
        },
        select: {
          id: true,
          applicationId: true
        }
      });

      if (!session) {
        throw new NotFoundException("Interview session bulunamadi.");
      }

      if (input.applicationId && session.applicationId !== input.applicationId) {
        throw new BadRequestException(
          "sessionId verilen application ile baglantili olmalidir."
        );
      }
    }

    if (input.aiReportId) {
      const report = await this.prisma.aiReport.findFirst({
        where: {
          id: input.aiReportId,
          tenantId: input.tenantId
        },
        select: { id: true }
      });

      if (!report) {
        throw new NotFoundException("AI report bulunamadi.");
      }
    }
  }
}
